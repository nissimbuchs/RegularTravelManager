#!/usr/bin/env node
// Development server to run Lambda functions locally with LocalStack integration
import express from 'express';
import cors from 'cors';
import { getEnvironmentConfig } from './config/environment';
import { getDynamoClient, getS3Client } from './services/aws-factory';
import { initializeDatabase, testDatabaseConnection } from './database/connection';

// Import real Lambda handlers
import {
  getActiveProjects,
  getAllProjects,
  getProjectById,
  createProject,
  createSubproject,
  updateProject,
  toggleProjectStatus,
  checkProjectReferences,
  deleteProject,
  getSubprojectsForProject,
  searchProjects,
  geocodeAddress,
} from './handlers/projects/management';
import {
  getEmployeeProfile,
  updateEmployeeAddress,
  getManagers,
} from './handlers/employees/profile';
import { calculatePreview, createTravelRequest } from './handlers/employees/travel-requests';
import {
  getManagerDashboard,
  getEmployeeContext,
  approveRequest,
  rejectRequest,
} from './handlers/managers/dashboard';

const app = express();
const PORT = 3000;

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

    // Determine if user is a manager (admin counts as manager)
    const isManager = userGroups.includes('managers') || userGroups.includes('administrators');

    const event = {
      httpMethod: req.method,
      path: req.path,
      pathParameters: req.params,
      queryStringParameters: req.query,
      body: req.body ? JSON.stringify(req.body) : null,
      headers: req.headers,
      requestContext: {
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

// Health endpoint with service checks
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

    // Check LocalStack DynamoDB connection
    try {
      const dynamoClient = getDynamoClient();
      await dynamoClient.send({ input: {} }); // Simple connection test
      services.localstack = 'ready';
    } catch (error) {
      services.localstack = 'error';
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
app.get('/projects/active', lambdaToExpress(getActiveProjects));
app.get('/projects/search', lambdaToExpress(searchProjects));
app.get('/projects/geocode', lambdaToExpress(geocodeAddress));
app.get('/projects/:projectId/subprojects', lambdaToExpress(getSubprojectsForProject));
app.get('/projects/:id/references', lambdaToExpress(checkProjectReferences));
app.patch('/projects/:id/toggle-status', lambdaToExpress(toggleProjectStatus));
app.get('/projects/:id', lambdaToExpress(getProjectById));
app.get('/projects', lambdaToExpress(getAllProjects)); // General projects endpoint for admin (all projects)
app.post('/projects', lambdaToExpress(createProject));
app.post('/projects/:projectId/subprojects', lambdaToExpress(createSubproject));
app.put('/projects/:id', lambdaToExpress(updateProject));
app.delete('/projects/:id', lambdaToExpress(deleteProject));

// Employee endpoints - using real database handlers
app.get('/managers', lambdaToExpress(getManagers));
app.get('/employees/:id', lambdaToExpress(getEmployeeProfile));
app.put('/employees/:id/address', lambdaToExpress(updateEmployeeAddress));

// Travel Request endpoints - using real database handlers
app.post('/api/employees/travel-requests/preview', lambdaToExpress(calculatePreview));
app.post('/api/employees/travel-requests', lambdaToExpress(createTravelRequest));

// Manager Dashboard endpoints - using real database handlers
app.get('/api/manager/dashboard', lambdaToExpress(getManagerDashboard));
app.get('/api/manager/employee-context/:employeeId', lambdaToExpress(getEmployeeContext));
app.post('/api/manager/requests/:requestId/approve', lambdaToExpress(approveRequest));
app.post('/api/manager/requests/:requestId/reject', lambdaToExpress(rejectRequest));

// Initialize database and start server
async function startServer() {
  try {
    console.log('🔧 Initializing database connection...');
    await initializeDatabase();
    console.log('✅ Database connection initialized successfully');

    app.listen(PORT, () => {
      console.log(`🚀 Development API server running at http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📦 Projects API: http://localhost:${PORT}/projects/active`);
      console.log(`👤 Employees API: http://localhost:${PORT}/employees`);
      console.log(`💼 Manager API: http://localhost:${PORT}/api/manager/dashboard`);
      console.log(`🧪 Using REAL PostgreSQL database (no mocks!)`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
