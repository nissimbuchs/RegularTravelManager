import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../middleware/logger';
import {
  updateUserRoleHandler,
  validateRoleChangeHandler,
  validateManagerAssignmentHandler,
} from '../handlers/admin/role-management';

/**
 * Main handler for admin role management operations
 * Routes requests to appropriate sub-handlers based on path and method
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.info('Admin role management request', {
    path: event.path,
    method: event.httpMethod,
    requestId: context.awsRequestId,
  });

  const path = event.path;
  const method = event.httpMethod;

  try {
    // Role management routes
    if (path.includes('/role/validate') && method === 'POST') {
      return await validateRoleChangeHandler(event, context);
    }

    if (path.includes('/role') && method === 'PUT') {
      return await updateUserRoleHandler(event, context);
    }

    // Manager assignment validation
    if (path.includes('/manager/validate') && method === 'POST') {
      return await validateManagerAssignmentHandler(event, context);
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
    logger.error('Admin role management error', {
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
