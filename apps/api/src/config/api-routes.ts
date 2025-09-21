/**
 * API Route Configuration for Local Gateway
 *
 * Defines all API routes, their handlers, and authentication requirements.
 * This is a simplified version of the infrastructure route configuration
 * for use in local development.
 */

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
    description: 'Authentication and registration endpoints',
    routes: [
      {
        path: 'register',
        method: 'POST',
        functionName: 'register-user',
        requiresAuth: false,
        description: 'User registration',
      },
      {
        path: 'verify-email',
        method: 'POST',
        functionName: 'verify-email',
        requiresAuth: false,
        description: 'Email verification',
      },
      {
        path: 'resend-verification',
        method: 'POST',
        functionName: 'resend-verification',
        requiresAuth: false,
        description: 'Resend verification email',
      },
      {
        path: 'registration-status',
        method: 'GET',
        functionName: 'registration-status',
        requiresAuth: false,
        description: 'Check registration status',
      },
    ],
  },
  {
    basePath: 'api/user',
    description: 'User profile endpoints',
    routes: [
      {
        path: 'profile',
        method: 'GET',
        functionName: 'user-get-profile',
        requiresAuth: true,
        description: 'Get current user profile',
      },
      {
        path: 'profile',
        method: 'PUT',
        functionName: 'user-update-profile',
        requiresAuth: true,
        description: 'Update current user profile',
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
        description: 'Geocode address',
      },
      {
        path: '{projectId}',
        method: 'GET',
        functionName: 'get-project-by-id',
        description: 'Get project by ID',
      },
      {
        path: '{projectId}',
        method: 'PUT',
        functionName: 'projects-management',
        description: 'Update project',
      },
      {
        path: '{projectId}',
        method: 'DELETE',
        functionName: 'projects-management',
        description: 'Delete project',
      },
      {
        path: '{projectId}/toggle-status',
        method: 'PATCH',
        functionName: 'projects-management',
        description: 'Toggle project status',
      },
      {
        path: '{projectId}/references',
        method: 'GET',
        functionName: 'check-project-references',
        description: 'Check project references',
      },
      {
        path: '{projectId}/subprojects',
        method: 'GET',
        functionName: 'get-subprojects-for-project',
        description: 'Get project subprojects',
      },
      {
        path: '{projectId}/subprojects',
        method: 'POST',
        functionName: 'create-subproject',
        description: 'Create subproject',
      },
      {
        path: '{projectId}/subprojects/{subprojectId}',
        method: 'GET',
        functionName: 'get-subproject-by-id',
        description: 'Get subproject by ID',
      },
      {
        path: '{projectId}/subprojects/{subprojectId}',
        method: 'PUT',
        functionName: 'projects-management',
        description: 'Update subproject',
      },
      {
        path: '{projectId}/subprojects/{subprojectId}',
        method: 'DELETE',
        functionName: 'projects-management',
        description: 'Delete subproject',
      },
      {
        path: '{projectId}/subprojects/{subprojectId}/toggle-status',
        method: 'PATCH',
        functionName: 'projects-management',
        description: 'Toggle subproject status',
      },
    ],
  },
  // Note: Direct subproject endpoints removed - frontend only uses nested endpoints
  {
    basePath: 'api/employees',
    description: 'Employee management endpoints',
    routes: [
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
        description: 'Get managers',
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
      {
        path: 'users',
        method: 'GET',
        functionName: 'admin-user-management',
        description: 'List all users',
      },
      {
        path: 'users/{userId}',
        method: 'GET',
        functionName: 'admin-user-management',
        description: 'Get user details',
      },
      {
        path: 'users/{userId}/status',
        method: 'PUT',
        functionName: 'admin-user-management',
        description: 'Update user status',
      },
      {
        path: 'users/{userId}/manager',
        method: 'PUT',
        functionName: 'admin-user-management',
        description: 'Update user manager',
      },
      {
        path: 'users/{userId}',
        method: 'PUT',
        functionName: 'admin-user-management',
        description: 'Update user profile',
      },
      {
        path: 'users/{userId}',
        method: 'DELETE',
        functionName: 'admin-user-management',
        description: 'Delete user',
      },
      {
        path: 'users/{userId}/role',
        method: 'PUT',
        functionName: 'admin-role-management',
        description: 'Update user role',
      },
      {
        path: 'users/{userId}/role/validate',
        method: 'POST',
        functionName: 'admin-role-management',
        description: 'Validate role change',
      },
      {
        path: 'users/{userId}/manager/validate',
        method: 'POST',
        functionName: 'admin-role-management',
        description: 'Validate manager assignment',
      },
    ],
  },
];
