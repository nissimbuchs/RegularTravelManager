import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../../middleware/logger';
import { db } from '../../database/connection';
import { formatResponse } from '../../middleware/response-formatter';
import {
  UserSummary,
  UserDetails,
  AdminUserListing,
  UserStatusUpdateRequest,
  UserDeletionRequest,
  UserDeletionSummary,
} from '../../../../../packages/shared/src/types/api';

interface AdminContext {
  sub: string;
  email: string;
  isAdmin: string; // API Gateway context converts boolean to string
  isManager: string;
  groups: string;
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
 * GET /admin/users - List all employees with pagination, filtering, and sorting (admin only)
 */
export const listUsersHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.info('Admin list users request', {
    requestId: context.awsRequestId,
    path: event.path,
    queryStringParameters: event.queryStringParameters,
  });

  try {
    validateAdminAccess(event);

    // Parse query parameters
    const params = event.queryStringParameters || {};
    const page = Math.max(1, parseInt(params.page || '1'));
    const pageSize = Math.min(100, Math.max(10, parseInt(params.pageSize || '25')));
    const offset = (page - 1) * pageSize;

    const search = params.search?.trim();
    const role = params.role;
    const status = params.status;
    const department = params.department;
    const managerId = params.managerId;
    const sortBy = params.sortBy || 'registrationDate';
    const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Build WHERE clause
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`(
        e.first_name ILIKE $${paramIndex} OR
        e.last_name ILIKE $${paramIndex + 1} OR
        e.email ILIKE $${paramIndex + 2} OR
        e.employee_id ILIKE $${paramIndex + 3}
      )`);
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
      paramIndex += 4;
    }

    if (status === 'active') {
      whereConditions.push(`e.is_active = true`);
    } else if (status === 'inactive') {
      whereConditions.push(`e.is_active = false`);
    }

    if (managerId) {
      whereConditions.push(`e.manager_id = $${paramIndex}`);
      queryParams.push(managerId);
      paramIndex++;
    }

    // Build ORDER BY clause
    let orderByClause = 'e.created_at DESC';
    switch (sortBy) {
      case 'name':
        orderByClause = `e.first_name ${sortOrder}, e.last_name ${sortOrder}`;
        break;
      case 'email':
        orderByClause = `e.email ${sortOrder}`;
        break;
      case 'registrationDate':
        orderByClause = `e.created_at ${sortOrder}`;
        break;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count total records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM employees e
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams);
    const totalUsers = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalUsers / pageSize);

    // Get user data with request counts
    const dataQuery = `
      SELECT
        e.id,
        e.employee_id,
        e.cognito_user_id,
        e.email,
        e.first_name,
        e.last_name,
        e.manager_id,
        m.first_name || ' ' || m.last_name as manager_name,
        e.is_active,
        e.created_at,
        e.updated_at,
        e.email_verified_at,
        e.phone_number,
        COALESCE(e.role, 'employee') as role,
        COALESCE(tr_count.request_count, 0) as request_count
      FROM employees e
      LEFT JOIN employees m ON e.manager_id = m.id
      LEFT JOIN (
        SELECT employee_id, COUNT(*) as request_count
        FROM travel_requests
        GROUP BY employee_id
      ) tr_count ON e.id = tr_count.employee_id
      ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(pageSize, offset);
    const result = await db.query(dataQuery, queryParams);

    const users: UserSummary[] = result.rows.map(row => ({
      id: row.id,
      employeeNumber: row.employee_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      role: row.role || 'employee',
      status: row.is_active ? 'active' : 'inactive',
      managerId: row.manager_id,
      managerName: row.manager_name,
      department: undefined, // TODO: Implement department system
      lastLoginAt: undefined, // TODO: Implement login tracking
      registrationDate: row.created_at.toISOString(),
      requestCount: parseInt(row.request_count),
      isVerified: !!row.email_verified_at,
    }));

    const response: AdminUserListing = {
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        pageSize,
      },
      filters: {
        search: search || undefined,
        role: role as any,
        status: status as any,
        department: department || undefined,
        managerId: managerId || undefined,
      },
      sortBy: sortBy as any,
      sortOrder: sortOrder.toLowerCase() as any,
    };

    logger.info('Admin list users completed', {
      requestId: context.awsRequestId,
      userCount: users.length,
      totalUsers,
      page,
      pageSize,
    });

    return formatResponse(200, response, context.awsRequestId);
  } catch (error: any) {
    logger.error('Admin list users error', {
      error: error.message,
      stack: error.stack,
      requestId: context.awsRequestId,
    });

    const statusCode = error instanceof AdminAccessError ? 403 : 500;
    const errorMessage =
      error instanceof AdminAccessError ? error.message : 'Internal server error';

    return formatResponse(
      statusCode,
      {
        code: error.name,
        message: errorMessage,
      },
      context.awsRequestId
    );
  }
};

/**
 * GET /admin/users/{userId} - Get detailed user information (admin only)
 */
export const getUserDetailsHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.info('Admin get user details request', {
    requestId: context.awsRequestId,
    path: event.path,
    pathParameters: event.pathParameters,
  });

  try {
    validateAdminAccess(event);

    const userId = event.pathParameters?.userId;
    if (!userId) {
      return formatResponse(
        400,
        {
          code: 'MISSING_USER_ID',
          message: 'User ID is required in path parameters',
        },
        context.awsRequestId
      );
    }

    // Get user details with activity summary
    const userQuery = `
      SELECT
        e.id,
        e.employee_id,
        e.cognito_user_id,
        e.email,
        e.first_name,
        e.last_name,
        e.phone_number,
        COALESCE(e.role, 'employee') as role,
        e.home_street,
        e.home_city,
        e.home_postal_code,
        e.home_country,
        e.manager_id,
        m.first_name || ' ' || m.last_name as manager_name,
        e.is_active,
        e.created_at,
        e.updated_at,
        e.email_verified_at,
        e.notification_preferences,
        COALESCE(tr_summary.total_requests, 0) as total_requests,
        COALESCE(tr_summary.requests_this_month, 0) as requests_this_month,
        COALESCE(tr_summary.average_request_value, 0) as average_request_value,
        tr_summary.last_request_date
      FROM employees e
      LEFT JOIN employees m ON e.manager_id = m.id
      LEFT JOIN (
        SELECT
          employee_id,
          COUNT(*) as total_requests,
          COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as requests_this_month,
          AVG(calculated_allowance) as average_request_value,
          MAX(created_at) as last_request_date
        FROM travel_requests
        GROUP BY employee_id
      ) tr_summary ON e.id = tr_summary.employee_id
      WHERE e.id = $1
    `;

    const userResult = await db.query(userQuery, [userId]);
    if (userResult.rows.length === 0) {
      return formatResponse(
        404,
        {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
        context.awsRequestId
      );
    }

    const user = userResult.rows[0];

    // Get direct reports
    const reportsQuery = `
      SELECT
        id,
        employee_id,
        first_name,
        last_name,
        email,
        is_active,
        created_at
      FROM employees
      WHERE manager_id = $1
      ORDER BY first_name, last_name
    `;

    const reportsResult = await db.query(reportsQuery, [userId]);
    const directReports: UserSummary[] = reportsResult.rows.map(row => ({
      id: row.id,
      employeeNumber: row.employee_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      role: 'employee',
      status: row.is_active ? 'active' : 'inactive',
      registrationDate: row.created_at.toISOString(),
      requestCount: 0,
      isVerified: true,
    }));

    // Get recent travel requests
    const recentRequestsQuery = `
      SELECT
        tr.id,
        p.name as project_name,
        sp.name as subproject_name,
        tr.status,
        tr.calculated_allowance,
        tr.created_at
      FROM travel_requests tr
      JOIN subprojects sp ON tr.subproject_id = sp.id
      JOIN projects p ON sp.project_id = p.id
      WHERE tr.employee_id = $1
      ORDER BY tr.created_at DESC
      LIMIT 10
    `;

    const requestsResult = await db.query(recentRequestsQuery, [userId]);
    const recentRequests = requestsResult.rows.map(row => ({
      id: row.id,
      projectName: row.project_name,
      subprojectName: row.subproject_name,
      status: row.status,
      allowanceAmount: parseFloat(row.calculated_allowance),
      requestDate: row.created_at.toISOString(),
    }));

    const userDetails: UserDetails = {
      id: user.id,
      employeeNumber: user.employee_id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role || 'employee',
      status: user.is_active ? 'active' : 'inactive',
      managerId: user.manager_id,
      managerName: user.manager_name,
      phoneNumber: user.phone_number,
      registrationDate: user.created_at.toISOString(),
      requestCount: parseInt(user.total_requests),
      isVerified: !!user.email_verified_at,
      homeAddress: {
        street: user.home_street,
        city: user.home_city,
        postalCode: user.home_postal_code,
        country: user.home_country,
      },
      notificationPreferences: user.notification_preferences || { email: true },
      activitySummary: {
        totalRequests: parseInt(user.total_requests),
        requestsThisMonth: parseInt(user.requests_this_month),
        averageRequestValue: parseFloat(user.average_request_value),
        lastRequestDate: user.last_request_date?.toISOString(),
        loginHistory: [], // TODO: Implement login tracking
        securityEvents: [], // TODO: Implement security event tracking
      },
      directReports,
      recentRequests,
    };

    logger.info('Admin get user details completed', {
      requestId: context.awsRequestId,
      userId,
      directReportsCount: directReports.length,
      recentRequestsCount: recentRequests.length,
    });

    return formatResponse(200, userDetails, context.awsRequestId);
  } catch (error: any) {
    logger.error('Admin get user details error', {
      error: error.message,
      stack: error.stack,
      requestId: context.awsRequestId,
    });

    const statusCode = error instanceof AdminAccessError ? 403 : 500;
    const errorMessage =
      error instanceof AdminAccessError ? error.message : 'Internal server error';

    return formatResponse(
      statusCode,
      {
        code: error.name,
        message: errorMessage,
      },
      context.awsRequestId
    );
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
      return formatResponse(
        400,
        {
          code: 'MISSING_USER_ID',
          message: 'User ID is required in path parameters',
        },
        context.awsRequestId
      );
    }

    let requestBody: UserStatusUpdateRequest;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch {
      return formatResponse(
        400,
        {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body',
        },
        context.awsRequestId
      );
    }

    const { isActive, reason } = requestBody;
    if (typeof isActive !== 'boolean') {
      return formatResponse(
        400,
        {
          code: 'INVALID_STATUS',
          message: 'isActive must be a boolean value',
        },
        context.awsRequestId
      );
    }

    // Check if user exists
    const userCheck = await db.query(
      'SELECT id, first_name, last_name, is_active FROM employees WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return formatResponse(
        404,
        {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
        context.awsRequestId
      );
    }

    const user = userCheck.rows[0];
    const adminContext = event.requestContext.authorizer as AdminContext;

    // Begin transaction for audit trail
    await db.query('BEGIN');

    try {
      // Update user status
      const updateResult = await db.query(
        `UPDATE employees
         SET is_active = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, first_name, last_name, is_active, updated_at`,
        [isActive, userId]
      );

      const updatedUser = updateResult.rows[0];

      // Create audit record
      await db.query(
        `
        INSERT INTO employee_profile_history
        (employee_id, changed_fields, old_values, new_values, changed_by, change_reason)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          userId,
          JSON.stringify(['is_active']),
          JSON.stringify({ is_active: user.is_active }),
          JSON.stringify({ is_active: isActive }),
          adminContext.sub,
          reason || `Status ${isActive ? 'activated' : 'deactivated'} by admin`,
        ]
      );

      await db.query('COMMIT');

      // Log the admin action
      logger.info('Admin user status updated', {
        requestId: context.awsRequestId,
        adminEmail: adminContext.email,
        userId: userId,
        userName: `${user.first_name} ${user.last_name}`,
        previousStatus: user.is_active,
        newStatus: isActive,
        reason: reason || 'No reason provided',
      });

      return formatResponse(
        200,
        {
          id: updatedUser.id,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          isActive: updatedUser.is_active,
          updatedAt: updatedUser.updated_at.toISOString(),
        },
        context.awsRequestId
      );
    } catch (error: any) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    logger.error('Admin update user status error', {
      error: error.message,
      stack: error.stack,
      requestId: context.awsRequestId,
    });

    const statusCode = error instanceof AdminAccessError ? 403 : 500;
    const errorMessage =
      error instanceof AdminAccessError ? error.message : 'Internal server error';

    return formatResponse(
      statusCode,
      {
        code: error.name,
        message: errorMessage,
      },
      context.awsRequestId
    );
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
      return formatResponse(
        400,
        {
          code: 'MISSING_USER_ID',
          message: 'User ID is required in path parameters',
        },
        context.awsRequestId
      );
    }

    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch {
      return formatResponse(
        400,
        {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body',
        },
        context.awsRequestId
      );
    }

    const { managerId } = requestBody;

    // Validate user exists
    const userCheck = await db.query(
      'SELECT id, first_name, last_name, manager_id FROM employees WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return formatResponse(
        404,
        {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
        context.awsRequestId
      );
    }

    // Validate manager exists (if provided)
    if (managerId) {
      const managerCheck = await db.query(
        'SELECT id, first_name, last_name FROM employees WHERE id = $1 AND is_active = true',
        [managerId]
      );

      if (managerCheck.rows.length === 0) {
        return formatResponse(
          400,
          {
            code: 'INVALID_MANAGER',
            message: 'Manager not found or inactive',
          },
          context.awsRequestId
        );
      }

      // Prevent circular reference
      if (managerId === userId) {
        return formatResponse(
          400,
          {
            code: 'CIRCULAR_REFERENCE',
            message: 'User cannot be their own manager',
          },
          context.awsRequestId
        );
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

    return formatResponse(
      200,
      {
        id: updatedUser.id,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        managerId: updatedUser.manager_id,
        managerName: managerName,
        updatedAt: updatedUser.updated_at.toISOString(),
      },
      context.awsRequestId
    );
  } catch (error: any) {
    logger.error('Admin update user manager error', {
      error: error.message,
      stack: error.stack,
      requestId: context.awsRequestId,
    });

    const statusCode = error instanceof AdminAccessError ? 403 : 500;
    const errorMessage =
      error instanceof AdminAccessError ? error.message : 'Internal server error';

    return formatResponse(
      statusCode,
      {
        code: error.name,
        message: errorMessage,
      },
      context.awsRequestId
    );
  }
};

/**
 * DELETE /admin/users/{userId} - Delete user with comprehensive cleanup (admin only)
 */
export const deleteUserHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  logger.info('Admin delete user request', {
    requestId: context.awsRequestId,
    path: event.path,
    pathParameters: event.pathParameters,
  });

  try {
    validateAdminAccess(event);

    const userId = event.pathParameters?.userId;
    if (!userId) {
      return formatResponse(
        400,
        {
          code: 'MISSING_USER_ID',
          message: 'User ID is required in path parameters',
        },
        context.awsRequestId
      );
    }

    let requestBody: UserDeletionRequest;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch {
      return formatResponse(
        400,
        {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body',
        },
        context.awsRequestId
      );
    }

    const { reason, reassignRequestsTo } = requestBody;
    if (!reason || reason.trim().length === 0) {
      return formatResponse(
        400,
        {
          code: 'MISSING_REASON',
          message: 'Deletion reason is required',
        },
        context.awsRequestId
      );
    }

    // Check if user exists
    const userCheck = await db.query(
      'SELECT id, first_name, last_name, email, is_active FROM employees WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return formatResponse(
        404,
        {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
        context.awsRequestId
      );
    }

    const user = userCheck.rows[0];
    const adminContext = event.requestContext.authorizer as AdminContext;

    // Validate reassignment target if provided
    if (reassignRequestsTo) {
      const reassignTargetCheck = await db.query(
        'SELECT id, first_name, last_name FROM employees WHERE id = $1 AND is_active = true',
        [reassignRequestsTo]
      );

      if (reassignTargetCheck.rows.length === 0) {
        return formatResponse(
          400,
          {
            code: 'INVALID_REASSIGN_TARGET',
            message: 'Reassignment target user not found or inactive',
          },
          context.awsRequestId
        );
      }
    }

    // Begin transaction for comprehensive cleanup
    await db.query('BEGIN');

    try {
      // Use the comprehensive cleanup function from the story
      const cleanupResult = await db.query(
        `
        SELECT admin_delete_user($1, $2, $3) as cleanup_summary
      `,
        [userId, adminContext.sub, reason]
      );

      const cleanupSummary = cleanupResult.rows[0].cleanup_summary;

      // If reassignment target specified, handle pending/approved requests
      if (reassignRequestsTo) {
        await db.query(
          `
          UPDATE travel_requests
          SET employee_id = $1,
              employee_note = CONCAT('Reassigned from deleted user: ', employee_note),
              updated_at = CURRENT_TIMESTAMP
          WHERE employee_id = $2 AND status IN ('pending', 'approved')
        `,
          [reassignRequestsTo, userId]
        );
      }

      await db.query('COMMIT');

      const deletionSummary: UserDeletionSummary = {
        userId: cleanupSummary.user_id,
        travelRequestsArchived: cleanupSummary.travel_requests_archived,
        auditRecordsPreserved: cleanupSummary.audit_records_preserved,
        directReportsUpdated: cleanupSummary.direct_reports_updated,
        deletedAt: cleanupSummary.deleted_at,
      };

      // Log the admin action
      logger.info('Admin user deleted', {
        requestId: context.awsRequestId,
        adminEmail: adminContext.email,
        userId: userId,
        userName: `${user.first_name} ${user.last_name}`,
        userEmail: user.email,
        reason: reason,
        reassignedTo: reassignRequestsTo,
        cleanupSummary: deletionSummary,
      });

      return formatResponse(200, deletionSummary, context.awsRequestId);
    } catch (error: any) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    logger.error('Admin delete user error', {
      error: error.message,
      stack: error.stack,
      requestId: context.awsRequestId,
    });

    const statusCode = error instanceof AdminAccessError ? 403 : 500;
    const errorMessage =
      error instanceof AdminAccessError ? error.message : 'Internal server error';

    return formatResponse(
      statusCode,
      {
        code: error.name,
        message: errorMessage,
      },
      context.awsRequestId
    );
  }
};
