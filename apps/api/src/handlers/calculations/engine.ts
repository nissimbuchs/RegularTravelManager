import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../../middleware/logger';
import { formatResponse } from '../../middleware/response-formatter';
import { ValidationError, NotFoundError } from '../../middleware/error-handler';
import { validateRequest } from '../../middleware/request-validator';
import { db } from '../../database/connection';
import {
  CalculationService,
  DistanceCalculationRequest,
  AllowanceCalculationRequest,
  TravelCostCalculationRequest,
  CalculationResult,
  CalculationAuditRecord,
  GeographicCoordinates,
  CacheInvalidationRequest,
} from '../../../../domains/calculation-engine/CalculationService';
import { getUserContextFromEvent } from '../auth/auth-utils';

class CalculationServiceImpl implements CalculationService {
  async calculateDistance(request: DistanceCalculationRequest): Promise<number> {
    logger.info('Calculating distance', {
      employeeLocation: request.employeeLocation,
      subprojectLocation: request.subprojectLocation,
      useCache: request.useCache,
    });

    const employeePoint = `POINT(${request.employeeLocation.longitude} ${request.employeeLocation.latitude})`;
    const subprojectPoint = `POINT(${request.subprojectLocation.longitude} ${request.subprojectLocation.latitude})`;

    try {
      let distance: number;

      if (request.useCache !== false) {
        // Try cached calculation first
        const cacheResult = await db.query(
          `
          SELECT get_cached_distance(
            ST_GeomFromText($1, 4326),
            ST_GeomFromText($2, 4326)
          ) as distance
        `,
          [employeePoint, subprojectPoint]
        );

        distance = parseFloat(cacheResult.rows[0].distance);
      } else {
        // Direct calculation without cache
        const result = await db.query(
          `
          SELECT calculate_travel_distance(
            ST_GeomFromText($1, 4326),
            ST_GeomFromText($2, 4326)
          ) as distance
        `,
          [employeePoint, subprojectPoint]
        );

        distance = parseFloat(result.rows[0].distance);
      }

      logger.info('Distance calculated successfully', {
        distance,
        cached: request.useCache !== false,
      });

      return distance;
    } catch (error) {
      logger.error('Distance calculation failed', {
        error: error.message,
        employeeLocation: request.employeeLocation,
        subprojectLocation: request.subprojectLocation,
      });
      throw new ValidationError(`Distance calculation failed: ${error.message}`);
    }
  }

  async calculateAllowance(request: AllowanceCalculationRequest): Promise<number> {
    logger.info('Calculating allowance', {
      distanceKm: request.distanceKm,
      costPerKm: request.costPerKm,
      days: request.days,
    });

    try {
      const result = await db.query(
        `
        SELECT calculate_daily_allowance($1, $2) as allowance
      `,
        [request.distanceKm, request.costPerKm]
      );

      let allowance = parseFloat(result.rows[0].allowance);

      // Apply multi-day multiplier if specified
      if (request.days && request.days > 1) {
        allowance = allowance * request.days;
        // Round to 2 decimal places for CHF
        allowance = Math.round(allowance * 100) / 100;
      }

      logger.info('Allowance calculated successfully', {
        allowance,
        days: request.days,
      });

      return allowance;
    } catch (error) {
      logger.error('Allowance calculation failed', {
        error: error.message,
        distanceKm: request.distanceKm,
        costPerKm: request.costPerKm,
      });
      throw new ValidationError(`Allowance calculation failed: ${error.message}`);
    }
  }

  async calculateTravelCost(request: TravelCostCalculationRequest): Promise<CalculationResult> {
    logger.info('Calculating travel cost', {
      employeeId: request.employeeId,
      subprojectId: request.subprojectId,
      costPerKm: request.costPerKm,
    });

    const calculationTimestamp = new Date();
    const employeePoint = `POINT(${request.employeeLocation.longitude} ${request.employeeLocation.latitude})`;
    const subprojectPoint = `POINT(${request.subprojectLocation.longitude} ${request.subprojectLocation.latitude})`;

    try {
      // Calculate distance and allowance in single query
      const result = await db.query(
        `
        SELECT * FROM calculate_travel_cost(
          ST_GeomFromText($1, 4326),
          ST_GeomFromText($2, 4326),
          $3
        )
      `,
        [employeePoint, subprojectPoint, request.costPerKm]
      );

      const calculation = result.rows[0];
      const distanceKm = parseFloat(calculation.distance_km);
      const dailyAllowanceChf = parseFloat(calculation.daily_allowance_chf);

      // Calculate weekly and monthly estimates
      const weeklyAllowanceChf = Math.round(dailyAllowanceChf * 5 * 100) / 100; // 5 workdays
      const monthlyAllowanceChf = Math.round(dailyAllowanceChf * 22 * 100) / 100; // ~22 workdays/month

      // Create audit record
      await this.createAuditRecord({
        calculationType: 'travel_cost',
        employeeId: request.employeeId,
        subprojectId: request.subprojectId,
        employeeLocation: request.employeeLocation,
        subprojectLocation: request.subprojectLocation,
        costPerKm: request.costPerKm,
        distanceKm,
        dailyAllowanceChf,
        calculationTimestamp,
        calculationVersion: '1.0',
        requestContext: request.requestContext,
      });

      const calculationResult: CalculationResult = {
        distanceKm,
        dailyAllowanceChf,
        weeklyAllowanceChf,
        monthlyAllowanceChf,
        calculationTimestamp,
        cacheUsed: true, // Cache is used in calculate function
      };

      logger.info('Travel cost calculated successfully', calculationResult);

      return calculationResult;
    } catch (error) {
      logger.error('Travel cost calculation failed', {
        error: error.message,
        employeeId: request.employeeId,
        subprojectId: request.subprojectId,
      });
      throw new ValidationError(`Travel cost calculation failed: ${error.message}`);
    }
  }

  async invalidateCache(request: CacheInvalidationRequest): Promise<number> {
    logger.info('Invalidating calculation cache', request);

    try {
      let deletedCount = 0;

      if (request.location) {
        const locationPoint = `POINT(${request.location.longitude} ${request.location.latitude})`;
        const result = await db.query(
          `
          SELECT invalidate_distance_cache(ST_GeomFromText($1, 4326)) as deleted_count
        `,
          [locationPoint]
        );
        deletedCount = parseInt(result.rows[0].deleted_count);
      }

      if (request.employeeId) {
        // Invalidate cache for all calculations involving this employee
        const employeeResult = await db.query(
          `
          DELETE FROM calculation_cache cc
          WHERE EXISTS (
            SELECT 1 FROM calculation_audit ca
            WHERE ca.employee_id = $1
              AND ST_Equals(ca.employee_location, cc.employee_location)
          )
        `,
          [request.employeeId]
        );
        deletedCount += employeeResult.rowCount || 0;
      }

      if (request.subprojectId) {
        // Invalidate cache for all calculations involving this subproject
        const subprojectResult = await db.query(
          `
          DELETE FROM calculation_cache cc
          WHERE EXISTS (
            SELECT 1 FROM calculation_audit ca
            WHERE ca.subproject_id = $1
              AND ST_Equals(ca.subproject_location, cc.subproject_location)
          )
        `,
          [request.subprojectId]
        );
        deletedCount += subprojectResult.rowCount || 0;
      }

      logger.info('Cache invalidated successfully', { deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Cache invalidation failed', { error: error.message });
      throw new ValidationError(`Cache invalidation failed: ${error.message}`);
    }
  }

  async getCalculationAudit(filters: {
    employeeId?: string;
    subprojectId?: string;
    startDate?: Date;
    endDate?: Date;
    calculationType?: string;
    limit?: number;
  }): Promise<CalculationAuditRecord[]> {
    logger.info('Retrieving calculation audit records', filters);

    const whereClauses = [];
    const values = [];
    let paramIndex = 1;

    if (filters.employeeId) {
      whereClauses.push(`employee_id = $${paramIndex++}`);
      values.push(filters.employeeId);
    }

    if (filters.subprojectId) {
      whereClauses.push(`subproject_id = $${paramIndex++}`);
      values.push(filters.subprojectId);
    }

    if (filters.startDate) {
      whereClauses.push(`calculation_timestamp >= $${paramIndex++}`);
      values.push(filters.startDate.toISOString());
    }

    if (filters.endDate) {
      whereClauses.push(`calculation_timestamp <= $${paramIndex++}`);
      values.push(filters.endDate.toISOString());
    }

    if (filters.calculationType) {
      whereClauses.push(`calculation_type = $${paramIndex++}`);
      values.push(filters.calculationType);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const limitClause = filters.limit ? `LIMIT ${filters.limit}` : 'LIMIT 100';

    try {
      const result = await db.query(
        `
        SELECT 
          id,
          calculation_type,
          employee_id,
          subproject_id,
          ST_X(employee_location) as employee_longitude,
          ST_Y(employee_location) as employee_latitude,
          ST_X(subproject_location) as subproject_longitude,
          ST_Y(subproject_location) as subproject_latitude,
          cost_per_km,
          distance_km,
          daily_allowance_chf,
          calculation_timestamp,
          calculation_version,
          request_context
        FROM calculation_audit
        ${whereClause}
        ORDER BY calculation_timestamp DESC
        ${limitClause}
      `,
        values
      );

      const auditRecords: CalculationAuditRecord[] = result.rows.map(row => ({
        id: row.id,
        calculationType: row.calculation_type,
        employeeId: row.employee_id,
        subprojectId: row.subproject_id,
        employeeLocation: {
          latitude: parseFloat(row.employee_latitude),
          longitude: parseFloat(row.employee_longitude),
        },
        subprojectLocation:
          row.subproject_latitude && row.subproject_longitude
            ? {
                latitude: parseFloat(row.subproject_latitude),
                longitude: parseFloat(row.subproject_longitude),
              }
            : undefined,
        costPerKm: row.cost_per_km ? parseFloat(row.cost_per_km) : undefined,
        distanceKm: parseFloat(row.distance_km),
        dailyAllowanceChf: parseFloat(row.daily_allowance_chf),
        calculationTimestamp: new Date(row.calculation_timestamp),
        calculationVersion: row.calculation_version,
        requestContext: row.request_context,
      }));

      logger.info('Calculation audit retrieved successfully', {
        recordCount: auditRecords.length,
      });

      return auditRecords;
    } catch (error) {
      logger.error('Calculation audit retrieval failed', { error: error.message });
      throw new ValidationError(`Calculation audit retrieval failed: ${error.message}`);
    }
  }

  async cleanupExpiredCache(): Promise<number> {
    logger.info('Cleaning up expired cache entries');

    try {
      const result = await db.query('SELECT cleanup_expired_cache() as deleted_count');
      const deletedCount = parseInt(result.rows[0].deleted_count);

      logger.info('Expired cache cleanup completed', { deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Cache cleanup failed', { error: error.message });
      throw new ValidationError(`Cache cleanup failed: ${error.message}`);
    }
  }

  private async createAuditRecord(record: Omit<CalculationAuditRecord, 'id'>): Promise<void> {
    const employeePoint = `POINT(${record.employeeLocation.longitude} ${record.employeeLocation.latitude})`;
    const subprojectPoint = record.subprojectLocation
      ? `POINT(${record.subprojectLocation.longitude} ${record.subprojectLocation.latitude})`
      : null;

    await db.query(
      `
      INSERT INTO calculation_audit (
        calculation_type,
        employee_id,
        subproject_id,
        employee_location,
        subproject_location,
        cost_per_km,
        distance_km,
        daily_allowance_chf,
        calculation_timestamp,
        calculation_version,
        request_context
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
      [
        record.calculationType,
        record.employeeId,
        record.subprojectId,
        `ST_GeomFromText('${employeePoint}', 4326)`,
        subprojectPoint ? `ST_GeomFromText('${subprojectPoint}', 4326)` : null,
        record.costPerKm,
        record.distanceKm,
        record.dailyAllowanceChf,
        record.calculationTimestamp.toISOString(),
        record.calculationVersion,
        record.requestContext ? JSON.stringify(record.requestContext) : null,
      ]
    );
  }
}

const calculationService = new CalculationServiceImpl();

// Calculate distance between two points
export const calculateDistance = validateRequest({
  body: {
    employeeLocation: {
      required: true,
      type: 'object',
      properties: {
        latitude: { required: true, type: 'number', min: -90, max: 90 },
        longitude: { required: true, type: 'number', min: -180, max: 180 },
      },
    },
    subprojectLocation: {
      required: true,
      type: 'object',
      properties: {
        latitude: { required: true, type: 'number', min: -90, max: 90 },
        longitude: { required: true, type: 'number', min: -180, max: 180 },
      },
    },
    useCache: { required: false, type: 'boolean' },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromEvent(event);
  const body = JSON.parse(event.body!);

  logger.info('Distance calculation request', {
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  const request: DistanceCalculationRequest = {
    employeeLocation: body.employeeLocation,
    subprojectLocation: body.subprojectLocation,
    useCache: body.useCache,
  };

  const distance = await calculationService.calculateDistance(request);

  return formatResponse(
    200,
    {
      distanceKm: distance,
      calculationTimestamp: new Date().toISOString(),
    },
    context.awsRequestId
  );
});

// Calculate travel allowance
export const calculateAllowance = validateRequest({
  body: {
    distanceKm: { required: true, type: 'number', min: 0 },
    costPerKm: { required: true, type: 'number', min: 0.01 },
    days: { required: false, type: 'number', min: 1, max: 365 },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromEvent(event);
  const body = JSON.parse(event.body!);

  logger.info('Allowance calculation request', {
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  const request: AllowanceCalculationRequest = {
    distanceKm: body.distanceKm,
    costPerKm: body.costPerKm,
    days: body.days,
  };

  const allowance = await calculationService.calculateAllowance(request);

  return formatResponse(
    200,
    {
      allowanceChf: allowance,
      distanceKm: body.distanceKm,
      costPerKm: body.costPerKm,
      days: body.days || 1,
      calculationTimestamp: new Date().toISOString(),
    },
    context.awsRequestId
  );
});

// Calculate complete travel cost for a request
export const calculateTravelCost = validateRequest({
  body: {
    employeeId: { required: true, type: 'string' },
    subprojectId: { required: true, type: 'string' },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromEvent(event);
  const body = JSON.parse(event.body!);

  logger.info('Travel cost calculation request', {
    employeeId: body.employeeId,
    subprojectId: body.subprojectId,
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  // Get employee location
  const employeeResult = await db.query(
    `
    SELECT 
      ST_X(home_location) as longitude,
      ST_Y(home_location) as latitude
    FROM employees 
    WHERE id = $1
  `,
    [body.employeeId]
  );

  if (employeeResult.rows.length === 0) {
    throw new NotFoundError('Employee');
  }

  const employeeLocation: GeographicCoordinates = {
    latitude: parseFloat(employeeResult.rows[0].latitude),
    longitude: parseFloat(employeeResult.rows[0].longitude),
  };

  // Get subproject location and cost rate
  const subprojectResult = await db.query(
    `
    SELECT 
      s.cost_per_km,
      p.default_cost_per_km,
      ST_X(s.location_coordinates) as longitude,
      ST_Y(s.location_coordinates) as latitude
    FROM subprojects s
    JOIN projects p ON s.project_id = p.id
    WHERE s.id = $1 AND s.is_active = true
  `,
    [body.subprojectId]
  );

  if (subprojectResult.rows.length === 0) {
    throw new NotFoundError('Subproject');
  }

  const subprojectData = subprojectResult.rows[0];
  const subprojectLocation: GeographicCoordinates = {
    latitude: parseFloat(subprojectData.latitude),
    longitude: parseFloat(subprojectData.longitude),
  };

  // Use subproject rate or fall back to project default
  const costPerKm = subprojectData.cost_per_km || subprojectData.default_cost_per_km;

  const request: TravelCostCalculationRequest = {
    employeeId: body.employeeId,
    subprojectId: body.subprojectId,
    employeeLocation,
    subprojectLocation,
    costPerKm,
    requestContext: {
      requestId: context.awsRequestId,
      userId: userContext.sub,
      timestamp: new Date(),
    },
  };

  const result = await calculationService.calculateTravelCost(request);

  return formatResponse(200, result, context.awsRequestId);
});

// Get calculation audit trail
export const getCalculationAudit = validateRequest({
  queryParams: {
    employeeId: { required: false, type: 'string' },
    subprojectId: { required: false, type: 'string' },
    startDate: { required: false, type: 'string' },
    endDate: { required: false, type: 'string' },
    calculationType: { required: false, type: 'string' },
    limit: { required: false, type: 'number', min: 1, max: 1000 },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromEvent(event);
  const params = event.queryStringParameters || {};

  logger.info('Calculation audit retrieval request', {
    filters: params,
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  const filters = {
    employeeId: params.employeeId,
    subprojectId: params.subprojectId,
    startDate: params.startDate ? new Date(params.startDate) : undefined,
    endDate: params.endDate ? new Date(params.endDate) : undefined,
    calculationType: params.calculationType,
    limit: params.limit ? parseInt(params.limit) : 50,
  };

  const auditRecords = await calculationService.getCalculationAudit(filters);

  return formatResponse(
    200,
    {
      auditRecords,
      filters: {
        ...filters,
        startDate: filters.startDate?.toISOString(),
        endDate: filters.endDate?.toISOString(),
      },
    },
    context.awsRequestId
  );
});

// Invalidate calculation cache
export const invalidateCalculationCache = validateRequest({
  body: {
    employeeId: { required: false, type: 'string' },
    subprojectId: { required: false, type: 'string' },
    location: {
      required: false,
      type: 'object',
      properties: {
        latitude: { required: true, type: 'number', min: -90, max: 90 },
        longitude: { required: true, type: 'number', min: -180, max: 180 },
      },
    },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromEvent(event);
  const body = JSON.parse(event.body!);

  logger.info('Cache invalidation request', {
    request: body,
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  const request: CacheInvalidationRequest = {
    employeeId: body.employeeId,
    subprojectId: body.subprojectId,
    location: body.location,
  };

  const deletedCount = await calculationService.invalidateCache(request);

  return formatResponse(
    200,
    {
      deletedCount,
      message: `Invalidated ${deletedCount} cache entries`,
    },
    context.awsRequestId
  );
});

// Cleanup expired cache entries (maintenance endpoint)
export const cleanupExpiredCache = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const userContext = getUserContextFromEvent(event);

  logger.info('Cache cleanup request', {
    requestedBy: userContext.sub,
    requestId: context.awsRequestId,
  });

  const deletedCount = await calculationService.cleanupExpiredCache();

  return formatResponse(
    200,
    {
      deletedCount,
      message: `Cleaned up ${deletedCount} expired cache entries`,
    },
    context.awsRequestId
  );
};
