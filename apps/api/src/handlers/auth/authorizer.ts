import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult, Context } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { logger } from '../../middleware/logger';

interface CognitoPayload {
  sub: string;
  email: string;
  'cognito:groups'?: string[];
  'cognito:username': string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  token_use: string;
}

interface MockPayload {
  email: string;
  isManager: boolean;
  isAdmin: boolean;
  groups: string[];
}

class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

// JWT Verifier instance for Cognito tokens
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID || '',
  tokenUse: 'access',
  clientId: process.env.COGNITO_CLIENT_ID || '',
});

// Create mock payload from token for bypass mode
function createMockPayload(token: string): MockPayload {
  // Extract mock user email from token like "mock-jwt-token-employee1@company.ch"
  let email = 'employee1@company.ch'; // Default fallback

  if (token.startsWith('mock-jwt-token-')) {
    email = token.replace('mock-jwt-token-', '');
  }

  // Determine role based on email pattern
  let groups = ['employees'];
  let isManager = false;
  let isAdmin = false;

  if (email.includes('admin')) {
    groups = ['administrators', 'managers', 'employees'];
    isManager = true;
    isAdmin = true;
  } else if (email.includes('manager')) {
    groups = ['managers', 'employees'];
    isManager = true;
  }

  return {
    email,
    isManager,
    isAdmin,
    groups,
  };
}

export const authorizerHandler = async (
  event: APIGatewayTokenAuthorizerEvent,
  context: Context
): Promise<APIGatewayAuthorizerResult> => {
  logger.info('Authorizer invoked', {
    methodArn: event.methodArn,
    requestId: context.awsRequestId,
    bypassAuth: process.env.BYPASS_AUTH,
  });

  try {
    // Extract token from Authorization header
    const token = extractTokenFromHeader(event.authorizationToken);

    // Check if authorization bypass is enabled
    if (process.env.BYPASS_AUTH === 'true') {
      logger.info('Authorization bypass enabled - using mock authentication', {
        requestId: context.awsRequestId,
      });

      const mockPayload = createMockPayload(token);

      // Generate IAM policy for mock user
      const policy = generatePolicy(mockPayload.email, 'Allow', event.methodArn);

      // Add mock user context
      policy.context = {
        sub: mockPayload.email,
        email: mockPayload.email,
        cognitoUsername: mockPayload.email,
        isManager: mockPayload.isManager.toString(),
        isAdmin: mockPayload.isAdmin.toString(),
        groups: JSON.stringify(mockPayload.groups),
      };

      logger.info('Mock authorization successful', {
        sub: mockPayload.email,
        email: mockPayload.email,
        isManager: mockPayload.isManager,
        isAdmin: mockPayload.isAdmin,
        requestId: context.awsRequestId,
      });

      return policy;
    }

    // Normal Cognito JWT verification
    const payload = await verifyToken(token);

    // Generate IAM policy
    const policy = generatePolicy(payload.sub, 'Allow', event.methodArn);

    // Add user context
    policy.context = {
      sub: payload.sub,
      email: payload.email,
      cognitoUsername: payload['cognito:username'],
      isManager: isUserManager(payload),
      isAdmin: isUserAdmin(payload),
      groups: JSON.stringify(payload['cognito:groups'] || []),
    };

    logger.info('Authorization successful', {
      sub: payload.sub,
      email: payload.email,
      isManager: policy.context.isManager,
      requestId: context.awsRequestId,
    });

    return policy;
  } catch (error) {
    logger.error('Authorization failed', {
      error: error.message,
      stack: error.stack,
      methodArn: event.methodArn,
      requestId: context.awsRequestId,
    });

    // Return deny policy for any authorization failures
    throw new Error('Unauthorized');
  }
};

function extractTokenFromHeader(authHeader: string): string {
  if (!authHeader) {
    throw new AuthorizationError('Missing authorization header');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AuthorizationError('Invalid authorization header format');
  }

  return parts[1];
}

async function verifyToken(token: string): Promise<CognitoPayload> {
  try {
    const payload = (await verifier.verify(token)) as CognitoPayload;

    // Additional token validation
    if (!payload.sub || !payload.email) {
      throw new AuthorizationError('Invalid token claims');
    }

    if (payload.token_use !== 'access') {
      throw new AuthorizationError('Invalid token use');
    }

    return payload;
  } catch (error) {
    if (error.name === 'JwtExpiredError') {
      throw new AuthorizationError('Token expired');
    }
    if (error.name === 'JwtInvalidSignatureError') {
      throw new AuthorizationError('Invalid token signature');
    }
    if (error.name === 'JwtInvalidClaimError') {
      throw new AuthorizationError('Invalid token claims');
    }

    throw new AuthorizationError(`Token verification failed: ${error.message}`);
  }
}

function isUserManager(payload: CognitoPayload): boolean {
  const groups = payload['cognito:groups'] || [];
  return groups.includes('managers');
}

function isUserAdmin(payload: CognitoPayload): boolean {
  const groups = payload['cognito:groups'] || [];
  return groups.includes('administrators');
}

function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
}

// Health check specific authorizer that allows unauthenticated access
export const healthAuthorizerHandler = async (
  event: APIGatewayTokenAuthorizerEvent,
  _context: Context
): Promise<APIGatewayAuthorizerResult> => {
  // Allow health check without authentication
  if (event.methodArn.includes('/health')) {
    return generatePolicy('health-check', 'Allow', event.methodArn);
  }

  // For all other endpoints, require authentication
  return authorizerHandler(event, _context);
};
