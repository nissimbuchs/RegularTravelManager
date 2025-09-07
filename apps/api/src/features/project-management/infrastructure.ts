/**
 * Project Management Feature Infrastructure Definition
 * This file defines all infrastructure requirements for project management features.
 */

import { FeatureInfrastructure } from '../travel-requests/infrastructure';

export const projectManagementInfrastructure: FeatureInfrastructure = {
  lambdaFunctions: [
    {
      name: 'get-projects',
      handler: 'apps/api/src/handlers/projects/get-projects.handler',
      description: 'Retrieves active projects and subprojects',
      timeout: 10,
      memory: 256,
    },
    {
      name: 'create-project',
      handler: 'apps/api/src/handlers/projects/create-project.handler',
      description: 'Admin creates new project',
      timeout: 10,
      memory: 256,
    },
    {
      name: 'update-project',
      handler: 'apps/api/src/handlers/projects/update-project.handler',
      description: 'Admin updates project details',
      timeout: 10,
      memory: 256,
    },
    {
      name: 'create-subproject',
      handler: 'apps/api/src/handlers/projects/create-subproject.handler',
      description: 'Admin creates subproject with location',
      timeout: 15, // Geocoding time
      memory: 256,
    },
  ],

  apiRoutes: [
    {
      method: 'GET',
      path: '/projects',
      lambdaFunction: 'get-projects',
      requiresAuth: true,
      description: 'Get all active projects',
    },
    {
      method: 'GET',
      path: '/projects/{id}/subprojects',
      lambdaFunction: 'get-projects',
      requiresAuth: true,
      description: 'Get subprojects for a project',
    },
    {
      method: 'POST',
      path: '/admin/projects',
      lambdaFunction: 'create-project',
      requiresAuth: true,
      description: 'Admin creates project',
    },
    {
      method: 'PUT',
      path: '/admin/projects/{id}',
      lambdaFunction: 'update-project',
      requiresAuth: true,
      description: 'Admin updates project',
    },
    {
      method: 'POST',
      path: '/admin/projects/{id}/subprojects',
      lambdaFunction: 'create-subproject',
      requiresAuth: true,
      description: 'Admin creates subproject',
    },
  ],

  environmentVariables: [
    'DATABASE_URL',
    'GEOCODING_API_KEY',
    'GEOCODING_ENDPOINT',
    'AWS_REGION',
    'LOG_LEVEL',
  ],

  iamPermissions: [
    'rds-db:connect',
    'logs:CreateLogGroup',
    'logs:CreateLogStream',
    'logs:PutLogEvents',
  ],

  databaseMigrations: [
    '007_add_project_management_indexes.sql',
    '008_add_subproject_geocoding.sql',
  ],

  awsServices: ['API Gateway', 'Lambda', 'RDS PostgreSQL', 'CloudWatch'],
};
