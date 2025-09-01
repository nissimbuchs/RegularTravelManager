import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../../middleware/logger';
import { formatResponse } from '../../middleware/response-formatter';
import { createTestUsers, CognitoAdminService, TEST_USERS } from './auth-utils';

// Handler to create test users (for development/testing only)
export const setupTestUsersHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.info('Setting up test users', { requestId: context.awsRequestId });

  // Only allow in development environment
  if (process.env.NODE_ENV === 'production') {
    return formatResponse(
      403,
      {
        message: 'Test user creation not allowed in production',
      },
      context.awsRequestId
    );
  }

  try {
    await createTestUsers();

    const testUserInfo = TEST_USERS.map(user => ({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      role: user.isManager ? 'manager' : 'employee',
      password: '***', // Don't expose passwords in response
    }));

    logger.info('Test users setup completed', {
      count: TEST_USERS.length,
      requestId: context.awsRequestId,
    });

    return formatResponse(
      200,
      {
        message: 'Test users created successfully',
        users: testUserInfo,
        note: 'Use the original passwords provided in the configuration for testing',
      },
      context.awsRequestId
    );
  } catch (error) {
    logger.error('Failed to setup test users', {
      error: error.message,
      requestId: context.awsRequestId,
    });

    return formatResponse(
      500,
      {
        message: 'Failed to create test users',
        error: error.message,
      },
      context.awsRequestId
    );
  }
};

// Handler to list current users (admin only)
export const listUsersHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.info('Listing Cognito users', { requestId: context.awsRequestId });

  try {
    const cognitoService = new CognitoAdminService();
    const users = await cognitoService.listUsers();

    logger.info('Users retrieved successfully', {
      count: users.length,
      requestId: context.awsRequestId,
    });

    return formatResponse(
      200,
      {
        users: users.map(user => ({
          username: user.username,
          email: user.attributes?.find(attr => attr.Name === 'email')?.Value,
          name: `${user.attributes?.find(attr => attr.Name === 'given_name')?.Value || ''} ${user.attributes?.find(attr => attr.Name === 'family_name')?.Value || ''}`.trim(),
          status: user.status,
          enabled: user.enabled,
          created: user.created,
          modified: user.modified,
        })),
      },
      context.awsRequestId
    );
  } catch (error) {
    logger.error('Failed to list users', {
      error: error.message,
      requestId: context.awsRequestId,
    });

    return formatResponse(
      500,
      {
        message: 'Failed to list users',
        error: error.message,
      },
      context.awsRequestId
    );
  }
};

// Handler to get user details (including groups)
export const getUserDetailsHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const username = event.pathParameters?.username;

  if (!username) {
    return formatResponse(
      400,
      {
        message: 'Username parameter required',
      },
      context.awsRequestId
    );
  }

  logger.info('Getting user details', { username, requestId: context.awsRequestId });

  try {
    const cognitoService = new CognitoAdminService();
    const userDetails = await cognitoService.getUserDetails(username);

    const formattedUser = {
      username: userDetails.username,
      email: userDetails.attributes?.find(attr => attr.Name === 'email')?.Value,
      firstName: userDetails.attributes?.find(attr => attr.Name === 'given_name')?.Value,
      lastName: userDetails.attributes?.find(attr => attr.Name === 'family_name')?.Value,
      groups: userDetails.groups,
      isManager: userDetails.groups.includes('managers'),
      status: userDetails.status,
      enabled: userDetails.enabled,
    };

    return formatResponse(200, formattedUser, context.awsRequestId);
  } catch (error) {
    logger.error('Failed to get user details', {
      error: error.message,
      username,
      requestId: context.awsRequestId,
    });

    return formatResponse(
      500,
      {
        message: 'Failed to get user details',
        error: error.message,
      },
      context.awsRequestId
    );
  }
};
