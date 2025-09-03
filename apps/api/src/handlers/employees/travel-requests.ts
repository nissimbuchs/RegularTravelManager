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

export const calculatePreview = async (
  event: APIGatewayProxyEvent,
  context: Context
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
  context: Context
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

    const body = JSON.parse(event.body || '{}');
    const { subproject_id, days_per_week, justification } = body;

    if (!subproject_id || !days_per_week || !justification) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'subproject_id, days_per_week, and justification are required',
        }),
      };
    }

    // Get employee details and validate manager
    const employeeQuery = `
      SELECT id, manager_id, home_location
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

    if (!employee.manager_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Employee has no assigned manager' }),
      };
    }

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

    const subprojectResult = await db.query(subprojectQuery, [subproject_id]);

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
    const calculatedAllowanceChf = distanceKm * costPerKm * days_per_week;

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
      employee.manager_id,
      subproject.project_id,
      subproject_id,
      days_per_week,
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
          submitted_at: newRequest.submitted_at,
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