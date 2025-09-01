import { describe, it, expect, vi } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { corsMiddleware } from '../../middleware/cors';

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

const createMockEvent = (httpMethod: string): APIGatewayProxyEvent => ({
  httpMethod,
  path: '/test',
  pathParameters: null,
  queryStringParameters: null,
  headers: {},
  body: null,
  isBase64Encoded: false,
  stageVariables: null,
  requestContext: {
    requestId: 'test-request',
    stage: 'dev',
    resourceId: 'resource-id',
    resourcePath: '/test',
    httpMethod,
    path: '/test',
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
    authorizer: null,
  },
  resource: '/test',
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
});

describe('CORS Middleware', () => {
  it('should handle OPTIONS preflight request', async () => {
    const mockEvent = createMockEvent('OPTIONS');
    const mockHandler = vi.fn();

    const corsHandler = corsMiddleware(mockHandler);
    const result = await corsHandler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers['Access-Control-Allow-Methods']).toContain('GET,POST,PUT,DELETE,OPTIONS');
    expect(result.headers['Access-Control-Allow-Headers']).toContain('Content-Type,Authorization');
    expect(result.headers['Access-Control-Max-Age']).toBe('86400');

    // Handler should not be called for OPTIONS
    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should add CORS headers to regular requests', async () => {
    const mockEvent = createMockEvent('GET');
    const mockHandler = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'success' }),
    });

    const corsHandler = corsMiddleware(mockHandler);
    const result = await corsHandler(mockEvent, mockContext);

    expect(mockHandler).toHaveBeenCalledWith(mockEvent, mockContext);
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers['Access-Control-Allow-Methods']).toContain('GET,POST,PUT,DELETE,OPTIONS');
    expect(result.headers['Content-Type']).toBe('application/json'); // Original header preserved
  });

  it('should preserve existing headers from handler', async () => {
    const mockEvent = createMockEvent('POST');
    const mockHandler = vi.fn().mockResolvedValue({
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
      },
      body: JSON.stringify({ id: '123' }),
    });

    const corsHandler = corsMiddleware(mockHandler);
    const result = await corsHandler(mockEvent, mockContext);

    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(result.headers['X-Custom-Header']).toBe('custom-value');
    expect(result.headers['Content-Type']).toBe('application/json');
  });
});
