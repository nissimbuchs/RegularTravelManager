import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../middleware/logger';
import {
  listUsersHandler,
  getUserDetailsHandler,
  updateUserStatusHandler,
  updateUserManagerHandler,
  deleteUserHandler,
} from '../handlers/admin/user-management';

/**
 * Main handler for admin user management operations
 * Routes requests to appropriate sub-handlers based on path and method
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.info('Admin user management request', {
    path: event.path,
    method: event.httpMethod,
    requestId: context.awsRequestId,
  });

  const path = event.path;
  const method = event.httpMethod;

  try {
    // List users (GET /admin/users)
    if (path.endsWith('/users') && method === 'GET') {
      return await listUsersHandler(event, context);
    }

    // Get user details (GET /admin/users/{userId})
    if (path.match(/\/users\/[^\/]+$/) && method === 'GET') {
      return await getUserDetailsHandler(event, context);
    }

    // Update user status (PUT /admin/users/{userId}/status)
    if (path.includes('/status') && method === 'PUT') {
      return await updateUserStatusHandler(event, context);
    }

    // Update user manager (PUT /admin/users/{userId}/manager)
    if (path.includes('/manager') && method === 'PUT') {
      return await updateUserManagerHandler(event, context);
    }

    // Delete user (DELETE /admin/users/{userId})
    if (path.match(/\/users\/[^\/]+$/) && method === 'DELETE') {
      return await deleteUserHandler(event, context);
    }

    // Route not found
    return {
      statusCode: 404,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'ROUTE_NOT_FOUND',
          message: `Route not found: ${method} ${path}`,
          timestamp: new Date().toISOString(),
          requestId: context.awsRequestId,
        },
      }),
    };
  } catch (error) {
    logger.error('Admin user management error', {
      error: error.message,
      stack: error.stack,
      path,
      method,
      requestId: context.awsRequestId,
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
          timestamp: new Date().toISOString(),
          requestId: context.awsRequestId,
        },
      }),
    };
  }
};
