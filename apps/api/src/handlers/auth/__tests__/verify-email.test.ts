import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../verify-email';
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

describe('Verify Email Handler', () => {
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
        verificationToken: 'valid-verification-token-12345678901234567890123456789012',
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

  it('should successfully verify email with valid token', async () => {
    // Mock service responses
    mockRegistrationService.prototype.validateVerificationToken.mockResolvedValue(true);
    mockRegistrationService.prototype.getRegistrationStatus.mockResolvedValue({
      isVerified: false,
      registrationComplete: false,
      accountEnabled: false,
    });
    mockCognitoService.prototype.getUserDetails.mockResolvedValue({
      username: 'test@example.com',
      userId: 'test-cognito-user-id',
      email: 'test@example.com',
      enabled: false,
      status: 'FORCE_CHANGE_PASSWORD',
      emailVerified: false,
      created: new Date(),
      lastModified: new Date(),
    });
    mockRegistrationService.prototype.markEmailVerified.mockResolvedValue(true);
    mockCognitoService.prototype.enableUserAfterVerification.mockResolvedValue(true);
    mockEmailService.prototype.sendWelcomeEmail.mockResolvedValue(true);
    mockRegistrationService.prototype.cleanupExpiredTokens.mockResolvedValue(5);

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({
      data: {
        success: true,
        message: expect.stringContaining('Email verified successfully'),
      },
    });

    // Verify services were called in correct order
    expect(mockRegistrationService.prototype.validateVerificationToken).toHaveBeenCalledWith(
      'test@example.com',
      'valid-verification-token-12345678901234567890123456789012'
    );
    expect(mockRegistrationService.prototype.markEmailVerified).toHaveBeenCalledWith(
      'test@example.com',
      'valid-verification-token-12345678901234567890123456789012'
    );
    expect(mockCognitoService.prototype.enableUserAfterVerification).toHaveBeenCalledWith(
      'test@example.com'
    );
    expect(mockEmailService.prototype.sendWelcomeEmail).toHaveBeenCalled();
  });

  it('should return 400 for invalid verification token', async () => {
    mockRegistrationService.prototype.validateVerificationToken.mockResolvedValue(false);

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
      error: {
        code: 'INVALID_TOKEN',
        message: expect.stringContaining('verification token is invalid or has expired'),
      },
    });
  });

  it('should return success for already verified email', async () => {
    mockRegistrationService.prototype.validateVerificationToken.mockResolvedValue(true);
    mockRegistrationService.prototype.getRegistrationStatus.mockResolvedValue({
      isVerified: true,
      registrationComplete: true,
      accountEnabled: true,
    });

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({
      data: {
        success: true,
        message: expect.stringContaining('already been verified'),
      },
    });

    // Should not call verification methods for already verified email
    expect(mockRegistrationService.prototype.markEmailVerified).not.toHaveBeenCalled();
    expect(mockCognitoService.prototype.enableUserAfterVerification).not.toHaveBeenCalled();
  });

  it('should return 400 when Cognito user not found', async () => {
    mockRegistrationService.prototype.validateVerificationToken.mockResolvedValue(true);
    mockRegistrationService.prototype.getRegistrationStatus.mockResolvedValue({
      isVerified: false,
      registrationComplete: false,
      accountEnabled: false,
    });
    mockCognitoService.prototype.getUserDetails.mockResolvedValue(null);

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User account not found. Please register again.',
      },
    });
  });

  it('should handle verification process failures gracefully', async () => {
    mockRegistrationService.prototype.validateVerificationToken.mockResolvedValue(true);
    mockRegistrationService.prototype.getRegistrationStatus.mockResolvedValue({
      isVerified: false,
      registrationComplete: false,
      accountEnabled: false,
    });
    mockCognitoService.prototype.getUserDetails.mockResolvedValue({
      username: 'test@example.com',
      userId: 'test-cognito-user-id',
      email: 'test@example.com',
      enabled: false,
      status: 'FORCE_CHANGE_PASSWORD',
      emailVerified: false,
      created: new Date(),
      lastModified: new Date(),
    });
    mockRegistrationService.prototype.markEmailVerified.mockRejectedValue(
      new Error('Database connection failed')
    );

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toMatchObject({
      error: {
        code: 'VERIFICATION_ERROR',
        message: expect.stringContaining('server error'),
      },
    });
  });

  it('should handle welcome email failure gracefully', async () => {
    mockRegistrationService.prototype.validateVerificationToken.mockResolvedValue(true);
    mockRegistrationService.prototype.getRegistrationStatus.mockResolvedValue({
      isVerified: false,
      registrationComplete: false,
      accountEnabled: false,
    });
    mockCognitoService.prototype.getUserDetails.mockResolvedValue({
      username: 'test@example.com',
      userId: 'test-cognito-user-id',
      email: 'test@example.com',
      enabled: false,
      status: 'FORCE_CHANGE_PASSWORD',
      emailVerified: false,
      created: new Date(),
      lastModified: new Date(),
    });
    mockRegistrationService.prototype.markEmailVerified.mockResolvedValue(true);
    mockCognitoService.prototype.enableUserAfterVerification.mockResolvedValue(true);
    mockEmailService.prototype.sendWelcomeEmail.mockResolvedValue(false);

    const result = await handler(mockEvent, mockContext);

    // Should still succeed even if welcome email fails
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({
      data: {
        success: true,
        message: expect.stringContaining('Email verified successfully'),
      },
    });
  });

  it('should validate input data', async () => {
    mockEvent.body = JSON.stringify({
      email: 'invalid-email-format',
      verificationToken: 'too-short',
    });

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid verification request data',
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

  it('should handle expired verification token', async () => {
    // Mock expired token validation
    mockRegistrationService.prototype.validateVerificationToken.mockResolvedValue(false);

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toMatchObject({
      error: {
        code: 'INVALID_TOKEN',
        message: expect.stringContaining('expired'),
      },
    });
  });

  it('should perform cleanup of expired tokens', async () => {
    mockRegistrationService.prototype.validateVerificationToken.mockResolvedValue(true);
    mockRegistrationService.prototype.getRegistrationStatus.mockResolvedValue({
      isVerified: false,
      registrationComplete: false,
      accountEnabled: false,
    });
    mockCognitoService.prototype.getUserDetails.mockResolvedValue({
      username: 'test@example.com',
      userId: 'test-cognito-user-id',
      email: 'test@example.com',
      enabled: false,
      status: 'FORCE_CHANGE_PASSWORD',
      emailVerified: false,
      created: new Date(),
      lastModified: new Date(),
    });
    mockRegistrationService.prototype.markEmailVerified.mockResolvedValue(true);
    mockCognitoService.prototype.enableUserAfterVerification.mockResolvedValue(true);
    mockEmailService.prototype.sendWelcomeEmail.mockResolvedValue(true);
    mockRegistrationService.prototype.cleanupExpiredTokens.mockResolvedValue(3);

    const result = await handler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    expect(mockRegistrationService.prototype.cleanupExpiredTokens).toHaveBeenCalled();
  });

  it('should handle cleanup failure gracefully', async () => {
    mockRegistrationService.prototype.validateVerificationToken.mockResolvedValue(true);
    mockRegistrationService.prototype.getRegistrationStatus.mockResolvedValue({
      isVerified: false,
      registrationComplete: false,
      accountEnabled: false,
    });
    mockCognitoService.prototype.getUserDetails.mockResolvedValue({
      username: 'test@example.com',
      userId: 'test-cognito-user-id',
      email: 'test@example.com',
      enabled: false,
      status: 'FORCE_CHANGE_PASSWORD',
      emailVerified: false,
      created: new Date(),
      lastModified: new Date(),
    });
    mockRegistrationService.prototype.markEmailVerified.mockResolvedValue(true);
    mockCognitoService.prototype.enableUserAfterVerification.mockResolvedValue(true);
    mockEmailService.prototype.sendWelcomeEmail.mockResolvedValue(true);
    mockRegistrationService.prototype.cleanupExpiredTokens.mockRejectedValue(
      new Error('Cleanup failed')
    );

    const result = await handler(mockEvent, mockContext);

    // Should still succeed even if cleanup fails
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({
      data: {
        success: true,
        message: expect.stringContaining('Email verified successfully'),
      },
    });
  });
});
