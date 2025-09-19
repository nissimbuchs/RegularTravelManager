import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface RouteConfig {
  path: string;
  method: string;
  functionName: string;
  requiresAuth?: boolean;
  description?: string;
}

export interface RouteGroupConfig {
  basePath: string;
  routes: RouteConfig[];
  description?: string;
}

/**
 * Route builder for API Gateway with automatic Lambda integration
 * Eliminates repetitive route configuration code
 */
export class ApiRouteBuilder {
  constructor(
    private restApi: apigateway.RestApi,
    private functions: Record<string, lambda.IFunction>,
    private authorizer?: apigateway.IAuthorizer
  ) {}

  /**
   * Build multiple route groups from configuration
   */
  buildRouteGroups(routeGroups: RouteGroupConfig[]): void {
    for (const group of routeGroups) {
      this.buildRouteGroup(group);
    }
  }

  /**
   * Build a single route group with shared base path
   */
  buildRouteGroup(config: RouteGroupConfig): void {
    const baseResource = this.getOrCreateResource(config.basePath);

    for (const route of config.routes) {
      this.buildRoute(baseResource, route);
    }
  }

  /**
   * Build individual route with automatic integration
   */
  private buildRoute(baseResource: apigateway.IResource, config: RouteConfig): void {
    const func = this.functions[config.functionName];
    if (!func) {
      throw new Error(`Function '${config.functionName}' not found in functions map`);
    }

    // Create nested resources if path has segments
    const resource = this.createNestedResource(baseResource, config.path);

    // Create integration
    const integration = new apigateway.LambdaIntegration(func);

    // Determine method options
    const methodOptions: apigateway.MethodOptions =
      config.requiresAuth !== false && this.authorizer
        ? {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,
          }
        : {
            authorizationType: apigateway.AuthorizationType.NONE,
          };

    // Add method
    resource.addMethod(config.method, integration, methodOptions);

    // Grant permissions
    func.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
  }

  /**
   * Get or create resource from path segments
   */
  private getOrCreateResource(path: string): apigateway.IResource {
    const segments = path.split('/').filter(s => s.length > 0);
    let currentResource: apigateway.IResource = this.restApi.root;

    for (const segment of segments) {
      // Try to find existing child resource first
      const existingChild = (currentResource as any).children?.[segment];
      if (existingChild) {
        currentResource = existingChild;
      } else {
        currentResource = currentResource.addResource(segment);
      }
    }

    return currentResource;
  }

  /**
   * Create nested resources from path
   */
  private createNestedResource(
    baseResource: apigateway.IResource,
    path: string
  ): apigateway.IResource {
    if (!path || path === '/') {
      return baseResource;
    }

    const segments = path.split('/').filter(s => s.length > 0);
    let currentResource = baseResource;

    for (const segment of segments) {
      // Try to find existing child resource first
      const existingChild = (currentResource as any).children?.[segment];
      if (existingChild) {
        currentResource = existingChild;
      } else {
        currentResource = currentResource.addResource(segment);
      }
    }

    return currentResource;
  }
}

/**
 * Predefined route configurations for the RegularTravelManager API
 */
export const API_ROUTES: RouteGroupConfig[] = [
  {
    basePath: 'api/health',
    description: 'Health check endpoints',
    routes: [
      {
        path: '',
        method: 'GET',
        functionName: 'health',
        requiresAuth: false,
        description: 'Health check endpoint',
      },
    ],
  },
  {
    basePath: 'api/auth',
    description: 'Authentication and registration endpoints (Story 5.1)',
    routes: [
      {
        path: 'register',
        method: 'POST',
        functionName: 'register-user',
        requiresAuth: false,
        description: 'User registration with email verification',
      },
      {
        path: 'register',
        method: 'OPTIONS',
        functionName: 'register-user',
        requiresAuth: false,
        description: 'CORS preflight for user registration',
      },
      {
        path: 'verify-email',
        method: 'POST',
        functionName: 'verify-email',
        requiresAuth: false,
        description: 'Email verification for registration',
      },
      {
        path: 'verify-email',
        method: 'OPTIONS',
        functionName: 'verify-email',
        requiresAuth: false,
        description: 'CORS preflight for email verification',
      },
      {
        path: 'resend-verification',
        method: 'POST',
        functionName: 'resend-verification',
        requiresAuth: false,
        description: 'Resend verification email',
      },
      {
        path: 'resend-verification',
        method: 'OPTIONS',
        functionName: 'resend-verification',
        requiresAuth: false,
        description: 'CORS preflight for resend verification',
      },
      {
        path: 'registration-status',
        method: 'GET',
        functionName: 'registration-status',
        requiresAuth: false,
        description: 'Check registration status',
      },
      {
        path: 'registration-status',
        method: 'OPTIONS',
        functionName: 'registration-status',
        requiresAuth: false,
        description: 'CORS preflight for registration status',
      },
    ],
  },
  {
    basePath: 'api/projects',
    description: 'Project management endpoints',
    routes: [
      {
        path: '',
        method: 'GET',
        functionName: 'get-all-projects',
        description: 'List all projects',
      },
      {
        path: '',
        method: 'POST',
        functionName: 'create-project',
        description: 'Create new project',
      },
      {
        path: 'active',
        method: 'GET',
        functionName: 'get-active-projects',
        description: 'Get active projects',
      },
      {
        path: 'search',
        method: 'GET',
        functionName: 'search-projects',
        description: 'Search projects',
      },
      {
        path: 'geocode',
        method: 'GET',
        functionName: 'projects-management',
        requiresAuth: false,
        description: 'Geocode address for projects and subprojects',
      },
      {
        path: '{id}',
        method: 'GET',
        functionName: 'get-project-by-id',
        description: 'Get project by ID',
      },
      {
        path: '{id}',
        method: 'PUT',
        functionName: 'projects-management',
        description: 'Update project',
      },
      {
        path: '{id}',
        method: 'DELETE',
        functionName: 'projects-management',
        description: 'Delete project',
      },
      {
        path: '{id}/toggle-status',
        method: 'PATCH',
        functionName: 'projects-management',
        description: 'Toggle project status',
      },
      {
        path: '{id}/references',
        method: 'GET',
        functionName: 'check-project-references',
        description: 'Check project references',
      },
      {
        path: '{id}/subprojects',
        method: 'GET',
        functionName: 'get-subprojects-for-project',
        description: 'Get project subprojects',
      },
      {
        path: '{id}/subprojects',
        method: 'POST',
        functionName: 'create-subproject',
        description: 'Create subproject',
      },
      {
        path: '{id}/subprojects/{subprojectId}',
        method: 'GET',
        functionName: 'get-subproject-by-id',
        description: 'Get subproject by ID',
      },
      {
        path: '{id}/subprojects/{subprojectId}',
        method: 'PUT',
        functionName: 'projects-management',
        description: 'Update subproject',
      },
      {
        path: '{id}/subprojects/{subprojectId}',
        method: 'DELETE',
        functionName: 'projects-management',
        description: 'Delete subproject',
      },
      {
        path: '{id}/subprojects/{subprojectId}/toggle-status',
        method: 'PATCH',
        functionName: 'projects-management',
        description: 'Toggle subproject status',
      },
    ],
  },
  {
    basePath: 'api/subprojects',
    description: 'Direct subproject endpoints',
    routes: [
      {
        path: '',
        method: 'POST',
        functionName: 'create-subproject',
        description: 'Create subproject',
      },
      {
        path: '{id}',
        method: 'GET',
        functionName: 'get-subproject-by-id',
        description: 'Get subproject by ID',
      },
      {
        path: '{id}',
        method: 'PUT',
        functionName: 'projects-management',
        description: 'Update subproject',
      },
      {
        path: '{id}',
        method: 'DELETE',
        functionName: 'projects-management',
        description: 'Delete subproject',
      },
    ],
  },
  {
    basePath: 'api/employees',
    description: 'Employee management endpoints',
    routes: [
      {
        path: '{cognitoUserId}',
        method: 'GET',
        functionName: 'get-employee-profile',
        description: 'Get employee profile',
      },
      {
        path: '{cognitoUserId}/address',
        method: 'PUT',
        functionName: 'update-employee-address',
        description: 'Update employee address',
      },
      {
        path: '{cognitoUserId}/address/history',
        method: 'GET',
        functionName: 'get-employee-profile',
        description: 'Get address history',
      },
      {
        path: 'managers',
        method: 'GET',
        functionName: 'get-managers',
        description: 'Get managers list',
      },
      {
        path: 'travel-requests',
        method: 'POST',
        functionName: 'employees-travel-requests',
        description: 'Submit travel request',
      },
      {
        path: 'travel-requests',
        method: 'GET',
        functionName: 'employees-travel-requests',
        description: 'Get employee travel requests',
      },
      {
        path: 'travel-requests/preview',
        method: 'POST',
        functionName: 'employees-travel-requests',
        description: 'Preview travel request',
      },
    ],
  },
  {
    basePath: 'api/managers',
    description: 'Manager direct access',
    routes: [
      {
        path: '',
        method: 'GET',
        functionName: 'get-managers',
        description: 'Get managers (backward compatibility)',
      },
    ],
  },
  {
    basePath: 'api/geocoding',
    description: 'Geocoding services',
    routes: [
      {
        path: 'address',
        method: 'POST',
        functionName: 'update-employee-address',
        description: 'Geocode address',
      },
    ],
  },
  {
    basePath: 'api/calculations',
    description: 'Calculation engine endpoints',
    routes: [
      {
        path: 'distance',
        method: 'POST',
        functionName: 'calculate-distance',
        description: 'Calculate distance',
      },
      {
        path: 'allowance',
        method: 'POST',
        functionName: 'calculate-allowance',
        description: 'Calculate allowance',
      },
      {
        path: 'preview',
        method: 'POST',
        functionName: 'calculate-travel-cost',
        description: 'Calculate travel cost preview',
      },
      {
        path: 'audit/{requestId}',
        method: 'GET',
        functionName: 'get-calculation-audit',
        description: 'Get calculation audit',
      },
      {
        path: 'cache/invalidate',
        method: 'POST',
        functionName: 'invalidate-calculation-cache',
        description: 'Invalidate calculation cache',
      },
      {
        path: 'cache/expired',
        method: 'DELETE',
        functionName: 'cleanup-expired-cache',
        description: 'Cleanup expired cache',
      },
    ],
  },
  {
    basePath: 'api/travel-requests',
    description: 'Travel request endpoints',
    routes: [
      {
        path: '',
        method: 'POST',
        functionName: 'employees-travel-requests',
        description: 'Submit travel request',
      },
      {
        path: '',
        method: 'GET',
        functionName: 'employees-travel-requests',
        description: 'Get travel requests',
      },
      {
        path: 'preview',
        method: 'POST',
        functionName: 'employees-travel-requests',
        description: 'Preview travel request',
      },
    ],
  },
  {
    basePath: 'api/manager',
    description: 'Manager dashboard and operations',
    routes: [
      {
        path: 'dashboard',
        method: 'GET',
        functionName: 'managers-dashboard',
        description: 'Get manager dashboard data',
      },
      {
        path: 'requests',
        method: 'GET',
        functionName: 'managers-dashboard',
        description: 'Get pending requests',
      },
      {
        path: 'employee-context/{employeeId}',
        method: 'GET',
        functionName: 'managers-dashboard',
        description: 'Get employee context',
      },
      {
        path: 'requests/{id}/context',
        method: 'GET',
        functionName: 'managers-dashboard',
        description: 'Get request context',
      },
      {
        path: 'requests/{id}/approve',
        method: 'PUT',
        functionName: 'managers-dashboard',
        description: 'Approve request',
      },
      {
        path: 'requests/{id}/reject',
        method: 'PUT',
        functionName: 'managers-dashboard',
        description: 'Reject request',
      },
    ],
  },
  {
    basePath: 'api/admin',
    description: 'Admin management endpoints',
    routes: [
      {
        path: 'projects',
        method: 'GET',
        functionName: 'admin-project-management',
        description: 'Admin project management',
      },
      // User Management Routes (Story 5.3) - Complete path-based routing
      {
        path: 'users',
        method: 'GET',
        functionName: 'admin-user-management',
        description: 'List all users with pagination and filtering',
      },
      {
        path: 'users/{userId}',
        method: 'GET',
        functionName: 'admin-user-management',
        description: 'Get detailed user information',
      },
      {
        path: 'users/{userId}/status',
        method: 'PUT',
        functionName: 'admin-user-management',
        description: 'Update user active status',
      },
      {
        path: 'users/{userId}/manager',
        method: 'PUT',
        functionName: 'admin-user-management',
        description: 'Update user manager assignment',
      },
      {
        path: 'users/{userId}',
        method: 'DELETE',
        functionName: 'admin-user-management',
        description: 'Delete user with comprehensive cleanup',
      },
      // Role Management Routes (Story 5.3)
      {
        path: 'users/{userId}/role',
        method: 'PUT',
        functionName: 'admin-role-management',
        description: 'Update user role with validation',
      },
      {
        path: 'users/{userId}/role/validate',
        method: 'POST',
        functionName: 'admin-role-management',
        description: 'Validate role change before execution',
      },
      {
        path: 'users/{userId}/manager/validate',
        method: 'POST',
        functionName: 'admin-role-management',
        description: 'Validate manager assignment before execution',
      },
    ],
  },
];
