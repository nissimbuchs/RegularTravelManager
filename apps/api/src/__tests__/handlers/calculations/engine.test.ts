import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { 
  calculateDistance, 
  calculateAllowance, 
  calculateTravelCost,
  getCalculationAudit,
  invalidateCalculationCache,
  cleanupExpiredCache
} from '../../../handlers/calculations/engine';

// Mock dependencies
vi.mock('../../../database/connection');
vi.mock('../../../handlers/auth/auth-utils');

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
  succeed: () => {}
};

const createMockEvent = (
  method: string, 
  body?: any,
  queryParams?: Record<string, string>
): APIGatewayProxyEvent => ({
  httpMethod: method,
  path: '/api/v1/calculations',
  pathParameters: null,
  queryStringParameters: queryParams || null,
  headers: {},
  body: body ? JSON.stringify(body) : null,
  isBase64Encoded: false,
  stageVariables: null,
  requestContext: {
    requestId: 'test-request',
    stage: 'dev',
    resourceId: 'resource-id',
    resourcePath: '/calculations',
    httpMethod: method,
    path: '/api/v1/calculations',
    protocol: 'HTTP/1.1',
    requestTime: '2025-08-31T10:00:00Z',
    requestTimeEpoch: 1693483200000,
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
      clientCert: null
    },
    domainName: 'api.test.com',
    apiId: 'api-id',
    accountId: '123456789',
    authorizer: {
      sub: 'user-123',
      email: 'test@company.com',
      isManager: 'false',
      groups: '["employees"]'
    }
  },
  resource: '/calculations',
  multiValueHeaders: {},
  multiValueQueryStringParameters: null
});

// Swiss test coordinates
const zurichCoords = { latitude: 47.376887, longitude: 8.540192 };
const bernCoords = { latitude: 46.947974, longitude: 7.447447 };

describe('Calculation Engine Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock getUserContextFromEvent
    const { getUserContextFromEvent } = require('../../../handlers/auth/auth-utils');
    vi.mocked(getUserContextFromEvent).mockReturnValue({
      sub: 'user-123',
      email: 'test@company.com',
      cognitoUsername: 'testuser',
      isManager: false,
      groups: ['employees']
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between Zurich and Bern', async () => {
      const requestBody = {
        employeeLocation: zurichCoords,
        subprojectLocation: bernCoords,
        useCache: true
      };
      const mockEvent = createMockEvent('POST', requestBody);

      // Mock database query for cached distance calculation
      const { db } = require('../../../database/connection');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ distance: 93.752 }] // Approximate distance Zurich-Bern
      });

      const result = await calculateDistance(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.distanceKm).toBe(93.752);
      expect(body.data.calculationTimestamp).toBeDefined();
    });

    it('should validate coordinate bounds', async () => {
      const invalidRequestBody = {
        employeeLocation: { latitude: 91, longitude: 8.540192 }, // Invalid latitude
        subprojectLocation: bernCoords
      };
      const mockEvent = createMockEvent('POST', invalidRequestBody);

      await expect(calculateDistance(mockEvent, mockContext))
        .rejects.toThrow('Validation failed');
    });

    it('should handle calculation without cache', async () => {
      const requestBody = {
        employeeLocation: zurichCoords,
        subprojectLocation: bernCoords,
        useCache: false
      };
      const mockEvent = createMockEvent('POST', requestBody);

      // Mock direct distance calculation
      const { db } = require('../../../database/connection');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ distance: 93.752 }]
      });

      const result = await calculateDistance(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.distanceKm).toBe(93.752);
    });
  });

  describe('calculateAllowance', () => {
    it('should calculate daily allowance correctly', async () => {
      const requestBody = {
        distanceKm: 93.752,
        costPerKm: 0.68 // CHF per km
      };
      const mockEvent = createMockEvent('POST', requestBody);

      // Mock allowance calculation (93.752 * 0.68 = 63.75)
      const { db } = require('../../../database/connection');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ allowance: 63.75 }]
      });

      const result = await calculateAllowance(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.allowanceChf).toBe(63.75);
      expect(body.data.distanceKm).toBe(93.752);
      expect(body.data.costPerKm).toBe(0.68);
      expect(body.data.days).toBe(1);
    });

    it('should calculate multi-day allowance', async () => {
      const requestBody = {
        distanceKm: 50,
        costPerKm: 0.70,
        days: 5
      };
      const mockEvent = createMockEvent('POST', requestBody);

      // Mock allowance calculation (50 * 0.70 = 35.00 per day)
      const { db } = require('../../../database/connection');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ allowance: 35.00 }]
      });

      const result = await calculateAllowance(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.allowanceChf).toBe(175.00); // 35 * 5 days
    });

    it('should validate positive values', async () => {
      const invalidRequestBody = {
        distanceKm: -10,
        costPerKm: 0.70
      };
      const mockEvent = createMockEvent('POST', invalidRequestBody);

      await expect(calculateAllowance(mockEvent, mockContext))
        .rejects.toThrow('Validation failed');
    });
  });

  describe('calculateTravelCost', () => {
    it('should calculate complete travel cost for employee and subproject', async () => {
      const requestBody = {
        employeeId: 'employee-123',
        subprojectId: 'subproject-456'
      };
      const mockEvent = createMockEvent('POST', requestBody);

      // Mock database queries
      const { db } = require('../../../database/connection');
      
      // Mock employee location query
      vi.mocked(db.query)
        .mockResolvedValueOnce({
          rows: [{ latitude: 47.376887, longitude: 8.540192 }] // Zurich
        })
        // Mock subproject location and cost rate query
        .mockResolvedValueOnce({
          rows: [{
            cost_per_km: 0.68,
            default_cost_per_km: 0.65,
            latitude: 46.947974,
            longitude: 7.447447 // Bern
          }]
        })
        // Mock travel cost calculation
        .mockResolvedValueOnce({
          rows: [{
            distance_km: 93.752,
            daily_allowance_chf: 63.75
          }]
        })
        // Mock audit record creation
        .mockResolvedValueOnce({});

      const result = await calculateTravelCost(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.distanceKm).toBe(93.752);
      expect(body.data.dailyAllowanceChf).toBe(63.75);
      expect(body.data.weeklyAllowanceChf).toBe(318.75); // 63.75 * 5
      expect(body.data.monthlyAllowanceChf).toBe(1402.5); // 63.75 * 22
      expect(body.data.cacheUsed).toBe(true);
    });

    it('should handle missing employee', async () => {
      const requestBody = {
        employeeId: 'nonexistent-employee',
        subprojectId: 'subproject-456'
      };
      const mockEvent = createMockEvent('POST', requestBody);

      // Mock empty employee result
      const { db } = require('../../../database/connection');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: []
      });

      await expect(calculateTravelCost(mockEvent, mockContext))
        .rejects.toThrow('Employee not found');
    });

    it('should handle missing subproject', async () => {
      const requestBody = {
        employeeId: 'employee-123',
        subprojectId: 'nonexistent-subproject'
      };
      const mockEvent = createMockEvent('POST', requestBody);

      // Mock employee exists but subproject doesn't
      const { db } = require('../../../database/connection');
      vi.mocked(db.query)
        .mockResolvedValueOnce({
          rows: [{ latitude: 47.376887, longitude: 8.540192 }]
        })
        .mockResolvedValueOnce({
          rows: []
        });

      await expect(calculateTravelCost(mockEvent, mockContext))
        .rejects.toThrow('Subproject not found');
    });
  });

  describe('getCalculationAudit', () => {
    it('should retrieve calculation audit records', async () => {
      const mockEvent = createMockEvent('GET', null, { 
        employeeId: 'employee-123',
        limit: '10' 
      });

      // Mock audit query
      const { db } = require('../../../database/connection');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{
          id: 'audit-123',
          calculation_type: 'travel_cost',
          employee_id: 'employee-123',
          subproject_id: 'subproject-456',
          employee_latitude: 47.376887,
          employee_longitude: 8.540192,
          subproject_latitude: 46.947974,
          subproject_longitude: 7.447447,
          cost_per_km: 0.68,
          distance_km: 93.752,
          daily_allowance_chf: 63.75,
          calculation_timestamp: new Date().toISOString(),
          calculation_version: '1.0',
          request_context: { requestId: 'test-123' }
        }]
      });

      const result = await getCalculationAudit(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.auditRecords).toHaveLength(1);
      expect(body.data.auditRecords[0].calculationType).toBe('travel_cost');
      expect(body.data.auditRecords[0].distanceKm).toBe(93.752);
    });
  });

  describe('invalidateCalculationCache', () => {
    it('should invalidate cache by location', async () => {
      const requestBody = {
        location: zurichCoords
      };
      const mockEvent = createMockEvent('POST', requestBody);

      // Mock cache invalidation
      const { db } = require('../../../database/connection');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ deleted_count: 5 }]
      });

      const result = await invalidateCalculationCache(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.deletedCount).toBe(5);
      expect(body.data.message).toBe('Invalidated 5 cache entries');
    });

    it('should invalidate cache by employee ID', async () => {
      const requestBody = {
        employeeId: 'employee-123'
      };
      const mockEvent = createMockEvent('POST', requestBody);

      // Mock cache invalidation
      const { db } = require('../../../database/connection');
      vi.mocked(db.query).mockResolvedValueOnce({
        rowCount: 3
      });

      const result = await invalidateCalculationCache(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.deletedCount).toBe(3);
    });
  });

  describe('cleanupExpiredCache', () => {
    it('should cleanup expired cache entries', async () => {
      const mockEvent = createMockEvent('POST');

      // Mock cache cleanup
      const { db } = require('../../../database/connection');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ deleted_count: 12 }]
      });

      const result = await cleanupExpiredCache(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.deletedCount).toBe(12);
      expect(body.data.message).toBe('Cleaned up 12 expired cache entries');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle zero distance calculation', async () => {
      const requestBody = {
        employeeLocation: zurichCoords,
        subprojectLocation: zurichCoords // Same location
      };
      const mockEvent = createMockEvent('POST', requestBody);

      // Mock zero distance result
      const { db } = require('../../../database/connection');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ distance: 0.000 }]
      });

      const result = await calculateDistance(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.distanceKm).toBe(0);
    });

    it('should handle database calculation errors', async () => {
      const requestBody = {
        employeeLocation: zurichCoords,
        subprojectLocation: bernCoords
      };
      const mockEvent = createMockEvent('POST', requestBody);

      // Mock database error
      const { db } = require('../../../database/connection');
      vi.mocked(db.query).mockRejectedValueOnce(
        new Error('Coordinates must be in WGS84 coordinate system')
      );

      await expect(calculateDistance(mockEvent, mockContext))
        .rejects.toThrow('Distance calculation failed');
    });

    it('should validate CHF precision in allowance calculation', async () => {
      const requestBody = {
        distanceKm: 93.752,
        costPerKm: 0.683 // This should round to proper CHF precision
      };
      const mockEvent = createMockEvent('POST', requestBody);

      // Mock allowance calculation with proper rounding
      const { db } = require('../../../database/connection');
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ allowance: 64.03 }] // Properly rounded CHF amount
      });

      const result = await calculateAllowance(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.allowanceChf).toBe(64.03);
    });
  });
});