import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { formatResponse } from './response-formatter';
import { logger } from './logger';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, any>) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export const errorHandler = (
  handler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>
) => {
  return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    try {
      return await handler(event, context);
    } catch (error) {
      logger.error('Handler error', {
        error: error.message,
        stack: error.stack,
        requestId: context.awsRequestId,
        path: event.path,
        method: event.httpMethod
      });

      if (error instanceof ApiError) {
        return formatResponse(
          error.statusCode,
          {
            code: error.code,
            message: error.message,
            details: error.details
          },
          context.awsRequestId
        );
      }

      // Handle unexpected errors
      return formatResponse(
        500,
        {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred'
        },
        context.awsRequestId
      );
    }
  };
};