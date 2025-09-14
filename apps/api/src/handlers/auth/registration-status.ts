import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { logger } from '../../middleware/logger';
import { createResponse } from '../../utils/response';
import { RegistrationService } from '../../services/registration.service';
import { CognitoRegistrationService } from '../../services/cognito-registration.service';
import { RegistrationStatusResponse } from '@rtm/shared';

/**
 * Lambda handler for checking registration status
 * Returns verification and account status for a given email
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext.requestId;

  try {
    logger.info('Registration status check request received', {
      requestId,
      sourceIp: event.requestContext.identity.sourceIp,
    });

    // Get email from query parameters
    const email = event.queryStringParameters?.email;

    if (!email) {
      return createResponse(400, {
        error: {
          code: 'MISSING_EMAIL',
          message: 'Email parameter is required',
          timestamp: new Date().toISOString(),
          requestId,
        },
      });
    }

    // Validate email format
    const emailSchema = z.string().email('Invalid email format');

    let validatedEmail: string;
    try {
      validatedEmail = emailSchema.parse(email.toLowerCase());
    } catch (error) {
      return createResponse(400, {
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid email format',
          timestamp: new Date().toISOString(),
          requestId,
        },
      });
    }

    // Initialize services
    const registrationService = new RegistrationService();
    const cognitoService = new CognitoRegistrationService();

    // Get registration status from database
    const dbStatus = await registrationService.getRegistrationStatus(validatedEmail);

    // Get Cognito user status
    const cognitoUserDetails = await cognitoService.getUserDetails(validatedEmail);

    // Determine overall status
    const response: RegistrationStatusResponse = {
      email: validatedEmail,
      isVerified: dbStatus.isVerified,
      registrationComplete: dbStatus.registrationComplete && !!cognitoUserDetails?.enabled,
      accountEnabled: dbStatus.accountEnabled && !!cognitoUserDetails?.enabled,
    };

    logger.info('Registration status check completed', {
      email: validatedEmail,
      status: response,
      cognitoExists: !!cognitoUserDetails,
      cognitoEnabled: cognitoUserDetails?.enabled,
      requestId,
    });

    return createResponse(200, { data: response });
  } catch (error) {
    logger.error('Registration status check failed', {
      error: error.message,
      stack: error.stack,
      requestId,
    });

    return createResponse(500, {
      error: {
        code: 'STATUS_CHECK_ERROR',
        message:
          'Failed to check registration status due to a server error. Please try again later.',
        timestamp: new Date().toISOString(),
        requestId,
      },
    });
  }
};
