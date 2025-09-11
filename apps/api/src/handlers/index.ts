import { healthHandler } from './health/health-check';
import { corsMiddleware } from '../middleware/cors';
import { errorHandler } from '../middleware/error-handler';
import { initializeDatabase } from '../database/connection';

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
export const health = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return healthHandler(event, context);
  })
);

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
import {
  calculatePreview as calculatePreviewHandler,
  createTravelRequest as createTravelRequestHandler,
  employeesTravelRequests as employeesTravelRequestsHandler,
} from './employees/travel-requests';

export const getEmployeeProfile = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return getEmployeeProfileHandler(event, context);
  })
);

export const updateEmployeeAddress = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return updateEmployeeAddressHandler(event, context);
  })
);

export const calculateTravelPreview = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return calculatePreviewHandler(event, context);
  })
);

export const createTravelRequest = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return createTravelRequestHandler(event, context);
  })
);

export const getManagers = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return getManagersHandler(event, context);
  })
);

export const employeesTravelRequests = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return employeesTravelRequestsHandler(event, context);
  })
);

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

export const createProject = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return createProjectHandler(event, context);
  })
);

export const createSubproject = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return createSubprojectHandler(event, context);
  })
);

export const getActiveProjects = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return getActiveProjectsHandler(event, context);
  })
);

export const getAllProjects = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return getAllProjectsHandler(event, context);
  })
);

export const getProjectById = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return getProjectByIdHandler(event, context);
  })
);

export const getSubprojectsForProject = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return getSubprojectsForProjectHandler(event, context);
  })
);

export const searchProjects = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return searchProjectsHandler(event, context);
  })
);

export const updateProject = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return updateProjectHandler(event, context);
  })
);

export const deleteProject = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return deleteProjectHandler(event, context);
  })
);

export const toggleProjectStatus = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return toggleProjectStatusHandler(event, context);
  })
);

export const checkProjectReferences = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return checkProjectReferencesHandler(event, context);
  })
);

export const geocodeAddress = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return geocodeAddressHandler(event, context);
  })
);

export const getSubprojectById = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return getSubprojectByIdHandler(event, context);
  })
);

// Unified project management handler for routing PUT/DELETE operations
import {
  updateSubproject as updateSubprojectHandler,
  deleteSubproject as deleteSubprojectHandler,
} from './projects/management';

export const projectsManagement = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    
    const method = event.httpMethod;
    const path = event.path;
    
    console.log('🔄 ProjectsManagement router:', {
      method,
      path,
      requestId: context.awsRequestId,
    });
    
    // Route based on HTTP method and path
    if (method === 'PUT' && path.includes('/projects/')) {
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
    } else if (method === 'PUT' && path.includes('/subprojects/')) {
      console.log('🔄 Routing to updateSubprojectHandler');
      return updateSubprojectHandler(event, context);
    } else if (method === 'DELETE' && path.includes('/subprojects/')) {
      console.log('🔄 Routing to deleteSubprojectHandler');
      return deleteSubprojectHandler(event, context);
    } else {
      console.log('❌ No route matched:', { method, path });
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Method Not Allowed',
          message: `${method} ${path} is not supported by this handler`
        }),
      };
    }
  })
);

// Calculation engine handlers (require auth)
import {
  calculateDistance as calculateDistanceHandler,
  calculateAllowance as calculateAllowanceHandler,
  calculateTravelCost as calculateTravelCostHandler,
  getCalculationAudit as getCalculationAuditHandler,
  invalidateCalculationCache as invalidateCalculationCacheHandler,
  cleanupExpiredCache as cleanupExpiredCacheHandler,
} from './calculations/engine';

export const calculateDistance = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return calculateDistanceHandler(event, context);
  })
);

export const calculateAllowance = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return calculateAllowanceHandler(event, context);
  })
);

export const calculateTravelCost = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return calculateTravelCostHandler(event, context);
  })
);

export const getCalculationAudit = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return getCalculationAuditHandler(event, context);
  })
);

export const invalidateCalculationCache = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return invalidateCalculationCacheHandler(event, context);
  })
);

export const cleanupExpiredCache = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return cleanupExpiredCacheHandler(event, context);
  })
);

// Manager dashboard handlers (require auth)
import {
  getManagerDashboard as getManagerDashboardHandler,
  getEmployeeContext as getEmployeeContextHandler,
  approveRequest as approveRequestHandler,
  rejectRequest as rejectRequestHandler,
} from './managers/dashboard';

export const getManagerDashboard = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return getManagerDashboardHandler(event, context);
  })
);

export const getEmployeeContext = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return getEmployeeContextHandler(event, context);
  })
);

export const approveRequest = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return approveRequestHandler(event, context);
  })
);

export const rejectRequest = errorHandler(
  corsMiddleware(async (event, context) => {
    await ensureDatabaseInitialized();
    return rejectRequestHandler(event, context);
  })
);

// Router function for all manager dashboard endpoints
export const managersDashboard = errorHandler(
  corsMiddleware(async (event, context) => {
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
    } else if (method === 'GET' && (path.includes('/employee-context/') || path.includes('/context'))) {
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
      return {
        statusCode: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ 
          error: 'Method Not Allowed',
          message: `${method} ${path} is not supported by this handler`
        }),
      };
    }
  })
);

// Admin user management handlers (require admin auth)
// Temporarily disabled due to import issues - will fix after deployment
// import {
//   listUsersHandler,
// } from './admin/user-management';

// export const listAdminUsers = errorHandler(
//   corsMiddleware(async (event, context) => {
//     await ensureDatabaseInitialized();
//     return listUsersHandler(event, context);
//   })
// );
