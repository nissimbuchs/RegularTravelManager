import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../register-user';
import { RegistrationService } from '../../../services/registration.service';
import { CognitoRegistrationService } from '../../../services/cognito-registration.service';
import { EmailService } from '../../../services/email.service';

// Mock the services
jest.mock('../../../services/registration.service');
jest.mock('../../../services/cognito-registration.service');
jest.mock('../../../services/email.service');
jest.mock('../../../middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockRegistrationService = RegistrationService as jest.MockedClass<typeof RegistrationService>;
const mockCognitoService = CognitoRegistrationService as jest.MockedClass<
  typeof CognitoRegistrationService
>;
const mockEmailService = EmailService as jest.MockedClass<typeof EmailService>;

describe('Register User Handler', () => {
  let mockEvent: APIGatewayProxyEvent;
  let mockContext: Context;

  beforeEach(() => {
    mockContext = {
      requestId: 'test-request-id',
      awsRequestId: 'test-aws-request-id',
    } as Context;

    mockEvent = {
      httpMethod: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:4200',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPass123!',
        firstName: 'John',
        lastName: 'Doe',
        homeAddress: {
          street: 'Bahnhofstrasse 1',
          city: 'Zürich',
          postalCode: '8001',
          country: 'Switzerland',
        },
        acceptTerms: true,
        acceptPrivacy: true,
      }),
      requestContext: {
        requestId: 'test-request-id',
        identity: {
          sourceIp: '127.0.0.1',
        },
      },
    } as unknown as APIGatewayProxyEvent;

    jest.clearAllMocks();
  });

  it('should successfully register a new user', async () => {
    // Mock service responses
    mockCognitoService.prototype.emailExists.mockResolvedValue(false);
    mockRegistrationService.prototype.checkEmailExists.mockResolvedValue({
      cognito: false,
      database: false,
    });
    mockRegistrationService.prototype.geocodeAddress.mockResolvedValue({
      latitude: 47.3769,
      longitude: 8.5417,
    });
    mockCognitoService.prototype.createRegistrationUser.mockResolvedValue({
      userId: 'test-cognito-user-id',
      username: 'test@example.com',
      isEnabled: false,
      needsPasswordReset: false,
    });
    mockRegistrationService.prototype.createEmployeeRecord.mockResolvedValue({
      id: 'test-employee-id',
      cognitoUserId: 'test-cognito-user-id',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      homeAddress: 'Bahnhofstrasse 1, Zürich, 8001, Switzerland',
      homeCoordinates: { x: 8.5417, y: 47.3769 },
      role: 'employee',
      isActive: false,
      registeredAt: new Date(),
    });
    mockRegistrationService.prototype.generateVerificationToken.mockReturnValue({
      token: 'mock-verification-token',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    mockRegistrationService.prototype.createVerificationToken.mockResolvedValue({
      id: 'test-token-id',
      email: 'test@example.com',
      token: 'mock-verification-token',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });
    mockEmailService.prototype.sendVerificationEmail.mockResolvedValue(true);

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toMatchObject({
      data: {
        userId: 'test-cognito-user-id',
        email: 'test@example.com',
        verificationRequired: true,
        message: expect.stringContaining('Registration successful'),
      },
    });

    // Verify services were called
    expect(mockCognitoService.prototype.emailExists).toHaveBeenCalledWith('test@example.com');
    expect(mockRegistrationService.prototype.checkEmailExists).toHaveBeenCalledWith(
      'test@example.com'
    );
    expect(mockRegistrationService.prototype.geocodeAddress).toHaveBeenCalled();
    expect(mockCognitoService.prototype.createRegistrationUser).toHaveBeenCalled();
    expect(mockRegistrationService.prototype.createEmployeeRecord).toHaveBeenCalled();
    expect(mockEmailService.prototype.sendVerificationEmail).toHaveBeenCalledWith(
      'test@example.com',
      'John',
      'mock-verification-token'
    );
  });

  it('should return 400 for duplicate email', async () => {
    mockCognitoService.prototype.emailExists.mockResolvedValue(true);

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
      error: {
        code: 'EMAIL_EXISTS',
        message: expect.stringContaining('already exists'),
      },
    });
  });

  it('should return 400 for invalid input data', async () => {
    mockEvent.body = JSON.stringify({
      email: 'invalid-email',
      password: 'weak',
      firstName: '',
      lastName: 'Doe',
      homeAddress: {
        street: 'Bahnhofstrasse 1',
        city: 'Zürich',
        postalCode: '12345', // Invalid Swiss postal code
        country: 'Switzerland',
      },
      acceptTerms: false,
      acceptPrivacy: true,
    });

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid registration data',
      },
    });
  });

  it('should return 429 for rate limit exceeded', async () => {
    // Mock multiple rapid requests from same IP
    mockEvent.requestContext.identity.sourceIp = '192.168.1.1';

    // First few requests should pass until rate limit is hit
    // This test simulates hitting the rate limit
    const promises = Array(10)
      .fill(null)
      .map(async () => {
        const clonedEvent = { ...mockEvent };
        return handler(clonedEvent, mockContext);
      });

    const results = await Promise.all(promises);

    // Some requests should be rate limited
    const rateLimitedResults = results.filter(r => r.statusCode === 429);
    expect(rateLimitedResults.length).toBeGreaterThan(0);

    if (rateLimitedResults.length > 0) {
      expect(JSON.parse(rateLimitedResults[0].body)).toMatchObject({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: expect.stringContaining('Too many requests'),
        },
      });
    }
  });

  it('should handle geocoding failure gracefully', async () => {
    mockCognitoService.prototype.emailExists.mockResolvedValue(false);
    mockRegistrationService.prototype.checkEmailExists.mockResolvedValue({
      cognito: false,
      database: false,
    });
    mockRegistrationService.prototype.geocodeAddress.mockRejectedValue(
      new Error('Invalid address or geocoding failed')
    );

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
      error: {
        code: 'GEOCODING_ERROR',
        message: expect.stringContaining('Invalid address'),
      },
    });
  });

  it('should handle CORS preflight requests', async () => {
    mockEvent.httpMethod = 'OPTIONS';

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toHaveProperty('Access-Control-Allow-Origin');
    expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
    expect(result.headers).toHaveProperty('Access-Control-Allow-Headers');
  });

  it('should handle email service failure', async () => {
    // Mock successful setup until email sending
    mockCognitoService.prototype.emailExists.mockResolvedValue(false);
    mockRegistrationService.prototype.checkEmailExists.mockResolvedValue({
      cognito: false,
      database: false,
    });
    mockRegistrationService.prototype.geocodeAddress.mockResolvedValue({
      latitude: 47.3769,
      longitude: 8.5417,
    });
    mockCognitoService.prototype.createRegistrationUser.mockResolvedValue({
      userId: 'test-cognito-user-id',
      username: 'test@example.com',
      isEnabled: false,
      needsPasswordReset: false,
    });
    mockRegistrationService.prototype.createEmployeeRecord.mockResolvedValue({
      id: 'test-employee-id',
      cognitoUserId: 'test-cognito-user-id',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      homeAddress: 'Bahnhofstrasse 1, Zürich, 8001, Switzerland',
      role: 'employee',
      isActive: false,
      registeredAt: new Date(),
    });
    mockRegistrationService.prototype.generateVerificationToken.mockReturnValue({
      token: 'mock-verification-token',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    mockRegistrationService.prototype.createVerificationToken.mockResolvedValue({
      id: 'test-token-id',
      email: 'test@example.com',
      token: 'mock-verification-token',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });
    mockEmailService.prototype.sendVerificationEmail.mockResolvedValue(false);

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toMatchObject({
      error: {
        code: 'REGISTRATION_ERROR',
        message: expect.stringContaining('server error'),
      },
    });
  });

  it('should validate password strength requirements', async () => {
    mockEvent.body = JSON.stringify({
      email: 'test@example.com',
      password: 'weakpassword', // No uppercase, number, or special character
      firstName: 'John',
      lastName: 'Doe',
      homeAddress: {
        street: 'Bahnhofstrasse 1',
        city: 'Zürich',
        postalCode: '8001',
        country: 'Switzerland',
      },
      acceptTerms: true,
      acceptPrivacy: true,
    });

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid registration data',
      },
    });
  });

  it('should validate Swiss postal code format', async () => {
    mockEvent.body = JSON.stringify({
      email: 'test@example.com',
      password: 'TestPass123!',
      firstName: 'John',
      lastName: 'Doe',
      homeAddress: {
        street: 'Bahnhofstrasse 1',
        city: 'Zürich',
        postalCode: '12345', // 5 digits - invalid for Switzerland
        country: 'Switzerland',
      },
      acceptTerms: true,
      acceptPrivacy: true,
    });

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid registration data',
      },
    });
  });

  it('should require terms and privacy acceptance', async () => {
    mockEvent.body = JSON.stringify({
      email: 'test@example.com',
      password: 'TestPass123!',
      firstName: 'John',
      lastName: 'Doe',
      homeAddress: {
        street: 'Bahnhofstrasse 1',
        city: 'Zürich',
        postalCode: '8001',
        country: 'Switzerland',
      },
      acceptTerms: false, // Not accepted
      acceptPrivacy: false, // Not accepted
    });

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid registration data',
      },
    });
  });
});
