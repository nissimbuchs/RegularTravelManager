#!/usr/bin/env node
// Development server to run Lambda functions locally with LocalStack integration
import express from 'express';
import cors from 'cors';
import { getEnvironmentConfig } from './config/environment';
import { initializeDatabase, testDatabaseConnection } from './database/connection';

// Import unified Lambda handlers from index.ts
import {
  // Project management - unified routing function
  projectsManagement,
  getActiveProjects,
  getAllProjects,
  getProjectById,
  createProject,
  createSubproject,
  getSubprojectsForProject,
  getSubprojectById,
  searchProjects,
  checkProjectReferences,

  // Employee management
  getEmployeeProfile,
  updateEmployeeAddress,
  getManagers,

  // Travel requests - unified routing function
  employeesTravelRequests,

  // Manager dashboard - unified routing function
  managersDashboard,

  // Admin functions - unified routing functions
  adminUserManagement,
  adminRoleManagement,
  adminProjectManagement,

  // Calculation engine
  calculateDistance,
  calculateAllowance,
  calculateTravelCost,
  getCalculationAudit,
  invalidateCalculationCache,
  cleanupExpiredCache,

  // Registration handlers (Story 5.1)
  registerUser,
  verifyEmail,
  resendVerification,
  registrationStatus,
} from './handlers/index';

const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Lambda to Express adapter
function lambdaToExpress(lambdaHandler) {
  return async (req, res) => {
    console.log(`🔵 ${req.method} ${req.path} - Processing request`);

    // Parse user groups from headers
    const userGroups = req.headers['x-user-groups']
      ? req.headers['x-user-groups'].split(',')
      : ['employees'];

    // Determine user roles
    const isAdmin = userGroups.includes('administrators');
    const isManager = userGroups.includes('managers') || isAdmin;

    const event = {
      httpMethod: req.method,
      path: req.path,
      pathParameters: req.params,
      queryStringParameters: req.query,
      body: req.body ? JSON.stringify(req.body) : null,
      headers: req.headers,
      requestContext: {
        requestId: `dev-${Date.now()}`,
        identity: {
          sourceIp: req.ip || req.connection.remoteAddress || '127.0.0.1',
          userAgent: req.headers['user-agent'],
        },
        authorizer: {
          // Raw claims (what the real authorizer would pass)
          claims: {
            sub: req.headers['x-user-id'] || 'employee1@company.ch', // Mock user for dev
            email: req.headers['x-user-email'] || 'employee1@company.ch',
            'cognito:groups': req.headers['x-user-groups'] || 'employees',
          },
          // Processed context (what auth-utils expects)
          sub: req.headers['x-user-id'] || 'employee1@company.ch',
          email: req.headers['x-user-email'] || 'employee1@company.ch',
          cognitoUsername: req.headers['x-user-email'] || 'employee1@company.ch',
          isManager: isManager.toString(),
          isAdmin: isAdmin.toString(),
          groups: JSON.stringify(userGroups),
        },
      },
    };

    const context = {
      awsRequestId: `dev-${Date.now()}`,
      functionName: 'dev-function',
      getRemainingTimeInMillis: () => 30000,
    };

    try {
      const result = await lambdaHandler(event, context);
      const response = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
      res.status(result.statusCode).json(response);
    } catch (error: any) {
      console.error(`❌ Lambda handler error for ${req.method} ${req.path}:`, error);
      console.error('Error stack:', error.stack);

      // Handle specific error types with appropriate HTTP status codes
      if (
        error.message === 'Manager role required' ||
        error.message === 'Access denied: can only access own data or manager required'
      ) {
        res.status(403).json({ error: 'Forbidden: ' + error.message });
      } else if (
        error.message === 'No authorization context found' ||
        error.message === 'Unauthorized'
      ) {
        res.status(401).json({ error: 'Unauthorized' });
      } else if (error.name === 'ValidationError' || error.code === 'VALIDATION_ERROR') {
        res.status(400).json({ error: 'Bad Request: ' + error.message });
      } else {
        res.status(500).json({ error: 'Internal server error', details: error.message });
      }
    }
  };
}

// Health endpoint with service checks (match API Gateway: /api/health)
app.get('/api/health', async (req, res) => {
  const config = getEnvironmentConfig();

  try {
    const services = {
      database: 'unknown',
      localstack: 'unknown',
      redis: 'unknown',
    };

    // Check database connection
    try {
      await testDatabaseConnection();
      services.database = 'connected';
    } catch (error) {
      services.database = 'error';
      console.error('Database health check failed:', error.message);
    }

    res.json({
      status: 'ok',
      environment: config.NODE_ENV,
      timestamp: new Date().toISOString(),
      service: 'RegularTravelManager API',
      services,
      config: {
        awsRegion: config.AWS_REGION,
        awsEndpoint: config.AWS_ENDPOINT_URL,
        databaseUrl: config.DATABASE_URL ? 'configured' : 'missing',
        localStackMode: !!config.AWS_ENDPOINT_URL,
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Legacy health endpoint for backward compatibility
app.get('/health', async (req, res) => {
  const config = getEnvironmentConfig();

  try {
    const services = {
      database: 'unknown',
      localstack: 'unknown',
      redis: 'unknown',
    };

    // Check database connection
    try {
      await testDatabaseConnection();
      services.database = 'connected';
    } catch (error) {
      services.database = 'error';
      console.error('Database health check failed:', error.message);
    }

    res.json({
      status: 'ok',
      environment: config.NODE_ENV,
      timestamp: new Date().toISOString(),
      service: 'RegularTravelManager API',
      services,
      config: {
        awsRegion: config.AWS_REGION,
        awsEndpoint: config.AWS_ENDPOINT_URL,
        databaseUrl: config.DATABASE_URL ? 'configured' : 'missing',
        localStackMode: !!config.AWS_ENDPOINT_URL,
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Projects endpoints - using real database handlers (specific routes first)
app.get('/api/projects/active', lambdaToExpress(getActiveProjects));
app.get('/api/projects/search', lambdaToExpress(searchProjects));
app.get('/api/projects/geocode', lambdaToExpress(projectsManagement)); // Unified routing
app.get('/api/projects/:projectId/subprojects/:subprojectId', lambdaToExpress(getSubprojectById));
app.get('/api/projects/:projectId/subprojects', lambdaToExpress(getSubprojectsForProject));
app.get('/api/projects/:projectId/references', lambdaToExpress(checkProjectReferences));
app.patch('/api/projects/:projectId/toggle-status', lambdaToExpress(projectsManagement)); // Unified routing
app.get('/api/projects/:projectId', lambdaToExpress(getProjectById));
app.get('/api/projects', lambdaToExpress(getAllProjects)); // General projects endpoint for admin (all projects)
app.post('/api/projects', lambdaToExpress(createProject));
app.post('/api/projects/:projectId/subprojects', lambdaToExpress(createSubproject));
app.put('/api/projects/:projectId/subprojects/:subprojectId', lambdaToExpress(projectsManagement)); // Unified routing
app.delete(
  '/api/projects/:projectId/subprojects/:subprojectId',
  lambdaToExpress(projectsManagement)
); // Unified routing
app.patch(
  '/api/projects/:projectId/subprojects/:subprojectId/toggle-status',
  lambdaToExpress(projectsManagement)
); // Unified routing
app.put('/api/projects/:projectId', lambdaToExpress(projectsManagement)); // Unified routing
app.delete('/api/projects/:projectId', lambdaToExpress(projectsManagement)); // Unified routing

// Employee endpoints - using real database handlers
app.get('/api/employees/managers', lambdaToExpress(getManagers));
app.get('/api/employees/:cognitoUserId', lambdaToExpress(getEmployeeProfile));
app.put('/api/employees/:cognitoUserId/address', lambdaToExpress(updateEmployeeAddress));
app.get('/api/employees/:cognitoUserId/address/history', lambdaToExpress(getEmployeeProfile));

// Travel Request endpoints - using unified routing function
app.post('/api/employees/travel-requests/preview', lambdaToExpress(employeesTravelRequests));
app.post('/api/employees/travel-requests', lambdaToExpress(employeesTravelRequests));
app.get('/api/employees/travel-requests', lambdaToExpress(employeesTravelRequests));

// Additional travel request endpoints
app.post('/api/travel-requests/preview', lambdaToExpress(employeesTravelRequests));
app.post('/api/travel-requests', lambdaToExpress(employeesTravelRequests));
app.get('/api/travel-requests', lambdaToExpress(employeesTravelRequests));

// Manager Dashboard endpoints - using unified routing function
app.get('/api/manager/dashboard', lambdaToExpress(managersDashboard));
app.get('/api/manager/requests', lambdaToExpress(managersDashboard));
app.get('/api/manager/employee-context/:employeeId', lambdaToExpress(managersDashboard));
app.get('/api/manager/requests/:id/context', lambdaToExpress(managersDashboard));
app.put('/api/manager/requests/:id/approve', lambdaToExpress(managersDashboard));
app.put('/api/manager/requests/:id/reject', lambdaToExpress(managersDashboard));

// Admin endpoints - require admin authentication
app.get('/api/admin/users', lambdaToExpress(adminUserManagement));
app.get('/api/admin/users/:userId', lambdaToExpress(adminUserManagement));
app.put('/api/admin/users/:userId/status', lambdaToExpress(adminUserManagement));
app.put('/api/admin/users/:userId/manager', lambdaToExpress(adminUserManagement));
app.delete('/api/admin/users/:userId', lambdaToExpress(adminUserManagement));
app.put('/api/admin/users/:userId/role', lambdaToExpress(adminRoleManagement));
app.post('/api/admin/users/:userId/role/validate', lambdaToExpress(adminRoleManagement));
app.post('/api/admin/users/:userId/manager/validate', lambdaToExpress(adminRoleManagement));
app.get('/api/admin/projects', lambdaToExpress(adminProjectManagement));

// Calculation engine endpoints
app.post('/api/calculations/distance', lambdaToExpress(calculateDistance));
app.post('/api/calculations/allowance', lambdaToExpress(calculateAllowance));
app.post('/api/calculations/preview', lambdaToExpress(calculateTravelCost));
app.get('/api/calculations/audit/:requestId', lambdaToExpress(getCalculationAudit));
app.post('/api/calculations/cache/invalidate', lambdaToExpress(invalidateCalculationCache));
app.delete('/api/calculations/cache/expired', lambdaToExpress(cleanupExpiredCache));

// Separate managers endpoint for backward compatibility
app.get('/api/managers', lambdaToExpress(getManagers));

// Note: Direct subproject endpoints removed - frontend only uses nested endpoints (/api/projects/:projectId/subprojects/)

// Geocoding endpoints
app.post('/api/geocoding/address', lambdaToExpress(updateEmployeeAddress));

// Registration endpoints (Story 5.1) - Public endpoints, no auth required
app.post('/api/auth/register', lambdaToExpress(registerUser));
app.options('/api/auth/register', lambdaToExpress(registerUser)); // CORS preflight
app.post('/api/auth/verify-email', lambdaToExpress(verifyEmail));
app.options('/api/auth/verify-email', lambdaToExpress(verifyEmail)); // CORS preflight
app.post('/api/auth/resend-verification', lambdaToExpress(resendVerification));
app.options('/api/auth/resend-verification', lambdaToExpress(resendVerification)); // CORS preflight
app.get('/api/auth/registration-status', lambdaToExpress(registrationStatus));
app.options('/api/auth/registration-status', lambdaToExpress(registrationStatus)); // CORS preflight

// Initialize database and start server
async function startServer() {
  try {
    console.log('🔧 Initializing database connection...');
    await initializeDatabase();
    console.log('✅ Database connection initialized successfully');

    app.listen(PORT, () => {
      console.log(`🚀 Development API server running at http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📦 Projects API: http://localhost:${PORT}/api/projects/active`);
      console.log(`👤 Employees API: http://localhost:${PORT}/api/employees`);
      console.log(`💼 Manager API: http://localhost:${PORT}/api/manager/dashboard`);
      console.log(`🧪 Using REAL PostgreSQL database (no mocks!)`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
