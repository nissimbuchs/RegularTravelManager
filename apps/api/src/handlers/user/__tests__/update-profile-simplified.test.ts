import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock the database connection module
const mockQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn();

vi.mock('../../../database/connection', () => ({
  db: {
    connect: () => mockConnect(),
  },
}));

// Mock auth utils
const mockGetUserContextFromEvent = vi.fn();
vi.mock('../../auth/auth-utils', () => ({
  getUserContextFromEvent: () => mockGetUserContextFromEvent(),
}));

// Mock response formatter
const mockFormatResponse = vi.fn();
vi.mock('../../../middleware/response-formatter', () => ({
  formatResponse: (status: number, data: any, requestId: string) =>
    mockFormatResponse(status, data, requestId),
}));

// Mock geocoding service
const mockGeocodeAddress = vi.fn();
vi.mock('../../../services/geocoding-service', () => ({
  GeocodingService: class {
    geocodeAddress = mockGeocodeAddress;
  },
}));

// Mock request validator (allow passthrough)
vi.mock('../../../middleware/request-validator', () => ({
  validateRequest: () => (handler: any) => handler,
}));

import { updateProfileHandler } from '../update-profile';

describe('updateProfileHandler', () => {
  const mockContext: Context = {
    awsRequestId: 'test-request-id',
    functionName: 'test',
    functionVersion: '1',
    invokedFunctionArn: 'arn:test',
    memoryLimitInMB: '128',
    logGroupName: 'test-log-group',
    logStreamName: 'test-log-stream',
    getRemainingTimeInMillis: () => 1000,
    callbackWaitsForEmptyEventLoop: false,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
  };

  const mockClient = {
    query: mockQuery,
    release: mockRelease,
  };

  const mockUserContext = {
    cognitoUserId: 'test-user-123',
    email: 'test@example.com',
    role: 'employee',
  };

  const mockCurrentUser = {
    id: '123',
    cognito_user_id: 'test-user-123',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    employee_id: 'EMP-001',
    phone_number: '+41 79 123 45 67',
    role: 'employee',
    status: 'active',
    home_address: '123 Main St',
    home_city: 'Zurich',
    home_postal_code: '8001',
    home_country: 'Switzerland',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(mockClient);
    mockGetUserContextFromEvent.mockReturnValue(mockUserContext);
    mockFormatResponse.mockImplementation((status, data, requestId) => ({
      statusCode: status,
      body: JSON.stringify({ data, requestId }),
    }));
    mockGeocodeAddress.mockResolvedValue({
      latitude: 47.3769,
      longitude: 8.5417,
    });
  });

  describe('Basic functionality', () => {
    it('should update user first name', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'PUT',
        pathParameters: null,
        headers: {},
        body: JSON.stringify({
          firstName: 'Jane',
        }),
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      // Mock database responses
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockCurrentUser] }) // SELECT current user
        .mockResolvedValueOnce({ rows: [{ ...mockCurrentUser, first_name: 'Jane' }] }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }) // Audit insert
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await updateProfileHandler(mockEvent, mockContext);

      expect(mockQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockFormatResponse).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          success: true,
          profile: expect.objectContaining({
            firstName: 'Jane',
          }),
        }),
        'test-request-id'
      );
      expect(result.statusCode).toBe(200);
    });

    it('should reject unauthorized admin operations', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/admin/users/other-user-456',
        httpMethod: 'PUT',
        pathParameters: { userId: 'other-user-456' },
        headers: {},
        body: JSON.stringify({
          firstName: 'Jane',
        }),
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      // Non-admin user trying admin route
      mockGetUserContextFromEvent.mockReturnValue({
        ...mockUserContext,
        role: 'employee',
      });

      mockQuery.mockResolvedValueOnce({ rows: [] }); // BEGIN

      const result = await updateProfileHandler(mockEvent, mockContext);

      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockFormatResponse).toHaveBeenCalledWith(
        403,
        expect.objectContaining({
          code: 'FORBIDDEN',
        }),
        'test-request-id'
      );
      expect(result.statusCode).toBe(403);
    });

    it('should handle database errors gracefully', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'PUT',
        pathParameters: null,
        headers: {},
        body: JSON.stringify({
          firstName: 'Jane',
        }),
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      // Mock database error
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await updateProfileHandler(mockEvent, mockContext);

      expect(mockQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockFormatResponse).toHaveBeenCalledWith(
        500,
        expect.objectContaining({
          code: 'PROFILE_UPDATE_ERROR',
        }),
        'test-request-id'
      );
      expect(result.statusCode).toBe(500);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should geocode address updates', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'PUT',
        pathParameters: null,
        headers: {},
        body: JSON.stringify({
          homeAddress: {
            street: '456 New St',
            city: 'Geneva',
            postalCode: '1200',
            country: 'Switzerland',
          },
        }),
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockCurrentUser] }) // SELECT current user
        .mockResolvedValueOnce({
          rows: [
            {
              ...mockCurrentUser,
              home_address: '456 New St',
              home_city: 'Geneva',
              longitude: '6.1432',
              latitude: '46.2044',
            },
          ],
        }) // UPDATE with geocoded coordinates
        .mockResolvedValueOnce({ rows: [] }) // Audit insert
        .mockResolvedValueOnce({ rows: [] }) // Impact calculation
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await updateProfileHandler(mockEvent, mockContext);

      expect(mockGeocodeAddress).toHaveBeenCalledWith({
        street: '456 New St',
        city: 'Geneva',
        postalCode: '1200',
        country: 'Switzerland',
      });

      expect(mockFormatResponse).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          success: true,
        }),
        'test-request-id'
      );
      expect(result.statusCode).toBe(200);
    });

    it('should sanitize input to prevent XSS', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'PUT',
        pathParameters: null,
        headers: {},
        body: JSON.stringify({
          firstName: '<script>alert("XSS")</script>John',
          lastName: 'Doe<img src=x onerror=alert(1)>',
        }),
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockCurrentUser] }) // SELECT current user
        .mockResolvedValueOnce({
          rows: [
            {
              ...mockCurrentUser,
              first_name: 'John',
              last_name: 'Doe',
            },
          ],
        }) // UPDATE with sanitized values
        .mockResolvedValueOnce({ rows: [] }) // Audit insert
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await updateProfileHandler(mockEvent, mockContext);

      // Check that the UPDATE query was called with sanitized values
      const updateCall = mockQuery.mock.calls.find(call => call[0].includes('UPDATE employees'));
      expect(updateCall).toBeTruthy();
      expect(updateCall[1]).toContain('John'); // Sanitized without script tag
      expect(updateCall[1]).toContain('Doe'); // Sanitized without img tag

      expect(result.statusCode).toBe(200);
    });
  });
});
