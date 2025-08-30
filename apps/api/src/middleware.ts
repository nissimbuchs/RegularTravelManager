import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export type Handler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

export const corsMiddleware = (handler: Handler): Handler => {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const result = await handler(event);

    return {
      ...result,
      headers: {
        ...result.headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      },
    };
  };
};
