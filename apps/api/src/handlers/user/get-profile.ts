import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../../middleware/logger';
import { formatResponse } from '../../middleware/response-formatter';
import { NotFoundError } from '../../middleware/error-handler';
import { getUserContextFromEvent } from '../auth/auth-utils';
import { db } from '../../database/connection';
import { UserProfile } from '@rtm/shared';

/**
 * GET /api/user/profile - Get current user's profile
 * GET /api/admin/users/{userId}/profile - Admin get specific user's profile
 */
export const getProfileHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const userContext = getUserContextFromEvent(event);
    const isAdminRequest = event.path.includes('/admin/');

    let targetUserId: string;

    if (isAdminRequest) {
      // Admin accessing another user's profile
      if (userContext.role !== 'administrator') {
        return formatResponse(
          403,
          {
            code: 'FORBIDDEN',
            message: 'Only administrators can access other user profiles',
          },
          context.awsRequestId
        );
      }
      targetUserId = event.pathParameters?.userId || '';
    } else {
      // User accessing their own profile
      targetUserId = userContext.cognitoUserId;
    }

    logger.info('Fetching user profile', {
      targetUserId,
      requestedBy: userContext.cognitoUserId,
      isAdminRequest,
    });

    const result = await db.query(
      `
      SELECT
        e.id,
        e.cognito_user_id,
        e.email,
        e.first_name,
        e.last_name,
        e.employee_id as employee_number,
        e.phone_number,
        e.role,
        e.status,
        e.home_address,
        e.home_city,
        e.home_postal_code,
        e.home_country,
        ST_X(e.home_coordinates::geometry) as longitude,
        ST_Y(e.home_coordinates::geometry) as latitude,
        e.notification_preferences,
        e.privacy_settings,
        e.profile_updated_at,
        e.email_verified_at,
        e.last_login_at,
        e.created_at,
        e.updated_at
      FROM employees e
      WHERE e.cognito_user_id = $1
    `,
      [targetUserId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User profile');
    }

    const row = result.rows[0];

    const profile: UserProfile = {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phoneNumber: row.phone_number,
      employeeNumber: row.employee_number,
      role: row.role,
      status: row.status,
      homeAddress: {
        street: row.home_address,
        city: row.home_city,
        postalCode: row.home_postal_code,
        country: row.home_country || 'Switzerland',
      },
      homeCoordinates:
        row.latitude && row.longitude
          ? {
              latitude: parseFloat(row.latitude),
              longitude: parseFloat(row.longitude),
            }
          : undefined,
      notificationPreferences: row.notification_preferences || {
        email: true,
        requestUpdates: true,
        weeklyDigest: false,
        maintenanceAlerts: true,
      },
      privacySettings: row.privacy_settings || {
        profileVisibility: 'team',
        allowAnalytics: true,
        shareLocationData: true,
        allowManagerAccess: true,
        dataRetentionConsent: true,
      },
      lastUpdatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
      emailVerifiedAt: row.email_verified_at,
      profileUpdatedAt: row.profile_updated_at,
    };

    logger.info('User profile fetched successfully', {
      userId: targetUserId,
      hasAddress: !!row.home_address,
      hasCoordinates: !!(row.latitude && row.longitude),
    });

    return formatResponse(200, profile, context.awsRequestId);
  } catch (error) {
    logger.error('Failed to fetch user profile', {
      error: error.message,
      stack: error.stack,
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

    return formatResponse(
      500,
      {
        code: 'PROFILE_FETCH_ERROR',
        message: 'Failed to retrieve user profile',
      },
      context.awsRequestId
    );
  }
};
