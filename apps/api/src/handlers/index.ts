import { healthHandler } from './health/health-check';
import { errorHandler } from '../middleware/error-handler';
import { initializeDatabase } from '../database/connection';
import { formatResponse } from '../middleware/response-formatter';

// Initialize database connection when Lambda starts
let isDbInitialized = false;

const ensureDatabaseInitialized = async () => {
  if (!isDbInitialized) {
    await initializeDatabase();
    isDbInitialized = true;
  }
};

// Export handlers with middleware chain

// Health check (no auth required)
export const health = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return healthHandler(event, context);
});

// Authentication handlers
export {
  authorizerHandler as authorizer,
  healthAuthorizerHandler as healthAuthorizer,
} from './auth/authorizer';
export {
  setupTestUsersHandler as setupTestUsers,
  listUsersHandler as listUsers,
  getUserDetailsHandler as getUserDetails,
} from './auth/setup-test-users';

// Employee handlers (require auth)
import {
  getEmployeeProfile as getEmployeeProfileHandler,
  updateEmployeeAddress as updateEmployeeAddressHandler,
  getManagers as getManagersHandler,
} from './employees/profile';

// User Profile handlers
import { getProfileHandler } from './user/get-profile';
import { updateProfileHandler } from './user/update-profile';
import {
  calculatePreview as calculatePreviewHandler,
  createTravelRequest as createTravelRequestHandler,
  employeesTravelRequests as employeesTravelRequestsHandler,
} from './employees/travel-requests';

export const getEmployeeProfile = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return getEmployeeProfileHandler(event, context);
});

export const updateEmployeeAddress = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return updateEmployeeAddressHandler(event, context);
});

export const calculateTravelPreview = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return calculatePreviewHandler(event, context);
});

export const createTravelRequest = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return createTravelRequestHandler(event, context);
});

export const getManagers = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return getManagersHandler(event, context);
});

export const employeesTravelRequests = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return employeesTravelRequestsHandler(event, context);
});

// Project management handlers (require auth)
import {
  createProject as createProjectHandler,
  createSubproject as createSubprojectHandler,
  getActiveProjects as getActiveProjectsHandler,
  getAllProjects as getAllProjectsHandler,
  getProjectById as getProjectByIdHandler,
  getSubprojectsForProject as getSubprojectsForProjectHandler,
  getSubprojectById as getSubprojectByIdHandler,
  searchProjects as searchProjectsHandler,
  updateProject as updateProjectHandler,
  deleteProject as deleteProjectHandler,
  toggleProjectStatus as toggleProjectStatusHandler,
  checkProjectReferences as checkProjectReferencesHandler,
  geocodeAddress as geocodeAddressHandler,
} from './projects/management';

export const createProject = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return createProjectHandler(event, context);
});

export const createSubproject = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return createSubprojectHandler(event, context);
});

export const getActiveProjects = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return getActiveProjectsHandler(event, context);
});

export const getAllProjects = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return getAllProjectsHandler(event, context);
});

export const getProjectById = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return getProjectByIdHandler(event, context);
});

export const getSubprojectsForProject = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return getSubprojectsForProjectHandler(event, context);
});

export const searchProjects = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return searchProjectsHandler(event, context);
});

export const updateProject = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return updateProjectHandler(event, context);
});

export const deleteProject = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return deleteProjectHandler(event, context);
});

export const toggleProjectStatus = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return toggleProjectStatusHandler(event, context);
});

export const checkProjectReferences = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return checkProjectReferencesHandler(event, context);
});

export const geocodeAddress = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return geocodeAddressHandler(event, context);
});

export const getSubprojectById = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return getSubprojectByIdHandler(event, context);
});

// Unified project management handler for routing PUT/DELETE operations
import {
  updateSubproject as updateSubprojectHandler,
  deleteSubproject as deleteSubprojectHandler,
} from './projects/management';

export const projectsManagement = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();

  const method = event.httpMethod;
  const path = event.path;

  console.log('🔄 ProjectsManagement router (with geocoding):', {
    method,
    path,
    requestId: context.awsRequestId,
  });

  // Route based on HTTP method and path - check subprojects first since they are more specific
  if (method === 'PUT' && path.includes('/subprojects/')) {
    console.log('🔄 Routing to updateSubprojectHandler');
    return updateSubprojectHandler(event, context);
  } else if (method === 'DELETE' && path.includes('/subprojects/')) {
    console.log('🔄 Routing to deleteSubprojectHandler');
    return deleteSubprojectHandler(event, context);
  } else if (method === 'PUT' && path.includes('/projects/')) {
    console.log('🔄 Routing to updateProjectHandler');
    const result = await updateProjectHandler(event, context);
    console.log('✅ UpdateProjectHandler completed:', {
      statusCode: result.statusCode,
      requestId: context.awsRequestId,
    });
    return result;
  } else if (method === 'DELETE' && path.includes('/projects/')) {
    console.log('🔄 Routing to deleteProjectHandler');
    return deleteProjectHandler(event, context);
  } else if (method === 'GET' && path.includes('/geocode')) {
    console.log('🔄 Routing to geocodeAddressHandler');
    return geocodeAddressHandler(event, context);
  } else {
    console.log('❌ No route matched:', { method, path });
    return formatResponse(
      405,
      {
        error: 'Method Not Allowed',
        message: `${method} ${path} is not supported by this handler`,
      },
      context.awsRequestId
    );
  }
});

// Calculation engine handlers (require auth)
import {
  calculateDistance as calculateDistanceHandler,
  calculateAllowance as calculateAllowanceHandler,
  calculateTravelCost as calculateTravelCostHandler,
  getCalculationAudit as getCalculationAuditHandler,
  invalidateCalculationCache as invalidateCalculationCacheHandler,
  cleanupExpiredCache as cleanupExpiredCacheHandler,
} from './calculations/engine';

export const calculateDistance = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return calculateDistanceHandler(event, context);
});

export const calculateAllowance = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return calculateAllowanceHandler(event, context);
});

export const calculateTravelCost = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return calculateTravelCostHandler(event, context);
});

export const getCalculationAudit = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return getCalculationAuditHandler(event, context);
});

export const invalidateCalculationCache = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return invalidateCalculationCacheHandler(event, context);
});

export const cleanupExpiredCache = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return cleanupExpiredCacheHandler(event, context);
});

// Manager dashboard handlers (require auth)
import {
  getManagerDashboard as getManagerDashboardHandler,
  getEmployeeContext as getEmployeeContextHandler,
  approveRequest as approveRequestHandler,
  rejectRequest as rejectRequestHandler,
} from './managers/dashboard';

export const getManagerDashboard = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return getManagerDashboardHandler(event, context);
});

export const getEmployeeContext = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return getEmployeeContextHandler(event, context);
});

export const approveRequest = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return approveRequestHandler(event, context);
});

export const rejectRequest = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return rejectRequestHandler(event, context);
});

// Router function for all manager dashboard endpoints
export const managersDashboard = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();

  const method = event.httpMethod;
  const path = event.path;

  console.log('🔄 ManagersDashboard router:', {
    method,
    path,
    requestId: context.awsRequestId,
  });

  // Route based on HTTP method and path
  if (method === 'GET' && path.includes('/manager/dashboard')) {
    console.log('🔄 Routing to getManagerDashboardHandler');
    return getManagerDashboardHandler(event, context);
  } else if (
    method === 'GET' &&
    (path.includes('/employee-context/') || path.includes('/context'))
  ) {
    console.log('🔄 Routing to getEmployeeContextHandler');
    return getEmployeeContextHandler(event, context);
  } else if (method === 'PUT' && path.includes('/approve')) {
    console.log('🔄 Routing to approveRequestHandler');
    return approveRequestHandler(event, context);
  } else if (method === 'PUT' && path.includes('/reject')) {
    console.log('🔄 Routing to rejectRequestHandler');
    return rejectRequestHandler(event, context);
  } else {
    console.log('❌ No route matched:', { method, path });
    return formatResponse(
      405,
      {
        error: 'Method Not Allowed',
        message: `${method} ${path} is not supported by this handler`,
      },
      context.awsRequestId
    );
  }
});

// Admin user management handlers (require admin auth)
import {
  listUsersHandler,
  getUserDetailsHandler,
  updateUserStatusHandler,
  updateUserManagerHandler,
  deleteUserHandler,
} from './admin/user-management';

import {
  updateUserRoleHandler,
  validateRoleChangeHandler,
  validateManagerAssignmentHandler,
} from './admin/role-management';

import {
  listProjectsHandler as adminListProjectsHandler,
  createProjectHandler as adminCreateProjectHandler,
  listSubprojectsHandler as adminListSubprojectsHandler,
  createSubprojectHandler as adminCreateSubprojectHandler,
} from './admin/project-management';

// Router function for all admin user management endpoints
export const adminUserManagement = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();

  const method = event.httpMethod;
  const path = event.path;

  console.log('🔄 AdminUserManagement router:', {
    method,
    path,
    requestId: context.awsRequestId,
  });

  // Route based on HTTP method and path
  if (method === 'GET' && (path.match(/\/admin\/users$/) || path.includes('/admin/users?'))) {
    console.log('🔄 Routing to listUsersHandler');
    return listUsersHandler(event, context);
  } else if (method === 'GET' && path.match(/\/admin\/users\/[^/]+$/)) {
    console.log('🔄 Routing to getUserDetailsHandler');
    return getUserDetailsHandler(event, context);
  } else if (method === 'PUT' && path.includes('/status')) {
    console.log('🔄 Routing to updateUserStatusHandler');
    return updateUserStatusHandler(event, context);
  } else if (method === 'PUT' && path.includes('/manager') && !path.includes('/role')) {
    console.log('🔄 Routing to updateUserManagerHandler');
    return updateUserManagerHandler(event, context);
  } else if (method === 'DELETE' && path.match(/\/admin\/users\/[^/]+$/)) {
    console.log('🔄 Routing to deleteUserHandler');
    return deleteUserHandler(event, context);
  } else {
    console.log('❌ No route matched:', { method, path });
    return formatResponse(
      405,
      {
        error: 'Method Not Allowed',
        message: `${method} ${path} is not supported by this handler`,
      },
      context.awsRequestId
    );
  }
});

// Router function for all admin role management endpoints
export const adminRoleManagement = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();

  const method = event.httpMethod;
  const path = event.path;

  console.log('🔄 AdminRoleManagement router:', {
    method,
    path,
    requestId: context.awsRequestId,
  });

  // Route based on HTTP method and path
  if (method === 'PUT' && path.includes('/role') && !path.includes('/validate')) {
    console.log('🔄 Routing to updateUserRoleHandler');
    return updateUserRoleHandler(event, context);
  } else if (method === 'POST' && path.includes('/role/validate')) {
    console.log('🔄 Routing to validateRoleChangeHandler');
    return validateRoleChangeHandler(event, context);
  } else if (method === 'POST' && path.includes('/manager/validate')) {
    console.log('🔄 Routing to validateManagerAssignmentHandler');
    return validateManagerAssignmentHandler(event, context);
  } else {
    console.log('❌ No route matched:', { method, path });
    return formatResponse(
      405,
      {
        error: 'Method Not Allowed',
        message: `${method} ${path} is not supported by this handler`,
      },
      context.awsRequestId
    );
  }
});

// Router function for all admin project management endpoints
export const adminProjectManagement = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();

  const method = event.httpMethod;
  const path = event.path;

  console.log('🔄 AdminProjectManagement router:', {
    method,
    path,
    requestId: context.awsRequestId,
  });

  // Route based on HTTP method and path
  if (method === 'GET' && path.includes('/admin/projects')) {
    console.log('🔄 Routing to adminListProjectsHandler');
    return adminListProjectsHandler(event, context);
  } else if (method === 'POST' && path.includes('/admin/projects')) {
    console.log('🔄 Routing to adminCreateProjectHandler');
    return adminCreateProjectHandler(event, context);
  } else {
    console.log('❌ No route matched:', { method, path });
    return formatResponse(
      405,
      {
        error: 'Method Not Allowed',
        message: `${method} ${path} is not supported by this handler`,
      },
      context.awsRequestId
    );
  }
});

// Registration handlers (Story 5.1) - Public endpoints, no auth required
import { handler as registerUserHandler } from './auth/register-user';
import { handler as verifyEmailHandler } from './auth/verify-email';
import { handler as resendVerificationHandler } from './auth/resend-verification';
import { handler as registrationStatusHandler } from './auth/registration-status';

export const registerUser = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return registerUserHandler(event);
});

export const verifyEmail = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return verifyEmailHandler(event);
});

export const resendVerification = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return resendVerificationHandler(event);
});

export const registrationStatus = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return registrationStatusHandler(event);
});

// User Profile handlers
export const userGetProfile = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return getProfileHandler(event, context);
});

export const userUpdateProfile = errorHandler(async (event, context) => {
  await ensureDatabaseInitialized();
  return updateProfileHandler(event, context);
});
