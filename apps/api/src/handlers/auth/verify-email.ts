import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { logger } from '../../middleware/logger';
import { createResponse } from '../../utils/response';
import { validateRequestBody } from '../../utils/validation';
import { RegistrationService } from '../../services/registration.service';
import { CognitoRegistrationService } from '../../services/cognito-registration.service';
import { EmailService } from '../../services/email.service';
import { VerifyEmailRequest, VerifyEmailResponse } from '@rtm/shared';
import { isLocalDevelopment } from '../../config/environment';

// Validation schema for email verification request
const verifyEmailSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  verificationToken: z.string().min(32, 'Invalid verification token format'),
});

/**
 * Lambda handler for email verification
 * Validates token and enables user account
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext.requestId;

  try {
    logger.info('Email verification request received', {
      requestId,
      sourceIp: event.requestContext.identity.sourceIp,
    });

    // Validate request body
    const verifyData = validateRequestBody(event, verifyEmailSchema) as VerifyEmailRequest;

    // Initialize services
    const registrationService = new RegistrationService();
    const emailService = new EmailService();

    const isLocalDev = isLocalDevelopment();
    let cognitoService: CognitoRegistrationService | null = null;

    if (!isLocalDev) {
      cognitoService = new CognitoRegistrationService();
    } else {
      logger.info('Local dev mode: Skipping Cognito service initialization', {
        email: verifyData.email,
      });
    }

    // Step 1: Validate verification token
    const isValidToken = await registrationService.validateVerificationToken(
      verifyData.email,
      verifyData.verificationToken
    );

    if (!isValidToken) {
      logger.warn('Invalid or expired verification token', {
        email: verifyData.email,
        requestId,
      });

      return createResponse(400, {
        error: {
          code: 'INVALID_TOKEN',
          message:
            'The verification token is invalid or has expired. Please request a new verification email.',
          timestamp: new Date().toISOString(),
          requestId,
        },
      });
    }

    // Step 2: Check if already verified
    const registrationStatus = await registrationService.getRegistrationStatus(verifyData.email);
    if (registrationStatus.isVerified) {
      logger.info('Email already verified', {
        email: verifyData.email,
        requestId,
      });

      const response: VerifyEmailResponse = {
        success: true,
        message: 'Your email has already been verified. You can now log in to your account.',
      };

      return createResponse(200, { data: response });
    }

    // Step 3: Get user details (from Cognito in production, from database in local dev)
    let cognitoUserDetails: any = null;
    let firstName = 'User'; // Default fallback

    if (isLocalDev) {
      // In local development, get user details from database
      logger.info('Local dev mode: Getting user details from database', {
        email: verifyData.email,
      });
      const employeeDetails = await registrationService.getEmployeeByEmail(verifyData.email);

      if (!employeeDetails) {
        logger.error('Employee not found during verification', {
          email: verifyData.email,
          requestId,
        });

        return createResponse(400, {
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User account not found. Please register again.',
            timestamp: new Date().toISOString(),
            requestId,
          },
        });
      }

      firstName = employeeDetails.first_name || verifyData.email.split('@')[0];
      cognitoUserDetails = { userId: employeeDetails.cognito_user_id, email: verifyData.email };
    } else {
      // Production mode: get details from Cognito
      cognitoUserDetails = await cognitoService!.getUserDetails(verifyData.email);

      if (!cognitoUserDetails) {
        logger.error('Cognito user not found during verification', {
          email: verifyData.email,
          requestId,
        });

        return createResponse(400, {
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User account not found. Please register again.',
            timestamp: new Date().toISOString(),
            requestId,
          },
        });
      }

      firstName = cognitoUserDetails.email?.split('@')[0] || 'User';
    }

    try {
      // Step 4: Mark email as verified in database and enable Cognito user
      const verificationSuccess = await registrationService.markEmailVerified(
        verifyData.email,
        verifyData.verificationToken
      );

      if (!verificationSuccess) {
        throw new Error('Failed to mark email as verified in database');
      }

      // Step 5: Enable Cognito user (skip in local development)
      if (!isLocalDev) {
        const cognitoEnableSuccess = await cognitoService!.enableUserAfterVerification(
          verifyData.email
        );

        if (!cognitoEnableSuccess) {
          throw new Error('Failed to enable user in Cognito');
        }
      } else {
        logger.info('Local dev mode: Skipping Cognito user enabling', { email: verifyData.email });
      }

      // Step 6: Send welcome email
      const welcomeEmailSent = await emailService.sendWelcomeEmail(verifyData.email, firstName);

      if (!welcomeEmailSent) {
        logger.warn('Failed to send welcome email, but verification succeeded', {
          email: verifyData.email,
          requestId,
        });
      }

      // Step 7: Clean up expired tokens (maintenance operation)
      try {
        await registrationService.cleanupExpiredTokens();
      } catch (cleanupError) {
        logger.warn('Failed to clean up expired tokens', {
          error: cleanupError.message,
          requestId,
        });
        // Don't fail the verification for cleanup issues
      }

      logger.info('Email verification completed successfully', {
        email: verifyData.email,
        cognitoUserId: cognitoUserDetails.userId,
        welcomeEmailSent,
        requestId,
      });

      const response: VerifyEmailResponse = {
        success: true,
        message:
          'Email verified successfully! Your account is now active. You can log in to access RegularTravelManager.',
      };

      return createResponse(200, { data: response });
    } catch (error) {
      logger.error('Failed to complete email verification process', {
        error: error.message,
        email: verifyData.email,
        requestId,
      });

      return createResponse(500, {
        error: {
          code: 'VERIFICATION_ERROR',
          message:
            'Email verification failed due to a server error. Please try again or contact support.',
          timestamp: new Date().toISOString(),
          requestId,
        },
      });
    }
  } catch (error) {
    logger.error('Email verification failed', {
      error: error.message,
      stack: error.stack,
      requestId,
    });

    if (error.name === 'ZodError') {
      return createResponse(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid verification request data',
          details: error.errors,
          timestamp: new Date().toISOString(),
          requestId,
        },
      });
    }

    return createResponse(500, {
      error: {
        code: 'VERIFICATION_ERROR',
        message: 'Email verification failed due to a server error. Please try again later.',
        timestamp: new Date().toISOString(),
        requestId,
      },
    });
  }
};
