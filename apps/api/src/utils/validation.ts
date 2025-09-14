import { APIGatewayProxyEvent } from 'aws-lambda';
import { z, ZodSchema } from 'zod';

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: any[],
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateRequestBody<T>(event: APIGatewayProxyEvent, schema: ZodSchema<T>): T {
  if (!event.body) {
    throw new ValidationError('Request body is required', [
      { message: 'Request body is required' },
    ]);
  }

  console.log('Raw event.body:', event.body);
  console.log('typeof event.body:', typeof event.body);

  let parsedBody: any;
  try {
    // Handle case where body might already be parsed or is a string
    if (typeof event.body === 'string') {
      parsedBody = JSON.parse(event.body);
    } else if (typeof event.body === 'object' && event.body !== null) {
      // Body is already parsed
      parsedBody = event.body;
    } else {
      throw new Error('Invalid body type');
    }
    console.log('Parsed body:', JSON.stringify(parsedBody, null, 2));
  } catch (error) {
    console.error('JSON parsing error:', error);
    console.error('Raw body content:', event.body);
    throw new ValidationError('Invalid JSON in request body', [{ message: 'Invalid JSON format' }]);
  }

  try {
    console.log('About to validate with schema. Parsed body keys:', Object.keys(parsedBody));
    console.log('Parsed body values:', JSON.stringify(parsedBody, null, 2));
    return schema.parse(parsedBody);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Zod validation errors:', JSON.stringify(error.errors, null, 2));
      const formattedErrors = error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
        received: err.received,
      }));

      throw new ValidationError('Validation failed', formattedErrors);
    }
    throw error;
  }
}

export function validateQueryParams<T>(event: APIGatewayProxyEvent, schema: ZodSchema<T>): T {
  try {
    return schema.parse(event.queryStringParameters || {});
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      throw new ValidationError('Query parameter validation failed', formattedErrors);
    }
    throw error;
  }
}
