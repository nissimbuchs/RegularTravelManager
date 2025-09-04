import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import {
  listUsersHandler,
  updateUserStatusHandler,
  updateUserManagerHandler,
} from '../../handlers/admin/user-management';

// Mock database connection
const mockQuery = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

vi.mock('../../database/connection', () => ({
  DatabaseConnection: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    disconnect: mockDisconnect,
    query: mockQuery,
  })),
}));

// Mock logger
vi.mock('../../middleware/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock CORS
vi.mock('../../middleware/cors', () => ({
  withCors: vi.fn(response => response),
}));

describe('Admin User Management', () => {
  let mockContext: Context;
  let adminEvent: APIGatewayProxyEvent;
  let nonAdminEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      awsRequestId: 'test-request-id',
      functionName: 'test-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
      memoryLimitInMB: '128',
      getRemainingTimeInMillis: () => 30000,
      logGroupName: '/aws/lambda/test-function',
      logStreamName: '2023/01/01/[$LATEST]abcdef',
      callbackWaitsForEmptyEventLoop: true,
      done: vi.fn(),
      fail: vi.fn(),
      succeed: vi.fn(),
    };

    adminEvent = {
      body: null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/admin/users',
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
          isManager: 'true',
          groups: JSON.stringify(['administrators', 'managers']),
        },
        protocol: 'HTTP/1.1',
        httpMethod: 'GET',
        path: '/admin/users',
        stage: 'dev',
        requestId: 'test-request-id',
        requestTime: '01/Jan/2023:12:00:00 +0000',
        requestTimeEpoch: 1672574400,
        resourceId: 'resource-id',
        resourcePath: '/admin/users',
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
      },
      resource: '/admin/users',
    };

    nonAdminEvent = {
      ...adminEvent,
      requestContext: {
        ...adminEvent.requestContext,
        authorizer: {
          sub: 'regular-user-id',
          email: 'employee@company.ch',
          isAdmin: 'false',
          isManager: 'false',
          groups: JSON.stringify(['employees']),
        },
      },
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('listUsersHandler', () => {
    it('should successfully list users for admin', async () => {
      const mockUsers = [
        {
          id: '11111111-1111-1111-1111-111111111111',
          employee_id: 'ADM-0001',
          cognito_user_id: 'admin1@company.ch',
          email: 'admin1@company.ch',
          first_name: 'Hans',
          last_name: 'Zimmermann',
          home_street: 'Bahnhofstrasse 1',
          home_city: 'Zürich',
          home_postal_code: '8001',
          home_country: 'Switzerland',
          longitude: 8.540192,
          latitude: 47.376887,
          manager_id: null,
          manager_name: null,
          is_active: true,
          created_at: new Date('2023-01-01T12:00:00Z'),
          updated_at: new Date('2023-01-01T12:00:00Z'),
        },
        {
          id: '55555555-5555-5555-5555-555555555555',
          employee_id: 'EMP-0001',
          cognito_user_id: 'employee1@company.ch',
          email: 'employee1@company.ch',
          first_name: 'Anna',
          last_name: 'Schneider',
          home_street: 'Kramgasse 45',
          home_city: 'Bern',
          home_postal_code: '3011',
          home_country: 'Switzerland',
          longitude: 7.447447,
          latitude: 46.947974,
          manager_id: '33333333-3333-3333-3333-333333333333',
          manager_name: 'Thomas Müller',
          is_active: true,
          created_at: new Date('2023-01-01T12:00:00Z'),
          updated_at: new Date('2023-01-01T12:00:00Z'),
        },
      ];

      mockQuery.mockResolvedValueOnce({ rows: mockUsers });

      const result = await listUsersHandler(adminEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockConnect).toHaveBeenCalledOnce();
      expect(mockDisconnect).toHaveBeenCalledOnce();
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT'));

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.users).toHaveLength(2);
      expect(body.data.users[0].employeeId).toBe('ADM-0001');
      expect(body.data.users[1].employeeId).toBe('EMP-0001');
      expect(body.data.users[1].managerName).toBe('Thomas Müller');
    });

    it('should reject non-admin access', async () => {
      const result = await listUsersHandler(nonAdminEvent, mockContext);

      expect(result.statusCode).toBe(403);
      expect(mockConnect).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AdminAccessError');
      expect(body.error.message).toBe('Admin access required for this operation');
    });

    it('should handle database errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await listUsersHandler(adminEvent, mockContext);

      expect(result.statusCode).toBe(500);
      expect(mockConnect).toHaveBeenCalledOnce();
      expect(mockDisconnect).toHaveBeenCalledOnce();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Internal server error');
    });
  });

  describe('updateUserStatusHandler', () => {
    beforeEach(() => {
      adminEvent.pathParameters = { userId: '55555555-5555-5555-5555-555555555555' };
      adminEvent.body = JSON.stringify({ isActive: false });
    });

    it('should successfully update user status for admin', async () => {
      const mockUser = {
        id: '55555555-5555-5555-5555-555555555555',
        first_name: 'Anna',
        last_name: 'Schneider',
        is_active: true,
      };

      const mockUpdatedUser = {
        id: '55555555-5555-5555-5555-555555555555',
        first_name: 'Anna',
        last_name: 'Schneider',
        is_active: false,
        updated_at: new Date('2023-01-01T12:05:00Z'),
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUser] }) // User check
        .mockResolvedValueOnce({ rows: [mockUpdatedUser] }); // Update result

      const result = await updateUserStatusHandler(adminEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockConnect).toHaveBeenCalledOnce();
      expect(mockDisconnect).toHaveBeenCalledOnce();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.isActive).toBe(false);
      expect(body.data.firstName).toBe('Anna');
      expect(body.data.lastName).toBe('Schneider');
    });

    it('should reject non-admin access', async () => {
      nonAdminEvent.pathParameters = { userId: '55555555-5555-5555-5555-555555555555' };
      nonAdminEvent.body = JSON.stringify({ isActive: false });

      const result = await updateUserStatusHandler(nonAdminEvent, mockContext);

      expect(result.statusCode).toBe(403);
      expect(mockConnect).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AdminAccessError');
    });

    it('should return 404 for non-existent user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // User not found

      const result = await updateUserStatusHandler(adminEvent, mockContext);

      expect(result.statusCode).toBe(404);
      expect(mockConnect).toHaveBeenCalledOnce();
      expect(mockDisconnect).toHaveBeenCalledOnce();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return 400 for missing userId', async () => {
      adminEvent.pathParameters = null;

      const result = await updateUserStatusHandler(adminEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(mockConnect).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MISSING_USER_ID');
    });

    it('should return 400 for invalid JSON body', async () => {
      adminEvent.body = '{ invalid json }';

      const result = await updateUserStatusHandler(adminEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(mockConnect).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_JSON');
    });

    it('should return 400 for invalid isActive value', async () => {
      adminEvent.body = JSON.stringify({ isActive: 'not-boolean' });

      const result = await updateUserStatusHandler(adminEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(mockConnect).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_STATUS');
    });
  });

  describe('updateUserManagerHandler', () => {
    beforeEach(() => {
      adminEvent.pathParameters = { userId: '55555555-5555-5555-5555-555555555555' };
      adminEvent.body = JSON.stringify({ managerId: '33333333-3333-3333-3333-333333333333' });
    });

    it('should successfully update user manager for admin', async () => {
      const mockUser = {
        id: '55555555-5555-5555-5555-555555555555',
        first_name: 'Anna',
        last_name: 'Schneider',
        manager_id: null,
      };

      const mockManager = {
        id: '33333333-3333-3333-3333-333333333333',
        first_name: 'Thomas',
        last_name: 'Müller',
      };

      const mockUpdatedUser = {
        id: '55555555-5555-5555-5555-555555555555',
        first_name: 'Anna',
        last_name: 'Schneider',
        manager_id: '33333333-3333-3333-3333-333333333333',
        updated_at: new Date('2023-01-01T12:05:00Z'),
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUser] }) // User check
        .mockResolvedValueOnce({ rows: [mockManager] }) // Manager check
        .mockResolvedValueOnce({ rows: [mockUpdatedUser] }) // Update result
        .mockResolvedValueOnce({ rows: [mockManager] }); // Manager name lookup

      const result = await updateUserManagerHandler(adminEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockConnect).toHaveBeenCalledOnce();
      expect(mockDisconnect).toHaveBeenCalledOnce();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.managerId).toBe('33333333-3333-3333-3333-333333333333');
      expect(body.data.managerName).toBe('Thomas Müller');
    });

    it('should allow setting manager to null', async () => {
      adminEvent.body = JSON.stringify({ managerId: null });

      const mockUser = {
        id: '55555555-5555-5555-5555-555555555555',
        first_name: 'Anna',
        last_name: 'Schneider',
        manager_id: '33333333-3333-3333-3333-333333333333',
      };

      const mockUpdatedUser = {
        id: '55555555-5555-5555-5555-555555555555',
        first_name: 'Anna',
        last_name: 'Schneider',
        manager_id: null,
        updated_at: new Date('2023-01-01T12:05:00Z'),
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUser] }) // User check
        .mockResolvedValueOnce({ rows: [mockUpdatedUser] }); // Update result

      const result = await updateUserManagerHandler(adminEvent, mockContext);

      expect(result.statusCode).toBe(200);

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.managerId).toBeNull();
      expect(body.data.managerName).toBeNull();
    });

    it('should return 400 for circular reference', async () => {
      adminEvent.pathParameters = { userId: '33333333-3333-3333-3333-333333333333' };
      adminEvent.body = JSON.stringify({ managerId: '33333333-3333-3333-3333-333333333333' });

      const mockUser = {
        id: '33333333-3333-3333-3333-333333333333',
        first_name: 'Thomas',
        last_name: 'Müller',
        manager_id: null,
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockUser] }); // User check

      const result = await updateUserManagerHandler(adminEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(mockConnect).toHaveBeenCalledOnce();
      expect(mockDisconnect).toHaveBeenCalledOnce();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('CIRCULAR_REFERENCE');
    });

    it('should return 400 for invalid manager', async () => {
      const mockUser = {
        id: '55555555-5555-5555-5555-555555555555',
        first_name: 'Anna',
        last_name: 'Schneider',
        manager_id: null,
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [mockUser] }) // User check
        .mockResolvedValueOnce({ rows: [] }); // Manager not found

      const result = await updateUserManagerHandler(adminEvent, mockContext);

      expect(result.statusCode).toBe(400);
      expect(mockConnect).toHaveBeenCalledOnce();
      expect(mockDisconnect).toHaveBeenCalledOnce();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_MANAGER');
    });
  });
});
