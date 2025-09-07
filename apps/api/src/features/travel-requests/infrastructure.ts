/**
 * Travel Requests Feature Infrastructure Definition
 * This file defines all infrastructure requirements for the travel requests feature.
 * When implementing travel request stories, developers must update this file.
 */

export interface FeatureInfrastructure {
  lambdaFunctions: LambdaFunction[];
  apiRoutes: ApiRoute[];
  environmentVariables: string[];
  iamPermissions: string[];
  databaseMigrations: string[];
  awsServices: string[];
}

export interface LambdaFunction {
  name: string;
  handler: string;
  description: string;
  timeout?: number;
  memory?: number;
}

export interface ApiRoute {
  method: string;
  path: string;
  lambdaFunction: string;
  requiresAuth: boolean;
  description: string;
}

/**
 * Complete infrastructure definition for travel requests feature
 */
export const travelRequestsInfrastructure: FeatureInfrastructure = {
  lambdaFunctions: [
    {
      name: 'submit-travel-request',
      handler: 'apps/api/src/handlers/travel-requests/submit-request.handler',
      description: 'Handles travel request submission with distance calculation',
      timeout: 30, // seconds - needs time for PostGIS calculations
      memory: 512  // MB - sufficient for geographic calculations
    },
    {
      name: 'get-travel-requests',
      handler: 'apps/api/src/handlers/travel-requests/get-requests.handler', 
      description: 'Retrieves travel requests for employees and managers',
      timeout: 10,
      memory: 256
    },
    {
      name: 'process-travel-request',
      handler: 'apps/api/src/handlers/travel-requests/process-request.handler',
      description: 'Handles manager approval/rejection of travel requests',
      timeout: 15,
      memory: 256
    },
    {
      name: 'withdraw-travel-request',
      handler: 'apps/api/src/handlers/travel-requests/withdraw-request.handler',
      description: 'Allows employees to withdraw pending requests',
      timeout: 10,
      memory: 256
    }
  ],

  apiRoutes: [
    {
      method: 'POST',
      path: '/travel-requests',
      lambdaFunction: 'submit-travel-request',
      requiresAuth: true,
      description: 'Employee submits new travel request'
    },
    {
      method: 'GET', 
      path: '/travel-requests',
      lambdaFunction: 'get-travel-requests',
      requiresAuth: true,
      description: 'Get travel requests (filtered by user role)'
    },
    {
      method: 'GET',
      path: '/travel-requests/{id}',
      lambdaFunction: 'get-travel-requests', 
      requiresAuth: true,
      description: 'Get specific travel request details'
    },
    {
      method: 'PUT',
      path: '/travel-requests/{id}/process',
      lambdaFunction: 'process-travel-request',
      requiresAuth: true,
      description: 'Manager approves or rejects request'
    },
    {
      method: 'PUT',
      path: '/travel-requests/{id}/withdraw',
      lambdaFunction: 'withdraw-travel-request',
      requiresAuth: true,
      description: 'Employee withdraws pending request'
    },
    {
      method: 'GET',
      path: '/manager/requests',
      lambdaFunction: 'get-travel-requests',
      requiresAuth: true,
      description: 'Manager dashboard - get pending requests'
    }
  ],

  environmentVariables: [
    'DATABASE_URL',        // PostgreSQL connection
    'AWS_REGION',         // AWS region for services
    'SES_FROM_EMAIL',     // Email notifications sender
    'SES_ENDPOINT',       // SES endpoint (LocalStack in dev)
    'COGNITO_USER_POOL_ID', // User authentication
    'CORS_ORIGINS',       // Allowed frontend origins
    'LOG_LEVEL'           // Logging configuration
  ],

  iamPermissions: [
    'rds-db:connect',           // Database access
    'ses:SendEmail',            // Email notifications
    'ses:SendRawEmail',         // Email notifications  
    'cognito-idp:GetUser',      // User information
    'logs:CreateLogGroup',      // CloudWatch logging
    'logs:CreateLogStream',     // CloudWatch logging
    'logs:PutLogEvents'         // CloudWatch logging
  ],

  databaseMigrations: [
    '001_create_travel_requests_table.sql',
    '002_add_travel_request_indexes.sql',
    '003_create_request_status_history.sql',
    '004_add_withdrawal_status.sql'
  ],

  awsServices: [
    'API Gateway',    // REST API endpoints
    'Lambda',         // Function execution
    'RDS PostgreSQL', // Data storage with PostGIS
    'SES',           // Email notifications
    'Cognito',       // Authentication
    'CloudWatch'     // Logging and monitoring
  ]
};

/**
 * Validation function to ensure all infrastructure is properly configured
 * This should be called by the infrastructure validator script
 */
export function validateTravelRequestsInfrastructure(): string[] {
  const errors: string[] = [];
  
  // Validate that all handler files exist
  travelRequestsInfrastructure.lambdaFunctions.forEach(func => {
    const handlerPath = `${func.handler}.ts`;
    // Note: File existence check would be done by the validator script
    if (!func.name || !func.handler || !func.description) {
      errors.push(`Lambda function ${func.name} missing required fields`);
    }
  });

  // Validate API routes reference valid Lambda functions  
  const lambdaNames = new Set(travelRequestsInfrastructure.lambdaFunctions.map(f => f.name));
  travelRequestsInfrastructure.apiRoutes.forEach(route => {
    if (!lambdaNames.has(route.lambdaFunction)) {
      errors.push(`API route ${route.method} ${route.path} references unknown Lambda function: ${route.lambdaFunction}`);
    }
  });

  return errors;
}

/**
 * Development helper - generates CDK code for this feature
 * Can be used by developers to quickly generate infrastructure boilerplate
 */
export function generateCDKCode(): string {
  const lambdaFunctions = travelRequestsInfrastructure.lambdaFunctions.map(func => `
    // ${func.description}
    const ${func.name.replace(/-/g, '')}Lambda = new Function(this, '${func.name}', {
      runtime: Runtime.NODEJS_20_X,
      handler: '${func.handler}.handler',
      code: Code.fromAsset('apps/api/dist'),
      timeout: Duration.seconds(${func.timeout || 10}),
      memorySize: ${func.memory || 256},
      environment: {
        ${travelRequestsInfrastructure.environmentVariables.map(env => `${env}: process.env.${env} || ''`).join(',\n        ')}
      }
    });`).join('\n');

  const apiRoutes = travelRequestsInfrastructure.apiRoutes.map(route => `
    // ${route.description}
    api.addMethod('${route.method}', '${route.path}', {
      integration: new LambdaIntegration(${route.lambdaFunction.replace(/-/g, '')}Lambda),
      authorizer: ${route.requiresAuth ? 'cognitoAuthorizer' : 'undefined'}
    });`).join('\n');

  return `
// Generated CDK code for Travel Requests feature
// Add this to your Lambda and API Gateway stacks

// Lambda Functions:
${lambdaFunctions}

// API Gateway Routes:
${apiRoutes}
`;
}