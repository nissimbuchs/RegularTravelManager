#!/usr/bin/env node
/**
 * Lambda Function Simulator
 *
 * Simulates AWS Lambda function execution for local development.
 * Receives events from the API Gateway simulator and invokes
 * the appropriate Lambda handlers.
 */

import express from 'express';
import { initializeDatabase } from './database/connection';

// Import all Lambda handlers
import * as handlers from './handlers/index';

const LAMBDA_PORT = 3001;
const app = express();

// Middleware - No CORS needed, this is internal communication only
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`⚡ [LAMBDA] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Lambda Function Simulator',
    timestamp: new Date().toISOString(),
    handlersLoaded: Object.keys(handlers).length,
  });
});

/**
 * Get Lambda handler by function name
 */
function getLambdaHandler(functionName: string): any {
  // Convert kebab-case to camelCase
  const handlerName = functionName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

  // Map function names to handlers
  const handlerMap: Record<string, any> = {
    // Health
    health: handlers.health,

    // Projects
    getActiveProjects: handlers.getActiveProjects,
    getAllProjects: handlers.getAllProjects,
    getProjectById: handlers.getProjectById,
    createProject: handlers.createProject,
    createSubproject: handlers.createSubproject,
    getSubprojectsForProject: handlers.getSubprojectsForProject,
    getSubprojectById: handlers.getSubprojectById,
    searchProjects: handlers.searchProjects,
    checkProjectReferences: handlers.checkProjectReferences,
    projectsManagement: handlers.projectsManagement,

    // Employees
    getEmployeeProfile: handlers.getEmployeeProfile,
    updateEmployeeAddress: handlers.updateEmployeeAddress,
    getManagers: handlers.getManagers,
    employeesTravelRequests: handlers.employeesTravelRequests,

    // Managers
    managersDashboard: handlers.managersDashboard,

    // Admin
    adminUserManagement: handlers.adminUserManagement,
    adminRoleManagement: handlers.adminRoleManagement,
    adminProjectManagement: handlers.adminProjectManagement,

    // Calculations
    calculateDistance: handlers.calculateDistance,
    calculateAllowance: handlers.calculateAllowance,
    calculateTravelCost: handlers.calculateTravelCost,
    getCalculationAudit: handlers.getCalculationAudit,
    invalidateCalculationCache: handlers.invalidateCalculationCache,
    cleanupExpiredCache: handlers.cleanupExpiredCache,

    // User Profile
    userGetProfile: handlers.userGetProfile,
    userUpdateProfile: handlers.userUpdateProfile,

    // Registration
    registerUser: handlers.registerUser,
    verifyEmail: handlers.verifyEmail,
    resendVerification: handlers.resendVerification,
    registrationStatus: handlers.registrationStatus,
  };

  return handlerMap[handlerName] || null;
}

/**
 * Lambda invocation endpoint
 */
app.post('/invoke/:functionName', async (req, res) => {
  const { functionName } = req.params;
  const lambdaEvent = req.body;

  console.log(`⚡ [LAMBDA] Invoking function: ${functionName}`);

  try {
    // Get the handler
    const handler = getLambdaHandler(functionName);

    if (!handler) {
      console.error(`❌ [LAMBDA] Handler not found: ${functionName}`);
      return res.status(404).json({
        statusCode: 404,
        body: JSON.stringify({
          error: 'Not Found',
          message: `Lambda function '${functionName}' not found`,
        }),
      });
    }

    // Create Lambda context
    const context = {
      awsRequestId: lambdaEvent.requestContext?.requestId || `lambda-${Date.now()}`,
      functionName: functionName,
      getRemainingTimeInMillis: () => 30000, // 30 seconds
    };

    // Invoke the handler
    const startTime = Date.now();
    const result = await handler(lambdaEvent, context);
    const duration = Date.now() - startTime;

    console.log(`✅ [LAMBDA] Function ${functionName} completed in ${duration}ms`);

    // Return Lambda response format
    res.json(result);
  } catch (error) {
    console.error(`❌ [LAMBDA] Function ${functionName} error:`, error);

    // Format error response
    const errorResponse = {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId: lambdaEvent.requestContext?.requestId,
      }),
    };

    res.status(500).json(errorResponse);
  }
});

// List available functions
app.get('/functions', (req, res) => {
  const functions = [
    'health',
    'get-active-projects',
    'get-all-projects',
    'get-project-by-id',
    'create-project',
    'create-subproject',
    'get-subprojects-for-project',
    'get-subproject-by-id',
    'search-projects',
    'check-project-references',
    'projects-management',
    'get-employee-profile',
    'update-employee-address',
    'get-managers',
    'employees-travel-requests',
    'managers-dashboard',
    'admin-user-management',
    'admin-role-management',
    'admin-project-management',
    'calculate-distance',
    'calculate-allowance',
    'calculate-travel-cost',
    'get-calculation-audit',
    'invalidate-calculation-cache',
    'cleanup-expired-cache',
    'user-get-profile',
    'user-update-profile',
    'register-user',
    'verify-email',
    'resend-verification',
    'registration-status',
  ];

  res.json({
    functions,
    count: functions.length,
  });
});

/**
 * Start the Lambda simulator
 */
async function startLambdaSimulator() {
  try {
    console.log('🔧 [LAMBDA] Initializing database...');
    await initializeDatabase();
    console.log('✅ [LAMBDA] Database initialized');

    app.listen(LAMBDA_PORT, () => {
      console.log(`\n⚡ Lambda Function Simulator`);
      console.log(`================================`);
      console.log(`✅ Server running at: http://localhost:${LAMBDA_PORT}`);
      console.log(`📊 Health check: http://localhost:${LAMBDA_PORT}/health`);
      console.log(`🎯 Functions list: http://localhost:${LAMBDA_PORT}/functions`);
      console.log(`📦 ${Object.keys(handlers).length} handlers loaded`);
      console.log(`================================\n`);
    });
  } catch (error) {
    console.error('❌ [LAMBDA] Failed to start:', error);
    process.exit(1);
  }
}

// Start the simulator
startLambdaSimulator();
