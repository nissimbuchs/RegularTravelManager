import { APIGatewayProxyResult } from 'aws-lambda';

/**
 * MANDATORY API Response Pattern for RegularTravelManager
 *
 * ⚠️  CRITICAL: ALL API endpoints MUST use formatResponse() - NO EXCEPTIONS
 *
 * This ensures consistent response structure across the entire application:
 * - Success responses: { success: true, data: T, timestamp, requestId }
 * - Error responses: { success: false, error: {...}, timestamp, requestId }
 *
 * DO NOT manually build JSON responses. Always use formatResponse().
 *
 * ✅ CORRECT Usage:
 *   return formatResponse(200, { users: [...] }, context.awsRequestId);
 *   return formatResponse(404, { code: 'NOT_FOUND', message: 'User not found' }, context.awsRequestId);
 *
 * ❌ NEVER DO THIS:
 *   return {
 *     statusCode: 200,
 *     body: JSON.stringify({ success: true, data: users })
 *   };
 */
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

/**
 * Central response formatter for all API endpoints
 *
 * @param statusCode HTTP status code (200, 404, 500, etc.)
 * @param data Success data or error object { code, message, details? }
 * @param requestId AWS request ID from context.awsRequestId
 * @param headers Optional additional headers
 * @returns Properly formatted APIGatewayProxyResult
 */
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
    requestId,
  };

  if (isError) {
    response.error = {
      code: data.code || `HTTP_${statusCode}`,
      message: data.message || data,
      details: data.details,
      timestamp: response.timestamp,
      requestId,
    };
  } else {
    response.data = data;
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
