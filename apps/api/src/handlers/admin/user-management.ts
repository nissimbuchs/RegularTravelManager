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

interface EmployeeDto {
  id: string;
  employeeId: string;
  cognitoUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  homeAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  managerId: string | null;
  managerName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

class AdminAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminAccessError';
  }
}

function validateAdminAccess(event: APIGatewayProxyEvent): void {
  const context = event.requestContext.authorizer as AdminContext;

  if (!context || !context.isAdmin || context.isAdmin !== 'true') {
    throw new AdminAccessError('Admin access required for this operation');
  }
}

/**
 * GET /admin/users - List all employees (admin only)
 */
export const listUsersHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.info('Admin list users request', {
    requestId: context.awsRequestId,
    path: event.path,
  });

  try {
    validateAdminAccess(event);

    const db = new DatabaseConnection();
    await db.connect();

    const query = `
      SELECT 
        e.id,
        e.employee_id,
        e.cognito_user_id,
        e.email,
        e.first_name,
        e.last_name,
        e.home_street,
        e.home_city,
        e.home_postal_code,
        e.home_country,
        ST_X(e.home_location) as longitude,
        ST_Y(e.home_location) as latitude,
        e.manager_id,
        m.first_name || ' ' || m.last_name as manager_name,
        e.is_active,
        e.created_at,
        e.updated_at
      FROM employees e
      LEFT JOIN employees m ON e.manager_id = m.id
      ORDER BY e.created_at DESC
    `;

    const result = await db.query(query);
    const employees: EmployeeDto[] = result.rows.map(row => ({
      id: row.id,
      employeeId: row.employee_id,
      cognitoUserId: row.cognito_user_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      homeAddress: {
        street: row.home_street,
        city: row.home_city,
        postalCode: row.home_postal_code,
        country: row.home_country,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
      },
      managerId: row.manager_id,
      managerName: row.manager_name,
      isActive: row.is_active,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));

    await db.disconnect();

    logger.info('Admin list users completed', {
      requestId: context.awsRequestId,
      userCount: employees.length,
    });

    return withCors({
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          users: employees,
          total: employees.length,
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId,
      }),
    });
  } catch (error) {
    logger.error('Admin list users error', {
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
 * PUT /admin/users/{userId}/status - Update user active status (admin only)
 */
export const updateUserStatusHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.info('Admin update user status request', {
    requestId: context.awsRequestId,
    path: event.path,
    pathParameters: event.pathParameters,
  });

  try {
    validateAdminAccess(event);

    const userId = event.pathParameters?.userId;
    if (!userId) {
      return withCors({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_USER_ID',
            message: 'User ID is required in path parameters',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
          },
        }),
      });
    }

    let requestBody;
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

    const { isActive } = requestBody;
    if (typeof isActive !== 'boolean') {
      return withCors({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'isActive must be a boolean value',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
          },
        }),
      });
    }

    const db = new DatabaseConnection();
    await db.connect();

    // Check if user exists
    const userCheck = await db.query(
      'SELECT id, first_name, last_name, is_active FROM employees WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      await db.disconnect();
      return withCors({
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
          },
        }),
      });
    }

    const user = userCheck.rows[0];
    const adminContext = event.requestContext.authorizer as AdminContext;

    // Update user status
    const updateResult = await db.query(
      `UPDATE employees 
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, first_name, last_name, is_active, updated_at`,
      [isActive, userId]
    );

    const updatedUser = updateResult.rows[0];

    // Log the admin action
    logger.info('Admin user status updated', {
      requestId: context.awsRequestId,
      adminEmail: adminContext.email,
      userId: userId,
      userName: `${user.first_name} ${user.last_name}`,
      previousStatus: user.is_active,
      newStatus: isActive,
    });

    await db.disconnect();

    return withCors({
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          id: updatedUser.id,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          isActive: updatedUser.is_active,
          updatedAt: updatedUser.updated_at.toISOString(),
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId,
      }),
    });
  } catch (error) {
    logger.error('Admin update user status error', {
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
 * PUT /admin/users/{userId}/manager - Update user's manager (admin only)
 */
export const updateUserManagerHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.info('Admin update user manager request', {
    requestId: context.awsRequestId,
    path: event.path,
    pathParameters: event.pathParameters,
  });

  try {
    validateAdminAccess(event);

    const userId = event.pathParameters?.userId;
    if (!userId) {
      return withCors({
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'MISSING_USER_ID',
            message: 'User ID is required in path parameters',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
          },
        }),
      });
    }

    let requestBody;
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

    const { managerId } = requestBody;

    const db = new DatabaseConnection();
    await db.connect();

    // Validate user exists
    const userCheck = await db.query(
      'SELECT id, first_name, last_name, manager_id FROM employees WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      await db.disconnect();
      return withCors({
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId,
          },
        }),
      });
    }

    // Validate manager exists (if provided)
    if (managerId) {
      const managerCheck = await db.query(
        'SELECT id, first_name, last_name FROM employees WHERE id = $1 AND is_active = true',
        [managerId]
      );

      if (managerCheck.rows.length === 0) {
        await db.disconnect();
        return withCors({
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: {
              code: 'INVALID_MANAGER',
              message: 'Manager not found or inactive',
              timestamp: new Date().toISOString(),
              requestId: context.awsRequestId,
            },
          }),
        });
      }

      // Prevent circular reference
      if (managerId === userId) {
        await db.disconnect();
        return withCors({
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: {
              code: 'CIRCULAR_REFERENCE',
              message: 'User cannot be their own manager',
              timestamp: new Date().toISOString(),
              requestId: context.awsRequestId,
            },
          }),
        });
      }
    }

    const user = userCheck.rows[0];
    const adminContext = event.requestContext.authorizer as AdminContext;

    // Update manager
    const updateResult = await db.query(
      `UPDATE employees 
       SET manager_id = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING id, first_name, last_name, manager_id, updated_at`,
      [managerId || null, userId]
    );

    const updatedUser = updateResult.rows[0];

    // Get manager name if set
    let managerName = null;
    if (updatedUser.manager_id) {
      const managerResult = await db.query(
        'SELECT first_name, last_name FROM employees WHERE id = $1',
        [updatedUser.manager_id]
      );
      if (managerResult.rows.length > 0) {
        const manager = managerResult.rows[0];
        managerName = `${manager.first_name} ${manager.last_name}`;
      }
    }

    logger.info('Admin user manager updated', {
      requestId: context.awsRequestId,
      adminEmail: adminContext.email,
      userId: userId,
      userName: `${user.first_name} ${user.last_name}`,
      previousManagerId: user.manager_id,
      newManagerId: managerId || null,
      newManagerName: managerName,
    });

    await db.disconnect();

    return withCors({
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          id: updatedUser.id,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          managerId: updatedUser.manager_id,
          managerName: managerName,
          updatedAt: updatedUser.updated_at.toISOString(),
        },
        timestamp: new Date().toISOString(),
        requestId: context.awsRequestId,
      }),
    });
  } catch (error) {
    logger.error('Admin update user manager error', {
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
