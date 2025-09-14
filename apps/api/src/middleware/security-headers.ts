import { APIGatewayProxyResult } from 'aws-lambda';

/**
 * Security headers for API responses
 */
export const SECURITY_HEADERS = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Prevent framing (clickjacking protection)
  'X-Frame-Options': 'DENY',

  // XSS protection
  'X-XSS-Protection': '1; mode=block',

  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Content security policy for API endpoints
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';",

  // Strict transport security (HTTPS only)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Feature policy
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

/**
 * CORS headers for frontend requests
 */
export const getCorsHeaders = (origin?: string): Record<string, string> => {
  // Allowed origins (configure based on environment)
  const allowedOrigins = [
    'http://localhost:4200', // Development
    'https://dz57qvo83kxos.cloudfront.net', // Production
    'https://rtm-staging.buchs.be', // Staging
  ];

  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
};

/**
 * Apply security headers to API Gateway response
 */
export function applySecurityHeaders(
  response: APIGatewayProxyResult,
  origin?: string
): APIGatewayProxyResult {
  return {
    ...response,
    headers: {
      ...response.headers,
      ...SECURITY_HEADERS,
      ...getCorsHeaders(origin),
    },
  };
}

/**
 * Create CORS preflight response
 */
export function createPreflightResponse(origin?: string): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      ...SECURITY_HEADERS,
      ...getCorsHeaders(origin),
    },
    body: '',
  };
}
