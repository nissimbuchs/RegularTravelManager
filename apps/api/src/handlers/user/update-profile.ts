import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../../middleware/logger';
import { formatResponse } from '../../middleware/response-formatter';
import { ValidationError, NotFoundError } from '../../middleware/error-handler';
import { validateRequest } from '../../middleware/request-validator';
import { getUserContextFromEvent } from '../auth/auth-utils';
import { db } from '../../database/connection';
import { GeocodingService } from '../../services/geocoding-service';
import {
  sanitizeInput,
  sanitizeObject,
  validateNotificationPreferences,
  validatePrivacySettings,
} from '../../utils/sanitization';
import {
  UserProfile,
  UserProfileUpdateRequest,
  AdminUserProfileUpdateRequest,
  ProfileUpdateResponse,
  AddressChangeImpact,
  DistanceChange,
} from '@rtm/shared';

const geocodingService = new GeocodingService();

/**
 * PUT /api/user/profile - Update current user's profile
 * PUT /api/admin/users/{userId} - Admin update any user's profile
 */
export const updateProfileHandler = validateRequest({
  body: {
    firstName: { required: false, type: 'string', minLength: 1, maxLength: 100 },
    lastName: { required: false, type: 'string', minLength: 1, maxLength: 100 },
    phoneNumber: { required: false, type: 'string', pattern: /^[+0-9\s\-()]+$/ },
    homeAddress: {
      required: false,
      type: 'object',
    },
    notificationPreferences: { required: false, type: 'object' },
    privacySettings: { required: false, type: 'object' },
    // Admin-only fields
    email: { required: false, type: 'string' },
    employeeNumber: { required: false, type: 'string' },
    role: { required: false, type: 'string', enum: ['employee', 'manager', 'administrator'] },
    status: { required: false, type: 'string', enum: ['active', 'inactive', 'pending'] },
  },
})(async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const pool = await db.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userContext = getUserContextFromEvent(event);
    const isAdminRequest = event.path.includes('/admin/');
    const body = JSON.parse(event.body || '{}') as AdminUserProfileUpdateRequest;

    let targetUserId: string;

    if (isAdminRequest) {
      // Admin updating another user's profile
      if (!userContext.isAdmin) {
        await client.query('ROLLBACK');
        return formatResponse(
          403,
          {
            code: 'FORBIDDEN',
            message: 'Only administrators can update other user profiles',
          },
          context.awsRequestId
        );
      }
      targetUserId = event.pathParameters?.userId || '';
    } else {
      // User updating their own profile - restrict to non-admin fields
      targetUserId = userContext.sub;
      if (body.email || body.employeeNumber || body.role || body.status) {
        await client.query('ROLLBACK');
        return formatResponse(
          403,
          {
            code: 'FORBIDDEN',
            message: 'Cannot update restricted fields. Contact administrator for changes.',
          },
          context.awsRequestId
        );
      }
    }

    logger.info('Updating user profile', {
      targetUserId,
      requestedBy: userContext.sub,
      isAdminRequest,
      fieldsToUpdate: Object.keys(body),
    });

    // Get current user data for audit trail
    const currentResult = await client.query('SELECT * FROM employees WHERE cognito_user_id = $1', [
      targetUserId,
    ]);

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new NotFoundError('User profile');
    }

    const currentUser = currentResult.rows[0];
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;
    let addressChanged = false;
    let newCoordinates = null;

    // Build update query dynamically with sanitization
    if (body.firstName !== undefined) {
      const sanitizedFirstName = sanitizeInput(body.firstName);
      updateFields.push(`first_name = $${paramIndex++}`);
      updateValues.push(sanitizedFirstName);
      oldValues.firstName = currentUser.first_name;
      newValues.firstName = sanitizedFirstName;
    }

    if (body.lastName !== undefined) {
      const sanitizedLastName = sanitizeInput(body.lastName);
      updateFields.push(`last_name = $${paramIndex++}`);
      updateValues.push(sanitizedLastName);
      oldValues.lastName = currentUser.last_name;
      newValues.lastName = sanitizedLastName;
    }

    if (body.phoneNumber !== undefined) {
      const sanitizedPhone = sanitizeInput(body.phoneNumber);
      updateFields.push(`phone_number = $${paramIndex++}`);
      updateValues.push(sanitizedPhone || null);
      oldValues.phoneNumber = currentUser.phone_number;
      newValues.phoneNumber = sanitizedPhone;
    }

    // Handle address update with geocoding
    if (body.homeAddress) {
      addressChanged = true;
      const sanitizedAddress = sanitizeObject(body.homeAddress);
      const { street, city, postalCode, country } = sanitizedAddress;

      updateFields.push(`home_street = $${paramIndex++}`);
      updateValues.push(street);
      updateFields.push(`home_city = $${paramIndex++}`);
      updateValues.push(city);
      updateFields.push(`home_postal_code = $${paramIndex++}`);
      updateValues.push(postalCode);
      updateFields.push(`home_country = $${paramIndex++}`);
      updateValues.push(country || 'Switzerland');

      oldValues.homeAddress = {
        street: currentUser.home_street,
        city: currentUser.home_city,
        postalCode: currentUser.home_postal_code,
        country: currentUser.home_country,
      };
      newValues.homeAddress = body.homeAddress;

      // Geocode new address
      try {
        const geocodeResult = await geocodingService.geocodeAddress({
          street,
          city,
          postalCode,
          country: country || 'Switzerland',
        });

        newCoordinates = geocodeResult;
        updateFields.push(
          `home_location = ST_SetSRID(ST_MakePoint($${paramIndex++}, $${paramIndex++}), 4326)`
        );
        updateValues.push(geocodeResult.longitude, geocodeResult.latitude);

        logger.info('Address geocoding successful', {
          userId: targetUserId,
          coordinates: geocodeResult,
        });
      } catch (geocodeError) {
        logger.warn('Address geocoding failed', {
          error: geocodeError.message,
          userId: targetUserId,
          address: body.homeAddress,
        });
        // Continue without updating coordinates
      }
    }

    if (body.notificationPreferences !== undefined) {
      const validatedPrefs = validateNotificationPreferences(body.notificationPreferences);
      updateFields.push(`notification_preferences = $${paramIndex++}`);
      updateValues.push(JSON.stringify(validatedPrefs));
      oldValues.notificationPreferences = currentUser.notification_preferences;
      newValues.notificationPreferences = validatedPrefs;
    }

    if (body.privacySettings !== undefined) {
      const validatedSettings = validatePrivacySettings(body.privacySettings);
      updateFields.push(`privacy_settings = $${paramIndex++}`);
      updateValues.push(JSON.stringify(validatedSettings));
      oldValues.privacySettings = currentUser.privacy_settings;
      newValues.privacySettings = validatedSettings;
    }

    // Admin-only fields
    if (isAdminRequest && body.email !== undefined) {
      updateFields.push(`email = $${paramIndex++}`);
      updateValues.push(body.email);
      oldValues.email = currentUser.email;
      newValues.email = body.email;
    }

    if (isAdminRequest && body.employeeNumber !== undefined) {
      updateFields.push(`employee_id = $${paramIndex++}`);
      updateValues.push(body.employeeNumber);
      oldValues.employeeNumber = currentUser.employee_id;
      newValues.employeeNumber = body.employeeNumber;
    }

    if (isAdminRequest && body.role !== undefined) {
      updateFields.push(`role = $${paramIndex++}`);
      updateValues.push(body.role);
      oldValues.role = currentUser.role;
      newValues.role = body.role;
    }

    if (isAdminRequest && body.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(body.status);
      oldValues.status = currentUser.status;
      newValues.status = body.status;
    }

    if (updateFields.length === 0) {
      await client.query('ROLLBACK');
      return formatResponse(
        400,
        {
          code: 'NO_UPDATES',
          message: 'No fields to update',
        },
        context.awsRequestId
      );
    }

    // Add metadata fields
    updateFields.push(`profile_updated_at = CURRENT_TIMESTAMP`);
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add WHERE clause parameter
    updateValues.push(targetUserId);

    // Execute update
    const updateQuery = `
      UPDATE employees
      SET ${updateFields.join(', ')}
      WHERE cognito_user_id = $${paramIndex}
      RETURNING *,
        ST_X(home_location::geometry) as longitude,
        ST_Y(home_location::geometry) as latitude
    `;

    const updateResult = await client.query(updateQuery, updateValues);
    const updatedUser = updateResult.rows[0];

    // Create audit trail entry
    await client.query(
      `
      INSERT INTO employee_profile_history (
        employee_id,
        changed_fields,
        old_values,
        new_values,
        changed_by,
        changed_at,
        ip_address,
        user_agent
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7)
    `,
      [
        currentUser.id,
        JSON.stringify(Object.keys(newValues)),
        JSON.stringify(oldValues),
        JSON.stringify(newValues),
        userContext.sub,
        event.requestContext.identity?.sourceIp || null,
        event.headers['User-Agent'] || null,
      ]
    );

    // Calculate address change impact if applicable
    let addressChangeImpact: AddressChangeImpact | undefined;

    if (addressChanged && newCoordinates) {
      const impactResult = await client.query(
        `
        SELECT
          tr.id as request_id,
          tr.calculated_distance_km as old_distance,
          tr.calculated_allowance as old_allowance,
          p.name as project_name,
          sp.cost_per_km,
          tr.days_per_week,
          ST_Distance(
            ST_Transform(sp.location::geometry, 3857),
            ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 3857)
          ) / 1000 as new_distance
        FROM travel_requests tr
        JOIN subprojects sp ON tr.subproject_id = sp.id
        JOIN projects p ON sp.project_id = p.id
        WHERE tr.employee_id = $3
          AND tr.status = 'pending'
      `,
        [newCoordinates.longitude, newCoordinates.latitude, currentUser.id]
      );

      const distanceChanges: DistanceChange[] = impactResult.rows.map(row => {
        const newDistance = parseFloat(row.new_distance);
        const newAllowance = newDistance * row.cost_per_km * row.days_per_week * 4;
        const percentageChange = ((newDistance - row.old_distance) / row.old_distance) * 100;

        return {
          requestId: row.request_id,
          projectName: row.project_name,
          oldDistance: row.old_distance,
          newDistance,
          oldAllowance: row.old_allowance,
          newAllowance,
          percentageChange,
        };
      });

      const totalImpact = distanceChanges.reduce(
        (sum, change) => sum + (change.newAllowance - change.oldAllowance),
        0
      );

      addressChangeImpact = {
        affectedRequests: distanceChanges.length,
        distanceChanges,
        totalAllowanceImpact: totalImpact,
        requiresManagerNotification: Math.abs(totalImpact) > 100,
      };

      logger.info('Address change impact calculated', {
        userId: targetUserId,
        affectedRequests: addressChangeImpact.affectedRequests,
        totalImpact,
      });
    }

    await client.query('COMMIT');

    // Build response profile
    const profile: UserProfile = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.first_name,
      lastName: updatedUser.last_name,
      phoneNumber: updatedUser.phone_number,
      employeeNumber: updatedUser.employee_id,
      role: updatedUser.role,
      status: updatedUser.is_active ? 'active' : 'inactive',
      homeAddress: {
        street: updatedUser.home_street,
        city: updatedUser.home_city,
        postalCode: updatedUser.home_postal_code,
        country: updatedUser.home_country || 'Switzerland',
      },
      ...(updatedUser.latitude && updatedUser.longitude && {
        homeCoordinates: {
          latitude: parseFloat(updatedUser.latitude),
          longitude: parseFloat(updatedUser.longitude),
        },
      }),
      notificationPreferences: updatedUser.notification_preferences,
      privacySettings: updatedUser.privacy_settings,
      lastUpdatedAt: updatedUser.updated_at,
      profileUpdatedAt: updatedUser.profile_updated_at,
    };

    logger.info('User profile updated successfully', {
      userId: targetUserId,
      fieldsUpdated: Object.keys(newValues),
      addressChanged,
      hasImpact: !!addressChangeImpact,
    });

    // Return just the profile for user's own update endpoint
    // Frontend expects data to be the UserProfile directly
    if (!isAdminRequest) {
      return formatResponse(200, profile, context.awsRequestId);
    }

    // For admin requests, include additional impact information
    const response: ProfileUpdateResponse = {
      success: true,
      profile,
      ...(addressChangeImpact && { addressChangeImpact }),
    };

    return formatResponse(200, response, context.awsRequestId);
  } catch (error) {
    await client.query('ROLLBACK');

    logger.error('Failed to update user profile', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      requestId: context.awsRequestId,
    });

    if (error instanceof NotFoundError) {
      return formatResponse(
        404,
        {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found',
        },
        context.awsRequestId
      );
    }

    if (error instanceof ValidationError) {
      return formatResponse(
        400,
        {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
        context.awsRequestId
      );
    }

    return formatResponse(
      500,
      {
        code: 'PROFILE_UPDATE_ERROR',
        message: 'Failed to update user profile',
      },
      context.awsRequestId
    );
  } finally {
    client.release();
  }
});
