import { healthHandler } from './health';
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
} from './employees/profile';
import {
  calculatePreview as calculatePreviewHandler,
  createTravelRequest as createTravelRequestHandler,
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

// Project management handlers (require auth)
import {
  createProject as createProjectHandler,
  createSubproject as createSubprojectHandler,
  getActiveProjects as getActiveProjectsHandler,
  getSubprojectsForProject as getSubprojectsForProjectHandler,
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
