import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../../middleware/logger';
import { formatResponse } from '../../middleware/response-formatter';
import { CognitoAdminService } from './auth-utils';

// Handler to create test users (deprecated - users are now managed through infrastructure)
export const setupTestUsersHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.info('Test user setup requested (deprecated)', { requestId: context.awsRequestId });

  return formatResponse(
    200,
    {
      message: 'Test user creation is deprecated',
      note: 'Users are now created through infrastructure setup with proper credentials',
      documentation: 'See README.md for current user credentials',
    },
    context.awsRequestId
  );
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to list users', {
      error: errorMessage,
      requestId: context.awsRequestId,
    });

    return formatResponse(
      500,
      {
        message: 'Failed to list users',
        error: errorMessage,
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
      isAdmin: userDetails.groups.includes('administrators'),
      status: userDetails.status,
      enabled: userDetails.enabled,
    };

    return formatResponse(200, formattedUser, context.awsRequestId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to get user details', {
      error: errorMessage,
      username,
      requestId: context.awsRequestId,
    });

    return formatResponse(
      500,
      {
        message: 'Failed to get user details',
        error: errorMessage,
      },
      context.awsRequestId
    );
  }
};
