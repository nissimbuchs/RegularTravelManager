import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { db } from '../../database/connection';
import { getUserContextFromEvent } from '../auth/auth-utils';
import { formatResponse } from '../../middleware/response-formatter';

/**
 * TEMPLATE: Copy this file when creating new handlers
 *
 * ⚠️  CRITICAL: Always use formatResponse() - NEVER build responses manually
 *
 * This template ensures:
 * - Consistent error handling with proper type annotations
 * - Mandatory formatResponse usage
 * - Standard authentication pattern
 * - Proper logging and context handling
 */

interface RequestBody {
  // Define your request body interface here
  name: string;
  email: string;
}

interface ResponseData {
  // Define your response data interface here
  id: string;
  message: string;
}

export const templateHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // 1. Extract user context (if authentication required)
    const userContext = getUserContextFromEvent(event);
    const userId = userContext.sub;
    if (!userId) {
      return formatResponse(401, { error: 'Unauthorized' }, context.awsRequestId);
    }

    // 2. Parse and validate request body (if applicable)
    const body: RequestBody = JSON.parse(event.body || '{}');
    if (!body.name || !body.email) {
      return formatResponse(
        400,
        {
          code: 'VALIDATION_ERROR',
          message: 'name and email are required',
        },
        context.awsRequestId
      );
    }

    // 3. Perform business logic
    const result = await db.query('SELECT id, name FROM example_table WHERE user_id = $1', [
      userId,
    ]);

    // 4. Build response data
    const responseData: ResponseData = {
      id: result.rows[0]?.id || 'new-id',
      message: 'Operation completed successfully',
    };

    // 5. ✅ ALWAYS use formatResponse for success
    return formatResponse(200, responseData, context.awsRequestId);
  } catch (error: any) {
    // 6. ✅ ALWAYS use formatResponse for errors with proper type annotation
    console.error('Template handler error:', error);
    return formatResponse(500, { error: 'Internal server error' }, context.awsRequestId);
  }
};

// Example router function (if needed)
export const templateRouter = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const path = event.path;

  if (method === 'GET') {
    return templateHandler(event, context);
  } else if (method === 'POST') {
    return templateHandler(event, context);
  }

  // ✅ ALWAYS use formatResponse for method not allowed
  return formatResponse(
    405,
    {
      error: 'Method Not Allowed',
      message: `${method} ${path} is not supported by this handler`,
    },
    context.awsRequestId
  );
};
