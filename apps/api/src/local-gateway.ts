#!/usr/bin/env node
/**
 * Local API Gateway Simulator
 *
 * Simulates AWS API Gateway behavior for local development.
 * Provides routing, authentication, and request transformation
 * matching production API Gateway configuration.
 */

import express from 'express';
import axios from 'axios';
import { localAuthorizerMiddleware } from './middleware/local-authorizer';
import { initializeDatabase } from './database/connection';
import { API_ROUTES } from './config/api-routes';

const GATEWAY_PORT = 4000;
const LAMBDA_SERVER_URL = 'http://localhost:3001'; // Lambda simulator port

const app = express();

// CORS middleware - needed for local browser development
// (In AWS, CloudFront handles CORS differently)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-mock-user, x-user-id, x-user-email, x-user-groups');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  console.log(`🌐 [GATEWAY] ${req.method} ${req.path}`);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`✨ [GATEWAY] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// Health check endpoint (no auth required)
app.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    service: 'Local API Gateway Simulator',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    lambdaServer: LAMBDA_SERVER_URL,
  });
});

// Apply authorization middleware for all routes (frontend doesn't use /api prefix)
app.use('/', localAuthorizerMiddleware);

/**
 * Transform Express request to Lambda event format
 */
function transformToLambdaEvent(req: express.Request, routeConfig: any): any {
  const authContext = req['requestContext']?.authorizer || {};

  return {
    httpMethod: req.method,
    path: req.path,
    pathParameters: extractPathParameters(req.path, routeConfig.path),
    queryStringParameters: req.query || null,
    headers: req.headers,
    body: req.body ? JSON.stringify(req.body) : null,
    requestContext: {
      requestId: req['requestContext']?.requestId || `gateway-${Date.now()}`,
      identity: {
        sourceIp: req.ip || req.connection?.remoteAddress || '127.0.0.1',
        userAgent: req.headers['user-agent'],
      },
      authorizer: authContext,
    },
  };
}

/**
 * Extract path parameters from URL
 */
function extractPathParameters(actualPath: string, routePattern: string): Record<string, string> | null {
  const params: Record<string, string> = {};

  // Remove leading slash for matching
  actualPath = actualPath.replace(/^\//, '');
  routePattern = routePattern.replace(/^\//, '');

  const actualParts = actualPath.split('/').filter(Boolean);
  const patternParts = routePattern.split('/').filter(Boolean);

  if (actualParts.length !== patternParts.length) {
    return null;
  }

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const actualPart = actualParts[i];

    if (patternPart.startsWith('{') && patternPart.endsWith('}')) {
      const paramName = patternPart.slice(1, -1);
      params[paramName] = actualPart;
    } else if (patternPart !== actualPart) {
      return null;
    }
  }

  return Object.keys(params).length > 0 ? params : null;
}

/**
 * Find matching route configuration
 */
function findRouteConfig(method: string, path: string): any {
  // Remove leading slash
  const cleanPath = path.replace(/^\//, '');

  for (const group of API_ROUTES) {
    // Remove 'api/' prefix from basePath since frontend doesn't use it
    const basePath = group.basePath.replace(/^api\//, '');

    for (const route of group.routes) {
      const fullPath = basePath + (route.path ? '/' + route.path : '');
      const normalizedPath = fullPath.replace(/\/+/g, '/').replace(/\/$/, '').replace(/^\//, '');
      const normalizedCleanPath = cleanPath.replace(/\/+/g, '/').replace(/\/$/, '');

      if (route.method === method) {
        // Check exact match
        if (normalizedPath === normalizedCleanPath) {
          return { ...route, fullPath };
        }

        // Check pattern match (with path parameters)
        const params = extractPathParameters(cleanPath, normalizedPath);
        if (params !== null) {
          return { ...route, fullPath, pathParameters: params };
        }
      }
    }
  }

  return null;
}

/**
 * Proxy request to Lambda simulator
 */
async function proxyToLambda(
  lambdaEvent: any,
  functionName: string
): Promise<{ statusCode: number; body: any; headers?: any }> {
  try {
    console.log(`🚀 [GATEWAY] Invoking Lambda function: ${functionName}`);

    // Call Lambda simulator with the specific function endpoint
    const response = await axios.post(
      `${LAMBDA_SERVER_URL}/invoke/${functionName}`,
      lambdaEvent,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // Lambda returned an error response
        return {
          statusCode: error.response.status,
          body: error.response.data,
        };
      } else if (error.request) {
        // Lambda server not responding
        console.error('❌ [GATEWAY] Lambda server not responding:', error.message);
        return {
          statusCode: 503,
          body: {
            error: 'Service Unavailable',
            message: 'Lambda simulation server is not responding',
          },
        };
      }
    }

    console.error('❌ [GATEWAY] Unexpected error:', error);
    return {
      statusCode: 500,
      body: {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Generic route handler - using middleware approach
 * Note: Frontend doesn't use /api prefix, so we handle all routes
 */
app.use('/', async (req, res, next) => {
  // Skip if already handled
  if (res.headersSent) {
    return next();
  }
  try {
    // Find matching route configuration
    const routeConfig = findRouteConfig(req.method, req.path);

    if (!routeConfig) {
      console.log(`⚠️ [GATEWAY] No route found for ${req.method} ${req.path}`);
      return res.status(404).json({
        error: 'Not Found',
        message: `No route configured for ${req.method} ${req.path}`,
      });
    }

    console.log(`✅ [GATEWAY] Route matched:`, {
      method: req.method,
      path: req.path,
      functionName: routeConfig.functionName,
      requiresAuth: routeConfig.requiresAuth !== false,
    });

    // Transform request to Lambda event format
    const lambdaEvent = transformToLambdaEvent(req, routeConfig);

    // Call Lambda simulator
    const lambdaResponse = await proxyToLambda(lambdaEvent, routeConfig.functionName);

    // Transform Lambda response back to HTTP response
    res.status(lambdaResponse.statusCode);

    if (lambdaResponse.headers) {
      Object.entries(lambdaResponse.headers).forEach(([key, value]) => {
        res.setHeader(key, value as string);
      });
    }

    // Parse body if it's a string (Lambda returns stringified JSON)
    const responseBody = typeof lambdaResponse.body === 'string'
      ? JSON.parse(lambdaResponse.body)
      : lambdaResponse.body;

    res.json(responseBody);
  } catch (error) {
    console.error('❌ [GATEWAY] Request handling error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ [GATEWAY] Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

/**
 * Start the gateway server
 */
async function startGateway() {
  try {
    console.log('🔧 [GATEWAY] Initializing database connection...');
    await initializeDatabase();
    console.log('✅ [GATEWAY] Database initialized');

    app.listen(GATEWAY_PORT, () => {
      console.log(`\n🌉 Local API Gateway Simulator`);
      console.log(`================================`);
      console.log(`✅ Gateway running at: http://localhost:${GATEWAY_PORT}`);
      console.log(`🚀 Lambda server at: ${LAMBDA_SERVER_URL}`);
      console.log(`📊 Health check: http://localhost:${GATEWAY_PORT}/health`);
      console.log(`🔐 Mock authentication enabled`);
      console.log(`\n📝 Available mock users:`);
      console.log(`  - admin1 (CEO/Admin)`);
      console.log(`  - manager1 (Regional Manager)`);
      console.log(`  - employee1 (Developer)`);
      console.log(`\n🎯 Frontend should connect to: http://localhost:${GATEWAY_PORT}`);
      console.log(`================================\n`);
    });
  } catch (error) {
    console.error('❌ [GATEWAY] Failed to start:', error);
    process.exit(1);
  }
}

// Start the gateway
startGateway();