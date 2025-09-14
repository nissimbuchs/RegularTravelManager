import { InfrastructureStack } from '../infrastructure-stack';

/**
 * Lambda function configuration interface
 */
export interface LambdaFunctionConfig {
  /** CDK construct ID */
  id: string;
  /** Function display name (for descriptions and exports) */
  name: string;
  /** Lambda handler path */
  handler: string;
  /** Function description */
  description: string;
  /** Custom timeout override (defaults to stack config) */
  timeout?: number;
  /** Custom memory override (defaults to stack config) */
  memory?: number;
  /** Whether function needs VPC access */
  needsVpc?: boolean;
  /** Whether to enable CloudWatch alarms */
  enableAlarms?: boolean;
  /** Environment-specific configuration */
  environmentConfig?: EnvironmentConfigProvider;
  /** Additional environment variables */
  additionalEnvironment?: Record<string, string>;
}

/**
 * Environment configuration provider function
 */
export type EnvironmentConfigProvider = (
  environment: string,
  infrastructureStack: InfrastructureStack
) => Record<string, string>;

/**
 * Common environment configurations
 */
export const EnvironmentConfigs = {
  /** Basic API version config */
  apiVersion: (): Record<string, string> => ({
    API_VERSION: '1.0.0',
  }),

  /** Cognito configuration for auth functions */
  cognito: (environment: string, infra: InfrastructureStack): Record<string, string> => ({
    COGNITO_USER_POOL_ID: infra.userPool.userPoolId,
    COGNITO_CLIENT_ID: infra.userPoolClient.userPoolClientId,
    BYPASS_AUTH: environment === 'dev' ? 'true' : 'false',
    API_VERSION: '1.0.0',
  }),

  /** Location services for geocoding functions */
  location: (environment: string, infra: InfrastructureStack): Record<string, string> => ({
    PLACE_INDEX_NAME: infra.placeIndex.indexName,
    API_VERSION: '1.0.0',
  }),

  /** Cognito and location services combined */
  cognitoAndLocation: (environment: string, infra: InfrastructureStack): Record<string, string> => ({
    COGNITO_USER_POOL_ID: infra.userPool.userPoolId,
    PLACE_INDEX_NAME: infra.placeIndex.indexName,
    API_VERSION: '1.0.0',
  }),

  /** Full admin configuration */
  admin: (environment: string, infra: InfrastructureStack): Record<string, string> => ({
    COGNITO_USER_POOL_ID: infra.userPool.userPoolId,
    COGNITO_CLIENT_ID: infra.userPoolClient.userPoolClientId,
    API_VERSION: '1.0.0',
  }),
};

/**
 * Complete Lambda function definitions for the RegularTravelManager system
 */
export const LAMBDA_FUNCTIONS: Record<string, LambdaFunctionConfig> = {
  // Health and Auth Functions
  health: {
    id: 'HealthFunction',
    name: 'Health',
    handler: 'index.health',
    description: 'Health check endpoint for RTM API',
    environmentConfig: EnvironmentConfigs.apiVersion,
  },

  authorizer: {
    id: 'AuthorizerFunction',
    name: 'Authorizer',
    handler: 'index.authorizer',
    description: 'JWT token authorizer for RTM API',
    environmentConfig: EnvironmentConfigs.cognito,
  },

  // Employee Management Functions
  getEmployeeProfile: {
    id: 'GetEmployeeProfileFunction',
    name: 'GetEmployeeProfile',
    handler: 'index.getEmployeeProfile',
    description: 'Get employee profile information',
  },

  updateEmployeeAddress: {
    id: 'UpdateEmployeeAddressFunction',
    name: 'UpdateEmployeeAddress',
    handler: 'index.updateEmployeeAddress',
    description: 'Update employee home address',
  },

  getManagers: {
    id: 'GetManagersFunction',
    name: 'GetManagers',
    handler: 'index.getManagers',
    description: 'Get list of managers for dropdown selection',
    additionalEnvironment: { LOG_LEVEL: 'debug' },
  },

  // Project Management Functions
  createProject: {
    id: 'CreateProjectFunction',
    name: 'CreateProject',
    handler: 'index.createProject',
    description: 'Create new project (manager only)',
  },

  createSubproject: {
    id: 'CreateSubprojectFunction',
    name: 'CreateSubproject',
    handler: 'index.createSubproject',
    description: 'Create new subproject with geocoding (manager only)',
    environmentConfig: EnvironmentConfigs.location,
  },

  getActiveProjects: {
    id: 'GetActiveProjectsFunction',
    name: 'GetActiveProjects',
    handler: 'index.getActiveProjects',
    description: 'Get all active projects for employee selection',
  },

  getAllProjects: {
    id: 'GetAllProjectsFunction',
    name: 'GetAllProjects',
    handler: 'index.getAllProjects',
    description: 'Get all projects (active and inactive) for admin use',
  },

  getProjectById: {
    id: 'GetProjectByIdFunction',
    name: 'GetProjectById',
    handler: 'index.getProjectById',
    description: 'Get single project by ID',
  },

  getSubprojectsForProject: {
    id: 'GetSubprojectsForProjectFunction',
    name: 'GetSubprojectsForProject',
    handler: 'index.getSubprojectsForProject',
    description: 'Get subprojects for a specific project',
  },

  getSubprojectById: {
    id: 'GetSubprojectByIdFunction',
    name: 'GetSubprojectById',
    handler: 'index.getSubprojectById',
    description: 'Get single subproject by ID',
  },

  checkProjectReferences: {
    id: 'CheckProjectReferencesFunction',
    name: 'CheckProjectReferences',
    handler: 'index.checkProjectReferences',
    description: 'Check project references and dependencies',
  },

  searchProjects: {
    id: 'SearchProjectsFunction',
    name: 'SearchProjects',
    handler: 'index.searchProjects',
    description: 'Search projects by name or description',
  },

  projectsManagement: {
    id: 'ProjectsManagementFunction',
    name: 'ProjectsManagement',
    handler: 'index.projectsManagement',
    description: 'Project management operations for all user roles',
    environmentConfig: EnvironmentConfigs.cognitoAndLocation,
  },

  // Calculation Engine Functions
  calculateDistance: {
    id: 'CalculateDistanceFunction',
    name: 'CalculateDistance',
    handler: 'index.calculateDistance',
    description: 'Calculate distance between geographic points using PostGIS',
  },

  calculateAllowance: {
    id: 'CalculateAllowanceFunction',
    name: 'CalculateAllowance',
    handler: 'index.calculateAllowance',
    description: 'Calculate travel allowance from distance and rates',
  },

  calculateTravelCost: {
    id: 'CalculateTravelCostFunction',
    name: 'CalculateTravelCost',
    handler: 'index.calculateTravelCost',
    description: 'Calculate complete travel cost with audit trail',
  },

  getCalculationAudit: {
    id: 'GetCalculationAuditFunction',
    name: 'GetCalculationAudit',
    handler: 'index.getCalculationAudit',
    description: 'Retrieve calculation audit records for compliance',
  },

  invalidateCalculationCache: {
    id: 'InvalidateCalculationCacheFunction',
    name: 'InvalidateCalculationCache',
    handler: 'index.invalidateCalculationCache',
    description: 'Invalidate calculation cache when data changes',
  },

  cleanupExpiredCache: {
    id: 'CleanupExpiredCacheFunction',
    name: 'CleanupExpiredCache',
    handler: 'index.cleanupExpiredCache',
    description: 'Cleanup expired calculation cache entries',
  },

  calculationsEngine: {
    id: 'CalculationsEngineFunction',
    name: 'CalculationsEngine',
    handler: 'index.calculationsEngine',
    description: 'Main calculations engine for travel cost computations',
    environmentConfig: EnvironmentConfigs.location,
  },

  // Admin Functions
  adminProjectManagement: {
    id: 'AdminProjectManagementFunction',
    name: 'AdminProjectManagement',
    handler: 'index.adminProjectManagement',
    description: 'Admin project management (create, update, delete projects)',
    environmentConfig: EnvironmentConfigs.admin,
  },

  adminUserManagement: {
    id: 'AdminUserManagementFunction',
    name: 'AdminUserManagement',
    handler: 'index.adminUserManagement',
    description: 'Admin user management (create, update, delete users)',
    environmentConfig: EnvironmentConfigs.admin,
  },

  // Manager Functions
  managersDashboard: {
    id: 'ManagersDashboardFunction',
    name: 'ManagersDashboard',
    handler: 'index.managersDashboard',
    description: 'Manager dashboard with approval statistics and pending requests',
    environmentConfig: EnvironmentConfigs.cognito,
  },

  // Employee Travel Request Functions
  employeesTravelRequests: {
    id: 'EmployeesTravelRequestsFunction',
    name: 'EmployeesTravelRequests',
    handler: 'index.employeesTravelRequests',
    description: 'Employee travel request management (create, update, submit)',
    environmentConfig: EnvironmentConfigs.cognitoAndLocation,
  },

  // User Registration Functions (Story 5.1)
  registerUser: {
    id: 'RegisterUserFunction',
    name: 'RegisterUser',
    handler: 'index.registerUser',
    description: 'User registration with email verification for RTM',
    timeout: 60, // Longer timeout for user creation process
    environmentConfig: (environment: string, infra: InfrastructureStack) => ({
      COGNITO_USER_POOL_ID: infra.userPool.userPoolId,
      FROM_EMAIL_ADDRESS: 'nissim@buchs.be',
      SUPPORT_EMAIL: 'nissim@buchs.be',
      FRONTEND_BASE_URL: environment === 'production'
        ? 'https://rtfm.buchs.be'
        : environment === 'staging'
        ? 'https://rtm-staging.buchs.be'
        : 'https://dz57qvo83kxos.cloudfront.net',
      API_VERSION: '1.0.0',
    }),
  },

  verifyEmail: {
    id: 'VerifyEmailFunction',
    name: 'VerifyEmail',
    handler: 'index.verifyEmail',
    description: 'Email verification for user registration',
    environmentConfig: (environment: string, infra: InfrastructureStack) => ({
      COGNITO_USER_POOL_ID: infra.userPool.userPoolId,
      FROM_EMAIL_ADDRESS: 'nissim@buchs.be',
      SUPPORT_EMAIL: 'nissim@buchs.be',
      FRONTEND_BASE_URL: environment === 'production'
        ? 'https://rtfm.buchs.be'
        : environment === 'staging'
        ? 'https://rtfm-staging.buchs.be'
        : 'https://rtfm-dev.buchs.be',
      API_VERSION: '1.0.0',
    }),
  },

  resendVerification: {
    id: 'ResendVerificationFunction',
    name: 'ResendVerification',
    handler: 'index.resendVerification',
    description: 'Resend verification email for user registration',
    environmentConfig: (environment: string, infra: InfrastructureStack) => ({
      COGNITO_USER_POOL_ID: infra.userPool.userPoolId,
      FROM_EMAIL_ADDRESS: 'nissim@buchs.be',
      SUPPORT_EMAIL: 'nissim@buchs.be',
      FRONTEND_BASE_URL: environment === 'production'
        ? 'https://rtfm.buchs.be'
        : environment === 'staging'
        ? 'https://rtm-staging.buchs.be'
        : 'https://dz57qvo83kxos.cloudfront.net',
      API_VERSION: '1.0.0',
    }),
  },

  registrationStatus: {
    id: 'RegistrationStatusFunction',
    name: 'RegistrationStatus',
    handler: 'index.registrationStatus',
    description: 'Check registration status for user account',
    environmentConfig: EnvironmentConfigs.cognito,
  },

  // Utility Functions
  authUtils: {
    id: 'AuthUtilsFunction',
    name: 'AuthUtils',
    handler: 'index.authUtils',
    description: 'Authentication utility functions',
    needsVpc: false,
    environmentConfig: EnvironmentConfigs.cognito,
  },
};

/**
 * Development-only functions that are conditionally created
 */
export const DEV_ONLY_FUNCTIONS: Record<string, LambdaFunctionConfig> = {
  setupTestUsers: {
    id: 'SetupTestUsersFunction',
    name: 'SetupTestUsers',
    handler: 'index.setupTestUsers',
    description: 'Create test users in Cognito for development',
    timeout: 60,
    needsVpc: false,
    environmentConfig: (environment: string, infra: InfrastructureStack) => ({
      COGNITO_USER_POOL_ID: infra.userPool.userPoolId,
    }),
  },
};