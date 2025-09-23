import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { db } from '../../database/connection';
import { logger } from '../../middleware/logger';
import { formatResponse } from '../../middleware/response-formatter';
import { getUserContextFromEvent } from '../auth/auth-utils';

interface RequestFilters {
  status?: string;
  projectName?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

interface PaginationConfig {
  pageIndex: number;
  pageSize: number;
}

interface SortConfig {
  active: string;
  direction: 'asc' | 'desc';
}

interface EmployeeRequestSummary {
  id: string;
  projectName: string;
  projectCode?: string;
  subProjectName: string;
  status: string;
  submittedDate: Date;
  processedDate?: Date;
  dailyAllowance: number;
  weeklyAllowance: number;
  daysPerWeek: number;
  justification?: string;
  managerName?: string;
  managerEmail?: string;
  calculatedDistance?: number;
  costPerKm?: number;
}

interface EmployeeDashboard {
  requests: EmployeeRequestSummary[];
  totalRequests: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  withdrawnCount: number;
  totalApprovedAllowance: number;
}

interface RequestDetails {
  id: string;
  projectName: string;
  subProjectName: string;
  justification: string;
  managerName: string;
  managerEmail?: string;
  calculatedDistance: number;
  costPerKm: number;
  dailyAllowance: number;
  weeklyAllowance: number;
  monthlyEstimate: number;
  daysPerWeek: number;
  status: string;
  submittedDate: Date;
  processedDate?: Date;
  statusHistory: any[];
  employeeAddress?: string;
  subprojectAddress?: string;
}

// Helper function to get employee UUID from cognito ID
async function getEmployeeId(cognitoUserId: string): Promise<string | null> {
  const query = `
    SELECT id
    FROM employees
    WHERE cognito_user_id = $1 AND is_active = true
  `;

  const result = await db.query(query, [cognitoUserId]);
  return result.rows.length > 0 ? result.rows[0].id : null;
}

/**
 * Get employee dashboard data with filtering, pagination, and sorting
 * Following the same pattern as manager dashboard
 */
export const getEmployeeDashboard = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user context from JWT token
    const userContext = getUserContextFromEvent(event);
    const employeeCognitoId = userContext.sub;

    if (!employeeCognitoId) {
      return formatResponse(401, { error: 'Unauthorized' }, context.awsRequestId);
    }

    // Get employee ID
    const employeeId = await getEmployeeId(employeeCognitoId);
    if (!employeeId) {
      return formatResponse(404, { error: 'Employee not found' }, context.awsRequestId);
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const pageIndex = parseInt(queryParams.pageIndex || '0', 10);
    const pageSize = parseInt(queryParams.pageSize || '25', 10);
    const sortActive = queryParams.sortActive || 'submittedDate';
    const sortDirection = queryParams.sortDirection || 'desc';

    const filters: RequestFilters = {};
    if (queryParams.status) filters.status = queryParams.status;
    if (queryParams.projectName) filters.projectName = queryParams.projectName;
    if (queryParams.dateRangeStart && queryParams.dateRangeEnd) {
      filters.dateRange = {
        start: new Date(queryParams.dateRangeStart),
        end: new Date(queryParams.dateRangeEnd),
      };
    }

    // Build WHERE clause with filters
    let whereClause = 'WHERE tr.employee_id = $1';
    const queryValues: any[] = [employeeId];
    let paramCount = 1;

    if (filters.status) {
      paramCount++;
      whereClause += ` AND tr.status = $${paramCount}`;
      queryValues.push(filters.status);
    }

    if (filters.projectName) {
      paramCount++;
      whereClause += ` AND p.name ILIKE $${paramCount}`;
      queryValues.push(`%${filters.projectName}%`);
    }

    if (filters.dateRange) {
      paramCount++;
      whereClause += ` AND tr.submitted_at >= $${paramCount}`;
      queryValues.push(filters.dateRange.start);

      paramCount++;
      whereClause += ` AND tr.submitted_at <= $${paramCount}`;
      queryValues.push(filters.dateRange.end);
    }

    // Build ORDER BY clause
    const validSortFields = {
      submittedDate: 'tr.submitted_at',
      processedDate: 'tr.processed_at',
      projectName: 'p.name',
      dailyAllowance: 'tr.calculated_allowance_chf',
      weeklyAllowance: '(tr.calculated_allowance_chf * tr.days_per_week)',
      status: 'tr.status'
    };

    const sortField = validSortFields[sortActive as keyof typeof validSortFields] || 'tr.submitted_at';
    const orderBy = `ORDER BY ${sortField} ${sortDirection.toUpperCase()}`;

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM travel_requests tr
      JOIN subprojects sp ON tr.subproject_id = sp.id
      JOIN projects p ON sp.project_id = p.id
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryValues);
    const totalRequests = parseInt(countResult.rows[0].total, 10);

    // Get main request data with pagination
    const mainQuery = `
      SELECT
        tr.id,
        p.name as project_name,
        p.id as project_id,
        sp.name as subproject_name,
        tr.status,
        tr.submitted_at as submitted_date,
        tr.processed_at as processed_date,
        tr.calculated_allowance_chf as daily_allowance,
        (tr.calculated_allowance_chf * tr.days_per_week) as weekly_allowance,
        tr.days_per_week,
        tr.justification,
        tr.calculated_distance_km,
        sp.cost_per_km,
        manager.first_name || ' ' || manager.last_name as manager_name,
        manager.email as manager_email
      FROM travel_requests tr
      JOIN subprojects sp ON tr.subproject_id = sp.id
      JOIN projects p ON sp.project_id = p.id
      LEFT JOIN employees manager ON tr.manager_id = manager.id
      ${whereClause}
      ${orderBy}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryValues.push(pageSize, pageIndex * pageSize);

    const requestsResult = await db.query(mainQuery, queryValues);

    // Get summary counts
    const summaryQuery = `
      SELECT
        tr.status,
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN tr.status = 'approved' THEN (tr.calculated_allowance_chf * tr.days_per_week * 4.33) END), 0) as monthly_allowance
      FROM travel_requests tr
      WHERE tr.employee_id = $1
      GROUP BY tr.status
    `;

    const summaryResult = await db.query(summaryQuery, [employeeId]);

    // Calculate summary statistics
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let withdrawnCount = 0;
    let totalApprovedAllowance = 0;

    summaryResult.rows.forEach(row => {
      switch (row.status) {
        case 'pending':
          pendingCount = parseInt(row.count, 10);
          break;
        case 'approved':
          approvedCount = parseInt(row.count, 10);
          totalApprovedAllowance = parseFloat(row.monthly_allowance || '0');
          break;
        case 'rejected':
          rejectedCount = parseInt(row.count, 10);
          break;
        case 'withdrawn':
          withdrawnCount = parseInt(row.count, 10);
          break;
      }
    });

    // Format response data
    const requests: EmployeeRequestSummary[] = requestsResult.rows.map(row => ({
      id: row.id,
      projectName: row.project_name,
      projectCode: row.project_id,
      subProjectName: row.subproject_name,
      status: row.status,
      submittedDate: row.submitted_date,
      processedDate: row.processed_date,
      dailyAllowance: parseFloat(row.daily_allowance),
      weeklyAllowance: parseFloat(row.weekly_allowance),
      daysPerWeek: parseInt(row.days_per_week, 10),
      justification: row.justification,
      managerName: row.manager_name,
      managerEmail: row.manager_email,
      calculatedDistance: parseFloat(row.calculated_distance_km || '0'),
      costPerKm: parseFloat(row.cost_per_km || '0'),
    }));

    const dashboard: EmployeeDashboard = {
      requests,
      totalRequests,
      pendingCount,
      approvedCount,
      rejectedCount,
      withdrawnCount,
      totalApprovedAllowance,
    };

    logger.info(`Employee dashboard loaded: ${requests.length} requests for employee ${employeeId}`);

    return formatResponse(200, dashboard, context.awsRequestId);

  } catch (error) {
    logger.error('Failed to load employee dashboard:', error);
    return formatResponse(500, { error: 'Internal server error' }, context.awsRequestId);
  }
};

/**
 * Get detailed information for a specific travel request
 */
export const getRequestDetails = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const userContext = getUserContextFromEvent(event);
    const employeeCognitoId = userContext.sub;

    if (!employeeCognitoId) {
      return formatResponse(401, { error: 'Unauthorized' }, context.awsRequestId);
    }

    const requestId = event.pathParameters?.id;
    if (!requestId) {
      return formatResponse(400, { error: 'Request ID is required' }, context.awsRequestId);
    }

    // Get employee ID
    const employeeId = await getEmployeeId(employeeCognitoId);
    if (!employeeId) {
      return formatResponse(404, { error: 'Employee not found' }, context.awsRequestId);
    }

    // Get detailed request information
    const detailsQuery = `
      SELECT
        tr.id,
        p.name as project_name,
        sp.name as subproject_name,
        tr.justification,
        manager.first_name || ' ' || manager.last_name as manager_name,
        manager.email as manager_email,
        tr.calculated_distance_km,
        sp.cost_per_km,
        tr.calculated_allowance_chf as daily_allowance,
        (tr.calculated_allowance_chf * tr.days_per_week) as weekly_allowance,
        (tr.calculated_allowance_chf * tr.days_per_week * 4.33) as monthly_estimate,
        tr.days_per_week,
        tr.status,
        tr.submitted_at as submitted_date,
        tr.processed_at as processed_date,
        CONCAT(employee.home_street, ', ', employee.home_city, ' ', employee.home_postal_code, ', ', employee.home_country) as employee_address,
        CONCAT(sp.street_address, ', ', sp.city, ' ', sp.postal_code, ', ', sp.country) as subproject_address
      FROM travel_requests tr
      JOIN subprojects sp ON tr.subproject_id = sp.id
      JOIN projects p ON sp.project_id = p.id
      JOIN employees employee ON tr.employee_id = employee.id
      LEFT JOIN employees manager ON tr.manager_id = manager.id
      WHERE tr.id = $1 AND tr.employee_id = $2
    `;

    const detailsResult = await db.query(detailsQuery, [requestId, employeeId]);

    if (detailsResult.rows.length === 0) {
      return formatResponse(404, { error: 'Request not found' }, context.awsRequestId);
    }

    const request = detailsResult.rows[0];

    // Get status history
    const historyQuery = `
      SELECT
        new_status as status,
        changed_at as timestamp,
        changed_by as processed_by,
        comment as note
      FROM request_status_history
      WHERE travel_request_id = $1
      ORDER BY changed_at ASC
    `;

    const historyResult = await db.query(historyQuery, [requestId]);

    const requestDetails: RequestDetails = {
      id: request.id,
      projectName: request.project_name,
      subProjectName: request.subproject_name,
      justification: request.justification || '',
      managerName: request.manager_name || '',
      managerEmail: request.manager_email,
      calculatedDistance: parseFloat(request.calculated_distance_km || '0'),
      costPerKm: parseFloat(request.cost_per_km || '0'),
      dailyAllowance: parseFloat(request.daily_allowance),
      weeklyAllowance: parseFloat(request.weekly_allowance),
      monthlyEstimate: parseFloat(request.monthly_estimate),
      daysPerWeek: parseInt(request.days_per_week, 10),
      status: request.status,
      submittedDate: request.submitted_date,
      processedDate: request.processed_date,
      statusHistory: historyResult.rows,
      employeeAddress: request.employee_address,
      subprojectAddress: request.subproject_address,
    };

    return formatResponse(200, requestDetails, context.awsRequestId);

  } catch (error) {
    logger.error('Failed to get request details:', error);
    return formatResponse(500, { error: 'Internal server error' }, context.awsRequestId);
  }
};

/**
 * Withdraw a pending travel request
 */
export const withdrawRequest = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const userContext = getUserContextFromEvent(event);
    const employeeCognitoId = userContext.sub;

    if (!employeeCognitoId) {
      return formatResponse(401, { error: 'Unauthorized' }, context.awsRequestId);
    }

    const requestId = event.pathParameters?.id;
    if (!requestId) {
      return formatResponse(400, { error: 'Request ID is required' }, context.awsRequestId);
    }

    // Get employee ID
    const employeeId = await getEmployeeId(employeeCognitoId);
    if (!employeeId) {
      return formatResponse(404, { error: 'Employee not found' }, context.awsRequestId);
    }

    // Check if request exists and is pending
    const checkQuery = `
      SELECT id, status
      FROM travel_requests
      WHERE id = $1 AND employee_id = $2
    `;

    const checkResult = await db.query(checkQuery, [requestId, employeeId]);

    if (checkResult.rows.length === 0) {
      return formatResponse(404, { error: 'Request not found' }, context.awsRequestId);
    }

    const request = checkResult.rows[0];
    if (request.status !== 'pending') {
      return formatResponse(400, {
        error: `Cannot withdraw ${request.status} request. Only pending requests can be withdrawn.`
      }, context.awsRequestId);
    }

    // Start transaction to update request and add status history
    await db.query('BEGIN');

    try {
      // Update request status
      const updateQuery = `
        UPDATE travel_requests
        SET status = 'withdrawn',
            processed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      await db.query(updateQuery, [requestId]);

      // Add status history record
      const historyQuery = `
        INSERT INTO request_status_history
        (travel_request_id, new_status, changed_by, comment, changed_at)
        VALUES ($1, 'withdrawn', $2, 'Request withdrawn by employee', CURRENT_TIMESTAMP)
      `;

      await db.query(historyQuery, [requestId, employeeId]);

      await db.query('COMMIT');

      logger.info(`Travel request ${requestId} withdrawn by employee ${employeeId}`);

      return formatResponse(200, {
        success: true,
        message: 'Request withdrawn successfully'
      }, context.awsRequestId);

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    logger.error('Failed to withdraw request:', error);
    return formatResponse(500, { error: 'Internal server error' }, context.awsRequestId);
  }
};