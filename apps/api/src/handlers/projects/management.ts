import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../../middleware/logger';
import { formatResponse } from '../../middleware/response-formatter';
import { ValidationError, NotFoundError } from '../../middleware/error-handler';
import { validateRequest } from '../../middleware/request-validator';
import { db } from '../../database/connection';
import {
  ProjectService,
  CreateProjectCommand,
  CreateSubprojectCommand,
  UpdateProjectCommand,
  UpdateSubprojectCommand,
  ProjectSearchFilters,
} from '@rtm/project-management';
import { GeocodingService, GeocodeResult, GeocodeRequest } from '../../services/geocoding-service';
import { getUserContextFromEvent, requireManager } from '../auth/auth-utils';
import { ProjectDomainService } from '../../domain/project-management/ProjectDomainService';
import { SubprojectDomainService } from '../../domain/project-management/SubprojectDomainService';

class ProjectServiceImpl implements ProjectService {
  private geocodingService: GeocodingService;
  public projectDomainService: ProjectDomainService;
  public subprojectDomainService: SubprojectDomainService;

  constructor() {
    this.geocodingService = new GeocodingService();
    this.projectDomainService = new ProjectDomainService();
    this.subprojectDomainService = new SubprojectDomainService();
  }

  async createProject(command: CreateProjectCommand) {
    return await this.projectDomainService.createProject(command);
  }

  async createSubproject(command: CreateSubprojectCommand) {
    return await this.subprojectDomainService.createSubproject(command);
  }

  async updateProject(command: UpdateProjectCommand) {
    return await this.projectDomainService.updateProject(command);
  }

  async getProject(id: string) {
    return await this.projectDomainService.getProject(id);
  }

  async getSubproject(id: string) {
    return await this.subprojectDomainService.getSubproject(id);
  }

  async getActiveProjects() {
    return await this.projectDomainService.getActiveProjects();
  }

  async getAllProjects() {
    return await this.projectDomainService.getAllProjects();
  }

  async getProjectsWithFilters(filters: ProjectSearchFilters) {
    return await this.projectDomainService.getProjectsWithFilters(filters);
  }

  async getSubprojectsForProject(projectId: string) {
    return await this.subprojectDomainService.getSubprojectsForProject(projectId);
  }

  async searchProjects(searchTerm: string) {
    return await this.projectDomainService.searchProjects(searchTerm);
  }

  async updateSubproject(command: UpdateSubprojectCommand) {
    return await this.subprojectDomainService.updateSubproject(command);
  }

  async deleteSubproject(projectId: string, subprojectId: string) {
    return await this.subprojectDomainService.deleteSubproject(projectId, subprojectId);
  }

  async canDeleteProject(projectId: string) {
    return await this.projectDomainService.canDeleteProject(projectId);
  }

  // Additional methods for admin functionality
  async getActiveProjectsWithCounts() {
    return await this.projectDomainService.getActiveProjectsWithCounts();
  }

  async getAllProjectsWithCounts() {
    return await this.projectDomainService.getProjectsWithCounts();
  }

  async searchProjectsWithCounts(searchTerm: string) {
    return await this.projectDomainService.searchProjectsWithCounts(searchTerm);
  }
}

const projectService = new ProjectServiceImpl();

// Create project (admin only)
export const createProject = validateRequest({
  body: {
    name: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    description: { required: false, type: 'string', maxLength: 1000 },
    defaultCostPerKm: { required: true, type: 'number' },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromEvent(event);
  requireManager(userContext); // Only managers can create projects

  const body = JSON.parse(event.body!);

  logger.info('Creating project', {
    name: body.name,
    createdBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  // Validate cost per km is positive
  if (body.defaultCostPerKm <= 0) {
    throw new ValidationError('Cost per kilometer must be positive');
  }

  const command: CreateProjectCommand = {
    name: body.name,
    description: body.description,
    defaultCostPerKm: body.defaultCostPerKm,
  };

  const project = await projectService.createProject(command);

  logger.info('Project created successfully', {
    projectId: project.id,
    name: project.name,
    requestId: context.awsRequestId,
  });

  return formatResponse(201, project, context.awsRequestId);
});

// Create subproject (admin only)
export const createSubproject = validateRequest({
  body: {
    projectId: { required: true, type: 'string' },
    name: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    streetAddress: { required: false, type: 'string', maxLength: 255 },
    city: { required: false, type: 'string', maxLength: 100 },
    postalCode: {
      required: false,
      type: 'string',
      pattern: /^[0-9]{4,5}$/, // Swiss postal code format
    },
    costPerKm: { required: false, type: 'number' },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromEvent(event);
  requireManager(userContext);

  const body = JSON.parse(event.body!);

  logger.info('Creating subproject', {
    name: body.name,
    projectId: body.projectId,
    createdBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  // Validate cost per km if provided
  if (body.costPerKm !== undefined && body.costPerKm <= 0) {
    throw new ValidationError('Cost per kilometer must be positive');
  }

  const command: CreateSubprojectCommand = {
    projectId: body.projectId,
    name: body.name,
    streetAddress: body.streetAddress,
    city: body.city,
    postalCode: body.postalCode,
    country: 'Switzerland',
    costPerKm: body.costPerKm,
  };

  const subproject = await projectService.createSubproject(command);

  logger.info('Subproject created successfully', {
    subprojectId: subproject.id,
    name: subproject.name,
    requestId: context.awsRequestId,
  });

  return formatResponse(201, subproject, context.awsRequestId);
});

// Get all active projects
export const getActiveProjects = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromEvent(event);

  logger.info('Getting active projects', {
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  const projects = await projectService.getActiveProjectsWithCounts();

  return formatResponse(200, { projects }, context.awsRequestId);
};

// Get all projects (active and inactive) - for admin use
export const getAllProjects = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromEvent(event);

  // Require manager role for this endpoint
  requireManager(userContext);

  // Extract query parameters for filtering
  const queryParams = event.queryStringParameters || {};
  const filters: ProjectSearchFilters = {};

  // Parse filter parameters
  if (queryParams.search) {
    filters.search = queryParams.search;
  }

  if (queryParams.isActive !== undefined) {
    filters.isActive = queryParams.isActive === 'true';
  }

  if (queryParams.minCostPerKm) {
    const minCost = parseFloat(queryParams.minCostPerKm);
    if (!isNaN(minCost) && minCost >= 0) {
      filters.minCostPerKm = minCost;
    }
  }

  if (queryParams.maxCostPerKm) {
    const maxCost = parseFloat(queryParams.maxCostPerKm);
    if (!isNaN(maxCost) && maxCost >= 0) {
      filters.maxCostPerKm = maxCost;
    }
  }

  if (queryParams.createdAfter) {
    filters.createdAfter = queryParams.createdAfter;
  }

  if (queryParams.createdBefore) {
    filters.createdBefore = queryParams.createdBefore;
  }

  logger.info('Getting projects with filters', {
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
    filters,
  });

  // Use filtered query if filters are present, otherwise get all projects with counts
  const hasFilters = Object.keys(filters).length > 0;
  const projects = hasFilters
    ? await projectService.getProjectsWithFilters(filters)
    : await projectService.getAllProjectsWithCounts();

  return formatResponse(200, { projects }, context.awsRequestId);
};

// Get single project by ID
export const getProjectById = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromEvent(event);
  const projectId = event.pathParameters?.projectId;

  if (!projectId) {
    return formatResponse(400, { error: 'Project ID is required' }, context.awsRequestId);
  }

  logger.info('Getting project by ID', {
    projectId,
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  try {
    const project = await projectService.getProject(projectId);

    if (!project) {
      return formatResponse(404, { error: 'Project not found' }, context.awsRequestId);
    }

    return formatResponse(200, { project }, context.awsRequestId);
  } catch (error) {
    logger.error('Failed to get project by ID', {
      projectId,
      error: error instanceof Error ? error.message : String(error),
      requestId: context.awsRequestId,
    });

    return formatResponse(500, { error: 'Internal server error' }, context.awsRequestId);
  }
};

// Get subprojects for a project
export const getSubprojectsForProject = validateRequest({
  pathParams: {
    projectId: { required: true, type: 'string' },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const projectId = event.pathParameters?.projectId;
  const userContext = getUserContextFromEvent(event);

  logger.info('Getting subprojects for project', {
    projectId,
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  // Get subprojects (this already verifies project exists in domain service)
  const subprojects = await projectService.getSubprojectsForProject(projectId!);

  // Get project info for response
  const project = await projectService.getProject(projectId!);
  if (!project) {
    throw new NotFoundError('Project');
  }

  return formatResponse(
    200,
    {
      project: project.name,
      subprojects,
    },
    context.awsRequestId
  );
});

// Search projects
export const searchProjects = validateRequest({
  queryParams: {
    q: { required: true, type: 'string', minLength: 2 },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const searchTerm = event.queryStringParameters?.q;
  const userContext = getUserContextFromEvent(event);

  logger.info('Searching projects', {
    searchTerm,
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  const projects = await projectService.searchProjectsWithCounts(searchTerm!);

  return formatResponse(
    200,
    {
      query: searchTerm,
      projects,
    },
    context.awsRequestId
  );
});

// Update project (admin only)
export const updateProject = validateRequest({
  pathParams: {
    projectId: { required: true, type: 'string' },
  },
  body: {
    name: { required: false, type: 'string', minLength: 1, maxLength: 255 },
    description: { required: false, type: 'string', maxLength: 1000 },
    defaultCostPerKm: { required: false, type: 'number' },
    isActive: { required: false, type: 'boolean' },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const projectId = event.pathParameters?.projectId;
  const userContext = getUserContextFromEvent(event);
  requireManager(userContext);

  const body = JSON.parse(event.body!);

  logger.info('Updating project', {
    projectId,
    updatedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  // Validate cost per km if provided
  if (body.defaultCostPerKm !== undefined && body.defaultCostPerKm <= 0) {
    throw new ValidationError('Cost per kilometer must be positive');
  }

  const command: UpdateProjectCommand = {
    id: projectId!,
    name: body.name,
    description: body.description,
    defaultCostPerKm: body.defaultCostPerKm,
    isActive: body.isActive,
  };

  const project = await projectService.updateProject(command);

  logger.info('Project updated successfully', {
    projectId: project.id,
    name: project.name,
    requestId: context.awsRequestId,
  });

  return formatResponse(200, project, context.awsRequestId);
});

// Toggle project status (admin only)
export const toggleProjectStatus = validateRequest({
  pathParams: {
    projectId: { required: true, type: 'string' },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const projectId = event.pathParameters?.projectId;
  const userContext = getUserContextFromEvent(event);
  requireManager(userContext);

  logger.info('Toggling project status', {
    projectId,
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  // Get current project status
  const currentProject = await projectService.getProject(projectId!);
  if (!currentProject) {
    throw new NotFoundError('Project');
  }

  const command: UpdateProjectCommand = {
    id: projectId!,
    isActive: !currentProject.isActive,
  };

  const project = await projectService.updateProject(command);

  logger.info('Project status toggled successfully', {
    projectId: project.id,
    newStatus: project.isActive ? 'active' : 'inactive',
    requestId: context.awsRequestId,
  });

  return formatResponse(200, project, context.awsRequestId);
});

// Toggle subproject status (admin only)
export const toggleSubprojectStatus = validateRequest({
  pathParams: {
    projectId: { required: true, type: 'string' },
    subprojectId: { required: true, type: 'string' },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const projectId = event.pathParameters?.projectId;
  const subprojectId = event.pathParameters?.subprojectId;
  const userContext = getUserContextFromEvent(event);
  requireManager(userContext);

  logger.info('Toggling subproject status', {
    projectId,
    subprojectId,
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  // Get current subproject status
  const currentSubproject = await projectService.getSubproject(subprojectId!);
  if (!currentSubproject) {
    throw new NotFoundError('Subproject');
  }

  const command: UpdateSubprojectCommand = {
    id: subprojectId!,
    projectId: projectId!,
    isActive: !currentSubproject.isActive,
  };

  const subproject = await projectService.updateSubproject(command);

  logger.info('Subproject status toggled successfully', {
    projectId,
    subprojectId: subproject.id,
    newStatus: subproject.isActive ? 'active' : 'inactive',
    requestId: context.awsRequestId,
  });

  return formatResponse(200, subproject, context.awsRequestId);
});

// Check project references (admin only)
// Get single subproject by ID
export const getSubprojectById = validateRequest({
  pathParams: {
    projectId: { required: true, type: 'string' },
    subprojectId: { required: true, type: 'string' },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const projectId = event.pathParameters?.projectId;
  const subprojectId = event.pathParameters?.subprojectId;
  const userContext = getUserContextFromEvent(event);

  logger.info('Getting subproject by ID', {
    projectId,
    subprojectId,
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  // Verify project exists first
  const project = await projectService.getProject(projectId!);
  if (!project) {
    throw new NotFoundError('Project');
  }

  const subproject = await projectService.getSubproject(subprojectId!);
  if (!subproject) {
    throw new NotFoundError('Subproject');
  }

  // Verify the subproject belongs to the specified project
  if (subproject.projectId !== projectId) {
    throw new NotFoundError('Subproject not found in specified project');
  }

  return formatResponse(200, subproject, context.awsRequestId);
});

export const checkProjectReferences = validateRequest({
  pathParams: {
    projectId: { required: true, type: 'string' },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const projectId = event.pathParameters?.projectId;
  const userContext = getUserContextFromEvent(event);
  requireManager(userContext);

  logger.info('Checking project references', {
    projectId,
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  const canDelete = await projectService.canDeleteProject(projectId!);

  // Get reference count for detailed response
  const result = await db.query(
    `
    SELECT COUNT(*) as count
    FROM travel_requests tr
    JOIN subprojects s ON tr.subproject_id = s.id
    WHERE s.project_id = $1 AND tr.status != 'completed'
  `,
    [projectId]
  );

  const referencesCount = parseInt(result.rows[0].count);

  return formatResponse(
    200,
    {
      canDelete,
      referencesCount,
      projectId,
    },
    context.awsRequestId
  );
});

// Delete project (admin only)
export const deleteProject = validateRequest({
  pathParams: {
    projectId: { required: true, type: 'string' },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const projectId = event.pathParameters?.projectId;
  const userContext = getUserContextFromEvent(event);
  requireManager(userContext);

  logger.info('Deleting project', {
    projectId,
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  // Use domain service to delete project (includes all validation)
  await projectService.projectDomainService.deleteProject(projectId!);

  logger.info('Project deleted successfully', {
    projectId,
    requestId: context.awsRequestId,
  });

  return formatResponse(204, null, context.awsRequestId);
});

// Helper function to parse address string into GeocodeRequest
function parseAddressString(addressString: string): GeocodeRequest {
  // For Swiss addresses, try to parse common patterns
  // Examples: "Bahnhofstrasse 45, 8001 Zurich, Switzerland"
  //           "Rue du Rhône 112, Geneva"
  //           "Basel"

  const trimmed = addressString.trim();
  const parts = trimmed.split(',').map(part => part.trim());

  let street = '';
  let city = '';
  let postalCode = '';
  let country = 'Switzerland'; // Default for Swiss addresses

  if (parts.length === 1) {
    // Just city name
    city = parts[0] || '';
  } else if (parts.length === 2) {
    // "Street, City" or "PostalCode City, Country"
    const firstPart = parts[0] || '';
    const secondPart = parts[1] || '';

    // Check if first part contains numbers (likely street)
    if (/\d/.test(firstPart)) {
      street = firstPart;
      // Second part might be "PostalCode City"
      const cityMatch = secondPart.match(/^(\d{4})?\s*(.+)$/);
      if (cityMatch) {
        if (cityMatch[1]) {
          postalCode = cityMatch[1];
        }
        city = cityMatch[2] || '';
      } else {
        city = secondPart;
      }
    } else {
      // First part is likely city, second might be country
      city = firstPart;
      country = secondPart.toLowerCase().includes('switzerland') ? 'Switzerland' : secondPart;
    }
  } else if (parts.length >= 3) {
    // "Street, PostalCode City, Country"
    street = parts[0] || '';
    const cityPart = parts[1] || '';
    country = parts[2] || 'Switzerland';

    // Extract postal code and city from middle part
    const cityMatch = cityPart.match(/^(\d{4})?\s*(.+)$/);
    if (cityMatch) {
      if (cityMatch[1]) {
        postalCode = cityMatch[1];
      }
      city = cityMatch[2] || '';
    } else {
      city = cityPart;
    }
  }

  return {
    street,
    city,
    postalCode,
    country,
  };
}

// Geocode address endpoint
export const geocodeAddress = validateRequest({
  queryParams: {
    address: { required: true, type: 'string', minLength: 3, maxLength: 255 },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const address = event.queryStringParameters?.address;

  // Get user context if available (optional for public geocoding endpoint)
  let userContext = null;
  try {
    userContext = getUserContextFromEvent(event);
  } catch (error) {
    // User context not available - this is fine for public geocoding endpoint
  }

  logger.info('Geocoding address', {
    address,
    requestedBy: userContext?.sub || 'anonymous',
    requestId: context.awsRequestId,
  });

  try {
    const geocodingService = new GeocodingService();

    // Parse the address string to create a GeocodeRequest
    const geocodeRequest = parseAddressString(address!);

    const result = await geocodingService.geocodeAddress(geocodeRequest);

    logger.info('Geocoding successful', {
      address,
      coordinates: result,
      requestId: context.awsRequestId,
    });

    return formatResponse(200, result, context.awsRequestId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Geocoding failed', {
      address,
      error: errorMessage,
      requestId: context.awsRequestId,
    });

    // Return a more user-friendly error for geocoding failures
    throw new ValidationError(
      'Unable to geocode the provided address. Please check the address format.'
    );
  }
});

// Update subproject (admin only)
export const updateSubproject = validateRequest({
  body: {
    name: { required: false, type: 'string', minLength: 1, maxLength: 255 },
    streetAddress: { required: false, type: 'string', maxLength: 255 },
    city: { required: false, type: 'string', maxLength: 100 },
    postalCode: {
      required: false,
      type: 'string',
      pattern: /^[0-9]{4,5}$/,
    },
    costPerKm: { required: false, type: 'number' },
    isActive: { required: false, type: 'boolean' },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromEvent(event);
  requireManager(userContext);

  const projectId = event.pathParameters?.projectId;
  const subprojectId = event.pathParameters?.subprojectId;
  const body = JSON.parse(event.body!);

  if (!projectId || !subprojectId) {
    throw new ValidationError('Project ID and Subproject ID are required');
  }

  logger.info('Updating subproject', {
    subprojectId,
    projectId,
    updatedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  // Validate cost per km is positive if provided
  if (body.costPerKm !== undefined && body.costPerKm <= 0) {
    throw new ValidationError('Cost per kilometer must be positive');
  }

  const command: UpdateSubprojectCommand = {
    id: subprojectId,
    projectId: projectId,
    name: body.name,
    streetAddress: body.streetAddress,
    city: body.city,
    postalCode: body.postalCode,
    country: 'Switzerland',
    costPerKm: body.costPerKm,
    isActive: body.isActive,
  };

  const subproject = await projectService.updateSubproject(command);

  logger.info('Subproject updated successfully', {
    subprojectId: subproject.id,
    name: subproject.name,
    requestId: context.awsRequestId,
  });

  return formatResponse(200, subproject, context.awsRequestId);
});

// Delete subproject (admin only)
export const deleteSubproject = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromEvent(event);
  requireManager(userContext);

  const projectId = event.pathParameters?.projectId;
  const subprojectId = event.pathParameters?.subprojectId;

  if (!projectId || !subprojectId) {
    throw new ValidationError('Project ID and Subproject ID are required');
  }

  logger.info('Deleting subproject', {
    subprojectId,
    projectId,
    deletedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  await projectService.deleteSubproject(projectId, subprojectId);

  logger.info('Subproject deleted successfully', {
    subprojectId,
    projectId,
    requestId: context.awsRequestId,
  });

  return formatResponse(204, null, context.awsRequestId);
};
