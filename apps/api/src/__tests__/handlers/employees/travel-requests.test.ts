import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { createTravelRequest, calculatePreview } from '../../../handlers/employees/travel-requests';

// Mock dependencies
const mockDbQuery = vi.fn();
vi.mock('../../../database/connection', () => ({
  db: {
    query: mockDbQuery,
    getPool: vi.fn(),
  },
}));
vi.mock('../../../handlers/auth/auth-utils', () => ({
  getUserContextFromEvent: vi.fn(),
  requireAuthenticated: vi.fn(),
}));

const mockContext: Context = {
  awsRequestId: 'test-request-id',
  functionName: 'test-function',
  functionVersion: '1.0',
  invokedFunctionArn: 'arn:test',
  memoryLimitInMB: '128',
  getRemainingTimeInMillis: () => 30000,
  logGroupName: 'test-group',
  logStreamName: 'test-stream',
  callbackWaitsForEmptyEventLoop: true,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

const createMockEvent = (method: string, body?: any): APIGatewayProxyEvent => ({
  httpMethod: method,
  path: '/api/v1/travel-requests',
  pathParameters: null,
  queryStringParameters: null,
  headers: {},
  body: body ? JSON.stringify(body) : null,
  isBase64Encoded: false,
  stageVariables: null,
  requestContext: {
    requestId: 'test-request',
    stage: 'dev',
    resourceId: 'resource-id',
    resourcePath: '/travel-requests',
    httpMethod: method,
    path: '/api/v1/travel-requests',
    protocol: 'HTTP/1.1',
    requestTime: '2025-09-03T10:00:00Z',
    requestTimeEpoch: 1693396800000,
    identity: {
      cognitoIdentityPoolId: null,
      accountId: null,
      cognitoIdentityId: null,
      caller: null,
      sourceIp: '127.0.0.1',
      principalOrgId: null,
      accessKey: null,
      cognitoAuthenticationType: null,
      cognitoAuthenticationProvider: null,
      userArn: null,
      userAgent: 'test-agent',
      user: null,
      apiKey: null,
      apiKeyId: null,
      clientCert: null,
    },
    domainName: 'api.test.com',
    apiId: 'api-id',
    accountId: '123456789',
    authorizer: {
      sub: 'employee1-cognito-id',
      email: 'employee1@company.com',
      isManager: 'false',
      groups: '["employees"]',
    },
  },
  resource: '/travel-requests',
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
});

const mockEmployee = {
  id: 'employee-uuid-123',
  cognito_user_id: 'employee1-cognito-id',
  home_location: 'POINT(8.540192 47.376887)', // Zurich coordinates
};

const mockManager = {
  id: 'manager-uuid-123',
  cognito_user_id: 'manager1-cognito-id',
  employee_id: 'MGR-001',
  is_active: true,
};

const mockSubproject = {
  id: 'subproject-uuid-123',
  project_id: 'project-uuid-123',
  location: 'POINT(7.447447 46.947974)', // Bern coordinates
  cost_per_km: 0.7,
  default_cost_per_km: 0.68,
};

const validTravelRequestBody = {
  subproject_id: 'subproject-uuid-123',
  days_per_week: 3,
  justification: 'Need to travel to client site for project work',
  manager_id: 'manager1-cognito-id',
};

describe('Travel Request Handlers', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock getUserContextFromEvent
    const authUtils = await import('../../../handlers/auth/auth-utils');
    vi.mocked(authUtils.getUserContextFromEvent).mockReturnValue({
      sub: 'employee1-cognito-id',
      email: 'employee1@company.com',
      cognitoUsername: 'employee1',
      isManager: false,
      groups: ['employees'],
    });
  });

  describe('createTravelRequest', () => {
    it('should create travel request with selected manager successfully', async () => {
      const mockEvent = createMockEvent('POST', validTravelRequestBody);

      mockDbQuery
        // Get employee details
        .mockResolvedValueOnce({
          rows: [mockEmployee],
        })
        // Validate selected manager
        .mockResolvedValueOnce({
          rows: [mockManager],
        })
        // Get subproject details
        .mockResolvedValueOnce({
          rows: [mockSubproject],
        })
        // Calculate distance
        .mockResolvedValueOnce({
          rows: [{ distance_km: 65.432 }],
        })
        // Insert travel request
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'request-uuid-123',
              submitted_at: '2025-09-03T10:00:00Z',
            },
          ],
        })
        // Insert status history
        .mockResolvedValueOnce({});

      const result = await createTravelRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.data).toEqual({
        id: 'request-uuid-123',
        submitted_at: '2025-09-03T10:00:00Z',
        status: 'pending',
        message: 'Travel request submitted successfully',
      });

      // Verify manager validation query was called
      expect(vi.mocked(db.query)).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, is_active'),
        ['manager1-cognito-id']
      );

      // Verify travel request was created with selected manager
      expect(vi.mocked(db.query)).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO travel_requests'),
        expect.arrayContaining([
          mockEmployee.id,
          mockManager.id, // Should use selected manager, not employee's default
          mockSubproject.project_id,
          validTravelRequestBody.subproject_id,
          validTravelRequestBody.days_per_week,
          validTravelRequestBody.justification,
          expect.any(Number), // distance
          expect.any(Number), // calculated allowance
        ])
      );
    });

    it('should reject request when manager_id is missing', async () => {
      const invalidBody = { ...validTravelRequestBody };
      delete invalidBody.manager_id;
      const mockEvent = createMockEvent('POST', invalidBody);

      const result = await createTravelRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe(
        'subproject_id, days_per_week, justification, and manager_id are required'
      );
    });

    it('should reject request when selected manager is invalid', async () => {
      const mockEvent = createMockEvent('POST', {
        ...validTravelRequestBody,
        manager_id: 'invalid-manager-id',
      });

      mockDbQuery
        // Get employee details
        .mockResolvedValueOnce({
          rows: [mockEmployee],
        })
        // Validate selected manager (invalid - no rows returned)
        .mockResolvedValueOnce({
          rows: [],
        });

      const result = await createTravelRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Invalid or inactive manager selected');
    });

    it('should reject request when selected manager is inactive', async () => {
      const mockEvent = createMockEvent('POST', validTravelRequestBody);

      mockDbQuery
        // Get employee details
        .mockResolvedValueOnce({
          rows: [mockEmployee],
        })
        // Validate selected manager (inactive - no rows returned due to WHERE clause)
        .mockResolvedValueOnce({
          rows: [],
        });

      const result = await createTravelRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Invalid or inactive manager selected');
    });

    it('should reject request for non-manager employee ID', async () => {
      const mockEvent = createMockEvent('POST', {
        ...validTravelRequestBody,
        manager_id: 'employee2-cognito-id', // Regular employee, not manager
      });

      mockDbQuery
        // Get employee details
        .mockResolvedValueOnce({
          rows: [mockEmployee],
        })
        // Validate selected manager (not a manager - no rows due to LIKE 'MGR-%' clause)
        .mockResolvedValueOnce({
          rows: [],
        });

      const result = await createTravelRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Invalid or inactive manager selected');
    });

    it('should reject request when employee not found', async () => {
      const mockEvent = createMockEvent('POST', validTravelRequestBody);

      mockDbQuery
        // Get employee details (not found)
        .mockResolvedValueOnce({
          rows: [],
        });

      const result = await createTravelRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Employee not found');
    });

    it('should reject request when employee has no home address', async () => {
      const mockEvent = createMockEvent('POST', validTravelRequestBody);

      mockDbQuery
        // Get employee details (no home location)
        .mockResolvedValueOnce({
          rows: [{ ...mockEmployee, home_location: null }],
        })
        // Validate selected manager
        .mockResolvedValueOnce({
          rows: [mockManager],
        });

      const result = await createTravelRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Employee home address not set');
    });

    it('should reject request when subproject not found', async () => {
      const mockEvent = createMockEvent('POST', validTravelRequestBody);

      mockDbQuery
        // Get employee details
        .mockResolvedValueOnce({
          rows: [mockEmployee],
        })
        // Validate selected manager
        .mockResolvedValueOnce({
          rows: [mockManager],
        })
        // Get subproject details (not found)
        .mockResolvedValueOnce({
          rows: [],
        });

      const result = await createTravelRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Subproject not found or inactive');
    });

    it('should return 401 when user is unauthorized', async () => {
      const mockEvent = createMockEvent('POST', validTravelRequestBody);

      // Mock unauthorized user context
      const authUtils = await import('../../../handlers/auth/auth-utils');
      vi.mocked(authUtils.getUserContextFromEvent).mockReturnValue({
        sub: null, // No user ID
        email: null,
        cognitoUsername: null,
        isManager: false,
        groups: [],
      });

      const result = await createTravelRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Unauthorized');
    });

    it('should handle database errors gracefully', async () => {
      const mockEvent = createMockEvent('POST', validTravelRequestBody);

      mockDbQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await createTravelRequest(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Internal server error');
    });
  });

  describe('calculatePreview', () => {
    const previewBody = {
      subprojectId: 'subproject-uuid-123',
      daysPerWeek: 3,
    };

    it('should calculate preview successfully', async () => {
      const mockEvent = createMockEvent('POST', previewBody);

      mockDbQuery
        // Get employee home location
        .mockResolvedValueOnce({
          rows: [mockEmployee],
        })
        // Get subproject details
        .mockResolvedValueOnce({
          rows: [mockSubproject],
        })
        // Calculate distance
        .mockResolvedValueOnce({
          rows: [{ distance_km: 65.432 }],
        });

      const result = await calculatePreview(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toEqual({
        distance: 65.432,
        dailyAllowance: 45.8, // 65.432 * 0.70 rounded to 2 decimal places
        weeklyAllowance: 137.41, // 45.8 * 3 rounded to 2 decimal places (due to JS precision)
      });
    });

    it('should reject preview when required fields missing', async () => {
      const invalidBody = { subprojectId: 'subproject-uuid-123' }; // missing daysPerWeek
      const mockEvent = createMockEvent('POST', invalidBody);

      const result = await calculatePreview(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('subprojectId and daysPerWeek are required');
    });
  });
});
