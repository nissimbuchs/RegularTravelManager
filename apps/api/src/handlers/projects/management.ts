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

class ProjectServiceImpl implements ProjectService {
  private geocodingService: GeocodingService;

  constructor() {
    this.geocodingService = new GeocodingService();
  }

  async createProject(command: CreateProjectCommand) {
    logger.info('Creating project', { name: command.name });

    const result = await db.query(
      `
      INSERT INTO projects (name, description, default_cost_per_km, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING *
    `,
      [command.name, command.description || null, command.defaultCostPerKm]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      defaultCostPerKm: parseFloat(row.default_cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createSubproject(command: CreateSubprojectCommand) {
    logger.info('Creating subproject', {
      name: command.name,
      projectId: command.projectId,
    });

    // Verify parent project exists
    const projectResult = await db.query(
      'SELECT id, default_cost_per_km FROM projects WHERE id = $1 AND is_active = true',
      [command.projectId]
    );

    if (projectResult.rows.length === 0) {
      throw new NotFoundError('Parent project');
    }

    const parentProject = projectResult.rows[0];
    let coordinates: GeocodeResult | null = null;

    // Geocode location if address is provided
    if (command.streetAddress && command.city && command.postalCode) {
      try {
        coordinates = await this.geocodingService.geocodeAddress({
          street: command.streetAddress,
          city: command.city,
          postalCode: command.postalCode,
          country: command.country || 'Switzerland',
        });

        logger.info('Subproject geocoding successful', {
          name: command.name,
          coordinates,
        });
      } catch (error) {
        logger.warn('Subproject geocoding failed, using default coordinates', {
          error: error.message,
          name: command.name,
        });
        coordinates = { latitude: 46.947974, longitude: 7.447447 }; // Default to Bern
      }
    }

    // Use subproject cost rate or inherit from parent project
    const costPerKm = command.costPerKm || parentProject.default_cost_per_km;

    const result = await db.query(
      `
      INSERT INTO subprojects (
        project_id, 
        name, 
        street_address,
        city,
        postal_code,
        country,
        location,
        cost_per_km,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING *
    `,
      [
        command.projectId,
        command.name,
        command.streetAddress || null,
        command.city || null,
        command.postalCode || null,
        command.country || 'Switzerland',
        coordinates ? `POINT(${coordinates.longitude} ${coordinates.latitude})` : null,
        costPerKm,
      ]
    );

    const row = result.rows[0];

    // Transform to camelCase for domain interface compatibility
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      streetAddress: row.street_address,
      city: row.city,
      postalCode: row.postal_code,
      country: row.country,
      locationCoordinates: coordinates
        ? {
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
          }
        : undefined,
      costPerKm: parseFloat(row.cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async updateProject(command: UpdateProjectCommand) {
    logger.info('Updating project', { id: command.id });

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (command.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(command.name);
    }
    if (command.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(command.description);
    }
    if (command.defaultCostPerKm !== undefined) {
      setClauses.push(`default_cost_per_km = $${paramIndex++}`);
      values.push(command.defaultCostPerKm);
    }
    if (command.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(command.isActive);
    }

    if (setClauses.length === 0) {
      throw new ValidationError('No fields to update');
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(command.id);

    const result = await db.query(
      `
      UPDATE projects 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `,
      values
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Project');
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      defaultCostPerKm: parseFloat(row.default_cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getProject(id: string) {
    const result = await db.query('SELECT * FROM projects WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      defaultCostPerKm: parseFloat(row.default_cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getSubproject(id: string) {
    const result = await db.query(
      `
      SELECT 
        s.*,
        ST_X(s.location) as longitude,
        ST_Y(s.location) as latitude,
        p.name as project_name
      FROM subprojects s
      LEFT JOIN projects p ON s.project_id = p.id
      WHERE s.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      streetAddress: row.street_address,
      city: row.city,
      postalCode: row.postal_code,
      country: row.country,
      locationCoordinates:
        row.longitude && row.latitude
          ? {
              latitude: row.latitude,
              longitude: row.longitude,
            }
          : undefined,
      costPerKm: parseFloat(row.cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getActiveProjects() {
    const result = await db.query(`
      SELECT 
        p.*,
        COUNT(s.id) as subproject_count
      FROM projects p
      LEFT JOIN subprojects s ON p.id = s.project_id AND s.is_active = true
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY p.name
    `);

    // Transform to camelCase for frontend compatibility
    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      defaultCostPerKm: parseFloat(row.default_cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      subprojectCount: parseInt(row.subproject_count) || 0,
    }));
  }

  async getAllProjects() {
    const result = await db.query(`
      SELECT 
        p.*,
        COUNT(s.id) as subproject_count
      FROM projects p
      LEFT JOIN subprojects s ON p.id = s.project_id AND s.is_active = true
      GROUP BY p.id
      ORDER BY p.name
    `);

    // Transform to camelCase for frontend compatibility
    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      defaultCostPerKm: parseFloat(row.default_cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      subprojectCount: parseInt(row.subproject_count) || 0,
    }));
  }

  async getProjectsWithFilters(filters: ProjectSearchFilters) {
    let query = `
      SELECT
        p.*,
        COUNT(s.id) as subproject_count
      FROM projects p
      LEFT JOIN subprojects s ON p.id = s.project_id AND s.is_active = true
    `;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Apply filters
    if (filters.search) {
      conditions.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.isActive !== undefined) {
      conditions.push(`p.is_active = $${paramIndex}`);
      params.push(filters.isActive);
      paramIndex++;
    }

    if (filters.minCostPerKm !== undefined) {
      conditions.push(`p.default_cost_per_km >= $${paramIndex}`);
      params.push(filters.minCostPerKm);
      paramIndex++;
    }

    if (filters.maxCostPerKm !== undefined) {
      conditions.push(`p.default_cost_per_km <= $${paramIndex}`);
      params.push(filters.maxCostPerKm);
      paramIndex++;
    }

    if (filters.createdAfter) {
      conditions.push(`p.created_at >= $${paramIndex}`);
      params.push(filters.createdAfter);
      paramIndex++;
    }

    if (filters.createdBefore) {
      conditions.push(`p.created_at <= $${paramIndex}`);
      params.push(filters.createdBefore);
      paramIndex++;
    }

    // Add WHERE clause if we have conditions
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += `
      GROUP BY p.id
      ORDER BY p.name
    `;

    const result = await db.query(query, params);

    // Transform to camelCase for frontend compatibility
    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      defaultCostPerKm: parseFloat(row.default_cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      subprojectCount: parseInt(row.subproject_count) || 0,
    }));
  }

  async getSubprojectsForProject(projectId: string) {
    const result = await db.query(
      `
      SELECT 
        s.*,
        ST_X(s.location) as longitude,
        ST_Y(s.location) as latitude
      FROM subprojects s
      WHERE s.project_id = $1 AND s.is_active = true
      ORDER BY s.name
    `,
      [projectId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      streetAddress: row.street_address,
      city: row.city,
      postalCode: row.postal_code,
      locationCoordinates:
        row.longitude && row.latitude
          ? {
              latitude: row.latitude,
              longitude: row.longitude,
            }
          : null,
      costPerKm: parseFloat(row.cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
    }));
  }

  async searchProjects(searchTerm: string) {
    const result = await db.query(
      `
      SELECT 
        p.*,
        COUNT(s.id) as subproject_count
      FROM projects p
      LEFT JOIN subprojects s ON p.id = s.project_id AND s.is_active = true
      WHERE (
        p.name ILIKE $1 
        OR p.description ILIKE $1
      ) AND p.is_active = true
      GROUP BY p.id
      ORDER BY p.name
      LIMIT 50
    `,
      [`%${searchTerm}%`]
    );

    // Transform to camelCase for frontend compatibility
    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      defaultCostPerKm: parseFloat(row.default_cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      subprojectCount: parseInt(row.subproject_count) || 0,
    }));
  }

  async updateSubproject(command: UpdateSubprojectCommand) {
    logger.info('Updating subproject', {
      id: command.id,
      projectId: command.projectId,
      name: command.name,
    });

    // Verify subproject exists and belongs to the project
    const existingResult = await db.query(
      'SELECT * FROM subprojects WHERE id = $1 AND project_id = $2',
      [command.id, command.projectId]
    );

    if (existingResult.rows.length === 0) {
      throw new NotFoundError('Subproject');
    }

    const existing = existingResult.rows[0];
    let coordinates: GeocodeResult | null = null;

    // Check if location has changed and geocode if needed
    const hasLocationChanged =
      command.streetAddress !== existing.street_address ||
      command.city !== existing.city ||
      command.postalCode !== existing.postal_code;

    if (hasLocationChanged && command.streetAddress && command.city && command.postalCode) {
      try {
        coordinates = await this.geocodingService.geocodeAddress({
          street: command.streetAddress,
          city: command.city,
          postalCode: command.postalCode,
          country: command.country || 'Switzerland',
        });

        logger.info('Subproject geocoding successful', {
          id: command.id,
          coordinates,
        });
      } catch (error) {
        logger.warn('Subproject geocoding failed, keeping existing coordinates', {
          error: error.message,
          id: command.id,
        });
      }
    }

    // Build update query dynamically based on provided fields
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (command.name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(command.name);
    }

    if (command.streetAddress !== undefined) {
      updateFields.push(`street_address = $${paramCount++}`);
      values.push(command.streetAddress);
    }

    if (command.city !== undefined) {
      updateFields.push(`city = $${paramCount++}`);
      values.push(command.city);
    }

    if (command.postalCode !== undefined) {
      updateFields.push(`postal_code = $${paramCount++}`);
      values.push(command.postalCode);
    }

    if (command.country !== undefined) {
      updateFields.push(`country = $${paramCount++}`);
      values.push(command.country);
    }

    if (command.costPerKm !== undefined) {
      updateFields.push(`cost_per_km = $${paramCount++}`);
      values.push(command.costPerKm);
    }

    if (command.isActive !== undefined) {
      updateFields.push(`is_active = $${paramCount++}`);
      values.push(command.isActive);
    }

    if (coordinates) {
      updateFields.push(
        `location = ST_SetSRID(ST_MakePoint($${paramCount++}, $${paramCount++}), 4326)`
      );
      values.push(coordinates.longitude, coordinates.latitude);
    }

    if (updateFields.length === 0) {
      // No updates needed, return existing subproject in proper format
      const coordsResult = await db.query(
        'SELECT ST_X(location) as longitude, ST_Y(location) as latitude FROM subprojects WHERE id = $1',
        [existing.id]
      );
      const coords = coordsResult.rows[0];

      return {
        id: existing.id,
        projectId: existing.project_id,
        name: existing.name,
        streetAddress: existing.street_address,
        city: existing.city,
        postalCode: existing.postal_code,
        country: existing.country,
        locationCoordinates:
          coords.longitude && coords.latitude
            ? {
                latitude: coords.latitude,
                longitude: coords.longitude,
              }
            : undefined,
        costPerKm: parseFloat(existing.cost_per_km),
        isActive: existing.is_active,
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
      };
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(command.id, command.projectId); // Add WHERE clause parameters

    const query = `
      UPDATE subprojects 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND project_id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    const row = result.rows[0];

    // Get coordinates for response
    const coordsResult = await db.query(
      'SELECT ST_X(location) as longitude, ST_Y(location) as latitude FROM subprojects WHERE id = $1',
      [row.id]
    );

    const coords = coordsResult.rows[0];

    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      streetAddress: row.street_address,
      city: row.city,
      postalCode: row.postal_code,
      country: row.country,
      locationCoordinates:
        coords.longitude && coords.latitude
          ? {
              latitude: coords.latitude,
              longitude: coords.longitude,
            }
          : undefined,
      costPerKm: parseFloat(row.cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async deleteSubproject(projectId: string, subprojectId: string) {
    logger.info('Deleting subproject', {
      projectId,
      subprojectId,
    });

    // Check if subproject exists and belongs to the project
    const existingResult = await db.query(
      'SELECT * FROM subprojects WHERE id = $1 AND project_id = $2',
      [subprojectId, projectId]
    );

    if (existingResult.rows.length === 0) {
      throw new NotFoundError('Subproject');
    }

    // Check for active travel requests referencing this subproject
    const requestsResult = await db.query(
      'SELECT COUNT(*) as count FROM travel_requests WHERE subproject_id = $1 AND status IN ($2, $3)',
      [subprojectId, 'pending', 'approved']
    );

    const activeRequestCount = parseInt(requestsResult.rows[0].count);
    if (activeRequestCount > 0) {
      throw new ValidationError(
        `Cannot delete subproject: ${activeRequestCount} active travel requests are referencing this location`
      );
    }

    // Soft delete by marking as inactive instead of hard delete
    await db.query(
      'UPDATE subprojects SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND project_id = $2',
      [subprojectId, projectId]
    );

    logger.info('Subproject deleted successfully', {
      projectId,
      subprojectId,
    });
  }

  async canDeleteProject(projectId: string) {
    // Check for active travel requests referencing this project's subprojects
    const result = await db.query(
      `
      SELECT COUNT(*) as count
      FROM travel_requests tr
      JOIN subprojects s ON tr.subproject_id = s.id
      WHERE s.project_id = $1 AND tr.status != 'completed'
    `,
      [projectId]
    );

    return parseInt(result.rows[0].count) === 0;
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

  const projects = await projectService.getActiveProjects();

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

  // Use filtered query if filters are present, otherwise get all projects
  const hasFilters = Object.keys(filters).length > 0;
  const projects = hasFilters
    ? await projectService.getProjectsWithFilters(filters)
    : await projectService.getAllProjects();

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

  // Verify project exists
  const project = await projectService.getProject(projectId!);
  if (!project) {
    throw new NotFoundError('Project');
  }

  const subprojects = await projectService.getSubprojectsForProject(projectId!);

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

  const projects = await projectService.searchProjects(searchTerm!);

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

  // Check if project can be deleted
  const canDelete = await projectService.canDeleteProject(projectId!);
  if (!canDelete) {
    throw new ValidationError('Cannot delete project with active travel request references');
  }

  // Verify project exists
  const project = await projectService.getProject(projectId!);
  if (!project) {
    throw new NotFoundError('Project');
  }

  // Delete associated subprojects first (cascade)
  await db.query('DELETE FROM subprojects WHERE project_id = $1', [projectId]);

  // Delete the project
  const result = await db.query('DELETE FROM projects WHERE id = $1 RETURNING *', [projectId]);

  if (result.rows.length === 0) {
    throw new NotFoundError('Project');
  }

  logger.info('Project deleted successfully', {
    projectId,
    name: project.name,
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
