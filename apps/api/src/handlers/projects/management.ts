import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../../middleware/logger';
import { formatResponse } from '../../middleware/response-formatter';
import { ValidationError, NotFoundError } from '../../middleware/error-handler';
import { validateRequest } from '../../middleware/request-validator';
import { db } from '../../database/connection';
import { ProjectService, CreateProjectCommand, CreateSubprojectCommand, UpdateProjectCommand } from '../../../../domains/project-management/ProjectService';
import { GeocodingService, GeocodeResult } from '../../services/geocoding-service';
import { getUserContextFromEvent, requireManager } from '../auth/auth-utils';

class ProjectServiceImpl implements ProjectService {
  private geocodingService: GeocodingService;

  constructor() {
    this.geocodingService = new GeocodingService();
  }

  async createProject(command: CreateProjectCommand) {
    logger.info('Creating project', { name: command.name });

    const result = await db.query(`
      INSERT INTO projects (name, description, default_cost_per_km, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING *
    `, [
      command.name,
      command.description || null,
      command.default_cost_per_km
    ]);

    return result.rows[0];
  }

  async createSubproject(command: CreateSubprojectCommand) {
    logger.info('Creating subproject', { 
      name: command.name, 
      projectId: command.project_id 
    });

    // Verify parent project exists
    const projectResult = await db.query(
      'SELECT id, default_cost_per_km FROM projects WHERE id = $1 AND is_active = true',
      [command.project_id]
    );

    if (projectResult.rows.length === 0) {
      throw new NotFoundError('Parent project');
    }

    const parentProject = projectResult.rows[0];
    let coordinates: GeocodeResult | null = null;

    // Geocode location if address is provided
    if (command.location_street && command.location_city && command.location_postal_code) {
      try {
        coordinates = await this.geocodingService.geocodeAddress({
          street: command.location_street,
          city: command.location_city,
          postalCode: command.location_postal_code,
          country: 'Switzerland' // Default for subprojects
        });
        
        logger.info('Subproject geocoding successful', {
          name: command.name,
          coordinates
        });
      } catch (error) {
        logger.warn('Subproject geocoding failed, using default coordinates', {
          error: error.message,
          name: command.name
        });
        coordinates = { latitude: 46.947974, longitude: 7.447447 }; // Default to Bern
      }
    }

    // Use subproject cost rate or inherit from parent project
    const costPerKm = command.cost_per_km || parentProject.default_cost_per_km;

    const result = await db.query(`
      INSERT INTO subprojects (
        project_id, 
        name, 
        location_street,
        location_city,
        location_postal_code,
        location_coordinates,
        cost_per_km,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING *
    `, [
      command.project_id,
      command.name,
      command.location_street || null,
      command.location_city || null,
      command.location_postal_code || null,
      coordinates ? `POINT(${coordinates.longitude} ${coordinates.latitude})` : null,
      costPerKm
    ]);

    const subproject = result.rows[0];
    
    // Convert PostGIS point to lat/lng if it exists
    if (subproject.location_coordinates && coordinates) {
      subproject.location_coordinates = {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude
      };
    }

    return subproject;
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
    if (command.default_cost_per_km !== undefined) {
      setClauses.push(`default_cost_per_km = $${paramIndex++}`);
      values.push(command.default_cost_per_km);
    }
    if (command.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(command.is_active);
    }

    if (setClauses.length === 0) {
      throw new ValidationError('No fields to update');
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(command.id);

    const result = await db.query(`
      UPDATE projects 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      throw new NotFoundError('Project');
    }

    return result.rows[0];
  }

  async getProject(id: string) {
    const result = await db.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getSubproject(id: string) {
    const result = await db.query(`
      SELECT 
        s.*,
        ST_X(s.location_coordinates) as longitude,
        ST_Y(s.location_coordinates) as latitude,
        p.name as project_name
      FROM subprojects s
      LEFT JOIN projects p ON s.project_id = p.id
      WHERE s.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const subproject = result.rows[0];
    if (subproject.longitude && subproject.latitude) {
      subproject.location_coordinates = {
        latitude: subproject.latitude,
        longitude: subproject.longitude
      };
      delete subproject.longitude;
      delete subproject.latitude;
    }

    return subproject;
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
    return result.rows;
  }

  async getSubprojectsForProject(projectId: string) {
    const result = await db.query(`
      SELECT 
        s.*,
        ST_X(s.location_coordinates) as longitude,
        ST_Y(s.location_coordinates) as latitude
      FROM subprojects s
      WHERE s.project_id = $1 AND s.is_active = true
      ORDER BY s.name
    `, [projectId]);

    return result.rows.map(subproject => {
      if (subproject.longitude && subproject.latitude) {
        subproject.location_coordinates = {
          latitude: subproject.latitude,
          longitude: subproject.longitude
        };
        delete subproject.longitude;
        delete subproject.latitude;
      }
      return subproject;
    });
  }

  async searchProjects(searchTerm: string) {
    const result = await db.query(`
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
    `, [`%${searchTerm}%`]);
    return result.rows;
  }

  async canDeleteProject(projectId: string) {
    // Check for active travel requests referencing this project's subprojects
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM travel_requests tr
      JOIN subprojects s ON tr.subproject_id = s.id
      WHERE s.project_id = $1 AND tr.status != 'completed'
    `, [projectId]);

    return parseInt(result.rows[0].count) === 0;
  }
}

const projectService = new ProjectServiceImpl();

// Create project (admin only)
export const createProject = validateRequest({
  body: {
    name: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    description: { required: false, type: 'string', maxLength: 1000 },
    default_cost_per_km: { required: true, type: 'number' }
  }
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromEvent(event);
  requireManager(userContext); // Only managers can create projects

  const body = JSON.parse(event.body!);
  
  logger.info('Creating project', { 
    name: body.name,
    createdBy: userContext.sub,
    requestId: context.awsRequestId 
  });

  // Validate cost per km is positive
  if (body.default_cost_per_km <= 0) {
    throw new ValidationError('Cost per kilometer must be positive');
  }

  const command: CreateProjectCommand = {
    name: body.name,
    description: body.description,
    default_cost_per_km: body.default_cost_per_km
  };

  const project = await projectService.createProject(command);

  logger.info('Project created successfully', { 
    projectId: project.id,
    name: project.name,
    requestId: context.awsRequestId 
  });

  return formatResponse(201, project, context.awsRequestId);
});

// Create subproject (admin only)
export const createSubproject = validateRequest({
  body: {
    project_id: { required: true, type: 'string' },
    name: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    location_street: { required: false, type: 'string', maxLength: 255 },
    location_city: { required: false, type: 'string', maxLength: 100 },
    location_postal_code: { 
      required: false, 
      type: 'string', 
      pattern: /^[0-9]{4}$/ // Swiss postal code format
    },
    cost_per_km: { required: false, type: 'number' }
  }
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromEvent(event);
  requireManager(userContext);

  const body = JSON.parse(event.body!);
  
  logger.info('Creating subproject', { 
    name: body.name,
    projectId: body.project_id,
    createdBy: userContext.sub,
    requestId: context.awsRequestId 
  });

  // Validate cost per km if provided
  if (body.cost_per_km !== undefined && body.cost_per_km <= 0) {
    throw new ValidationError('Cost per kilometer must be positive');
  }

  const command: CreateSubprojectCommand = {
    project_id: body.project_id,
    name: body.name,
    location_street: body.location_street,
    location_city: body.location_city,
    location_postal_code: body.location_postal_code,
    cost_per_km: body.cost_per_km
  };

  const subproject = await projectService.createSubproject(command);

  logger.info('Subproject created successfully', { 
    subprojectId: subproject.id,
    name: subproject.name,
    requestId: context.awsRequestId 
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
    requestId: context.awsRequestId 
  });

  const projects = await projectService.getActiveProjects();

  return formatResponse(200, { projects }, context.awsRequestId);
};

// Get subprojects for a project
export const getSubprojectsForProject = validateRequest({
  pathParams: {
    projectId: { required: true, type: 'string' }
  }
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const projectId = event.pathParameters?.projectId;
  const userContext = getUserContextFromEvent(event);
  
  logger.info('Getting subprojects for project', { 
    projectId,
    requestedBy: userContext.sub,
    requestId: context.awsRequestId 
  });

  // Verify project exists
  const project = await projectService.getProject(projectId!);
  if (!project) {
    throw new NotFoundError('Project');
  }

  const subprojects = await projectService.getSubprojectsForProject(projectId!);

  return formatResponse(200, { 
    project: project.name,
    subprojects 
  }, context.awsRequestId);
});

// Search projects
export const searchProjects = validateRequest({
  queryParams: {
    q: { required: true, type: 'string', minLength: 2 }
  }
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const searchTerm = event.queryStringParameters?.q;
  const userContext = getUserContextFromEvent(event);
  
  logger.info('Searching projects', { 
    searchTerm,
    requestedBy: userContext.sub,
    requestId: context.awsRequestId 
  });

  const projects = await projectService.searchProjects(searchTerm!);

  return formatResponse(200, { 
    query: searchTerm,
    projects 
  }, context.awsRequestId);
});