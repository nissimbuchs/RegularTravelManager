import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { healthHandler } from '../../handlers/health';
import * as dbConnection from '../../database/connection';

// Mock the database connection
vi.mock('../../database/connection');

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

const mockEvent: APIGatewayProxyEvent = {
  httpMethod: 'GET',
  path: '/health',
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
    resourcePath: '/health',
    httpMethod: 'GET',
    path: '/health',
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
      clientCert: null
    },
    domainName: 'api.test.com',
    apiId: 'api-id',
    accountId: '123456789',
    authorizer: null
  },
  resource: '/health',
  multiValueHeaders: {},
  multiValueQueryStringParameters: null
};

describe('Health Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return healthy status when database connection is successful', async () => {
    // Mock successful database connection
    vi.mocked(dbConnection.testDatabaseConnection).mockResolvedValue();

    const result = await healthHandler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.headers['Access-Control-Allow-Origin']).toBe('*');

    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('healthy');
    expect(body.data.services.database.status).toBe('healthy');
    expect(body.requestId).toBe('test-request-id');
    expect(body.timestamp).toBeDefined();
  });

  it('should return degraded status when database connection fails', async () => {
    // Mock failed database connection
    vi.mocked(dbConnection.testDatabaseConnection).mockRejectedValue(new Error('Connection failed'));

    const result = await healthHandler(mockEvent, mockContext);

    expect(result.statusCode).toBe(200);
    
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('degraded');
    expect(body.data.services.database.status).toBe('unhealthy');
  });

  it('should return proper error response when handler fails completely', async () => {
    // Mock complete handler failure
    vi.mocked(dbConnection.testDatabaseConnection).mockImplementation(() => {
      throw new Error('Critical failure');
    });

    const result = await healthHandler(mockEvent, mockContext);

    expect(result.statusCode).toBe(503);
    
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBeDefined();
  });

  it('should include response time measurements', async () => {
    vi.mocked(dbConnection.testDatabaseConnection).mockResolvedValue();

    const result = await healthHandler(mockEvent, mockContext);
    
    const body = JSON.parse(result.body);
    expect(body.data.services.database.responseTime).toBeGreaterThanOrEqual(0);
    expect(body.data.services.cognito.responseTime).toBeGreaterThanOrEqual(0);
    expect(body.data.services.ses.responseTime).toBeGreaterThanOrEqual(0);
  });

  it('should include version information', async () => {
    process.env.API_VERSION = '1.2.3';
    vi.mocked(dbConnection.testDatabaseConnection).mockResolvedValue();

    const result = await healthHandler(mockEvent, mockContext);
    
    const body = JSON.parse(result.body);
    expect(body.data.version).toBe('1.2.3');
    
    delete process.env.API_VERSION;
  });
});