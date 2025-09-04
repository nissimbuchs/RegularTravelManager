import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { getEmployeeProfile, updateEmployeeAddress } from '../../../handlers/employees/profile';

// Mock dependencies
vi.mock('../../../database/connection', () => ({
  db: {
    query: vi.fn(),
    getPool: vi.fn(),
  },
}));
vi.mock('../../../handlers/auth/auth-utils');
vi.mock('../../../services/geocoding-service', () => ({
  GeocodingService: vi.fn(),
  GeocodeResult: {},
  GeocodeRequest: {},
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

const createMockEvent = (
  method: string,
  pathParams: Record<string, string> = {},
  body?: any
): APIGatewayProxyEvent => ({
  httpMethod: method,
  path: '/api/v1/employees/123',
  pathParameters: pathParams,
  queryStringParameters: null,
  headers: {},
  body: body ? JSON.stringify(body) : null,
  isBase64Encoded: false,
  stageVariables: null,
  requestContext: {
    requestId: 'test-request',
    stage: 'dev',
    resourceId: 'resource-id',
    resourcePath: '/employees/{id}',
    httpMethod: method,
    path: '/api/v1/employees/123',
    protocol: 'HTTP/1.1',
    requestTime: '2025-08-30T10:00:00Z',
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
      sub: 'user-123',
      email: 'test@company.com',
      isManager: 'false',
      groups: '["employees"]',
    },
  },
  resource: '/employees/{id}',
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
});

const mockEmployee = {
  id: 'employee-123',
  cognito_user_id: 'user-123',
  email: 'test@company.com',
  first_name: 'John',
  last_name: 'Doe',
  employee_id: 'EMP-0001',
  home_street: 'Bahnhofstrasse 1',
  home_city: 'Zürich',
  home_postal_code: '8001',
  home_country: 'Switzerland',
  home_location: { latitude: 47.376887, longitude: 8.540192 },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('Employee Profile Handlers', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock getUserContextFromEvent
    const authUtils = await import('../../../handlers/auth/auth-utils');
    vi.mocked(authUtils.getUserContextFromEvent).mockReturnValue({
      sub: 'user-123',
      email: 'test@company.com',
      cognitoUsername: 'testuser',
      isManager: false,
      groups: ['employees'],
    });
  });

  describe('getEmployeeProfile', () => {
    it('should return employee profile for own data', async () => {
      const mockEvent = createMockEvent('GET', { id: 'user-123' });

      // Mock database query
      vi.mocked((await import('../../../database/connection')).db.query)
        .mockResolvedValueOnce({
          rows: [mockEmployee],
        })
        .mockResolvedValueOnce({
          rows: [{ latitude: 47.376887, longitude: 8.540192 }],
        });

      const result = await getEmployeeProfile(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.email).toBe('test@company.com');
      expect(body.data.home_location).toEqual({ latitude: 47.376887, longitude: 8.540192 });
    });

    it('should allow manager to view any employee profile', async () => {
      const mockEvent = createMockEvent('GET', { id: 'employee-456' });

      // Mock manager context
      const authUtils = await import('../../../handlers/auth/auth-utils');
      vi.mocked(authUtils.getUserContextFromEvent).mockReturnValue({
        sub: 'manager-123',
        email: 'manager@company.com',
        cognitoUsername: 'manageruser',
        isManager: true,
        groups: ['managers'],
      });

      // Mock database query
      vi.mocked((await import('../../../database/connection')).db.query)
        .mockResolvedValueOnce({
          rows: [{ ...mockEmployee, id: 'employee-456' }],
        })
        .mockResolvedValueOnce({
          rows: [{ latitude: 47.376887, longitude: 8.540192 }],
        });

      const result = await getEmployeeProfile(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });

    it('should reject access to other employee profiles for non-managers', async () => {
      const mockEvent = createMockEvent('GET', { id: 'employee-456' });

      await expect(getEmployeeProfile(mockEvent, mockContext)).rejects.toThrow(
        'Access denied: can only view own profile or manager access required'
      );
    });

    it('should return 404 for non-existent employee', async () => {
      const mockEvent = createMockEvent('GET', { id: 'user-123' });

      // Mock empty database result
      vi.mocked((await import('../../../database/connection')).db.query).mockResolvedValueOnce({
        rows: [],
      });

      await expect(getEmployeeProfile(mockEvent, mockContext)).rejects.toThrow(
        'Employee not found'
      );
    });
  });

  describe('updateEmployeeAddress', () => {
    const validAddressUpdate = {
      home_street: 'Bahnhofstrasse 15',
      home_city: 'Bern',
      home_postal_code: '3001',
      home_country: 'Switzerland',
    };

    it('should update employee address successfully', async () => {
      const mockEvent = createMockEvent('PUT', { id: 'user-123' }, validAddressUpdate);

      // Mock geocoding service
      const { GeocodingService } = require('../../../services/geocoding-service');
      const mockGeocodingService = {
        geocodeAddress: vi.fn().mockResolvedValue({
          latitude: 46.947974,
          longitude: 7.447447,
          accuracy: 0.9,
          formattedAddress: 'Bahnhofstrasse 15, 3001 Bern, Switzerland',
        }),
      };
      vi.mocked(GeocodingService).mockImplementation(() => mockGeocodingService);

      // Mock database operations
      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };
      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };
      vi.mocked((await import('../../../database/connection')).db.getPool).mockResolvedValue(
        mockPool
      );

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({
          // SELECT previous address
          rows: [
            {
              home_street: 'Old Street',
              home_city: 'Old City',
              home_postal_code: '1234',
              home_country: 'Switzerland',
              home_location: 'old_location',
            },
          ],
        })
        .mockResolvedValueOnce({
          // UPDATE employees
          rows: [
            {
              ...mockEmployee,
              home_street: 'Bahnhofstrasse 15',
              home_city: 'Bern',
              home_postal_code: '3001',
              home_location: 'new_location',
            },
          ],
        })
        .mockResolvedValueOnce() // INSERT into address history
        .mockResolvedValueOnce(); // COMMIT

      // Mock pending requests check
      vi.mocked((await import('../../../database/connection')).db.query).mockResolvedValueOnce({
        rows: [],
      });

      const result = await updateEmployeeAddress(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.home_city).toBe('Bern');
    });

    it('should reject invalid postal code format', async () => {
      const invalidAddress = {
        ...validAddressUpdate,
        home_postal_code: 'INVALID',
      };
      const mockEvent = createMockEvent('PUT', { id: 'user-123' }, invalidAddress);

      await expect(updateEmployeeAddress(mockEvent, mockContext)).rejects.toThrow(
        'Validation failed'
      );
    });

    it('should reject access for non-owner non-manager', async () => {
      const mockEvent = createMockEvent('PUT', { id: 'employee-456' }, validAddressUpdate);

      await expect(updateEmployeeAddress(mockEvent, mockContext)).rejects.toThrow(
        'Access denied: can only update own profile or manager access required'
      );
    });

    it('should allow manager to update any employee address', async () => {
      const mockEvent = createMockEvent('PUT', { id: 'employee-456' }, validAddressUpdate);

      // Mock manager context
      const authUtils = await import('../../../handlers/auth/auth-utils');
      vi.mocked(authUtils.getUserContextFromEvent).mockReturnValue({
        sub: 'manager-123',
        email: 'manager@company.com',
        cognitoUsername: 'manageruser',
        isManager: true,
        groups: ['managers'],
      });

      // Mock successful update (same mocking as successful update test)
      const { GeocodingService } = require('../../../services/geocoding-service');
      const mockGeocodingService = {
        geocodeAddress: vi.fn().mockResolvedValue({
          latitude: 46.947974,
          longitude: 7.447447,
        }),
      };
      vi.mocked(GeocodingService).mockImplementation(() => mockGeocodingService);

      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };
      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      };
      vi.mocked((await import('../../../database/connection')).db.getPool).mockResolvedValue(
        mockPool
      );

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [{}] }) // SELECT previous
        .mockResolvedValueOnce({ rows: [mockEmployee] }) // UPDATE
        .mockResolvedValueOnce() // INSERT history
        .mockResolvedValueOnce(); // COMMIT

      vi.mocked((await import('../../../database/connection')).db.query).mockResolvedValueOnce({
        rows: [],
      }); // pending requests

      const result = await updateEmployeeAddress(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });
  });
});
