import { APIGatewayRequestAuthorizerEvent, APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult, Context } from 'aws-lambda';
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

// JWT Verifier instance for Cognito tokens (lazy initialization)
let verifier: any = null;

function getVerifier() {
  if (!verifier) {
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    const clientId = process.env.COGNITO_CLIENT_ID;
    const region = process.env.AWS_REGION || 'eu-central-1';

    logger.info('Initializing Cognito JWT verifier', {
      userPoolId: userPoolId ? `${userPoolId.substring(0, 10)}...` : 'undefined',
      clientId: clientId ? `${clientId.substring(0, 10)}...` : 'undefined',
      region,
      hasUserPoolId: !!userPoolId,
      hasClientId: !!clientId,
    });

    if (!userPoolId || !clientId) {
      logger.error('Missing Cognito configuration', {
        hasUserPoolId: !!userPoolId,
        hasClientId: !!clientId,
        region,
      });
      throw new Error(
        'Missing required Cognito configuration: COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID environment variables are required'
      );
    }

    try {
      verifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: 'access',
        clientId,
      });
      logger.info('Cognito JWT verifier created successfully', {
        userPoolId: `${userPoolId.substring(0, 10)}...`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to create Cognito JWT verifier', {
        error: errorMessage,
        userPoolId: userPoolId ? `${userPoolId.substring(0, 10)}...` : 'undefined',
        clientId: clientId ? `${clientId.substring(0, 10)}...` : 'undefined',
      });
      throw error;
    }
  }
  return verifier;
}

// Create mock payload from token for bypass mode
async function createMockPayload(token: string): Promise<MockPayload> {
  // Extract mock identifier from token - can be email or UUID
  let identifier = 'employee1@company.ch'; // Default fallback
  let email = 'employee1@company.ch';

  if (token.startsWith('mock-jwt-token-')) {
    identifier = token.replace('mock-jwt-token-', '');
    
    // Check if identifier is a UUID (mock UUID format) or email
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(identifier)) {
      // It's a UUID - look up by cognito_user_id
      // Don't set email yet, we'll get it from the database lookup
      email = ''; // Will be set from database
    } else {
      // It's an email - use as-is
      email = identifier;
    }
  }

  // Look up the actual user data from the database
  let cognitoUserId = identifier; // Will be updated from database
  
  try {
    // Use the existing database connection system
    const { db, getDatabaseConfig } = await import('../../database/connection');
    
    // Always ensure database is configured (safe to call multiple times)
    const config = await getDatabaseConfig();
    db.configure(config);
    
    let result;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidPattern.test(identifier)) {
      // Query by cognito_user_id (UUID)
      result = await db.query(
        'SELECT cognito_user_id, first_name, last_name, employee_id, email FROM employees WHERE cognito_user_id = $1 LIMIT 1',
        [identifier]
      );
    } else {
      // Query by email - fallback to old employee_id pattern matching
      let employeeIdPattern = '';
      if (email.includes('admin1')) {
        employeeIdPattern = 'ADM-0001';
      } else if (email.includes('admin2')) {
        employeeIdPattern = 'ADM-0002';
      } else if (email.includes('manager1')) {
        employeeIdPattern = 'MGR-0001';
      } else if (email.includes('manager2')) {
        employeeIdPattern = 'MGR-0002';
      } else if (email.includes('employee1')) {
        employeeIdPattern = 'EMP-0001';
      } else if (email.includes('employee2')) {
        employeeIdPattern = 'EMP-0002';
      } else if (email.includes('employee3')) {
        employeeIdPattern = 'EMP-0003';
      } else if (email.includes('employee4')) {
        employeeIdPattern = 'EMP-0004';
      } else if (email.includes('employee5')) {
        employeeIdPattern = 'EMP-0005';
      } else if (email.includes('employee6')) {
        employeeIdPattern = 'EMP-0006';
      }

      result = await db.query(
        'SELECT cognito_user_id, first_name, last_name, employee_id, email FROM employees WHERE employee_id = $1 LIMIT 1',
        [employeeIdPattern]
      );
    }
    
    if (result.rows.length > 0) {
      cognitoUserId = result.rows[0].cognito_user_id;
      // If we looked up by UUID, get the email from the result
      if (!email && result.rows[0].email) {
        email = result.rows[0].email;
      }
      logger.info('Mock user lookup successful', {
        identifier,
        email,
        cognitoUserId: cognitoUserId ? `${cognitoUserId.substring(0, 8)}...` : 'null',
        found: true,
        lookupMethod: uuidPattern.test(identifier) ? 'UUID' : 'email',
      });
    } else {
      logger.warn('Mock user not found in database', {
        identifier,
        email,
        fallbackToEmail: true,
        lookupMethod: uuidPattern.test(identifier) ? 'UUID' : 'email',
      });
    }
  } catch (error) {
    logger.error('Database lookup failed for mock user', {
      email,
      error: error instanceof Error ? error.message : String(error),
      fallbackToEmail: true,
    });
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
    email: cognitoUserId, // Use the actual cognito_user_id from database
    isManager,
    isAdmin,
    groups,
  };
}

export const authorizerHandler = async (
  event: APIGatewayRequestAuthorizerEvent | APIGatewayTokenAuthorizerEvent,
  context: Context
): Promise<APIGatewayAuthorizerResult> => {
  const correlationId = `auth-${context.awsRequestId.substring(0, 8)}`;
  
  logger.info('Authorizer invoked with full event details', {
    methodArn: event.methodArn,
    requestId: context.awsRequestId,
    correlationId,
    eventType: 'authorizationToken' in event ? 'TOKEN' : 'REQUEST',
    bypassAuth: process.env.BYPASS_AUTH,
    cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID ? `${process.env.COGNITO_USER_POOL_ID.substring(0, 10)}...` : 'undefined',
    cognitoClientId: process.env.COGNITO_CLIENT_ID ? `${process.env.COGNITO_CLIENT_ID.substring(0, 10)}...` : 'undefined',
    awsRegion: process.env.AWS_REGION || 'eu-central-1',
    // Log the full event structure for debugging
    eventKeys: Object.keys(event),
    fullEvent: JSON.stringify(event, null, 2),
  });

  try {
    // Extract token from event (supports both TOKEN and REQUEST authorizer formats)
    let token: string;
    
    logger.info('Starting token extraction', {
      correlationId,
      eventType: 'authorizationToken' in event ? 'TOKEN' : 'REQUEST',
      hasAuthorizationToken: 'authorizationToken' in event,
      authorizationTokenValue: 'authorizationToken' in event ? event.authorizationToken : 'N/A',
      headers: 'headers' in event ? JSON.stringify(event.headers) : 'N/A',
      requestContext: 'requestContext' in event ? JSON.stringify(event.requestContext) : 'N/A',
    });
    
    if ('authorizationToken' in event) {
      // TOKEN authorizer - token passed directly
      logger.info('Using TOKEN authorizer path', {
        correlationId,
        authorizationTokenRaw: event.authorizationToken,
      });
      token = extractTokenFromHeader(event.authorizationToken);
    } else {
      // REQUEST authorizer - token in headers
      logger.info('Using REQUEST authorizer path', {
        correlationId,
        allHeaders: JSON.stringify(event.headers),
        authorizationHeader: event.headers?.Authorization,
        authorizationHeaderLowercase: event.headers?.authorization,
      });
      
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      if (!authHeader) {
        logger.error('Missing authorization header in REQUEST authorizer', {
          correlationId,
          availableHeaders: Object.keys(event.headers || {}),
          headerValues: JSON.stringify(event.headers),
        });
        throw new AuthorizationError('Missing authorization header');
      }
      token = extractTokenFromHeader(authHeader);
    }
    
    logger.info('Token extracted successfully', {
      correlationId,
      authorizerType: 'authorizationToken' in event ? 'TOKEN' : 'REQUEST',
      tokenLength: token?.length || 0,
      tokenPrefix: token ? `${token.substring(0, 20)}...` : 'none',
      hasToken: !!token,
    });

    // Check if authorization bypass is enabled
    if (process.env.BYPASS_AUTH === 'true') {
      logger.info('Authorization bypass enabled - using mock authentication', {
        requestId: context.awsRequestId,
      });

      const mockPayload = await createMockPayload(token);

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
    logger.info('Starting Cognito JWT verification', {
      correlationId,
      bypassAuth: process.env.BYPASS_AUTH,
    });

    const payload = await verifyToken(token);

    // Generate IAM policy
    const policy = generatePolicy(payload.sub, 'Allow', event.methodArn);

    // Add user context  
    // Note: Access tokens may not have email/cognitoUsername, use sub as fallback
    policy.context = {
      sub: payload.sub,
      email: payload.email || payload.sub, // Use sub as fallback for access tokens
      cognitoUsername: payload['cognito:username'] || payload.sub, // Use sub as fallback
      isManager: isUserManager(payload).toString(),
      isAdmin: isUserAdmin(payload).toString(),
      groups: JSON.stringify(payload['cognito:groups'] || []),
    };

    logger.info('Authorization successful', {
      correlationId,
      sub: payload.sub ? `${payload.sub.substring(0, 8)}...` : 'undefined',
      email: payload.email,
      isManager: policy.context.isManager,
      isAdmin: policy.context.isAdmin,
      groupCount: payload['cognito:groups']?.length || 0,
      requestId: context.awsRequestId,
    });

    return policy;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorStack = error instanceof Error ? error.stack?.substring(0, 1000) : 'No stack available';
    logger.error('Authorization failed', {
      correlationId: correlationId || 'unknown',
      error: errorMessage,
      errorName,
      stack: errorStack,
      methodArn: event.methodArn,
      requestId: context.awsRequestId,
      isAuthError: error instanceof AuthorizationError,
      bypassAuth: process.env.BYPASS_AUTH,
      authorizerType: 'authorizationToken' in event ? 'TOKEN' : 'REQUEST',
    });

    // Return deny policy for any authorization failures
    throw new Error('Unauthorized');
  }
};

function extractTokenFromHeader(authHeader: string): string {
  logger.info('Extracting token from header', {
    authHeader: authHeader ? `${authHeader.substring(0, 50)}...` : 'null/undefined',
    authHeaderLength: authHeader?.length || 0,
    authHeaderType: typeof authHeader,
  });

  if (!authHeader) {
    logger.error('Authorization header is null/undefined');
    throw new AuthorizationError('Missing authorization header');
  }

  const parts = authHeader.split(' ');
  logger.info('Authorization header parts', {
    partsCount: parts.length,
    firstPart: parts[0],
    secondPartLength: parts[1]?.length || 0,
    secondPartPrefix: parts[1] ? `${parts[1].substring(0, 20)}...` : 'none',
  });

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.error('Invalid authorization header format', {
      partsCount: parts.length,
      expectedFormat: 'Bearer <token>',
      actualFirstPart: parts[0],
      fullHeader: authHeader,
    });
    throw new AuthorizationError('Invalid authorization header format');
  }

  const token = parts[1];
  if (!token) {
    logger.error('Token part is undefined');
    throw new AuthorizationError('Invalid authorization header - missing token');
  }

  logger.info('Token extracted successfully from header', {
    tokenLength: token.length,
    tokenPrefix: `${token.substring(0, 20)}...`,
  });

  return token;
}

async function verifyToken(token: string): Promise<CognitoPayload> {
  const tokenPrefix = token ? `${token.substring(0, 20)}...` : 'none';
  
  try {
    // Log JWT header information for debugging
    let jwtHeader = null;
    try {
      const parts = token.split('.');
      if (parts.length >= 1 && parts[0]) {
        const headerPart = parts[0];
        jwtHeader = JSON.parse(Buffer.from(headerPart, 'base64').toString());
      }
    } catch (headerError) {
      const errorMessage = headerError instanceof Error ? headerError.message : String(headerError);
      logger.warn('Could not parse JWT header', {
        error: errorMessage,
        tokenPrefix,
      });
    }

    logger.info('Attempting Cognito JWT verification', {
      tokenPrefix,
      tokenLength: token?.length || 0,
      jwtHeader: jwtHeader ? {
        alg: jwtHeader.alg,
        typ: jwtHeader.typ,
        kid: jwtHeader.kid,
      } : 'unparseable',
    });

    const payload = (await getVerifier().verify(token)) as CognitoPayload;

    logger.info('Cognito JWT verification successful', {
      tokenPrefix,
      sub: payload.sub ? `${payload.sub.substring(0, 8)}...` : 'undefined',
      email: payload.email || 'undefined',
      tokenUse: payload.token_use,
      iss: payload.iss,
      aud: payload.aud,
      exp: payload.exp,
      hasGroups: !!(payload['cognito:groups']?.length),
      groupCount: payload['cognito:groups']?.length || 0,
    });

    // Additional token validation with detailed logging
    // Note: Access tokens don't contain email claims, only ID tokens do
    if (!payload.sub) {
      logger.error('Token missing required claims', {
        tokenPrefix,
        hasSub: !!payload.sub,
        hasEmail: !!payload.email,
        payload: {
          sub: payload.sub ? `${payload.sub.substring(0, 8)}...` : 'missing',
          email: payload.email || 'not-required-for-access-token',
          tokenUse: payload.token_use,
        },
      });
      throw new AuthorizationError('Invalid token claims - missing sub');
    }

    // For access tokens, email is optional - log it for debugging but don't require it
    if (!payload.email && payload.token_use === 'access') {
      logger.info('Access token without email claim (expected)', {
        tokenPrefix,
        sub: `${payload.sub.substring(0, 8)}...`,
        tokenUse: payload.token_use,
        hasGroups: !!(payload['cognito:groups']?.length),
      });
    }

    if (payload.token_use !== 'access') {
      logger.error('Invalid token use type', {
        tokenPrefix,
        expected: 'access',
        actual: payload.token_use,
      });
      throw new AuthorizationError('Invalid token use');
    }

    logger.info('Token validation completed successfully', {
      tokenPrefix,
      sub: `${payload.sub.substring(0, 8)}...`,
      email: payload.email,
    });

    return payload;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorStack = error instanceof Error ? error.stack?.substring(0, 500) : 'No stack available';
    
    logger.error('JWT verification failed with detailed context', {
      tokenPrefix,
      errorName,
      errorMessage,
      errorStack,
      isAuthError: error instanceof AuthorizationError,
    });

    if (errorName === 'JwtExpiredError') {
      logger.warn('Token has expired', { tokenPrefix });
      throw new AuthorizationError('Token expired');
    }
    if (errorName === 'JwtInvalidSignatureError') {
      logger.warn('Token has invalid signature', { tokenPrefix });
      throw new AuthorizationError('Invalid token signature');
    }
    if (errorName === 'JwtInvalidClaimError') {
      logger.warn('Token has invalid claims', { tokenPrefix });
      throw new AuthorizationError('Invalid token claims');
    }

    throw new AuthorizationError(`Token verification failed: ${errorMessage}`);
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
  // Extract the base ARN without the specific resource path
  // e.g., "arn:aws:execute-api:region:account:api-id/stage/METHOD/path/specific-id"
  // becomes "arn:aws:execute-api:region:account:api-id/stage/*/*"
  
  // Split the ARN by colons to get the parts
  const arnParts = resource.split(':');
  if (arnParts.length >= 6) {
    // The last part contains "api-id/stage/METHOD/path"
    const resourcePart = arnParts[5];
    if (resourcePart) {
      const resourceSegments = resourcePart.split('/');
      
      if (resourceSegments.length >= 2) {
        // Create wildcard: "api-id/stage/*/*" to allow all methods and paths
        const wildcardResource = `${resourceSegments[0]}/${resourceSegments[1]}/*/*`;
        arnParts[5] = wildcardResource;
        
        const wildcardArn = arnParts.join(':');
        
        logger.info('Generated wildcard policy', {
          originalResource: resource,
          wildcardResource: wildcardArn,
          principalId: principalId.substring(0, 8) + '...',
        });
        
        return {
          principalId,
          policyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Action: 'execute-api:Invoke',
                Effect: effect,
                Resource: wildcardArn,
              },
            ],
          },
        };
      }
    }
  }
  
  // Fallback to the original resource if parsing fails
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
  event: APIGatewayRequestAuthorizerEvent | APIGatewayTokenAuthorizerEvent,
  _context: Context
): Promise<APIGatewayAuthorizerResult> => {
  // Allow health check without authentication
  if (event.methodArn.includes('/health')) {
    return generatePolicy('health-check', 'Allow', event.methodArn);
  }

  // For all other endpoints, require authentication
  return authorizerHandler(event, _context);
};
