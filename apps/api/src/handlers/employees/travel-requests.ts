import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { db } from '../../database/connection';
import { getUserContextFromEvent } from '../auth/auth-utils';

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
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const body: CalculationPreviewRequest = JSON.parse(event.body || '{}');
    if (!body.subprojectId || !body.daysPerWeek) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'subprojectId and daysPerWeek are required' }),
      };
    }

    // Get employee home location
    const employeeQuery = `
      SELECT home_location 
      FROM employees 
      WHERE cognito_user_id = $1 AND is_active = true
    `;

    const employeeResult = await db.query(employeeQuery, [employeeCognitoId]);

    if (employeeResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Employee not found' }),
      };
    }

    const employee = employeeResult.rows[0];
    if (!employee.home_location) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Employee home address not set' }),
      };
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
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Subproject not found or inactive' }),
      };
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

    return {
      statusCode: 200,
      body: JSON.stringify({ data: preview }),
    };
  } catch (error) {
    console.error('Error calculating travel preview:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
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
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const body: CreateTravelRequestBody = JSON.parse(event.body || '{}');
    const { subprojectId, daysPerWeek, justification, managerId } = body; // ✅ Fixed: Use camelCase

    if (!subprojectId || !daysPerWeek || !justification || !managerId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'subprojectId, daysPerWeek, justification, and managerId are required', // ✅ Fixed: Use camelCase in error message
        }),
      };
    }

    // Get employee details
    const employeeQuery = `
      SELECT id, home_location
      FROM employees 
      WHERE cognito_user_id = $1 AND is_active = true
    `;

    const employeeResult = await db.query(employeeQuery, [employeeCognitoId]);

    if (employeeResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Employee not found' }),
      };
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
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid or inactive manager selected' }),
      };
    }

    const selectedManager = managerResult.rows[0];

    if (!employee.home_location) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Employee home address not set' }),
      };
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
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Subproject not found or inactive' }),
      };
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

    return {
      statusCode: 201,
      body: JSON.stringify({
        data: {
          id: newRequest.id,
          submittedAt: newRequest.submitted_at, // Convert to camelCase for API response
          status: 'pending',
          message: 'Travel request submitted successfully',
        },
      }),
    };
  } catch (error) {
    console.error('Error creating travel request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
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
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Get employee ID
    const employeeQuery = `
      SELECT id FROM employees 
      WHERE cognito_user_id = $1 AND is_active = true
    `;
    const employeeResult = await db.query(employeeQuery, [employeeCognitoId]);

    if (employeeResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Employee not found' }),
      };
    }

    const employeeId = employeeResult.rows[0].id;

    // Get all travel requests for this employee
    const travelRequestsQuery = `
      SELECT 
        tr.id,
        tr.status,
        tr.days_per_week,
        tr.justification,
        tr.calculated_distance_km,
        tr.calculated_allowance_chf,
        tr.submitted_at,
        tr.approved_at,
        tr.rejected_at,
        p.name as project_name,
        sp.name as subproject_name,
        sp.location as subproject_location,
        m.first_name || ' ' || m.last_name as manager_name
      FROM travel_requests tr
      JOIN subprojects sp ON tr.subproject_id = sp.id
      JOIN projects p ON tr.project_id = p.id
      JOIN employees m ON tr.manager_id = m.id
      WHERE tr.employee_id = $1
      ORDER BY tr.submitted_at DESC
    `;

    const result = await db.query(travelRequestsQuery, [employeeId]);

    const travelRequests = result.rows.map(row => ({
      id: row.id,
      status: row.status,
      daysPerWeek: row.days_per_week,
      justification: row.justification,
      calculatedDistanceKm: row.calculated_distance_km,
      calculatedAllowanceChf: row.calculated_allowance_chf,
      submittedAt: row.submitted_at?.toISOString(),
      approvedAt: row.approved_at?.toISOString(),
      rejectedAt: row.rejected_at?.toISOString(),
      projectName: row.project_name,
      subprojectName: row.subproject_name,
      subprojectLocation: row.subproject_location,
      managerName: row.manager_name,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ data: travelRequests }),
    };
  } catch (error) {
    console.error('Error getting travel requests:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

// Router function to handle both GET and POST requests
export const employeesTravelRequests = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  
  if (method === 'GET') {
    return getTravelRequests(event, context);
  } else if (method === 'POST') {
    const path = event.path;
    if (path.endsWith('/preview')) {
      return calculatePreview(event, context);
    } else {
      return createTravelRequest(event, context);
    }
  }
  
  return {
    statusCode: 405,
    body: JSON.stringify({ error: `Method ${method} not allowed` }),
  };
};
