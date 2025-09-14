import { APIGatewayProxyResult } from 'aws-lambda';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId?: string;
  };
  timestamp?: string;
  requestId?: string;
}

export const createResponse = (
  statusCode: number,
  data: any,
  headers: Record<string, string> = {}
): APIGatewayProxyResult => {
  const isError = statusCode >= 400;

  const response: ApiResponse = {
    success: !isError,
    timestamp: new Date().toISOString(),
  };

  if (isError) {
    response.error = typeof data === 'object' && data.error ? data.error : data;
  } else {
    response.data = typeof data === 'object' && data.data ? data.data : data;
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  return {
    statusCode,
    headers: { ...defaultHeaders, ...headers },
    body: JSON.stringify(response),
  };
};
