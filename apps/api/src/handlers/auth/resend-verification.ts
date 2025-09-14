import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { logger } from '../../middleware/logger';
import { createResponse } from '../../utils/response';
import { validateRequestBody } from '../../utils/validation';
import { checkRateLimit, RateLimitConfigs } from '../../middleware/rate-limit';
import { applySecurityHeaders } from '../../middleware/security-headers';
import { RegistrationService } from '../../services/registration.service';
import { CognitoRegistrationService } from '../../services/cognito-registration.service';
import { EmailService } from '../../services/email.service';
import { ResendVerificationRequest, ResendVerificationResponse } from '@rtm/shared';

// Validation schema for resend verification request
const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
});

/**
 * Lambda handler for resending verification email
 * Generates new token and sends new verification email
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext.requestId;

  try {
    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return applySecurityHeaders(
        {
          statusCode: 200,
          headers: {},
          body: '',
        },
        event.headers.origin
      );
    }

    logger.info('Resend verification request received', {
      requestId,
      sourceIp: event.requestContext.identity.sourceIp,
    });

    // Apply rate limiting
    const rateLimitCheck = checkRateLimit(event, RateLimitConfigs.RESEND_VERIFICATION);
    if (!rateLimitCheck.allowed) {
      logger.warn('Resend verification rate limit exceeded', {
        requestId,
        sourceIp: event.requestContext.identity.sourceIp,
        resetTime: new Date(rateLimitCheck.resetTime).toISOString(),
      });

      return applySecurityHeaders(
        createResponse(429, {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: rateLimitCheck.error,
            timestamp: new Date().toISOString(),
            requestId,
          },
        }),
        event.headers.origin
      );
    }

    // Validate request body
    const resendData = validateRequestBody(
      event,
      resendVerificationSchema
    ) as ResendVerificationRequest;

    // Initialize services
    const registrationService = new RegistrationService();
    const cognitoService = new CognitoRegistrationService();
    const emailService = new EmailService();

    // Check if email exists in registration system
    const registrationStatus = await registrationService.getRegistrationStatus(resendData.email);

    // If already verified, don't resend
    if (registrationStatus.isVerified) {
      logger.info('Verification email requested for already verified account', {
        email: resendData.email,
        requestId,
      });

      const response: ResendVerificationResponse = {
        success: true,
        message: 'Your email has already been verified. You can now log in to your account.',
      };

      return applySecurityHeaders(createResponse(200, { data: response }), event.headers.origin);
    }

    // Check if user exists in Cognito
    const cognitoUserDetails = await cognitoService.getUserDetails(resendData.email);

    if (!cognitoUserDetails) {
      logger.warn('Resend verification requested for non-existent user', {
        email: resendData.email,
        requestId,
      });

      // Don't reveal whether user exists or not - return success message for security
      const response: ResendVerificationResponse = {
        success: true,
        message:
          'If an account exists with this email address, a new verification email has been sent.',
      };

      return applySecurityHeaders(createResponse(200, { data: response }), event.headers.origin);
    }

    // If user is already enabled in Cognito, they shouldn't need verification
    if (cognitoUserDetails.enabled) {
      logger.info('Resend verification requested for already enabled user', {
        email: resendData.email,
        requestId,
      });

      const response: ResendVerificationResponse = {
        success: true,
        message: 'Your account is already active. You can log in to your account.',
      };

      return applySecurityHeaders(createResponse(200, { data: response }), event.headers.origin);
    }

    try {
      // Generate new verification token
      const tokenData = registrationService.generateVerificationToken();

      // Update/create verification token in database
      await registrationService.createVerificationToken(
        resendData.email,
        tokenData.token,
        tokenData.expiresAt
      );

      // Extract first name from Cognito user attributes or use fallback
      const firstName = cognitoUserDetails.email?.split('@')[0] || 'User';

      // Send new verification email
      const emailSent = await emailService.sendVerificationEmail(
        resendData.email,
        firstName,
        tokenData.token
      );

      if (!emailSent) {
        throw new Error('Failed to send verification email');
      }

      logger.info('Verification email resent successfully', {
        email: resendData.email,
        expiresAt: tokenData.expiresAt.toISOString(),
        requestId,
      });

      const response: ResendVerificationResponse = {
        success: true,
        message: `A new verification email has been sent to ${resendData.email}. Please check your email and click the verification link. The link will expire in 24 hours.`,
      };

      return applySecurityHeaders(createResponse(200, { data: response }), event.headers.origin);
    } catch (error) {
      logger.error('Failed to resend verification email', {
        error: error.message,
        email: resendData.email,
        requestId,
      });

      return applySecurityHeaders(
        createResponse(500, {
          error: {
            code: 'RESEND_ERROR',
            message:
              'Failed to resend verification email due to a server error. Please try again later.',
            timestamp: new Date().toISOString(),
            requestId,
          },
        }),
        event.headers.origin
      );
    }
  } catch (error) {
    logger.error('Resend verification failed', {
      error: error.message,
      stack: error.stack,
      requestId,
    });

    if (error.name === 'ZodError') {
      return applySecurityHeaders(
        createResponse(400, {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid resend request data',
            details: error.errors,
            timestamp: new Date().toISOString(),
            requestId,
          },
        }),
        event.headers.origin
      );
    }

    return applySecurityHeaders(
      createResponse(500, {
        error: {
          code: 'RESEND_ERROR',
          message:
            'Failed to resend verification email due to a server error. Please try again later.',
          timestamp: new Date().toISOString(),
          requestId,
        },
      }),
      event.headers.origin
    );
  }
};
