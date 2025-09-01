import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { formatResponse } from './response-formatter';

export const corsMiddleware = (
  handler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>
) => {
  return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
      return formatResponse(200, { message: 'CORS preflight successful' }, context.awsRequestId, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'Content-Type,Authorization,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Max-Age': '86400',
      });
    }

    // Execute the main handler
    const result = await handler(event, context);

    // Ensure CORS headers are present
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Content-Type,Authorization,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    };

    return {
      ...result,
      headers: {
        ...result.headers,
        ...corsHeaders,
      },
    };
  };
};
