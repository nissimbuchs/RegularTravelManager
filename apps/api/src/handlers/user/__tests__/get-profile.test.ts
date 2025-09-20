import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { getProfileHandler } from '../get-profile';
import { db } from '../../../database/connection';
import { getUserContextFromEvent } from '../../auth/auth-utils';
import { formatResponse } from '../../../middleware/response-formatter';

// Mock dependencies
vi.mock('../../../database/connection');
vi.mock('../../auth/auth-utils');
vi.mock('../../../middleware/response-formatter');

describe('getProfileHandler', () => {
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

  const mockUserContext = {
    cognitoUserId: 'test-user-123',
    email: 'test@example.com',
    role: 'employee',
  };

  const mockUserProfile = {
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
    longitude: '8.5417',
    latitude: '47.3769',
    notification_preferences: {
      email: true,
      requestUpdates: true,
      weeklyDigest: false,
      maintenanceAlerts: true,
    },
    privacy_settings: {
      profileVisibility: 'team',
      allowAnalytics: true,
      shareLocationData: true,
      allowManagerAccess: true,
      dataRetentionConsent: true,
    },
    profile_updated_at: new Date(),
    email_verified_at: new Date(),
    last_login_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserContextFromEvent).mockReturnValue(mockUserContext);
    vi.mocked(formatResponse).mockImplementation((status, data, requestId) => ({
      statusCode: status,
      body: JSON.stringify({ data, requestId }),
    }));
  });

  describe('User accessing own profile', () => {
    it('should successfully retrieve user profile', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'GET',
        pathParameters: null,
        headers: {},
        body: null,
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      vi.mocked(db.query).mockResolvedValue({
        rows: [mockUserProfile],
      });

      const result = await getProfileHandler(mockEvent, mockContext);

      expect(getUserContextFromEvent).toHaveBeenCalledWith(mockEvent);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), ['test-user-123']);
      expect(formatResponse).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          id: '123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
        }),
        'test-request-id'
      );
      expect(result.statusCode).toBe(200);
    });

    it('should handle user not found', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'GET',
        pathParameters: null,
        headers: {},
        body: null,
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      vi.mocked(db.query).mockResolvedValue({
        rows: [],
      });

      const result = await getProfileHandler(mockEvent, mockContext);

      expect(formatResponse).toHaveBeenCalledWith(
        404,
        expect.objectContaining({
          code: 'USER_NOT_FOUND',
          message: 'User profile not found',
        }),
        'test-request-id'
      );
      expect(result.statusCode).toBe(404);
    });

    it('should handle database errors gracefully', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'GET',
        pathParameters: null,
        headers: {},
        body: null,
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      vi.mocked(db.query).mockRejectedValue(new Error('Database connection failed'));

      const result = await getProfileHandler(mockEvent, mockContext);

      expect(formatResponse).toHaveBeenCalledWith(
        500,
        expect.objectContaining({
          code: 'PROFILE_FETCH_ERROR',
          message: 'Failed to retrieve user profile',
        }),
        'test-request-id'
      );
      expect(result.statusCode).toBe(500);
    });
  });

  describe('Admin accessing user profile', () => {
    it('should allow admin to access other user profiles', async () => {
      const adminContext = {
        ...mockUserContext,
        role: 'administrator',
      };

      vi.mocked(getUserContextFromEvent).mockReturnValue(adminContext);

      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/admin/users/target-user-456/profile',
        httpMethod: 'GET',
        pathParameters: { userId: 'target-user-456' },
        headers: {},
        body: null,
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      vi.mocked(db.query).mockResolvedValue({
        rows: [mockUserProfile],
      });

      const result = await getProfileHandler(mockEvent, mockContext);

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), ['target-user-456']);
      expect(result.statusCode).toBe(200);
    });

    it('should deny non-admin access to other profiles', async () => {
      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/admin/users/target-user-456/profile',
        httpMethod: 'GET',
        pathParameters: { userId: 'target-user-456' },
        headers: {},
        body: null,
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await getProfileHandler(mockEvent, mockContext);

      expect(formatResponse).toHaveBeenCalledWith(
        403,
        expect.objectContaining({
          code: 'FORBIDDEN',
          message: 'Only administrators can access other user profiles',
        }),
        'test-request-id'
      );
      expect(result.statusCode).toBe(403);
    });
  });

  describe('Profile data transformation', () => {
    it('should handle missing optional fields', async () => {
      const minimalProfile = {
        ...mockUserProfile,
        phone_number: null,
        longitude: null,
        latitude: null,
        notification_preferences: null,
        privacy_settings: null,
        profile_updated_at: null,
        email_verified_at: null,
        last_login_at: null,
      };

      const mockEvent: APIGatewayProxyEvent = {
        path: '/api/user/profile',
        httpMethod: 'GET',
        pathParameters: null,
        headers: {},
        body: null,
        isBase64Encoded: false,
        queryStringParameters: null,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      vi.mocked(db.query).mockResolvedValue({
        rows: [minimalProfile],
      });

      const result = await getProfileHandler(mockEvent, mockContext);

      expect(formatResponse).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          phoneNumber: null,
          homeCoordinates: undefined,
          notificationPreferences: expect.objectContaining({
            email: true,
            requestUpdates: true,
            weeklyDigest: false,
            maintenanceAlerts: true,
          }),
        }),
        'test-request-id'
      );
      expect(result.statusCode).toBe(200);
    });
  });
});
