import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { getEmployeeDashboard, getRequestDetails, withdrawRequest } from '../../../handlers/employees/dashboard';

// Mock dependencies
vi.mock('../../../database/connection', () => ({
  db: {
    query: vi.fn(),
    getPool: vi.fn(),
  },
}));

vi.mock('../../../handlers/auth/auth-utils', () => ({
  getUserContextFromEvent: vi.fn(),
}));

vi.mock('../../../middleware/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Import the mocked functions after the mocks are set up
import { db } from '../../../database/connection';
import { getUserContextFromEvent } from '../../../handlers/auth/auth-utils';

const mockDbQuery = vi.mocked(db.query);
const mockGetUserContextFromEvent = vi.mocked(getUserContextFromEvent);


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

const createMockEvent = (
  method: string,
  queryStringParameters?: Record<string, string> | null,
  pathParameters?: Record<string, string> | null
): APIGatewayProxyEvent => ({
  httpMethod: method,
  path: '/api/employees/dashboard/requests',
  pathParameters,
  queryStringParameters,
  headers: {
    Authorization: 'Bearer valid-token',
  },
  body: null,
  isBase64Encoded: false,
  stageVariables: null,
  requestContext: {
    requestId: 'test-request',
    stage: 'dev',
    resourceId: 'resource-id',
    resourcePath: '/employees/dashboard/requests',
    httpMethod: method,
    path: '/api/employees/dashboard/requests',
    protocol: 'HTTP/1.1',
    requestTime: '2025-09-22T10:00:00Z',
    requestTimeEpoch: 1727000000000,
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      clientCert: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '127.0.0.1',
      user: null,
      userAgent: 'test-agent',
      userArn: null,
    },
    authorizer: null,
    domainName: 'api.test.com',
    domainPrefix: 'api',
    extendedRequestId: 'test-extended-id',
    httpMethod: method,
    messageDirection: 'IN',
    messageId: 'test-message-id',
    path: '/api/employees/dashboard/requests',
    stage: 'dev',
    requestId: 'test-request',
    requestTime: '2025-09-22T10:00:00Z',
    requestTimeEpoch: 1727000000000,
    resourceId: 'resource-id',
    resourcePath: '/employees/dashboard/requests',
    routeKey: '$default',
  },
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
});

describe('Employee Dashboard Handlers', () => {
  const mockEmployeeId = 'employee-uuid-123';
  const mockCognitoUserId = 'cognito-user-123';

  beforeEach(() => {
    vi.clearAllMocks();

    // Default user context setup
    mockGetUserContextFromEvent.mockReturnValue({
      sub: mockCognitoUserId,
      email: 'employee@test.com',
      'cognito:groups': ['employee'],
    });

    // Default employee ID lookup
    mockDbQuery.mockImplementation((query: string, params: any[]) => {
      if (query.includes('SELECT id FROM employees WHERE cognito_user_id')) {
        return Promise.resolve({
          rows: [{ id: mockEmployeeId }],
        });
      }
      return Promise.resolve({ rows: [] });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getEmployeeDashboard', () => {
    const mockRequestsData = [
      {
        id: 'request-1',
        project_name: 'Test Project Alpha',
        project_code: 'TPA',
        subproject_name: 'Zurich Office',
        status: 'pending',
        submitted_date: new Date('2025-09-20T10:00:00Z'),
        processed_date: null,
        daily_allowance: '50.00',
        weekly_allowance: '150.00',
        days_per_week: '3',
        justification: 'Weekly project meetings',
        calculated_distance: '25.5',
        cost_per_km: '0.70',
        manager_name: 'John Manager',
        manager_email: 'john.manager@test.com',
      },
      {
        id: 'request-2',
        project_name: 'Test Project Beta',
        subproject_name: 'Basel Office',
        status: 'approved',
        submitted_date: new Date('2025-09-18T09:00:00Z'),
        processed_date: new Date('2025-09-19T14:00:00Z'),
        daily_allowance: '75.00',
        weekly_allowance: '300.00',
        days_per_week: '4',
        justification: 'Client meetings and coordination',
        calculated_distance: '38.2',
        cost_per_km: '0.75',
        manager_name: 'Jane Supervisor',
        manager_email: 'jane.supervisor@test.com',
      },
    ];

    const mockSummaryData = [
      { status: 'pending', count: '1', monthly_allowance: '0' },
      { status: 'approved', count: '1', monthly_allowance: '1300.00' },
      { status: 'rejected', count: '0', monthly_allowance: null },
      { status: 'withdrawn', count: '0', monthly_allowance: null },
    ];

    it('should return dashboard data successfully with basic parameters', async () => {
      const event = createMockEvent('GET', {
        pageIndex: '0',
        pageSize: '25',
        sortActive: 'submittedDate',
        sortDirection: 'desc',
      });

      // Mock database calls
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: mockEmployeeId }] }) // Employee lookup
        .mockResolvedValueOnce({ rows: [{ total: '2' }] }) // Count query
        .mockResolvedValueOnce({ rows: mockRequestsData }) // Main query
        .mockResolvedValueOnce({ rows: mockSummaryData }); // Summary query

      const result = await getEmployeeDashboard(event, mockContext);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data).toMatchObject({
        totalRequests: 2,
        pendingCount: 1,
        approvedCount: 1,
        rejectedCount: 0,
        withdrawnCount: 0,
        totalApprovedAllowance: 1300,
        requests: expect.arrayContaining([
          expect.objectContaining({
            id: 'request-1',
            projectName: 'Test Project Alpha',
            status: 'pending',
            dailyAllowance: 50.00,
            weeklyAllowance: 150.00,
          }),
          expect.objectContaining({
            id: 'request-2',
            projectName: 'Test Project Beta',
            status: 'approved',
            dailyAllowance: 75.00,
            weeklyAllowance: 300.00,
          }),
        ]),
      });
    });

    it('should handle filtering parameters correctly', async () => {
      const event = createMockEvent('GET', {
        pageIndex: '0',
        pageSize: '25',
        sortActive: 'submittedDate',
        sortDirection: 'desc',
        status: 'pending',
        projectName: 'Alpha',
        dateRangeStart: '2025-09-01T00:00:00.000Z',
        dateRangeEnd: '2025-09-30T23:59:59.999Z',
      });

      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: mockEmployeeId }] })
        .mockResolvedValueOnce({ rows: [{ total: '1' }] })
        .mockResolvedValueOnce({ rows: [mockRequestsData[0]] })
        .mockResolvedValueOnce({ rows: mockSummaryData });

      const result = await getEmployeeDashboard(event, mockContext);

      expect(result.statusCode).toBe(200);

      // Verify that filtering WHERE clauses were built correctly
      const countQueryCall = mockDbQuery.mock.calls[1];
      const mainQueryCall = mockDbQuery.mock.calls[2];

      // Check count query includes filters
      expect(countQueryCall[0]).toContain('WHERE tr.employee_id = $1');
      expect(countQueryCall[0]).toContain('AND tr.status = $2');
      expect(countQueryCall[0]).toContain('AND p.name ILIKE $3');
      expect(countQueryCall[1]).toEqual([mockEmployeeId, 'pending', '%Alpha%', expect.any(Date), expect.any(Date), 25, 0]);

      // Check main query includes filters
      expect(mainQueryCall[0]).toContain('WHERE tr.employee_id = $1');
      expect(mainQueryCall[1]).toEqual([
        mockEmployeeId,
        'pending',
        '%Alpha%',
        expect.any(Date),
        expect.any(Date),
        25,
        0
      ]);
    });

    it('should handle authentication errors', async () => {
      const event = createMockEvent('GET');

      mockGetUserContextFromEvent.mockReturnValue({
        sub: null, // No user ID
      });

      const result = await getEmployeeDashboard(event, mockContext);

      expect(result.statusCode).toBe(401);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('HTTP_401');
      expect(responseBody.error.message.error).toBe('Unauthorized');
    });

    it('should handle employee not found', async () => {
      const event = createMockEvent('GET');

      // Mock employee lookup returning empty result
      mockDbQuery.mockResolvedValueOnce({ rows: [] });

      const result = await getEmployeeDashboard(event, mockContext);

      expect(result.statusCode).toBe(404);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('HTTP_404');
      expect(responseBody.error.message.error).toBe('Employee not found');
    });

    it('should handle database errors gracefully', async () => {
      const event = createMockEvent('GET');

      mockDbQuery.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await getEmployeeDashboard(event, mockContext);

      expect(result.statusCode).toBe(500);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('HTTP_500');
      expect(responseBody.error.message.error).toBe('Internal server error');
    });

    it('should handle pagination correctly', async () => {
      const event = createMockEvent('GET', {
        pageIndex: '2',
        pageSize: '10',
        sortActive: 'status',
        sortDirection: 'asc',
      });

      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: mockEmployeeId }] })
        .mockResolvedValueOnce({ rows: [{ total: '25' }] })
        .mockResolvedValueOnce({ rows: mockRequestsData })
        .mockResolvedValueOnce({ rows: mockSummaryData });

      await getEmployeeDashboard(event, mockContext);

      // Check that LIMIT and OFFSET are calculated correctly
      const mainQueryCall = mockDbQuery.mock.calls[2];
      const queryParams = mainQueryCall[1];

      // Should have LIMIT 10 OFFSET 20 (pageIndex 2 * pageSize 10)
      expect(queryParams[queryParams.length - 2]).toBe(10); // LIMIT
      expect(queryParams[queryParams.length - 1]).toBe(20); // OFFSET
    });
  });

  describe('getRequestDetails', () => {
    const mockRequestDetails = {
      id: 'request-1',
      project_name: 'Test Project Alpha',
      subproject_name: 'Zurich Office',
      justification: 'Weekly project meetings and client coordination',
      manager_name: 'John Manager',
      manager_email: 'john.manager@test.com',
      calculated_distance: '25.5',
      cost_per_km: '0.70',
      daily_allowance: '50.00',
      weekly_allowance: '150.00',
      monthly_estimate: '650.00',
      days_per_week: '3',
      status: 'pending',
      submitted_date: new Date('2025-09-20T10:00:00Z'),
      processed_date: null,
      employee_address: '123 Employee Street, Test City',
      subproject_address: '456 Project Avenue, Project City',
    };

    const mockStatusHistory = [
      {
        status: 'pending',
        timestamp: new Date('2025-09-20T10:00:00Z'),
        processed_by: 'System',
        note: 'Request submitted',
      },
    ];

    it('should return request details successfully', async () => {
      const requestId = 'request-1';
      const event = createMockEvent('GET', null, { id: requestId });

      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: mockEmployeeId }] }) // Employee lookup
        .mockResolvedValueOnce({ rows: [mockRequestDetails] }) // Details query
        .mockResolvedValueOnce({ rows: mockStatusHistory }); // History query

      const result = await getRequestDetails(event, mockContext);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data).toMatchObject({
        id: 'request-1',
        projectName: 'Test Project Alpha',
        subProjectName: 'Zurich Office',
        justification: 'Weekly project meetings and client coordination',
        managerName: 'John Manager',
        managerEmail: 'john.manager@test.com',
        calculatedDistance: 25.5,
        costPerKm: 0.70,
        dailyAllowance: 50.00,
        weeklyAllowance: 150.00,
        monthlyEstimate: 650.00,
        daysPerWeek: 3,
        status: 'pending',
        employeeAddress: '123 Employee Street, Test City',
        subprojectAddress: '456 Project Avenue, Project City',
        statusHistory: [
          {
            status: 'pending',
            timestamp: expect.any(String),
            note: 'Request submitted',
          },
        ],
      });
    });

    it('should handle missing request ID', async () => {
      const event = createMockEvent('GET', null, null); // No path parameters

      const result = await getRequestDetails(event, mockContext);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('HTTP_400');
      expect(responseBody.error.message.error).toBe('Request ID is required');
    });

    it('should handle request not found', async () => {
      const requestId = 'nonexistent-request';
      const event = createMockEvent('GET', null, { id: requestId });

      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: mockEmployeeId }] }) // Employee lookup
        .mockResolvedValueOnce({ rows: [] }); // Details query - no results

      const result = await getRequestDetails(event, mockContext);

      expect(result.statusCode).toBe(404);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('HTTP_404');
      expect(responseBody.error.message.error).toBe('Request not found');
    });

    it('should verify employee access control', async () => {
      const requestId = 'request-1';
      const event = createMockEvent('GET', null, { id: requestId });

      // Mock queries to verify employee ID is used in WHERE clause
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: mockEmployeeId }] })
        .mockResolvedValueOnce({ rows: [mockRequestDetails] })
        .mockResolvedValueOnce({ rows: mockStatusHistory });

      await getRequestDetails(event, mockContext);

      // Verify details query includes employee_id filter
      const detailsQueryCall = mockDbQuery.mock.calls[1];
      expect(detailsQueryCall[0]).toContain('WHERE tr.id = $1 AND tr.employee_id = $2');
      expect(detailsQueryCall[1]).toEqual([requestId, mockEmployeeId]);
    });
  });

  describe('withdrawRequest', () => {
    const requestId = 'request-1';

    it('should withdraw pending request successfully', async () => {
      const event = createMockEvent('PUT', null, { id: requestId });

      const mockRequest = { id: requestId, status: 'pending' };
      const mockEmployeeName = 'John Employee';

      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: mockEmployeeId }] }) // Employee lookup
        .mockResolvedValueOnce({ rows: [mockRequest] }) // Request check
        .mockResolvedValueOnce({ rows: [] }) // BEGIN transaction
        .mockResolvedValueOnce({ rows: [] }) // UPDATE request
        .mockResolvedValueOnce({ rows: [{ full_name: mockEmployeeName }] }) // Employee name lookup
        .mockResolvedValueOnce({ rows: [] }) // INSERT status history
        .mockResolvedValueOnce({ rows: [] }); // COMMIT transaction

      const result = await withdrawRequest(event, mockContext);

      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data).toMatchObject({
        success: true,
        message: 'Request withdrawn successfully',
      });

      // Verify transaction calls
      const queryCalls = mockDbQuery.mock.calls;
      expect(queryCalls.some(call => call[0] === 'BEGIN')).toBe(true);
      expect(queryCalls.some(call => call[0] === 'COMMIT')).toBe(true);

      // Verify update call
      expect(queryCalls.some(call =>
        call[0].includes('UPDATE travel_requests') &&
        call[0].includes("SET status = 'withdrawn'")
      )).toBe(true);

      // Verify status history insert
      expect(queryCalls.some(call =>
        call[0].includes('INSERT INTO travel_request_status_history')
      )).toBe(true);
    });

    it('should reject withdrawal of non-pending request', async () => {
      const event = createMockEvent('PUT', null, { id: requestId });

      const mockRequest = { id: requestId, status: 'approved' }; // Non-pending status

      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: mockEmployeeId }] }) // Employee lookup
        .mockResolvedValueOnce({ rows: [mockRequest] }); // Request check

      const result = await withdrawRequest(event, mockContext);

      expect(result.statusCode).toBe(400);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('HTTP_400');
      expect(responseBody.error.message.error).toContain('Cannot withdraw approved request');
    });

    it('should handle database transaction failure', async () => {
      const event = createMockEvent('PUT', null, { id: requestId });

      const mockRequest = { id: requestId, status: 'pending' };

      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: mockEmployeeId }] }) // Employee lookup
        .mockResolvedValueOnce({ rows: [mockRequest] }) // Request check
        .mockResolvedValueOnce({ rows: [] }) // BEGIN transaction
        .mockRejectedValueOnce(new Error('Database error')) // UPDATE fails
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const result = await withdrawRequest(event, mockContext);

      expect(result.statusCode).toBe(500);

      // Verify rollback was called
      const queryCalls = mockDbQuery.mock.calls;
      expect(queryCalls.some(call => call[0] === 'ROLLBACK')).toBe(true);
    });

    it('should handle missing request ID', async () => {
      const event = createMockEvent('PUT', null, null); // No path parameters

      const result = await withdrawRequest(event, mockContext);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('HTTP_400');
      expect(responseBody.error.message.error).toBe('Request ID is required');
    });

    it('should verify employee ownership of request', async () => {
      const event = createMockEvent('PUT', null, { id: requestId });

      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: mockEmployeeId }] }) // Employee lookup
        .mockResolvedValueOnce({ rows: [] }); // Request check - no results (not owned by employee)

      const result = await withdrawRequest(event, mockContext);

      expect(result.statusCode).toBe(404);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('HTTP_404');
      expect(responseBody.error.message.error).toBe('Request not found');

      // Verify request check query includes employee_id filter
      const requestCheckCall = mockDbQuery.mock.calls[1];
      expect(requestCheckCall[0]).toContain('WHERE id = $1 AND employee_id = $2');
      expect(requestCheckCall[1]).toEqual([requestId, mockEmployeeId]);
    });
  });
});