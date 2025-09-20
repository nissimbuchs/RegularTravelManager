import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import {
  updateUserRoleHandler,
  validateRoleChangeHandler,
  validateManagerAssignmentHandler,
} from '../role-management';
import { db } from '../../../database/connection';

// Mock dependencies
jest.mock('../../../database/connection');
jest.mock('../../../middleware/logger');

const mockDb = db as jest.Mocked<typeof db>;

describe('Admin Role Management Handlers', () => {
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
    httpMethod: 'PUT',
    isBase64Encoded: false,
    path: '/api/admin/users/123/role',
    pathParameters: { userId: '123' },
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
      httpMethod: 'PUT',
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
      path: '/api/admin/users/123/role',
      stage: 'test',
      requestId: 'test-request-id',
      requestTime: '01/Jan/2023:00:00:00 +0000',
      requestTimeEpoch: 1672531200,
      resourceId: 'resource-id',
      resourcePath: '/api/admin/users/{userId}/role',
      routeKey: 'PUT /api/admin/users/{userId}/role',
    },
    resource: '/api/admin/users/{userId}/role',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.query.mockReset();
  });

  describe('updateUserRoleHandler', () => {
    const mockUser = {
      id: '123',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@company.ch',
      cognito_user_id: 'cognito-123',
      current_role: 'employee',
      is_active: true,
    };

    const mockUpdatedUser = {
      id: '123',
      first_name: 'John',
      last_name: 'Doe',
      role: 'manager',
      updated_at: new Date('2023-01-01'),
    };

    it('should update user role successfully', async () => {
      // Mock user check
      mockDb.query.mockResolvedValueOnce({
        rows: [mockUser],
      } as any);

      // Mock reports check (for impact analysis)
      mockDb.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      } as any);

      // Mock pending requests check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      } as any);

      // Mock transaction
      mockDb.query.mockResolvedValueOnce(undefined); // BEGIN

      // Mock role update
      mockDb.query.mockResolvedValueOnce({
        rows: [mockUpdatedUser],
      } as any);

      // Mock audit record
      mockDb.query.mockResolvedValueOnce(undefined);

      // Mock commit
      mockDb.query.mockResolvedValueOnce(undefined); // COMMIT

      const event = mockAdminEvent({
        body: JSON.stringify({
          userId: '123',
          newRole: 'manager',
          reason: 'Promotion to team lead',
        }),
      });

      const result = await updateUserRoleHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.role).toBe('manager');
      expect(body.data.warnings).toBeDefined();
      expect(body.data.impacts).toBeDefined();
    });

    it('should validate role values', async () => {
      const event = mockAdminEvent({
        body: JSON.stringify({
          userId: '123',
          newRole: 'invalid_role',
          reason: 'Test',
        }),
      });

      const result = await updateUserRoleHandler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_ROLE');
    });

    it('should require reason for role change', async () => {
      const event = mockAdminEvent({
        body: JSON.stringify({
          userId: '123',
          newRole: 'manager',
          reason: '',
        }),
      });

      const result = await updateUserRoleHandler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MISSING_REASON');
    });

    it('should check if role change is needed', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            ...mockUser,
            current_role: 'manager', // Already has target role
          },
        ],
      } as any);

      const event = mockAdminEvent({
        body: JSON.stringify({
          userId: '123',
          newRole: 'manager',
          reason: 'Test',
        }),
      });

      const result = await updateUserRoleHandler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NO_CHANGE_NEEDED');
    });

    it('should detect direct reports when demoting from manager', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            ...mockUser,
            current_role: 'manager',
          },
        ],
      } as any);

      // Mock reports check - user has 3 direct reports
      mockDb.query.mockResolvedValueOnce({
        rows: [{ count: '3' }],
      } as any);

      // Mock pending requests check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      } as any);

      // Continue with successful update for testing
      mockDb.query.mockResolvedValueOnce(undefined); // BEGIN
      mockDb.query.mockResolvedValueOnce({ rows: [mockUpdatedUser] } as any);
      mockDb.query.mockResolvedValueOnce(undefined); // Audit
      mockDb.query.mockResolvedValueOnce(undefined); // COMMIT

      const event = mockAdminEvent({
        body: JSON.stringify({
          userId: '123',
          newRole: 'employee',
          reason: 'Role change',
        }),
      });

      const result = await updateUserRoleHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.warnings).toContain('User has 3 direct reports that will need reassignment');
      expect(body.data.impacts).toContain('3 employees will lose their manager assignment');
    });

    it('should detect pending approvals when removing privileges', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            ...mockUser,
            current_role: 'manager',
          },
        ],
      } as any);

      // Mock reports check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      } as any);

      // Mock pending requests check - user has 2 pending approvals
      mockDb.query.mockResolvedValueOnce({
        rows: [{ count: '2' }],
      } as any);

      // Continue with successful update
      mockDb.query.mockResolvedValueOnce(undefined); // BEGIN
      mockDb.query.mockResolvedValueOnce({ rows: [mockUpdatedUser] } as any);
      mockDb.query.mockResolvedValueOnce(undefined); // Audit
      mockDb.query.mockResolvedValueOnce(undefined); // COMMIT

      const event = mockAdminEvent({
        body: JSON.stringify({
          userId: '123',
          newRole: 'employee',
          reason: 'Role change',
        }),
      });

      const result = await updateUserRoleHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.warnings).toContain(
        'User has 2 pending travel requests awaiting their approval'
      );
      expect(body.data.impacts).toContain(
        'Pending travel request approvals will need to be reassigned'
      );
    });

    it('should handle database transaction errors', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [mockUser] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }] } as any);
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '0' }] } as any);
      mockDb.query.mockResolvedValueOnce(undefined); // BEGIN
      mockDb.query.mockRejectedValueOnce(new Error('Database error')); // Update fails

      const event = mockAdminEvent({
        body: JSON.stringify({
          userId: '123',
          newRole: 'manager',
          reason: 'Promotion',
        }),
      });

      const result = await updateUserRoleHandler(event, mockContext);

      expect(result.statusCode).toBe(500);
      expect(mockDb.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('validateRoleChangeHandler', () => {
    const mockUser = {
      id: '123',
      first_name: 'John',
      last_name: 'Doe',
      current_role: 'employee',
      is_active: true,
    };

    it('should validate role change successfully', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [mockUser],
      } as any);

      // Mock reports check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      } as any);

      // Mock pending requests check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
      } as any);

      const event = mockAdminEvent({
        httpMethod: 'POST',
        path: '/api/admin/users/123/role/validate',
        body: JSON.stringify({
          newRole: 'manager',
        }),
      });

      const result = await validateRoleChangeHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.canChangeRole).toBe(true);
      expect(body.data.existingPermissions).toContain('submit_travel_requests');
      expect(body.data.newPermissions).toContain('approve_travel_requests');
    });

    it('should detect when no change is needed', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            ...mockUser,
            current_role: 'manager',
          },
        ],
      } as any);

      const event = mockAdminEvent({
        httpMethod: 'POST',
        path: '/api/admin/users/123/role/validate',
        body: JSON.stringify({
          newRole: 'manager',
        }),
      });

      const result = await validateRoleChangeHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.canChangeRole).toBe(false);
      expect(body.data.warnings).toContain('User already has role: manager');
    });

    it('should validate invalid role', async () => {
      const event = mockAdminEvent({
        httpMethod: 'POST',
        path: '/api/admin/users/123/role/validate',
        body: JSON.stringify({
          newRole: 'super_admin',
        }),
      });

      const result = await validateRoleChangeHandler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_ROLE');
    });
  });

  describe('validateManagerAssignmentHandler', () => {
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
      role: 'manager',
      is_active: true,
    };

    it('should validate manager assignment successfully', async () => {
      // Mock user check
      mockDb.query.mockResolvedValueOnce({
        rows: [mockUser],
      } as any);

      // Mock manager check
      mockDb.query.mockResolvedValueOnce({
        rows: [mockManager],
      } as any);

      // Mock loop detection check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ loop_count: '0' }],
      } as any);

      // Mock capacity check
      mockDb.query.mockResolvedValueOnce({
        rows: [{ direct_reports: '5' }],
      } as any);

      const event = mockAdminEvent({
        httpMethod: 'POST',
        path: '/api/admin/users/123/manager/validate',
        body: JSON.stringify({
          managerId: '456',
        }),
      });

      const result = await validateManagerAssignmentHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.canAssignManager).toBe(true);
      expect(body.data.loopDetected).toBe(false);
      expect(body.data.managerCapacityOk).toBe(true);
    });

    it('should detect circular hierarchy', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [mockUser],
      } as any);

      mockDb.query.mockResolvedValueOnce({
        rows: [mockManager],
      } as any);

      // Mock loop detection - loop found
      mockDb.query.mockResolvedValueOnce({
        rows: [{ loop_count: '1' }],
      } as any);

      const event = mockAdminEvent({
        httpMethod: 'POST',
        path: '/api/admin/users/123/manager/validate',
        body: JSON.stringify({
          managerId: '456',
        }),
      });

      const result = await validateManagerAssignmentHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.canAssignManager).toBe(false);
      expect(body.data.loopDetected).toBe(true);
      expect(body.data.hierarchyImpacts).toContain('Circular management hierarchy detected');
    });

    it('should check manager capacity', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [mockUser],
      } as any);

      mockDb.query.mockResolvedValueOnce({
        rows: [mockManager],
      } as any);

      mockDb.query.mockResolvedValueOnce({
        rows: [{ loop_count: '0' }],
      } as any);

      // Mock capacity check - manager has too many reports
      mockDb.query.mockResolvedValueOnce({
        rows: [{ direct_reports: '25' }],
      } as any);

      const event = mockAdminEvent({
        httpMethod: 'POST',
        path: '/api/admin/users/123/manager/validate',
        body: JSON.stringify({
          managerId: '456',
        }),
      });

      const result = await validateManagerAssignmentHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.managerCapacityOk).toBe(false);
      expect(body.data.warnings).toContain(
        'Manager already has 25 direct reports (recommended max: 20)'
      );
    });

    it('should handle inactive manager', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [mockUser],
      } as any);

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            ...mockManager,
            is_active: false,
          },
        ],
      } as any);

      mockDb.query.mockResolvedValueOnce({
        rows: [{ loop_count: '0' }],
      } as any);

      mockDb.query.mockResolvedValueOnce({
        rows: [{ direct_reports: '5' }],
      } as any);

      const event = mockAdminEvent({
        httpMethod: 'POST',
        path: '/api/admin/users/123/manager/validate',
        body: JSON.stringify({
          managerId: '456',
        }),
      });

      const result = await validateManagerAssignmentHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.canAssignManager).toBe(false);
      expect(body.data.warnings).toContain('Proposed manager is inactive');
    });

    it('should handle manager not found', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [mockUser],
      } as any);

      mockDb.query.mockResolvedValueOnce({
        rows: [], // Manager not found
      } as any);

      const event = mockAdminEvent({
        httpMethod: 'POST',
        path: '/api/admin/users/123/manager/validate',
        body: JSON.stringify({
          managerId: '999',
        }),
      });

      const result = await validateManagerAssignmentHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.canAssignManager).toBe(false);
      expect(body.data.warnings).toContain('Manager not found');
    });

    it('should handle removing manager assignment', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            ...mockUser,
            manager_id: '456',
          },
        ],
      } as any);

      const event = mockAdminEvent({
        httpMethod: 'POST',
        path: '/api/admin/users/123/manager/validate',
        body: JSON.stringify({
          managerId: null,
        }),
      });

      const result = await validateManagerAssignmentHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.canAssignManager).toBe(true);
      expect(body.data.hierarchyImpacts).toContain('User will no longer have a manager');
    });
  });
});
