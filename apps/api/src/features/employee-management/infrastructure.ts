/**
 * Employee Management Feature Infrastructure Definition
 * This file defines all infrastructure requirements for employee management features.
 */

import { FeatureInfrastructure } from '../travel-requests/infrastructure';

export const employeeManagementInfrastructure: FeatureInfrastructure = {
  lambdaFunctions: [
    {
      name: 'get-employee-profile',
      handler: 'apps/api/src/handlers/employees/get-profile.handler',
      description: 'Retrieves employee profile information',
      timeout: 10,
      memory: 256
    },
    {
      name: 'update-employee-address',
      handler: 'apps/api/src/handlers/employees/update-address.handler',
      description: 'Updates employee home address with geocoding',
      timeout: 20, // Geocoding may take extra time
      memory: 256
    },
    {
      name: 'search-employees',
      handler: 'apps/api/src/handlers/employees/search-employees.handler', 
      description: 'Manager search for employees',
      timeout: 10,
      memory: 256
    }
  ],

  apiRoutes: [
    {
      method: 'GET',
      path: '/employees/profile',
      lambdaFunction: 'get-employee-profile',
      requiresAuth: true,
      description: 'Get current user profile'
    },
    {
      method: 'GET',
      path: '/employees/{cognitoUserId}',
      lambdaFunction: 'get-employee-profile',
      requiresAuth: true,
      description: 'Get specific employee profile'
    },
    {
      method: 'PUT',
      path: '/employees/address',
      lambdaFunction: 'update-employee-address',
      requiresAuth: true,
      description: 'Update employee home address'
    },
    {
      method: 'GET',
      path: '/employees/search',
      lambdaFunction: 'search-employees',
      requiresAuth: true,
      description: 'Search employees (manager only)'
    }
  ],

  environmentVariables: [
    'DATABASE_URL',
    'GEOCODING_API_KEY',    // For address validation
    'GEOCODING_ENDPOINT',   // Geocoding service endpoint
    'AWS_REGION',
    'LOG_LEVEL'
  ],

  iamPermissions: [
    'rds-db:connect',
    'logs:CreateLogGroup',
    'logs:CreateLogStream', 
    'logs:PutLogEvents'
  ],

  databaseMigrations: [
    '005_create_employee_address_history.sql',
    '006_add_employee_search_indexes.sql'
  ],

  awsServices: [
    'API Gateway',
    'Lambda', 
    'RDS PostgreSQL',
    'CloudWatch'
  ]
};