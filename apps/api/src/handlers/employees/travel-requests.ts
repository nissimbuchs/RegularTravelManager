import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { db } from '../../database/connection';
import { getUserContextFromEvent } from '../auth/auth-utils';
import { formatResponse } from '../../middleware/response-formatter';

interface CalculationPreviewRequest {
  subprojectId: string;
  daysPerWeek: number;
}

interface CalculationPreview {
  distance: number;
  dailyAllowance: number;
  weeklyAllowance: number;
}

interface CreateTravelRequestBody {
  subprojectId: string; // ✅ Fixed: Use camelCase per API field naming conventions
  daysPerWeek: number; // ✅ Fixed: Use camelCase per API field naming conventions
  justification: string;
  managerId: string; // ✅ Fixed: Use camelCase per API field naming conventions
}

export const calculatePreview = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user info from Lambda authorizer
    const userContext = getUserContextFromEvent(event);
    const employeeCognitoId = userContext.sub;
    if (!employeeCognitoId) {
      return formatResponse(401, { error: 'Unauthorized' }, 'travel-preview-request');
    }

    const body: CalculationPreviewRequest = JSON.parse(event.body || '{}');
    if (!body.subprojectId || !body.daysPerWeek) {
      return formatResponse(
        400,
        { error: 'subprojectId and daysPerWeek are required' },
        'travel-preview-request'
      );
    }

    // Get employee home location
    const employeeQuery = `
      SELECT home_location
      FROM employees
      WHERE cognito_user_id = $1 AND is_active = true
    `;

    const employeeResult = await db.query(employeeQuery, [employeeCognitoId]);

    if (employeeResult.rows.length === 0) {
      return formatResponse(404, { error: 'Employee not found' }, 'travel-preview-request');
    }

    const employee = employeeResult.rows[0];
    if (!employee.home_location) {
      return formatResponse(
        400,
        { error: 'Employee home address not set' },
        'travel-preview-request'
      );
    }

    // Get subproject location and cost per km
    const subprojectQuery = `
      SELECT sp.location, sp.cost_per_km, p.default_cost_per_km
      FROM subprojects sp
      JOIN projects p ON sp.project_id = p.id
      WHERE sp.id = $1 AND sp.is_active = true AND p.is_active = true
    `;

    const subprojectResult = await db.query(subprojectQuery, [body.subprojectId]);

    if (subprojectResult.rows.length === 0) {
      return formatResponse(
        404,
        { error: 'Subproject not found or inactive' },
        'travel-preview-request'
      );
    }

    const subproject = subprojectResult.rows[0];
    const costPerKm = subproject.cost_per_km || subproject.default_cost_per_km || 0.68;

    // Calculate distance using PostGIS function
    const distanceQuery = `
      SELECT calculate_travel_distance($1, $2) as distance_km
    `;

    const distanceResult = await db.query(distanceQuery, [
      employee.home_location,
      subproject.location,
    ]);

    const distanceKm = parseFloat(distanceResult.rows[0].distance_km);

    // Calculate allowances
    const dailyAllowance = distanceKm * costPerKm;
    const weeklyAllowance = dailyAllowance * body.daysPerWeek;

    const preview: CalculationPreview = {
      distance: Math.round(distanceKm * 1000) / 1000, // Round to 3 decimal places
      dailyAllowance: Math.round(dailyAllowance * 100) / 100, // Round to 2 decimal places
      weeklyAllowance: Math.round(weeklyAllowance * 100) / 100,
    };

    return formatResponse(200, preview, 'travel-preview-request');
  } catch (error) {
    console.error('Error calculating travel preview:', error);
    return formatResponse(500, { error: 'Internal server error' }, 'travel-preview-request');
  }
};

export const createTravelRequest = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract user info from Lambda authorizer
    const userContext = getUserContextFromEvent(event);
    const employeeCognitoId = userContext.sub;
    if (!employeeCognitoId) {
      return formatResponse(401, { error: 'Unauthorized' }, 'create-travel-request');
    }

    const body: CreateTravelRequestBody = JSON.parse(event.body || '{}');
    const { subprojectId, daysPerWeek, justification, managerId } = body; // ✅ Fixed: Use camelCase

    if (!subprojectId || !daysPerWeek || !justification || !managerId) {
      return formatResponse(
        400,
        {
          error: 'subprojectId, daysPerWeek, justification, and managerId are required',
        },
        'create-travel-request'
      );
    }

    // Get employee details
    const employeeQuery = `
      SELECT id, home_location
      FROM employees
      WHERE cognito_user_id = $1 AND is_active = true
    `;

    const employeeResult = await db.query(employeeQuery, [employeeCognitoId]);

    if (employeeResult.rows.length === 0) {
      return formatResponse(404, { error: 'Employee not found' }, 'create-travel-request');
    }

    const employee = employeeResult.rows[0];

    // Validate selected manager
    const managerQuery = `
      SELECT id, is_active
      FROM employees 
      WHERE cognito_user_id = $1 AND employee_id LIKE 'MGR-%' AND is_active = true
    `;

    const managerResult = await db.query(managerQuery, [managerId]); // ✅ Fixed: Use camelCase variable

    if (managerResult.rows.length === 0) {
      return formatResponse(
        400,
        { error: 'Invalid or inactive manager selected' },
        'create-travel-request'
      );
    }

    const selectedManager = managerResult.rows[0];

    if (!employee.home_location) {
      return formatResponse(
        400,
        { error: 'Employee home address not set' },
        'create-travel-request'
      );
    }

    // Get subproject and project details
    const subprojectQuery = `
      SELECT sp.id, sp.project_id, sp.location, sp.cost_per_km, p.default_cost_per_km
      FROM subprojects sp
      JOIN projects p ON sp.project_id = p.id
      WHERE sp.id = $1 AND sp.is_active = true AND p.is_active = true
    `;

    const subprojectResult = await db.query(subprojectQuery, [subprojectId]); // ✅ Fixed: Use camelCase variable

    if (subprojectResult.rows.length === 0) {
      return formatResponse(
        404,
        { error: 'Subproject not found or inactive' },
        'create-travel-request'
      );
    }

    const subproject = subprojectResult.rows[0];
    const costPerKm = subproject.cost_per_km || subproject.default_cost_per_km || 0.68;

    // Calculate distance and allowance
    const distanceQuery = `
      SELECT calculate_travel_distance($1, $2) as distance_km
    `;

    const distanceResult = await db.query(distanceQuery, [
      employee.home_location,
      subproject.location,
    ]);

    const distanceKm = parseFloat(distanceResult.rows[0].distance_km);
    const calculatedAllowanceChf = distanceKm * costPerKm * daysPerWeek; // ✅ Fixed: Use camelCase variable

    // Create travel request
    const insertQuery = `
      INSERT INTO travel_requests (
        employee_id,
        manager_id,
        project_id,
        subproject_id,
        days_per_week,
        justification,
        status,
        calculated_distance_km,
        calculated_allowance_chf
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)
      RETURNING id, submitted_at
    `;

    const insertResult = await db.query(insertQuery, [
      employee.id,
      selectedManager.id,
      subproject.project_id,
      subprojectId, // ✅ Fixed: Use camelCase variable (note: DB column remains snake_case)
      daysPerWeek, // ✅ Fixed: Use camelCase variable (note: DB column remains snake_case)
      justification,
      distanceKm,
      calculatedAllowanceChf,
    ]);

    const newRequest = insertResult.rows[0];

    // Add initial status history entry
    const historyQuery = `
      INSERT INTO request_status_history (travel_request_id, new_status, changed_by)
      VALUES ($1, 'pending', $2)
    `;

    await db.query(historyQuery, [newRequest.id, employee.id]);

    return formatResponse(
      201,
      {
        data: {
          id: newRequest.id,
          submittedAt: newRequest.submitted_at, // Convert to camelCase for API response
          status: 'pending',
          message: 'Travel request submitted successfully',
        },
      },
      'create-travel-request'
    );
  } catch (error) {
    console.error('Error creating travel request:', error);
    return formatResponse(500, { error: 'Internal server error' }, 'create-travel-request');
  }
};

export const getTravelRequests = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const userContext = getUserContextFromEvent(event);
    const employeeCognitoId = userContext.sub;
    if (!employeeCognitoId) {
      return formatResponse(401, { error: 'Unauthorized' }, 'get-travel-requests');
    }

    // Get employee ID
    const employeeQuery = `
      SELECT id FROM employees
      WHERE cognito_user_id = $1 AND is_active = true
    `;
    const employeeResult = await db.query(employeeQuery, [employeeCognitoId]);

    if (employeeResult.rows.length === 0) {
      return formatResponse(404, { error: 'Employee not found' }, 'get-travel-requests');
    }

    const employeeId = employeeResult.rows[0].id;

    // Extract pagination and filtering parameters from query string
    const queryParams = event.queryStringParameters || {};
    const pageIndex = parseInt(queryParams.pageIndex || '0');
    const pageSize = parseInt(queryParams.pageSize || '25');
    const sortActive = queryParams.sortActive || 'submittedDate';
    const sortDirection = queryParams.sortDirection || 'desc';
    const statusFilter = queryParams.status;
    const projectNameFilter = queryParams.projectName;

    // Build WHERE clause for filters
    const whereConditions = ['tr.employee_id = $1'];
    const queryValues = [employeeId];
    let paramIndex = 2;

    if (statusFilter) {
      whereConditions.push(`tr.status = $${paramIndex}`);
      queryValues.push(statusFilter);
      paramIndex++;
    }

    if (projectNameFilter) {
      whereConditions.push(`p.name ILIKE $${paramIndex}`);
      queryValues.push(`%${projectNameFilter}%`);
      paramIndex++;
    }

    // Handle date range filtering if provided
    if (queryParams.dateRangeStart && queryParams.dateRangeEnd) {
      whereConditions.push(`tr.submitted_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
      queryValues.push(new Date(queryParams.dateRangeStart));
      queryValues.push(new Date(queryParams.dateRangeEnd));
      paramIndex += 2;
    }

    const whereClause = whereConditions.join(' AND ');

    // Build ORDER BY clause
    const sortMap: Record<string, string> = {
      submittedDate: 'tr.submitted_at',
      projectName: 'p.name',
      status: 'tr.status',
      processedDate: 'tr.processed_at',
    };
    const sortColumn = sortMap[sortActive] || 'tr.submitted_at';
    const orderBy = `${sortColumn} ${sortDirection.toUpperCase()}`;

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM travel_requests tr
      JOIN subprojects sp ON tr.subproject_id = sp.id
      JOIN projects p ON tr.project_id = p.id
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryValues);
    const totalRequests = parseInt(countResult.rows[0].total);

    // Get paginated travel requests with all required data
    const travelRequestsQuery = `
      SELECT
        tr.id,
        tr.status,
        tr.days_per_week,
        tr.justification,
        tr.calculated_distance_km,
        tr.calculated_allowance_chf,
        tr.submitted_at,
        tr.processed_at,
        tr.rejection_reason,
        p.name as project_name,
        sp.name as subproject_name,
        sp.location as subproject_location,
        sp.cost_per_km,
        p.default_cost_per_km,
        m.first_name || ' ' || m.last_name as manager_name,
        m.email as manager_email
      FROM travel_requests tr
      JOIN subprojects sp ON tr.subproject_id = sp.id
      JOIN projects p ON tr.project_id = p.id
      JOIN employees m ON tr.manager_id = m.id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryValues.push(pageSize, pageIndex * pageSize);
    const result = await db.query(travelRequestsQuery, queryValues);

    // Calculate summary counts
    const summaryQuery = `
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN calculated_allowance_chf ELSE 0 END), 0) as total_approved_allowance
      FROM travel_requests tr
      JOIN subprojects sp ON tr.subproject_id = sp.id
      JOIN projects p ON tr.project_id = p.id
      WHERE ${whereClause}
      GROUP BY status
    `;

    const summaryResult = await db.query(summaryQuery, queryValues.slice(0, -2));

    // Initialize counts
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let withdrawnCount = 0;
    let totalApprovedAllowance = 0;

    summaryResult.rows.forEach((row: any) => {
      switch (row.status) {
        case 'pending':
          pendingCount = parseInt(row.count);
          break;
        case 'approved':
          approvedCount = parseInt(row.count);
          totalApprovedAllowance = parseFloat(row.total_approved_allowance);
          break;
        case 'rejected':
          rejectedCount = parseInt(row.count);
          break;
        case 'withdrawn':
          withdrawnCount = parseInt(row.count);
          break;
      }
    });

    // Transform requests to match frontend model
    const requests = result.rows.map((row: any) => {
      const costPerKm = parseFloat(row.cost_per_km || row.default_cost_per_km || 0.68);
      const dailyAllowance =
        parseFloat(row.calculated_allowance_chf || 0) / parseInt(row.days_per_week || 1);
      const weeklyAllowance = parseFloat(row.calculated_allowance_chf || 0);

      return {
        id: row.id,
        projectName: row.project_name,
        subProjectName: row.subproject_name,
        status: row.status,
        submittedDate: row.submitted_at, // Will be converted to Date in frontend
        processedDate: row.processed_at, // Will be converted to Date in frontend
        dailyAllowance: parseFloat(dailyAllowance.toFixed(2)),
        weeklyAllowance: parseFloat(weeklyAllowance.toFixed(2)),
        daysPerWeek: row.days_per_week,
        justification: row.justification,
        managerName: row.manager_name,
        managerEmail: row.manager_email,
        calculatedDistance: row.calculated_distance_km,
        costPerKm: costPerKm,
        statusHistory: [], // Will be populated if needed in details view
      };
    });

    // Build dashboard response matching EmployeeDashboard interface
    const dashboardData = {
      requests,
      totalRequests,
      pendingCount,
      approvedCount,
      rejectedCount,
      withdrawnCount,
      totalApprovedAllowance: parseFloat(totalApprovedAllowance.toFixed(2)),
    };

    return formatResponse(200, dashboardData, 'get-travel-requests');
  } catch (error) {
    console.error('Error getting travel requests:', error);
    return formatResponse(500, { error: 'Internal server error' }, 'get-travel-requests');
  }
};

export const getRequestDetails = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract request ID from path parameters
    const requestId = event.pathParameters?.requestId;
    if (!requestId) {
      return formatResponse(400, { error: 'Request ID is required' }, 'get-request-details');
    }

    // Get authenticated user
    const authContext = event.requestContext?.authorizer;
    if (!authContext?.sub) {
      return formatResponse(401, { error: 'Unauthorized' }, 'get-request-details');
    }

    const cognitoUserId = authContext.sub;

    // Get employee ID from cognito_user_id
    const employeeQuery = `
      SELECT id FROM employees
      WHERE cognito_user_id = $1
    `;

    const employeeResult = await db.query(employeeQuery, [cognitoUserId]);

    if (employeeResult.rows.length === 0) {
      return formatResponse(404, { error: 'Employee not found' }, 'get-request-details');
    }

    const employeeId = employeeResult.rows[0].id;

    // Get detailed request information including cost calculation
    const requestQuery = `
      SELECT
        tr.id,
        tr.status,
        tr.days_per_week,
        tr.justification,
        tr.calculated_distance_km,
        tr.calculated_allowance_chf,
        tr.submitted_at,
        tr.processed_at,
        tr.rejection_reason,
        p.name as project_name,
        sp.name as subproject_name,
        sp.cost_per_km,
        p.default_cost_per_km,
        ST_AsText(sp.location) as subproject_address,
        m.first_name || ' ' || m.last_name as manager_name,
        m.email as manager_email,
        e.home_street || ', ' || e.home_city || ' ' || e.home_postal_code || ', ' || e.home_country as employee_address
      FROM travel_requests tr
      JOIN subprojects sp ON tr.subproject_id = sp.id
      JOIN projects p ON tr.project_id = p.id
      JOIN employees m ON tr.manager_id = m.id
      JOIN employees e ON tr.employee_id = e.id
      WHERE tr.id = $1 AND tr.employee_id = $2 AND tr.archived_at IS NULL
    `;

    const result = await db.query(requestQuery, [requestId, employeeId]);

    if (result.rows.length === 0) {
      return formatResponse(404, { error: 'Request not found' }, 'get-request-details');
    }

    const request = result.rows[0];

    // Calculate all required allowance values
    const costPerKm = parseFloat(request.cost_per_km || request.default_cost_per_km || 0.68);
    const calculatedDistance = parseFloat(request.calculated_distance_km || 0);
    const weeklyAllowance = parseFloat(request.calculated_allowance_chf || 0);
    const dailyAllowance = weeklyAllowance / parseInt(request.days_per_week || 1);
    const monthlyEstimate = weeklyAllowance * 4.33; // Average weeks per month

    const requestDetails = {
      id: request.id,
      projectName: request.project_name,
      subProjectName: request.subproject_name,
      justification: request.justification || '',
      managerName: request.manager_name,
      managerEmail: request.manager_email,
      calculatedDistance,
      costPerKm,
      dailyAllowance: parseFloat(dailyAllowance.toFixed(2)),
      weeklyAllowance: parseFloat(weeklyAllowance.toFixed(2)),
      monthlyEstimate: parseFloat(monthlyEstimate.toFixed(2)),
      daysPerWeek: parseInt(request.days_per_week || 0),
      status: request.status,
      submittedDate: request.submitted_at, // Will be converted to Date in frontend
      processedDate: request.processed_at, // Will be converted to Date in frontend
      statusHistory: [], // TODO: Add status history query if needed
      employeeAddress: request.employee_address,
      subprojectAddress: request.subproject_address,
    };

    return formatResponse(200, requestDetails, 'get-request-details');
  } catch (error) {
    console.error('Error getting request details:', error);
    return formatResponse(500, { error: 'Internal server error' }, 'get-request-details');
  }
};

export const withdrawRequest = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Extract request ID from path parameters
    const requestId = event.pathParameters?.requestId;
    if (!requestId) {
      return formatResponse(400, { error: 'Request ID is required' }, 'withdraw-request');
    }

    // Get authenticated user
    const authContext = event.requestContext?.authorizer;
    if (!authContext?.sub) {
      return formatResponse(401, { error: 'Unauthorized' }, 'withdraw-request');
    }

    const cognitoUserId = authContext.sub;

    // Get employee ID from cognito_user_id
    const employeeQuery = `
      SELECT id FROM employees
      WHERE cognito_user_id = $1
    `;

    const employeeResult = await db.query(employeeQuery, [cognitoUserId]);

    if (employeeResult.rows.length === 0) {
      return formatResponse(404, { error: 'Employee not found' }, 'withdraw-request');
    }

    const employeeId = employeeResult.rows[0].id;

    // Check if request exists and belongs to the employee
    const checkQuery = `
      SELECT id, status FROM travel_requests
      WHERE id = $1 AND employee_id = $2 AND archived_at IS NULL
    `;

    const checkResult = await db.query(checkQuery, [requestId, employeeId]);

    if (checkResult.rows.length === 0) {
      return formatResponse(404, { error: 'Request not found' }, 'withdraw-request');
    }

    const currentStatus = checkResult.rows[0].status;

    // Only pending requests can be withdrawn
    if (currentStatus !== 'pending') {
      return formatResponse(
        400,
        {
          error: `Cannot withdraw request with status: ${currentStatus}`,
        },
        'withdraw-request'
      );
    }

    // Update request status to withdrawn
    const withdrawQuery = `
      UPDATE travel_requests
      SET status = 'withdrawn',
          processed_at = CURRENT_TIMESTAMP,
          processed_by = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND employee_id = $3
      RETURNING id, status, processed_at
    `;

    const result = await db.query(withdrawQuery, [employeeId, requestId, employeeId]);

    if (result.rows.length === 0) {
      return formatResponse(500, { error: 'Failed to withdraw request' }, 'withdraw-request');
    }

    const updatedRequest = result.rows[0];

    return formatResponse(
      200,
      {
        id: updatedRequest.id,
        status: updatedRequest.status,
        processedAt: updatedRequest.processed_at?.toISOString(),
      },
      'withdraw-request'
    );
  } catch (error) {
    console.error('Error withdrawing request:', error);
    return formatResponse(500, { error: 'Internal server error' }, 'withdraw-request');
  }
};

// Router function to handle GET, POST, and PUT requests
export const employeesTravelRequests = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const path = event.path;

  if (method === 'GET') {
    // Check for specific request details endpoint
    if (path.match(/\/employees\/requests\/[^\/]+\/details$/)) {
      return getRequestDetails(event, context);
    }
    // Default to dashboard requests
    return getTravelRequests(event, context);
  } else if (method === 'POST') {
    if (path.endsWith('/preview')) {
      return calculatePreview(event, context);
    } else {
      return createTravelRequest(event, context);
    }
  } else if (method === 'PUT') {
    if (path.match(/\/employees\/requests\/[^\/]+\/withdraw$/)) {
      return withdrawRequest(event, context);
    }
  }

  return formatResponse(
    405,
    { error: `Method ${method} not allowed` },
    'employees-travel-requests-router'
  );
};
