import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import {
  listUsersHandler,
  getUserDetailsHandler,
  updateUserStatusHandler,
  updateUserManagerHandler,
  deleteUserHandler,
} from '../user-management';
import { db } from '../../../database/connection';

// Mock dependencies
jest.mock('../../../database/connection');
jest.mock('../../../middleware/logger');

const mockDb = db as jest.Mocked<typeof db>;

describe('Admin User Management Handlers', () => {
  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2023/01/01/[$LATEST]test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };

  const mockAdminEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/api/admin/users',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: {
        sub: 'admin-user-id',
        email: 'admin@company.ch',
        isAdmin: 'true',
        isManager: 'false',
        groups: 'administrators',
      },
      connectedAt: 0,
      connectionId: '',
      domainName: 'api.example.com',
      domainPrefix: 'api',
      eventType: 'MESSAGE',
      extendedRequestId: 'test-extended-id',
      httpMethod: 'GET',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
        clientCert: null,
      },
      messageDirection: 'IN',
      messageId: 'test-message-id',
      path: '/api/admin/users',
      stage: 'test',
      requestId: 'test-request-id',
      requestTime: '01/Jan/2023:00:00:00 +0000',
      requestTimeEpoch: 1672531200,
      resourceId: 'resource-id',
      resourcePath: '/api/admin/users',
      routeKey: 'GET /api/admin/users',
    },
    resource: '/api/admin/users',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.query.mockReset();
    mockDb.disconnect = jest.fn().mockResolvedValue(undefined);
  });

  describe('listUsersHandler', () => {
    const mockUserData = [
      {
        id: '123',
        employee_id: 'EMP-001',
        cognito_user_id: 'cognito-123',
        email: 'john.doe@company.ch',
        first_name: 'John',
        last_name: 'Doe',
        manager_id: null,
        manager_name: null,
        is_active: true,
        created_at: new Date('2023-01-01'),
        updated_at: new Date('2023-01-01'),
        email_verified_at: new Date('2023-01-01'),
        phone_number: '+41781234567',
        role: 'employee',
        request_count: '5',
      },
    ];

    it('should list users successfully with default pagination', async () => {
      // Mock count query
      mockDb.query.mockResolvedValueOnce({
        rows: [{ total: '1' }],
      } as any);

      // Mock data query
      mockDb.query.mockResolvedValueOnce({
        rows: mockUserData,
      } as any);

      const event = mockAdminEvent({
        queryStringParameters: {},
      });

      const result = await listUsersHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.users).toHaveLength(1);
      expect(body.data.pagination.totalUsers).toBe(1);
      expect(body.data.pagination.currentPage).toBe(1);
      expect(body.data.pagination.pageSize).toBe(25);
    });

    it('should handle search filtering', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ total: '1' }] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: mockUserData } as any);

      const event = mockAdminEvent({
        queryStringParameters: {
          search: 'John',
          role: 'employee',
          status: 'active',
        },
      });

      const result = await listUsersHandler(event, mockContext);

      expect(result.statusCode).toBe(200);

      // Verify that search parameters were used in query
      const countCall = mockDb.query.mock.calls[0];
      const dataCall = mockDb.query.mock.calls[1];

      expect(countCall[1]).toEqual(['%John%', '%John%', '%John%', '%John%']);
      expect(dataCall[1]).toEqual(['%John%', '%John%', '%John%', '%John%', 25, 0]);
    });

    it('should handle pagination parameters', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ total: '50' }] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: mockUserData } as any);

      const event = mockAdminEvent({
        queryStringParameters: {
          page: '2',
          pageSize: '10',
        },
      });

      const result = await listUsersHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.pagination.currentPage).toBe(2);
      expect(body.data.pagination.pageSize).toBe(10);
      expect(body.data.pagination.totalPages).toBe(5);
    });

    it('should require admin access', async () => {
      const event = mockAdminEvent({
        requestContext: {
          ...mockAdminEvent().requestContext,
          authorizer: {
            sub: 'user-id',
            email: 'user@company.ch',
            isAdmin: 'false',
            isManager: 'true',
            groups: 'managers',
          },
        },
      });

      const result = await listUsersHandler(event, mockContext);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AdminAccessError');
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const event = mockAdminEvent();
      const result = await listUsersHandler(event, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Internal server error');
    });
  });

  describe('getUserDetailsHandler', () => {
    const mockUserDetailData = {
      id: '123',
      employee_id: 'EMP-001',
      cognito_user_id: 'cognito-123',
      email: 'john.doe@company.ch',
      first_name: 'John',
      last_name: 'Doe',
      phone_number: '+41781234567',
      role: 'employee',
      home_street: 'Musterstrasse 1',
      home_city: 'Zürich',
      home_postal_code: '8001',
      home_country: 'Switzerland',
      manager_id: null,
      manager_name: null,
      is_active: true,
      created_at: new Date('2023-01-01'),
      updated_at: new Date('2023-01-01'),
      email_verified_at: new Date('2023-01-01'),
      notification_preferences: { email: true },
      total_requests: '5',
      requests_this_month: '2',
      average_request_value: '150.50',
      last_request_date: new Date('2023-01-15'),
    };

    it('should get user details successfully', async () => {
      // Mock user query
      mockDb.query.mockResolvedValueOnce({
        rows: [mockUserDetailData],
      } as any);

      // Mock reports query
      mockDb.query.mockResolvedValueOnce({
        rows: [],
      } as any);

      // Mock recent requests query
      mockDb.query.mockResolvedValueOnce({
        rows: [],
      } as any);

      const event = mockAdminEvent({
        pathParameters: { userId: '123' },
        path: '/api/admin/users/123',
      });

      const result = await getUserDetailsHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('123');
      expect(body.data.firstName).toBe('John');
      expect(body.data.lastName).toBe('Doe');
    });

    it('should return 404 for non-existent user', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [],
      } as any);

      const event = mockAdminEvent({
        pathParameters: { userId: '999' },
        path: '/api/admin/users/999',
      });

      const result = await getUserDetailsHandler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should require userId parameter', async () => {
      const event = mockAdminEvent({
        pathParameters: null,
      });

      const result = await getUserDetailsHandler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MISSING_USER_ID');
    });
  });

  describe('updateUserStatusHandler', () => {
    const mockUser = {
      id: '123',
      first_name: 'John',
      last_name: 'Doe',
      is_active: true,
    };

    const mockUpdatedUser = {
      id: '123',
      first_name: 'John',
      last_name: 'Doe',
      is_active: false,
      updated_at: new Date('2023-01-01'),
    };

    it('should update user status successfully', async () => {
      // Mock user check
      mockDb.query.mockResolvedValueOnce({
        rows: [mockUser],
      } as any);

      // Mock transaction
      mockDb.query.mockResolvedValueOnce(undefined); // BEGIN

      // Mock update
      mockDb.query.mockResolvedValueOnce({
        rows: [mockUpdatedUser],
      } as any);

      // Mock audit insert
      mockDb.query.mockResolvedValueOnce(undefined);

      // Mock commit
      mockDb.query.mockResolvedValueOnce(undefined); // COMMIT

      const event = mockAdminEvent({
        httpMethod: 'PUT',
        pathParameters: { userId: '123' },
        body: JSON.stringify({
          isActive: false,
          reason: 'Account suspended',
        }),
      });

      const result = await updateUserStatusHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.isActive).toBe(false);
    });

    it('should validate request body', async () => {
      const event = mockAdminEvent({
        httpMethod: 'PUT',
        pathParameters: { userId: '123' },
        body: JSON.stringify({
          isActive: 'invalid',
        }),
      });

      const result = await updateUserStatusHandler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_STATUS');
    });

    it('should handle invalid JSON', async () => {
      const event = mockAdminEvent({
        httpMethod: 'PUT',
        pathParameters: { userId: '123' },
        body: 'invalid json',
      });

      const result = await updateUserStatusHandler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_JSON');
    });
  });

  describe('updateUserManagerHandler', () => {
    const mockUser = {
      id: '123',
      first_name: 'John',
      last_name: 'Doe',
      manager_id: null,
    };

    const mockManager = {
      id: '456',
      first_name: 'Jane',
      last_name: 'Smith',
    };

    it('should update user manager successfully', async () => {
      // Mock user check
      mockDb.query.mockResolvedValueOnce({
        rows: [mockUser],
      } as any);

      // Mock manager check
      mockDb.query.mockResolvedValueOnce({
        rows: [mockManager],
      } as any);

      // Mock update
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: '123',
            first_name: 'John',
            last_name: 'Doe',
            manager_id: '456',
            updated_at: new Date('2023-01-01'),
          },
        ],
      } as any);

      // Mock manager name lookup
      mockDb.query.mockResolvedValueOnce({
        rows: [mockManager],
      } as any);

      const event = mockAdminEvent({
        httpMethod: 'PUT',
        pathParameters: { userId: '123' },
        body: JSON.stringify({
          managerId: '456',
        }),
      });

      const result = await updateUserManagerHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.managerId).toBe('456');
    });

    it('should prevent circular reference', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [mockUser],
      } as any);

      const event = mockAdminEvent({
        httpMethod: 'PUT',
        pathParameters: { userId: '123' },
        body: JSON.stringify({
          managerId: '123', // Same as user ID
        }),
      });

      const result = await updateUserManagerHandler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('CIRCULAR_REFERENCE');
    });

    it('should handle invalid manager', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [mockUser],
      } as any);

      mockDb.query.mockResolvedValueOnce({
        rows: [], // Manager not found
      } as any);

      const event = mockAdminEvent({
        httpMethod: 'PUT',
        pathParameters: { userId: '123' },
        body: JSON.stringify({
          managerId: '999',
        }),
      });

      const result = await updateUserManagerHandler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_MANAGER');
    });
  });

  describe('deleteUserHandler', () => {
    const mockUser = {
      id: '123',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@company.ch',
      is_active: true,
    };

    const mockCleanupSummary = {
      user_id: '123',
      travel_requests_archived: 5,
      audit_records_preserved: 10,
      direct_reports_updated: 2,
      deleted_at: new Date('2023-01-01'),
    };

    it('should delete user successfully', async () => {
      // Mock user check
      mockDb.query.mockResolvedValueOnce({
        rows: [mockUser],
      } as any);

      // Mock transaction
      mockDb.query.mockResolvedValueOnce(undefined); // BEGIN

      // Mock cleanup function
      mockDb.query.mockResolvedValueOnce({
        rows: [{ cleanup_summary: mockCleanupSummary }],
      } as any);

      // Mock commit
      mockDb.query.mockResolvedValueOnce(undefined); // COMMIT

      const event = mockAdminEvent({
        httpMethod: 'DELETE',
        pathParameters: { userId: '123' },
        body: JSON.stringify({
          reason: 'Employee departure',
        }),
      });

      const result = await deleteUserHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.userId).toBe('123');
      expect(body.data.travelRequestsArchived).toBe(5);
    });

    it('should require deletion reason', async () => {
      const event = mockAdminEvent({
        httpMethod: 'DELETE',
        pathParameters: { userId: '123' },
        body: JSON.stringify({
          reason: '',
        }),
      });

      const result = await deleteUserHandler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MISSING_REASON');
    });

    it('should validate reassignment target', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [mockUser],
      } as any);

      mockDb.query.mockResolvedValueOnce({
        rows: [], // Reassignment target not found
      } as any);

      const event = mockAdminEvent({
        httpMethod: 'DELETE',
        pathParameters: { userId: '123' },
        body: JSON.stringify({
          reason: 'Employee departure',
          reassignRequestsTo: '999',
        }),
      });

      const result = await deleteUserHandler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_REASSIGN_TARGET');
    });
  });
});
