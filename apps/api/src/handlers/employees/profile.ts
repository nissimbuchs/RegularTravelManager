import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../../middleware/logger';
import { formatResponse } from '../../middleware/response-formatter';
import { ValidationError, NotFoundError } from '../../middleware/error-handler';
import { validateRequest } from '../../middleware/request-validator';
import { db } from '../../database/connection';
import {
  EmployeeService,
  UpdateEmployeeAddressCommand,
  CreateEmployeeCommand,
} from '../../../../domains/employee-management/EmployeeService';
import { GeocodingService, GeocodeResult } from '../../services/geocoding-service';
import { getUserContextFromEvent } from '../auth/auth-utils';

class EmployeeServiceImpl implements EmployeeService {
  private geocodingService: GeocodingService;

  constructor() {
    this.geocodingService = new GeocodingService();
  }
  async createEmployee(command: CreateEmployeeCommand) {
    logger.info('Creating employee profile', { email: command.email });

    const result = await db.query(
      `
      SELECT sync_employee_with_cognito($1, $2, $3, $4) as employee_id
    `,
      [command.email, command.cognito_user_id, command.first_name, command.last_name]
    );

    const employeeId = result.rows[0].employee_id;
    return this.getEmployee(employeeId);
  }

  async getEmployee(id: string) {
    const result = await db.query('SELECT * FROM employees WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const employee = result.rows[0];
    // Convert PostGIS point to lat/lng
    if (employee.home_location) {
      const locationResult = await db.query(
        'SELECT ST_X($1::geometry) as longitude, ST_Y($1::geometry) as latitude',
        [employee.home_location]
      );
      employee.home_location = {
        latitude: locationResult.rows[0].latitude,
        longitude: locationResult.rows[0].longitude,
      };
    }

    return employee;
  }

  async getEmployeeByCognitoId(cognitoUserId: string) {
    console.log('Searching for employee with cognito_user_id:', cognitoUserId);
    const result = await db.query('SELECT * FROM employees WHERE cognito_user_id = $1', [
      cognitoUserId,
    ]);

    console.log('Query result rows count:', result.rows.length);
    if (result.rows.length === 0) {
      console.log('No employee found with cognito_user_id:', cognitoUserId);
      return null;
    }

    const employee = result.rows[0];
    console.log('Found employee:', employee.first_name, employee.last_name);

    // Convert PostGIS point to lat/lng
    let homeLocation = null;
    if (employee.home_location) {
      try {
        const locationResult = await db.query(
          'SELECT ST_X($1::geometry) as longitude, ST_Y($1::geometry) as latitude',
          [employee.home_location]
        );
        homeLocation = {
          latitude: locationResult.rows[0].latitude,
          longitude: locationResult.rows[0].longitude,
        };
      } catch (error) {
        console.error('PostGIS location conversion failed:', error);
        // If location conversion fails, set to default location (Bern)
        homeLocation = {
          latitude: 46.947974,
          longitude: 7.447447,
        };
      }
    }

    console.log('Returning employee:', employee.id);

    // Transform snake_case to camelCase for API response
    return {
      id: employee.id,
      cognitoUserId: employee.cognito_user_id,
      email: employee.email,
      firstName: employee.first_name,
      lastName: employee.last_name,
      employeeId: employee.employee_id,
      homeStreet: employee.home_street,
      homeCity: employee.home_city,
      homePostalCode: employee.home_postal_code,
      homeCountry: employee.home_country,
      homeLocation: homeLocation,
      createdAt: employee.created_at,
      updatedAt: employee.updated_at,
    };
  }

  async getEmployeeByEmployeeId(employeeId: string) {
    const result = await db.query('SELECT * FROM employees WHERE employee_id = $1', [employeeId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async searchEmployees(searchTerm: string) {
    const result = await db.query(
      `
      SELECT * FROM employees 
      WHERE first_name ILIKE $1 
         OR last_name ILIKE $1 
         OR employee_id ILIKE $1
         OR (first_name || ' ' || last_name) ILIKE $1
      ORDER BY last_name, first_name
      LIMIT 50
    `,
      [`%${searchTerm}%`]
    );

    return result.rows;
  }

  async updateEmployeeAddress(command: UpdateEmployeeAddressCommand) {
    logger.info('Updating employee address', { employeeId: command.id });

    // Geocode the address first
    const coordinates = await this.geocodeAddress({
      street: command.home_street,
      city: command.home_city,
      postalCode: command.home_postal_code,
      country: command.home_country,
    });

    // Start transaction
    const client = await (await db.getPool()).connect();
    try {
      await client.query('BEGIN');

      // Store previous address for audit
      const previousResult = await client.query(
        'SELECT home_street, home_city, home_postal_code, home_country, home_location FROM employees WHERE id = $1',
        [command.id]
      );

      if (previousResult.rows.length === 0) {
        throw new NotFoundError('Employee');
      }

      const previousAddress = previousResult.rows[0];

      // Update employee address
      const updateResult = await client.query(
        `
        UPDATE employees 
        SET home_street = $1,
            home_city = $2,
            home_postal_code = $3,
            home_country = $4,
            home_location = ST_SetSRID(ST_MakePoint($5, $6), 4326),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING *
      `,
        [
          command.home_street,
          command.home_city,
          command.home_postal_code,
          command.home_country,
          coordinates.longitude,
          coordinates.latitude,
          command.id,
        ]
      );

      const updatedEmployee = updateResult.rows[0];

      // Create audit trail entry
      await client.query(
        `
        INSERT INTO employee_address_history (
          employee_id, 
          previous_street, 
          previous_city, 
          previous_postal_code, 
          previous_country,
          previous_location,
          new_street,
          new_city,
          new_postal_code,
          new_country,
          new_location,
          changed_at,
          changed_by,
          change_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, $12, $13)
      `,
        [
          command.id,
          previousAddress.home_street,
          previousAddress.home_city,
          previousAddress.home_postal_code,
          previousAddress.home_country,
          previousAddress.home_location,
          command.home_street,
          command.home_city,
          command.home_postal_code,
          command.home_country,
          updatedEmployee.home_location,
          command.id, // changed_by is the employee making the change
          'User address update',
        ]
      );

      await client.query('COMMIT');

      // Check for pending travel requests that need recalculation
      await this.recalculatePendingRequests(command.id);

      // Transform snake_case to camelCase for API response
      return {
        id: updatedEmployee.id,
        cognitoUserId: updatedEmployee.cognito_user_id,
        email: updatedEmployee.email,
        firstName: updatedEmployee.first_name,
        lastName: updatedEmployee.last_name,
        employeeId: updatedEmployee.employee_id,
        homeStreet: updatedEmployee.home_street,
        homeCity: updatedEmployee.home_city,
        homePostalCode: updatedEmployee.home_postal_code,
        homeCountry: updatedEmployee.home_country,
        homeLocation: coordinates,
        createdAt: updatedEmployee.created_at,
        updatedAt: updatedEmployee.updated_at,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async geocodeAddress(address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  }): Promise<GeocodeResult> {
    return await this.geocodingService.geocodeAddress(address);
  }

  private async recalculatePendingRequests(employeeId: string) {
    logger.info('Checking for pending requests to recalculate', { employeeId });

    const pendingRequests = await db.query(
      `
      SELECT id, subproject_id FROM travel_requests 
      WHERE employee_id = $1 AND status = 'pending'
    `,
      [employeeId]
    );

    if (pendingRequests.rows.length > 0) {
      logger.info('Found pending requests for recalculation', {
        count: pendingRequests.rows.length,
        employeeId,
      });

      // TODO: Trigger recalculation service
      // This would call the distance calculation engine
    }
  }
}

const employeeService = new EmployeeServiceImpl();

// Get employee profile
export const getEmployeeProfile = validateRequest({
  pathParams: {
    id: { required: true, type: 'string' },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const employeeId = event.pathParameters?.id;
  const userContext = getUserContextFromEvent(event);

  logger.info('Getting employee profile', {
    employeeId,
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  // Verify user can access this employee's data
  if (userContext.sub !== employeeId && !userContext.isManager) {
    throw new ValidationError(
      'Access denied: can only view own profile or manager access required'
    );
  }

  const employee = await employeeService.getEmployeeByCognitoId(employeeId!);

  if (!employee) {
    throw new NotFoundError('Employee');
  }

  return formatResponse(200, employee, context.awsRequestId);
});

// Update employee address
export const updateEmployeeAddress = validateRequest({
  pathParams: {
    id: { required: true, type: 'string' },
  },
  body: {
    homeStreet: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    homeCity: { required: true, type: 'string', minLength: 1, maxLength: 100 },
    homePostalCode: {
      required: true,
      type: 'string',
      pattern: /^[0-9]{4}$/, // Swiss postal code format
    },
    homeCountry: {
      required: true,
      type: 'string',
      enum: ['Switzerland', 'Germany', 'France', 'Italy', 'Austria'],
    },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const cognitoUserId = event.pathParameters?.id;
  const body = JSON.parse(event.body!);
  const userContext = getUserContextFromEvent(event);

  logger.info('Updating employee address', {
    cognitoUserId,
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  // Verify user can update this employee's data
  if (userContext.sub !== cognitoUserId && !userContext.isManager) {
    throw new ValidationError(
      'Access denied: can only update own profile or manager access required'
    );
  }

  // First, get the employee by Cognito ID to get the actual database ID
  const employee = await employeeService.getEmployeeByCognitoId(cognitoUserId!);

  if (!employee) {
    throw new NotFoundError('Employee');
  }

  const command: UpdateEmployeeAddressCommand = {
    id: employee.id, // Use the actual database ID, not the Cognito ID
    home_street: body.homeStreet,
    home_city: body.homeCity,
    home_postal_code: body.homePostalCode,
    home_country: body.homeCountry,
  };

  const updatedEmployee = await employeeService.updateEmployeeAddress(command);

  logger.info('Employee address updated successfully', {
    cognitoUserId,
    employeeDbId: employee.id,
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  return formatResponse(200, updatedEmployee, context.awsRequestId);
});

// Get all managers for dropdown selection
export const getManagers = validateRequest({})(async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromEvent(event);

  logger.info('Getting managers list', {
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  // Query for all employees who are managers
  const result = await db.query(`
      SELECT 
        cognito_user_id as id,
        CONCAT(first_name, ' ', last_name) as name,
        employee_id
      FROM employees 
      WHERE employee_id LIKE 'MGR-%'
      AND is_active = true
      ORDER BY first_name, last_name
    `);

  const managers = result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    employeeId: row.employee_id, // Already using snake_case alias from SQL query
  }));

  return formatResponse(200, { managers }, context.awsRequestId);
});
