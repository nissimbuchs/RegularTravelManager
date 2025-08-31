import { APIGatewayProxyResult } from 'aws-lambda';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
  timestamp: string;
  requestId: string;
}

export const formatResponse = (
  statusCode: number,
  data: any,
  requestId: string,
  headers: Record<string, string> = {}
): APIGatewayProxyResult => {
  const isError = statusCode >= 400;
  
  const response: ApiResponse = {
    success: !isError,
    timestamp: new Date().toISOString(),
    requestId
  };

  if (isError) {
    response.error = {
      code: data.code || `HTTP_${statusCode}`,
      message: data.message || data,
      details: data.details,
      timestamp: response.timestamp,
      requestId
    };
  } else {
    response.data = data;
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };

  return {
    statusCode,
    headers: { ...defaultHeaders, ...headers },
    body: JSON.stringify(response)
  };
};