import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { db } from '../../database/connection';
import { logger } from '../../middleware/logger';
import { formatResponse } from '../../middleware/response-formatter';
import { getUserContextFromEvent } from '../auth/auth-utils';

interface DashboardFilters {
  employeeName?: string;
  projectName?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  allowanceRange?: {
    min: number;
    max: number;
  };
  urgencyLevels?: ('low' | 'medium' | 'high')[];
}

interface PaginationConfig {
  pageIndex: number;
  pageSize: number;
}

interface SortConfig {
  active: string;
  direction: 'asc' | 'desc';
}

interface TravelRequestSummary {
  id: string;
  employeeName: string;
  employeeEmail: string;
  projectName: string;
  subProjectName: string;
  daysPerWeek: number;
  calculatedAllowance: number;
  submittedDate: Date;
  urgencyLevel: 'low' | 'medium' | 'high';
  daysSinceSubmission: number;
}

interface ManagerDashboard {
  pendingRequests: TravelRequestSummary[];
  totalPending: number;
  urgentCount: number;
  filters: DashboardFilters;
  summary: DashboardSummary;
}

interface DashboardSummary {
  totalEmployees: number;
  activeProjects: number;
  pendingRequests: number;
  monthlyBudget: number;
}

interface EmployeeContext {
  employee: {
    id: string;
    name: string;
    email: string;
    department: string;
    position: string;
    managerId: string;
  };
  currentWeeklyAllowance: number;
  activeRequestsCount: number;
  recentHistory: any[];
  totalRequestsThisYear: number;
  averageWeeklyAllowance: number;
  departmentBudgetUtilization: number;
  recentApprovals: number;
  recentRejections: number;
  performanceScore: number;
}

// Helper function to get manager's employee UUID from cognito ID
async function getManagerEmployeeId(cognitoUserId: string): Promise<string> {
  const result = await db.query('SELECT id FROM employees WHERE cognito_user_id = $1', [
    cognitoUserId,
  ]);

  if (result.rows.length === 0) {
    throw new Error(`Manager not found in employees table for cognito ID: ${cognitoUserId}`);
  }

  return result.rows[0].id;
}

// Helper function to get dashboard summary data
async function getDashboardSummary(managerEmployeeId: string): Promise<DashboardSummary> {
  // Get total employees under this manager
  const employeeResult = await db.query(
    'SELECT COUNT(*) as total FROM employees WHERE manager_id = $1 AND is_active = true',
    [managerEmployeeId]
  );

  // Get active projects count (projects that have active subprojects with pending/approved requests)
  const projectResult = await db.query(
    `
    SELECT COUNT(DISTINCT p.id) as total 
    FROM projects p
    JOIN subprojects sp ON p.id = sp.project_id
    JOIN travel_requests tr ON sp.id = tr.subproject_id
    WHERE tr.manager_id = $1 
      AND p.is_active = true 
      AND sp.is_active = true
      AND tr.status IN ('pending', 'approved')
  `,
    [managerEmployeeId]
  );

  // Get pending requests count for this manager
  const pendingResult = await db.query(
    'SELECT COUNT(*) as total FROM travel_requests WHERE manager_id = $1 AND status = $2',
    [managerEmployeeId, 'pending']
  );

  // Calculate monthly budget (sum of approved requests * 4.33 weeks/month)
  const budgetResult = await db.query(
    `
    SELECT COALESCE(SUM(calculated_allowance_chf * days_per_week * 4.33), 0) as monthly_budget
    FROM travel_requests 
    WHERE manager_id = $1 AND status = 'approved'
  `,
    [managerEmployeeId]
  );

  return {
    totalEmployees: parseInt(employeeResult.rows[0].total),
    activeProjects: parseInt(projectResult.rows[0].total),
    pendingRequests: parseInt(pendingResult.rows[0].total),
    monthlyBudget: parseFloat(budgetResult.rows[0].monthly_budget) || 0,
  };
}

export const getManagerDashboard = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user info from Lambda authorizer
    const managerId = event.requestContext.authorizer?.claims?.sub;
    if (!managerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Look up manager's employee UUID using cognito ID
    let managerEmployeeId: string;
    try {
      managerEmployeeId = await getManagerEmployeeId(managerId);
    } catch (error) {
      logger.warn('Manager not found in employees table', {
        cognitoUserId: managerId,
        error: error instanceof Error ? error.message : String(error),
        requestId: context.awsRequestId,
      });

      return formatResponse(
        404,
        {
          error: 'Manager profile not found. Please contact system administrator.',
        },
        context.awsRequestId
      );
    }

    // Extract query parameters
    const {
      pageIndex = '0',
      pageSize = '10',
      sortActive = 'submittedDate',
      sortDirection = 'desc',
      employeeName,
      projectName,
      dateRangeStart,
      dateRangeEnd,
      allowanceMin,
      allowanceMax,
      urgencyLevels,
    } = event.queryStringParameters || {};

    const pagination: PaginationConfig = {
      pageIndex: parseInt(pageIndex),
      pageSize: parseInt(pageSize),
    };

    const sort: SortConfig = {
      active: sortActive,
      direction: sortDirection as 'asc' | 'desc',
    };

    const filters: DashboardFilters = {};
    if (employeeName) {
      filters.employeeName = employeeName;
    }
    if (projectName) {
      filters.projectName = projectName;
    }
    if (dateRangeStart && dateRangeEnd) {
      filters.dateRange = {
        start: new Date(dateRangeStart),
        end: new Date(dateRangeEnd),
      };
    }
    if (allowanceMin && allowanceMax) {
      filters.allowanceRange = {
        min: parseFloat(allowanceMin),
        max: parseFloat(allowanceMax),
      };
    }
    if (urgencyLevels) {
      filters.urgencyLevels = urgencyLevels.split(',') as ('low' | 'medium' | 'high')[];
    }

    // Build the base query
    let query = `
      SELECT 
        tr.id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.email as employee_email,
        p.name as project_name,
        sp.name as subproject_name,
        tr.days_per_week,
        tr.calculated_allowance_chf as calculated_allowance,
        tr.submitted_at as submitted_date,
        EXTRACT(EPOCH FROM (NOW() - tr.submitted_at))/86400 as days_since_submission
      FROM travel_requests tr
      JOIN employees e ON tr.employee_id = e.id
      JOIN projects p ON tr.project_id = p.id
      JOIN subprojects sp ON tr.subproject_id = sp.id
      WHERE tr.manager_id = $1 AND tr.status = 'pending'
    `;

    const queryParams: any[] = [managerEmployeeId];
    let paramIndex = 2;

    // Apply filters
    if (filters.employeeName) {
      query += ` AND (e.first_name ILIKE $${paramIndex} OR e.last_name ILIKE $${paramIndex})`;
      queryParams.push(`%${filters.employeeName}%`);
      paramIndex++;
    }

    if (filters.projectName) {
      query += ` AND (p.name ILIKE $${paramIndex} OR sp.name ILIKE $${paramIndex})`;
      queryParams.push(`%${filters.projectName}%`);
      paramIndex++;
    }

    if (filters.dateRange) {
      query += ` AND tr.submitted_at >= $${paramIndex} AND tr.submitted_at <= $${paramIndex + 1}`;
      queryParams.push(filters.dateRange.start, filters.dateRange.end);
      paramIndex += 2;
    }

    if (filters.allowanceRange) {
      query += ` AND tr.calculated_allowance_chf >= $${paramIndex} AND tr.calculated_allowance_chf <= $${paramIndex + 1}`;
      queryParams.push(filters.allowanceRange.min, filters.allowanceRange.max);
      paramIndex += 2;
    }

    // Get total count for pagination (before applying LIMIT/OFFSET)
    // Build a simpler count query by extracting just the FROM clause and WHERE conditions
    const fromIndex = query.indexOf('FROM travel_requests');
    const countQuery = `SELECT COUNT(*) as total ${query.substring(fromIndex)}`;

    const countResult = await db.query(countQuery, queryParams);
    const totalPending = parseInt(countResult.rows[0].total);

    // Apply sorting
    let orderBy = '';
    switch (sort.active) {
      case 'employeeName':
        orderBy = `ORDER BY employee_name ${sort.direction.toUpperCase()}`;
        break;
      case 'submittedDate':
        orderBy = `ORDER BY tr.submitted_at ${sort.direction.toUpperCase()}`;
        break;
      case 'calculatedAllowance':
        orderBy = `ORDER BY tr.calculated_allowance_chf ${sort.direction.toUpperCase()}`;
        break;
      case 'urgencyLevel':
        orderBy = `ORDER BY days_since_submission ${sort.direction === 'asc' ? 'ASC' : 'DESC'}`;
        break;
      default:
        orderBy = `ORDER BY tr.submitted_at DESC`;
    }

    query += ` ${orderBy}`;

    // Apply pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(pagination.pageSize, pagination.pageIndex * pagination.pageSize);

    // Execute the main query
    const result = await db.query(query, queryParams);

    // Transform results and calculate urgency levels
    const pendingRequests: TravelRequestSummary[] = result.rows.map(row => {
      const daysSinceSubmission = parseInt(row.days_since_submission) || 0;
      let urgencyLevel: 'low' | 'medium' | 'high' = 'low';

      if (daysSinceSubmission > 7) {
        urgencyLevel = 'high';
      } else if (daysSinceSubmission > 3) {
        urgencyLevel = 'medium';
      }

      return {
        id: row.id,
        employeeName: row.employee_name,
        employeeEmail: row.employee_email,
        projectName: row.project_name,
        subProjectName: row.subproject_name,
        daysPerWeek: row.days_per_week,
        calculatedAllowance: parseFloat(row.calculated_allowance),
        submittedDate: new Date(row.submitted_date),
        urgencyLevel,
        daysSinceSubmission,
      };
    });

    // Filter by urgency levels if specified
    let filteredRequests = pendingRequests;
    if (filters.urgencyLevels && filters.urgencyLevels.length > 0) {
      filteredRequests = pendingRequests.filter(req =>
        filters.urgencyLevels!.includes(req.urgencyLevel)
      );
    }

    // Calculate urgent count
    const urgentCount = filteredRequests.filter(req => req.urgencyLevel === 'high').length;

    // Get summary data for dashboard cards
    const summaryData = await getDashboardSummary(managerEmployeeId);

    const dashboard: ManagerDashboard = {
      pendingRequests: filteredRequests,
      totalPending: filters.urgencyLevels ? filteredRequests.length : totalPending,
      urgentCount,
      filters,
      summary: summaryData,
    };

    return formatResponse(200, dashboard, context.awsRequestId);
  } catch (error) {
    console.error('Error fetching manager dashboard:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export const getEmployeeContext = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user info from Lambda authorizer
    const managerId = event.requestContext.authorizer?.claims?.sub;
    if (!managerId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const employeeId = event.pathParameters?.employeeId;
    if (!employeeId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Employee ID is required' }),
      };
    }

    // Convert manager cognito ID to database UUID
    let managerEmployeeId: string;
    try {
      managerEmployeeId = await getManagerEmployeeId(managerId);
    } catch (error) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Manager not found' }),
      };
    }

    // Get employee details - convert cognito user ID to database UUID
    const employeeQuery = `
      SELECT 
        e.id,
        CONCAT(e.first_name, ' ', e.last_name) as name,
        e.email,
        'Engineering' as department, -- TODO: Add department field to employee table
        'Employee' as position -- TODO: Add position field to employee table
      FROM employees e
      WHERE e.cognito_user_id = $1
    `;

    const employeeResult = await db.query(employeeQuery, [employeeId]);

    if (employeeResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Employee not found' }),
      };
    }

    const employee = employeeResult.rows[0];
    const employeeUUID = employee.id; // Use the database UUID for subsequent queries

    // Get current active requests and allowances
    const activeRequestsQuery = `
      SELECT 
        COUNT(*) as active_count,
        COALESCE(SUM(tr.calculated_allowance_chf), 0) as total_allowance
      FROM travel_requests tr
      WHERE tr.employee_id = $1 AND tr.status = 'approved'
    `;

    const activeRequestsResult = await db.query(activeRequestsQuery, [employeeUUID]);
    const activeData = activeRequestsResult.rows[0];

    // Get request statistics for this year
    const statsQuery = `
      SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approvals,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejections,
        AVG(CASE WHEN status = 'approved' THEN calculated_allowance_chf END) as avg_allowance
      FROM travel_requests tr
      WHERE tr.employee_id = $1 
        AND EXTRACT(YEAR FROM tr.submitted_at) = EXTRACT(YEAR FROM NOW())
    `;

    const statsResult = await db.query(statsQuery, [employeeUUID]);
    const stats = statsResult.rows[0];

    // Calculate performance score based on approval rate
    const totalRequests = parseInt(stats.total_requests) || 1;
    const approvalRate = (parseInt(stats.approvals) || 0) / totalRequests;
    const performanceScore = Math.round((approvalRate * 3 + 7) * 10) / 10; // Scale to 7-10 range

    const employeeContext: EmployeeContext = {
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        position: employee.position,
        managerId: managerEmployeeId,
      },
      currentWeeklyAllowance: parseFloat(activeData.total_allowance) || 0,
      activeRequestsCount: parseInt(activeData.active_count) || 0,
      recentHistory: [], // TODO: Implement history query if needed
      totalRequestsThisYear: parseInt(stats.total_requests) || 0,
      averageWeeklyAllowance: parseFloat(stats.avg_allowance) || 0,
      departmentBudgetUtilization: Math.floor(Math.random() * 40) + 60, // TODO: Implement actual budget tracking
      recentApprovals: parseInt(stats.approvals) || 0,
      recentRejections: parseInt(stats.rejections) || 0,
      performanceScore,
    };

    return formatResponse(200, employeeContext, context.awsRequestId);
  } catch (error) {
    console.error('Error fetching employee context:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export const approveRequest = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const userContext = getUserContextFromEvent(event);
    const managerCognitoId = userContext.sub;
    if (!managerCognitoId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Convert cognito_user_id to UUID for database queries
    const managerEmployeeId = await getManagerEmployeeId(managerCognitoId);

    const requestId = event.pathParameters?.requestId;
    if (!requestId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Request ID is required' }),
      };
    }

    // Begin transaction using direct db.query (note: this is a simplified approach)
    // In a production system, you would use a proper transaction
    const updateQuery = `
      UPDATE travel_requests 
      SET status = 'approved', 
          processed_at = NOW(), 
          processed_by = $1,
          updated_at = NOW()
      WHERE id = $2 AND status = 'pending'
      RETURNING id, employee_id
    `;

    const updateResult = await db.query(updateQuery, [managerEmployeeId, requestId]);

    if (updateResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Request not found or already processed' }),
      };
    }

    const request = updateResult.rows[0];

    // Add status history entry
    const historyQuery = `
      INSERT INTO request_status_history (travel_request_id, previous_status, new_status, changed_by)
      VALUES ($1, 'pending', 'approved', $2)
    `;

    await db.query(historyQuery, [requestId, managerEmployeeId]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: {
          id: request.id,
          status: 'approved',
          message: 'Request approved successfully',
        },
      }),
    };
  } catch (error) {
    console.error('Error approving request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export const rejectRequest = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const userContext = getUserContextFromEvent(event);
    const managerCognitoId = userContext.sub;
    if (!managerCognitoId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Convert cognito_user_id to UUID for database queries
    const managerEmployeeId = await getManagerEmployeeId(managerCognitoId);

    const requestId = event.pathParameters?.requestId;
    if (!requestId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Request ID is required' }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const rejectionReason = body.reason;

    if (!rejectionReason || rejectionReason.trim().length < 10) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Rejection reason is required (minimum 10 characters)' }),
      };
    }

    // Update request status
    const updateQuery = `
      UPDATE travel_requests 
      SET status = 'rejected', 
          processed_at = NOW(), 
          processed_by = $1,
          rejection_reason = $2,
          updated_at = NOW()
      WHERE id = $3 AND status = 'pending'
      RETURNING id, employee_id
    `;

    const updateResult = await db.query(updateQuery, [
      managerEmployeeId,
      rejectionReason,
      requestId,
    ]);

    if (updateResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Request not found or already processed' }),
      };
    }

    const request = updateResult.rows[0];

    // Add status history entry
    const historyQuery = `
      INSERT INTO request_status_history (travel_request_id, previous_status, new_status, comment, changed_by)
      VALUES ($1, 'pending', 'rejected', $2, $3)
    `;

    await db.query(historyQuery, [requestId, rejectionReason, managerEmployeeId]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: {
          id: request.id,
          status: 'rejected',
          message: 'Request rejected successfully',
        },
      }),
    };
  } catch (error) {
    console.error('Error rejecting request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
