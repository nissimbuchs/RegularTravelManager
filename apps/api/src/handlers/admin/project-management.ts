import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../../middleware/logger';
import { DatabaseConnection } from '../../database/connection';
import { withCors } from '../../middleware/cors';

interface AdminContext {
  sub: string;
  email: string;
  isAdmin: string; // API Gateway context converts boolean to string
  isManager: string;
  groups: string;
}

interface ProjectDto {
  id: string;
  name: string;
  description: string;
  defaultCostPerKm: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  subprojectCount?: number;
}

interface SubprojectDto {
  id: string;
  projectId: string;
  name: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  costPerKm: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateProjectRequest {
  name: string;
  description: string;
  defaultCostPerKm: number;
  isActive?: boolean;
}

interface CreateSubprojectRequest {
  projectId: string;
  name: string;
  streetAddress: string;
  city: string;
  postalCode: string;
  country?: string;
  latitude: number;
  longitude: number;
  costPerKm: number;
  isActive?: boolean;
}

class AdminAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminAccessError';
  }
}

function validateAdminAccess(event: APIGatewayProxyEvent): void {
  const context = event.requestContext.authorizer as AdminContext;

  if (!context.isAdmin || context.isAdmin !== 'true') {
    throw new AdminAccessError('Admin access required for this operation');
  }
}

/**
 * GET /admin/projects - List all projects with subproject counts (admin only)
 */
export const listProjectsHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.info('Admin list projects request', {
    requestId: context.awsRequestId,
    path: event.path,
  });

  try {
    validateAdminAccess(event);

    const db = new DatabaseConnection();
    await db.connect();

    const query = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.default_cost_per_km,
        p.is_active,
        p.created_at,
        p.updated_at,
        COUNT(sp.id) as subproject_count
      FROM projects p
      LEFT JOIN subprojects sp ON p.id = sp.project_id
      GROUP BY p.id, p.name, p.description, p.default_cost_per_km, p.is_active, p.created_at, p.updated_at
      ORDER BY p.created_at DESC
    `;

    const result = await db.query(query);
    const projects: ProjectDto[] = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      defaultCostPerKm: parseFloat(row.default_cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      subprojectCount: parseInt(row.subproject_count, 10),
    }));

    await db.disconnect();

    logger.info('Admin list projects completed', {
      requestId: context.awsRequestId,
      projectCount: projects.length,
    });

    return withCors({
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          projects: projects,
          total: projects.length,
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId,
      }),
    });
  } catch (error) {
    logger.error('Admin list projects error', {
      error: error.message,
      stack: error.stack,
      requestId: context.awsRequestId,
    });

    const statusCode = error instanceof AdminAccessError ? 403 : 500;
    const errorMessage =
      error instanceof AdminAccessError ? error.message : 'Internal server error';

    return withCors({
      statusCode,
      body: JSON.stringify({
        success: false,
        error: {
          code: error.name,
          message: errorMessage,
          timestamp: new Date().toISOString(),
          requestId: context.awsRequestId,
        },
      }),
    });
  }
};

/**
 * POST /admin/projects - Create new project (admin only)
 */
export const createProjectHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.info('Admin create project request', {
    requestId: context.awsRequestId,
    path: event.path,
  });

  try {
    validateAdminAccess(event);

    let requestBody: CreateProjectRequest;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch {
      return withCors({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Invalid JSON in request body',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
          },
        }),
      });
    }

    // Validate required fields
    if (!requestBody.name || !requestBody.description || !requestBody.defaultCostPerKm) {
      return withCors({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'name, description, and defaultCostPerKm are required',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
          },
        }),
      });
    }

    // Validate cost per km is positive
    if (requestBody.defaultCostPerKm <= 0) {
      return withCors({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_COST_RATE',
            message: 'defaultCostPerKm must be greater than 0',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
          },
        }),
      });
    }

    const db = new DatabaseConnection();
    await db.connect();

    // Create project
    const insertResult = await db.query(
      `INSERT INTO projects (name, description, default_cost_per_km, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, default_cost_per_km, is_active, created_at, updated_at`,
      [
        requestBody.name,
        requestBody.description,
        requestBody.defaultCostPerKm,
        requestBody.isActive !== undefined ? requestBody.isActive : true,
      ]
    );

    const newProject = insertResult.rows[0];
    const adminContext = event.requestContext.authorizer as AdminContext;

    logger.info('Admin project created', {
      requestId: context.awsRequestId,
      adminEmail: adminContext.email,
      projectId: newProject.id,
      projectName: newProject.name,
    });

    await db.disconnect();

    const projectDto: ProjectDto = {
      id: newProject.id,
      name: newProject.name,
      description: newProject.description,
      defaultCostPerKm: parseFloat(newProject.default_cost_per_km),
      isActive: newProject.is_active,
      createdAt: newProject.created_at.toISOString(),
      updatedAt: newProject.updated_at.toISOString(),
      subprojectCount: 0,
    };

    return withCors({
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        data: projectDto,
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId,
      }),
    });
  } catch (error) {
    logger.error('Admin create project error', {
      error: error.message,
      stack: error.stack,
      requestId: context.awsRequestId,
    });

    const statusCode = error instanceof AdminAccessError ? 403 : 500;
    const errorMessage =
      error instanceof AdminAccessError ? error.message : 'Internal server error';

    return withCors({
      statusCode,
      body: JSON.stringify({
        success: false,
        error: {
          code: error.name,
          message: errorMessage,
          timestamp: new Date().toISOString(),
          requestId: context.awsRequestId,
        },
      }),
    });
  }
};

/**
 * GET /admin/projects/{projectId}/subprojects - List subprojects for a project (admin only)
 */
export const listSubprojectsHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.info('Admin list subprojects request', {
    requestId: context.awsRequestId,
    path: event.path,
    pathParameters: event.pathParameters,
  });

  try {
    validateAdminAccess(event);

    const projectId = event.pathParameters?.projectId;
    if (!projectId) {
      return withCors({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_PROJECT_ID',
            message: 'Project ID is required in path parameters',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
          },
        }),
      });
    }

    const db = new DatabaseConnection();
    await db.connect();

    // Verify project exists
    const projectCheck = await db.query('SELECT id, name FROM projects WHERE id = $1', [projectId]);

    if (projectCheck.rows.length === 0) {
      await db.disconnect();
      return withCors({
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
          },
        }),
      });
    }

    const query = `
      SELECT 
        id,
        project_id,
        name,
        street_address,
        city,
        postal_code,
        country,
        ST_X(location) as longitude,
        ST_Y(location) as latitude,
        cost_per_km,
        is_active,
        created_at,
        updated_at
      FROM subprojects
      WHERE project_id = $1
      ORDER BY created_at DESC
    `;

    const result = await db.query(query, [projectId]);
    const subprojects: SubprojectDto[] = result.rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      address: {
        street: row.street_address,
        city: row.city,
        postalCode: row.postal_code,
        country: row.country,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
      },
      costPerKm: parseFloat(row.cost_per_km),
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));

    await db.disconnect();

    logger.info('Admin list subprojects completed', {
      requestId: context.awsRequestId,
      projectId: projectId,
      subprojectCount: subprojects.length,
    });

    return withCors({
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          projectId: projectId,
          projectName: projectCheck.rows[0].name,
          subprojects: subprojects,
          total: subprojects.length,
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId,
      }),
    });
  } catch (error) {
    logger.error('Admin list subprojects error', {
      error: error.message,
      stack: error.stack,
      requestId: context.awsRequestId,
    });

    const statusCode = error instanceof AdminAccessError ? 403 : 500;
    const errorMessage =
      error instanceof AdminAccessError ? error.message : 'Internal server error';

    return withCors({
      statusCode,
      body: JSON.stringify({
        success: false,
        error: {
          code: error.name,
          message: errorMessage,
          timestamp: new Date().toISOString(),
          requestId: context.awsRequestId,
        },
      }),
    });
  }
};

/**
 * POST /admin/subprojects - Create new subproject (admin only)
 */
export const createSubprojectHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.info('Admin create subproject request', {
    requestId: context.awsRequestId,
    path: event.path,
  });

  try {
    validateAdminAccess(event);

    let requestBody: CreateSubprojectRequest;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch {
      return withCors({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Invalid JSON in request body',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
          },
        }),
      });
    }

    // Validate required fields
    const requiredFields = [
      'projectId',
      'name',
      'streetAddress',
      'city',
      'postalCode',
      'latitude',
      'longitude',
      'costPerKm',
    ];
    const missingFields = requiredFields.filter(
      field => !requestBody[field as keyof CreateSubprojectRequest]
    );

    if (missingFields.length > 0) {
      return withCors({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: `Missing required fields: ${missingFields.join(', ')}`,
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
          },
        }),
      });
    }

    // Validate coordinates and cost rate
    if (requestBody.latitude < -90 || requestBody.latitude > 90) {
      return withCors({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_LATITUDE',
            message: 'Latitude must be between -90 and 90',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
          },
        }),
      });
    }

    if (requestBody.longitude < -180 || requestBody.longitude > 180) {
      return withCors({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_LONGITUDE',
            message: 'Longitude must be between -180 and 180',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
          },
        }),
      });
    }

    if (requestBody.costPerKm <= 0) {
      return withCors({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_COST_RATE',
            message: 'costPerKm must be greater than 0',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
          },
        }),
      });
    }

    const db = new DatabaseConnection();
    await db.connect();

    // Verify project exists
    const projectCheck = await db.query('SELECT id, name FROM projects WHERE id = $1', [
      requestBody.projectId,
    ]);

    if (projectCheck.rows.length === 0) {
      await db.disconnect();
      return withCors({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
          },
        }),
      });
    }

    // Create subproject
    const insertResult = await db.query(
      `INSERT INTO subprojects 
       (project_id, name, street_address, city, postal_code, country, location, cost_per_km, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromText($7, 4326), $8, $9)
       RETURNING id, project_id, name, street_address, city, postal_code, country, 
                 ST_X(location) as longitude, ST_Y(location) as latitude, 
                 cost_per_km, is_active, created_at, updated_at`,
      [
        requestBody.projectId,
        requestBody.name,
        requestBody.streetAddress,
        requestBody.city,
        requestBody.postalCode,
        requestBody.country || 'Switzerland',
        `POINT(${requestBody.longitude} ${requestBody.latitude})`,
        requestBody.costPerKm,
        requestBody.isActive !== undefined ? requestBody.isActive : true,
      ]
    );

    const newSubproject = insertResult.rows[0];
    const adminContext = event.requestContext.authorizer as AdminContext;

    logger.info('Admin subproject created', {
      requestId: context.awsRequestId,
      adminEmail: adminContext.email,
      projectId: requestBody.projectId,
      subprojectId: newSubproject.id,
      subprojectName: newSubproject.name,
    });

    await db.disconnect();

    const subprojectDto: SubprojectDto = {
      id: newSubproject.id,
      projectId: newSubproject.project_id,
      name: newSubproject.name,
      address: {
        street: newSubproject.street_address,
        city: newSubproject.city,
        postalCode: newSubproject.postal_code,
        country: newSubproject.country,
        latitude: parseFloat(newSubproject.latitude),
        longitude: parseFloat(newSubproject.longitude),
      },
      costPerKm: parseFloat(newSubproject.cost_per_km),
      isActive: newSubproject.is_active,
      createdAt: newSubproject.created_at.toISOString(),
      updatedAt: newSubproject.updated_at.toISOString(),
    };

    return withCors({
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        data: subprojectDto,
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId,
      }),
    });
  } catch (error) {
    logger.error('Admin create subproject error', {
      error: error.message,
      stack: error.stack,
      requestId: context.awsRequestId,
    });

    const statusCode = error instanceof AdminAccessError ? 403 : 500;
    const errorMessage =
      error instanceof AdminAccessError ? error.message : 'Internal server error';

    return withCors({
      statusCode,
      body: JSON.stringify({
        success: false,
        error: {
          code: error.name,
          message: errorMessage,
          timestamp: new Date().toISOString(),
          requestId: context.awsRequestId,
        },
      }),
    });
  }
};
