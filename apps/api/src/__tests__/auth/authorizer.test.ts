import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { APIGatewayTokenAuthorizerEvent, Context } from 'aws-lambda';

// Mock the aws-jwt-verify module
vi.mock('aws-jwt-verify', () => {
  const mockVerify = vi.fn();
  return {
    CognitoJwtVerifier: {
      create: vi.fn(() => ({
        verify: mockVerify,
      })),
    },
  };
});

// Import after mocking
import { authorizerHandler } from '../../handlers/auth/authorizer';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

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

const createMockEvent = (token: string): APIGatewayTokenAuthorizerEvent => ({
  type: 'TOKEN',
  authorizationToken: token,
  methodArn: 'arn:aws:execute-api:eu-central-1:123456789:abcdef123/dev/GET/api/v1/employees',
});

const mockValidPayload = {
  sub: 'user-123',
  email: 'test@company.com',
  'cognito:username': 'testuser',
  'cognito:groups': ['employees'],
  aud: 'client-id',
  iss: 'https://cognito-idp.region.amazonaws.com/user-pool-id',
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  token_use: 'access',
};

const mockManagerPayload = {
  ...mockValidPayload,
  'cognito:groups': ['managers'],
};

describe('Lambda Authorizer', () => {
  let mockVerify: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COGNITO_USER_POOL_ID = 'test-user-pool';
    process.env.COGNITO_CLIENT_ID = 'test-client-id';

    // Get the mock verify function from the mocked module
    const mockVerifier = (CognitoJwtVerifier.create as Mock)();
    mockVerify = mockVerifier.verify as Mock;
  });

  it('should authorize valid employee token', async () => {
    const mockEvent = createMockEvent('Bearer valid-token');

    // Mock JWT verifier to return valid employee payload
    mockVerify.mockResolvedValue(mockValidPayload);

    const result = await authorizerHandler(mockEvent, mockContext);

    expect(result.principalId).toBe('user-123');
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(result.context?.sub).toBe('user-123');
    expect(result.context?.email).toBe('test@company.com');
    expect(result.context?.isManager).toBe(false);
  });

  it('should authorize valid manager token', async () => {
    const mockEvent = createMockEvent('Bearer manager-token');

    // Mock JWT verifier to return valid manager payload
    mockVerify.mockResolvedValue(mockManagerPayload);

    const result = await authorizerHandler(mockEvent, mockContext);

    expect(result.principalId).toBe('user-123');
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(result.context?.isManager).toBe(true);
  });

  it('should reject missing authorization header', async () => {
    const mockEvent = createMockEvent('');

    await expect(authorizerHandler(mockEvent, mockContext)).rejects.toThrow('Unauthorized');
  });

  it('should reject invalid authorization header format', async () => {
    const mockEvent = createMockEvent('InvalidFormat token');

    await expect(authorizerHandler(mockEvent, mockContext)).rejects.toThrow('Unauthorized');
  });

  it('should reject expired token', async () => {
    const mockEvent = createMockEvent('Bearer expired-token');

    // Mock JWT verifier to throw expired error
    const expiredError = new Error('Token expired');
    expiredError.name = 'JwtExpiredError';
    mockVerify.mockRejectedValue(expiredError);

    await expect(authorizerHandler(mockEvent, mockContext)).rejects.toThrow('Unauthorized');
  });

  it('should reject token with invalid signature', async () => {
    const mockEvent = createMockEvent('Bearer invalid-signature-token');

    // Mock JWT verifier to throw signature error
    const signatureError = new Error('Invalid signature');
    signatureError.name = 'JwtInvalidSignatureError';
    mockVerify.mockRejectedValue(signatureError);

    await expect(authorizerHandler(mockEvent, mockContext)).rejects.toThrow('Unauthorized');
  });

  it('should reject token with invalid claims', async () => {
    const mockEvent = createMockEvent('Bearer invalid-claims-token');

    // Mock JWT verifier to return payload with missing claims
    mockVerify.mockResolvedValue({
      ...mockValidPayload,
      sub: undefined, // Missing required claim
    });

    await expect(authorizerHandler(mockEvent, mockContext)).rejects.toThrow('Unauthorized');
  });

  it('should reject token with wrong token use', async () => {
    const mockEvent = createMockEvent('Bearer wrong-use-token');

    // Mock JWT verifier to return id token instead of access token
    mockVerify.mockResolvedValue({
      ...mockValidPayload,
      token_use: 'id', // Wrong token use
    });

    await expect(authorizerHandler(mockEvent, mockContext)).rejects.toThrow('Unauthorized');
  });

  it('should handle users without groups', async () => {
    const mockEvent = createMockEvent('Bearer no-groups-token');

    // Mock JWT verifier to return payload without groups
    mockVerify.mockResolvedValue({
      ...mockValidPayload,
      'cognito:groups': undefined,
    });

    const result = await authorizerHandler(mockEvent, mockContext);

    expect(result.principalId).toBe('user-123');
    expect(result.context?.isManager).toBe(false);
    expect(JSON.parse((result.context?.groups as string) || '[]')).toEqual([]);
  });
});
