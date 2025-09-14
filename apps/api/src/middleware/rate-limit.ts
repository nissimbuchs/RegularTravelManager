import { APIGatewayProxyEvent } from 'aws-lambda';
import { logger } from './logger';
import { isLocalDevelopment } from '../config/environment';

// In-memory rate limiting cache (in production, use Redis or DynamoDB)
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (event: APIGatewayProxyEvent) => string; // Custom key generator
}

/**
 * Rate limiting middleware for Lambda functions
 */
export function checkRateLimit(
  event: APIGatewayProxyEvent,
  config: RateLimitConfig
): {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
  error?: string;
} {
  const key = config.keyGenerator
    ? config.keyGenerator(event)
    : event.requestContext.identity.sourceIp;
  const now = Date.now();

  // Clean up expired entries periodically
  cleanupExpiredEntries(now);

  // Get current rate limit data
  let rateLimitData = rateLimitCache.get(key);

  // Initialize or reset if window expired
  if (!rateLimitData || now > rateLimitData.resetTime) {
    rateLimitData = {
      count: 0,
      resetTime: now + config.windowMs,
    };
  }

  // Check if rate limit exceeded
  if (rateLimitData.count >= config.maxRequests) {
    logger.warn('Rate limit exceeded', {
      key,
      count: rateLimitData.count,
      maxRequests: config.maxRequests,
      resetTime: rateLimitData.resetTime,
      requestId: event.requestContext.requestId,
    });

    return {
      allowed: false,
      remainingRequests: 0,
      resetTime: rateLimitData.resetTime,
      error: `Too many requests. Try again in ${Math.ceil((rateLimitData.resetTime - now) / 1000)} seconds.`,
    };
  }

  // Increment counter and save
  rateLimitData.count++;
  rateLimitCache.set(key, rateLimitData);

  logger.info('Rate limit check passed', {
    key,
    count: rateLimitData.count,
    maxRequests: config.maxRequests,
    remainingRequests: config.maxRequests - rateLimitData.count,
    requestId: event.requestContext.requestId,
  });

  return {
    allowed: true,
    remainingRequests: config.maxRequests - rateLimitData.count,
    resetTime: rateLimitData.resetTime,
  };
}

/**
 * Generate rate limit key by email from request body
 */
export function emailRateLimitKey(event: APIGatewayProxyEvent): string {
  try {
    const body = JSON.parse(event.body || '{}');
    const email = body.email?.toLowerCase()?.trim();
    return email ? `email:${email}` : `ip:${event.requestContext.identity.sourceIp}`;
  } catch (error) {
    return `ip:${event.requestContext.identity.sourceIp}`;
  }
}

/**
 * Generate rate limit key by IP address
 */
export function ipRateLimitKey(event: APIGatewayProxyEvent): string {
  return `ip:${event.requestContext.identity.sourceIp}`;
}

/**
 * Clean up expired rate limit entries to prevent memory leaks
 */
function cleanupExpiredEntries(now: number): void {
  const entriesToDelete: string[] = [];

  rateLimitCache.forEach((data, key) => {
    if (now > data.resetTime) {
      entriesToDelete.push(key);
    }
  });

  entriesToDelete.forEach(key => {
    rateLimitCache.delete(key);
  });

  if (entriesToDelete.length > 0) {
    logger.info('Cleaned up expired rate limit entries', {
      count: entriesToDelete.length,
      remainingEntries: rateLimitCache.size,
    });
  }
}

/**
 * Common rate limit configurations
 */
export const RateLimitConfigs = {
  REGISTRATION: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: isLocalDevelopment() ? 100 : 5, // 100 for local, 5 for production
    keyGenerator: ipRateLimitKey,
  },
  EMAIL_VERIFICATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 verification attempts per hour per email
    keyGenerator: emailRateLimitKey,
  },
  RESEND_VERIFICATION: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 3, // 3 resend attempts per 5 minutes per email
    keyGenerator: emailRateLimitKey,
  },
  LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 login attempts per 15 minutes per IP
    keyGenerator: ipRateLimitKey,
  },
};
