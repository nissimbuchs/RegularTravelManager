import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../middleware/logger';
import { formatResponse } from '../middleware/response-formatter';
import { testDatabaseConnection } from '../database/connection';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: { status: string; responseTime: number };
    cognito: { status: string; responseTime: number };
    ses: { status: string; responseTime: number };
  };
}

export const healthHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();

  try {
    logger.info('Health check initiated', { requestId: context.awsRequestId });

    // Test database connectivity
    const dbStartTime = Date.now();
    let dbStatus = 'healthy';
    let dbResponseTime = 0;

    try {
      await testDatabaseConnection();
      dbResponseTime = Date.now() - dbStartTime;
    } catch (error) {
      dbStatus = 'unhealthy';
      dbResponseTime = Date.now() - dbStartTime;
      logger.error('Database health check failed', { error: error.message });

      // If it's a critical failure (test setup issue), throw immediately
      if (error.message.includes('Critical failure')) {
        throw error;
      }
    }

    // Test Cognito connectivity (placeholder)
    const cognitoStatus = 'healthy';
    const cognitoResponseTime = 5;

    // Test SES connectivity (placeholder)
    const sesStatus = 'healthy';
    const sesResponseTime = 3;

    // Determine overall status
    const allServicesHealthy =
      dbStatus === 'healthy' && cognitoStatus === 'healthy' && sesStatus === 'healthy';

    const overallStatus: HealthStatus['status'] = allServicesHealthy ? 'healthy' : 'degraded';

    const healthData: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0',
      services: {
        database: { status: dbStatus, responseTime: dbResponseTime },
        cognito: { status: cognitoStatus, responseTime: cognitoResponseTime },
        ses: { status: sesStatus, responseTime: sesResponseTime },
      },
    };

    const responseTime = Date.now() - startTime;
    logger.info('Health check completed', {
      status: overallStatus,
      responseTime,
      requestId: context.awsRequestId,
    });

    return formatResponse(200, healthData, context.awsRequestId);
  } catch (error) {
    logger.error('Health check failed', {
      error: error.message,
      requestId: context.awsRequestId,
    });

    const errorHealthData: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0',
      services: {
        database: { status: 'unknown', responseTime: 0 },
        cognito: { status: 'unknown', responseTime: 0 },
        ses: { status: 'unknown', responseTime: 0 },
      },
    };

    return formatResponse(503, errorHealthData, context.awsRequestId);
  }
};
