import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { updateProfileHandler } from '../update-profile';
import { db } from '../../../database/connection';
import { getUserContextFromEvent } from '../../auth/auth-utils';
import { formatResponse } from '../../../middleware/response-formatter';
import { GeocodingService } from '../../../services/geocoding-service';

// Mock dependencies
const mockQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn();

vi.mock('../../../database/connection', () => ({
  db: {
    connect: mockConnect,
    query: mockQuery,
  },
}));

vi.mock('../../auth/auth-utils', () => ({
  getUserContextFromEvent: vi.fn(),
}));

vi.mock('../../../middleware/response-formatter', () => ({
  formatResponse: vi.fn(),
}));

vi.mock('../../../services/geocoding-service', () => ({
  GeocodingService: vi.fn().mockImplementation(() => ({
    geocodeAddress: vi.fn(),
  })),
}));

describe('updateProfileHandler', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test',
    functionVersion: '1',
    invokedFunctionArn: 'arn:test',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: 'test-log-group',
    logStreamName: 'test-log-stream',
    getRemainingTimeInMillis: () => 1000,
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
    const { getUserContextFromEvent } = await import('../../auth/auth-utils');
    const { formatResponse } = await import('../../../middleware/response-formatter');
    vi.mocked(getUserContextFromEvent).mockReturnValue(mockUserContext);
    vi.mocked(formatResponse).mockImplementation((status, data, requestId) => ({
      statusCode: status,
      body: JSON.stringify({ data, requestId }),
    }));
    const mockGeocodingService = new (
      await import('../../../services/geocoding-service')
    ).GeocodingService();
    vi.mocked(mockGeocodingService.geocodeAddress).mockResolvedValue({
      latitude: 47.3769,
      longitude: 8.5417,
    });
  });

  describe('Input validation', () => {
    it('should validate phone number format', async () => {
      const invalidPhoneNumbers = ['abc123', '12345', 'phone'];

      for (const invalidPhone of invalidPhoneNumbers) {
        const mockEvent: APIGatewayProxyEvent = {
          path: '/api/user/profile',
          httpMethod: 'PUT',
          pathParameters: null,
          headers: {},
          body: JSON.stringify({
            phoneNumber: invalidPhone,
          }),
          isBase64Encoded: false,
          queryStringParameters: null,
          multiValueHeaders: {},
          multiValueQueryStringParameters: null,
          stageVariables: null,
          requestContext: {} as any,
          resource: '',
        };

        const result = await updateProfileHandler(mockEvent, mockContext);

        // Validation middleware should catch this
        expect(result.statusCode).toBe(400);
      }
    });

    it('should accept valid phone numbers', async () => {
      const validPhoneNumbers = [
        '+41 79 123 45 67',
        '+41791234567',
        '079 123 45 67',
        '(079) 123-4567',
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockCurrentUser] }) // Current user
        .mockResolvedValueOnce({ rows: [{ ...mockCurrentUser, phone_number: '+41 79 123 45 67' }] }) // Updated user
        .mockResolvedValueOnce({ rows: [] }); // Insert audit

      for (const validPhone of validPhoneNumbers) {
        const mockEvent: APIGatewayProxyEvent = {
          path: '/api/user/profile',
          httpMethod: 'PUT',
          pathParameters: null,
          headers: {},
          body: JSON.stringify({
            phoneNumber: validPhone,
          }),
          isBase64Encoded: false,
          queryStringParameters: null,
          multiValueHeaders: {},
          multiValueQueryStringParameters: null,
          stageVariables: null,
          requestContext: {} as any,
          resource: '',
        };

        const result = await updateProfileHandler(mockEvent, mockContext);

        expect(result.statusCode).toBe(200);
        vi.clearAllMocks();
        mockClient.query
          .mockResolvedValueOnce({ rows: [mockCurrentUser] })
          .mockResolvedValueOnce({ rows: [{ ...mockCurrentUser, phone_number: validPhone }] })
          .mockResolvedValueOnce({ rows: [] });
      }
    });

    it('should sanitize text inputs to prevent XSS', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'PUT',
        pathParameters: null,
        headers: {},
        body: JSON.stringify({
          firstName: '<script>alert("XSS")</script>John',
          lastName: 'Doe<img src=x onerror=alert("XSS")>',
        }),
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockCurrentUser] })
        .mockResolvedValueOnce({ rows: [mockCurrentUser] })
        .mockResolvedValueOnce({ rows: [] });

      await updateProfileHandler(mockEvent, mockContext);

      // Check that the update query was called with sanitized values
      const updateCall = mockClient.query.mock.calls.find(call =>
        call[0].includes('UPDATE employees')
      );

      expect(updateCall).toBeDefined();
      // The values should be properly escaped or rejected
      expect(updateCall[1]).not.toContain('<script>');
      expect(updateCall[1]).not.toContain('onerror=');
    });

    it('should validate notification preferences structure', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'PUT',
        pathParameters: null,
        headers: {},
        body: JSON.stringify({
          notificationPreferences: {
            email: 'not-a-boolean', // Invalid
            requestUpdates: true,
            invalidField: 'test', // Extra field
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

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockCurrentUser] })
        .mockResolvedValueOnce({ rows: [mockCurrentUser] })
        .mockResolvedValueOnce({ rows: [] });

      await updateProfileHandler(mockEvent, mockContext);

      const updateCall = mockClient.query.mock.calls.find(call =>
        call[0].includes('UPDATE employees')
      );

      if (updateCall) {
        const notifPrefsIndex = updateCall[0].includes('notification_preferences');
        if (notifPrefsIndex) {
          const jsonValue = updateCall[1].find(
            (val: any) => typeof val === 'string' && val.includes('email')
          );
          if (jsonValue) {
            const parsed = JSON.parse(jsonValue);
            expect(typeof parsed.email).toBe('boolean');
            expect(parsed.invalidField).toBeUndefined();
          }
        }
      }
    });
  });

  describe('User profile updates', () => {
    it('should allow users to update their own profile', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'PUT',
        pathParameters: null,
        headers: {},
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Smith',
          phoneNumber: '+41 79 987 65 43',
        }),
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockCurrentUser] })
        .mockResolvedValueOnce({
          rows: [
            {
              ...mockCurrentUser,
              first_name: 'Jane',
              last_name: 'Smith',
              phone_number: '+41 79 987 65 43',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // Audit insert

      const result = await updateProfileHandler(mockEvent, mockContext);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(result.statusCode).toBe(200);
    });

    it('should prevent users from updating restricted fields', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'PUT',
        pathParameters: null,
        headers: {},
        body: JSON.stringify({
          email: 'newemail@example.com', // Restricted
          role: 'administrator', // Restricted
          status: 'inactive', // Restricted
        }),
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await updateProfileHandler(mockEvent, mockContext);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(formatResponse).toHaveBeenCalledWith(
        403,
        expect.objectContaining({
          code: 'FORBIDDEN',
          message: 'Cannot update restricted fields. Contact administrator for changes.',
        }),
        'test-request-id'
      );
      expect(result.statusCode).toBe(403);
    });
  });

  describe('Admin profile updates', () => {
    it('should allow admins to update any user profile', async () => {
      const adminContext = {
        ...mockUserContext,
        role: 'administrator',
      };

      vi.mocked(getUserContextFromEvent).mockReturnValue(adminContext);

      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/admin/users/target-user-456',
        httpMethod: 'PUT',
        pathParameters: { userId: 'target-user-456' },
        headers: {},
        body: JSON.stringify({
          firstName: 'Updated',
          email: 'updated@example.com',
          role: 'manager',
          status: 'active',
        }),
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ ...mockCurrentUser, cognito_user_id: 'target-user-456' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              ...mockCurrentUser,
              cognito_user_id: 'target-user-456',
              first_name: 'Updated',
              email: 'updated@example.com',
              role: 'manager',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await updateProfileHandler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should deny non-admins from admin endpoints', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/admin/users/target-user-456',
        httpMethod: 'PUT',
        pathParameters: { userId: 'target-user-456' },
        headers: {},
        body: JSON.stringify({
          firstName: 'Hacker',
        }),
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await updateProfileHandler(mockEvent, mockContext);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(result.statusCode).toBe(403);
    });
  });

  describe('Address updates and geocoding', () => {
    it('should geocode new addresses', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'PUT',
        pathParameters: null,
        headers: {},
        body: JSON.stringify({
          homeAddress: {
            street: '456 New Street',
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

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockCurrentUser] })
        .mockResolvedValueOnce({
          rows: [
            {
              ...mockCurrentUser,
              home_address: '456 New Street',
              home_city: 'Geneva',
              longitude: '6.1432',
              latitude: '46.2044',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }); // Impact calculation

      const result = await updateProfileHandler(mockEvent, mockContext);

      expect(GeocodingService.prototype.geocodeAddress).toHaveBeenCalledWith({
        street: '456 New Street',
        city: 'Geneva',
        postalCode: '1200',
        country: 'Switzerland',
      });
      expect(result.statusCode).toBe(200);
    });

    it('should calculate impact on travel requests', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'PUT',
        pathParameters: null,
        headers: {},
        body: JSON.stringify({
          homeAddress: {
            street: '789 Far Street',
            city: 'Lugano',
            postalCode: '6900',
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

      const mockImpactRequests = [
        {
          request_id: 'req-1',
          old_distance: 50,
          old_allowance: 100,
          project_name: 'Project A',
          cost_per_km: 2,
          days_per_week: 5,
          new_distance: 75,
        },
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockCurrentUser] })
        .mockResolvedValueOnce({
          rows: [
            {
              ...mockCurrentUser,
              home_address: '789 Far Street',
              longitude: '8.9511',
              latitude: '46.0037',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: mockImpactRequests });

      const result = await updateProfileHandler(mockEvent, mockContext);
      const response = JSON.parse(result.body);

      expect(response.data.addressChangeImpact).toBeDefined();
      expect(response.data.addressChangeImpact.affectedRequests).toBe(1);
      expect(response.data.addressChangeImpact.distanceChanges).toHaveLength(1);
      expect(result.statusCode).toBe(200);
    });

    it('should handle geocoding failures gracefully', async () => {
      vi.mocked(GeocodingService.prototype.geocodeAddress).mockRejectedValue(
        new Error('Geocoding service unavailable')
      );

      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'PUT',
        pathParameters: null,
        headers: {},
        body: JSON.stringify({
          homeAddress: {
            street: 'Invalid Street',
            city: 'Unknown',
            postalCode: '0000',
            country: 'Nowhere',
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

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockCurrentUser] })
        .mockResolvedValueOnce({
          rows: [
            {
              ...mockCurrentUser,
              home_address: 'Invalid Street',
              home_city: 'Unknown',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await updateProfileHandler(mockEvent, mockContext);

      // Should continue without coordinates
      expect(result.statusCode).toBe(200);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('Audit trail', () => {
    it('should create audit records for all changes', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'PUT',
        pathParameters: null,
        headers: {
          'User-Agent': 'TestBrowser/1.0',
        },
        body: JSON.stringify({
          firstName: 'Audited',
          lastName: 'User',
        }),
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {
          identity: {
            sourceIp: '192.168.1.1',
          },
        } as any,
        resource: '',
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockCurrentUser] })
        .mockResolvedValueOnce({
          rows: [
            {
              ...mockCurrentUser,
              first_name: 'Audited',
              last_name: 'User',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      await updateProfileHandler(mockEvent, mockContext);

      // Find the audit insert query
      const auditCall = mockClient.query.mock.calls.find(call =>
        call[0].includes('INSERT INTO employee_profile_history')
      );

      expect(auditCall).toBeDefined();
      expect(auditCall[1]).toContain('["firstName","lastName"]'); // Changed fields
      expect(auditCall[1][5]).toBe('192.168.1.1'); // IP address
      expect(auditCall[1][6]).toBe('TestBrowser/1.0'); // User agent
    });
  });

  describe('Transaction handling', () => {
    it('should rollback on errors', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'PUT',
        pathParameters: null,
        headers: {},
        body: JSON.stringify({
          firstName: 'Error',
        }),
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockCurrentUser] })
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await updateProfileHandler(mockEvent, mockContext);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(result.statusCode).toBe(500);
    });

    it('should release connection on success', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'PUT',
        pathParameters: null,
        headers: {},
        body: JSON.stringify({
          firstName: 'Success',
        }),
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockCurrentUser] })
        .mockResolvedValueOnce({ rows: [mockCurrentUser] })
        .mockResolvedValueOnce({ rows: [] });

      await updateProfileHandler(mockEvent, mockContext);

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release connection on error', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'PUT',
        pathParameters: null,
        headers: {},
        body: JSON.stringify({
          firstName: 'Error',
        }),
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      mockClient.query.mockRejectedValueOnce(new Error('Connection error'));

      await updateProfileHandler(mockEvent, mockContext);

      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
