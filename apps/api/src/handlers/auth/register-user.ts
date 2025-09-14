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
import { RegisterRequest, RegisterResponse } from '@rtm/shared';
import { isLocalDevelopment } from '../../config/environment';

// Validation schema for registration request
const registerSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name too long')
    .regex(/^[a-zA-ZÀ-ÿĀ-žЀ-ӿ\s\-']+$/, 'First name contains invalid characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name too long')
    .regex(/^[a-zA-ZÀ-ÿĀ-žЀ-ӿ\s\-']+$/, 'Last name contains invalid characters'),
  homeAddress: z.object({
    street: z.string().min(1, 'Street address is required').max(100, 'Street address too long'),
    city: z.string().min(1, 'City is required').max(50, 'City name too long'),
    postalCode: z.string().regex(/^\d{4}$/, 'Swiss postal code must be 4 digits'),
    country: z.string().default('Switzerland'),
    coordinates: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
      })
      .optional(),
  }),
  acceptTerms: z.boolean().refine(val => val === true, 'Terms of service must be accepted'),
  acceptPrivacy: z.boolean().refine(val => val === true, 'Privacy policy must be accepted'),
});

/**
 * Lambda handler for user registration
 * Creates Cognito user, database record, and sends verification email
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

    logger.info('Registration request received', {
      requestId,
      httpMethod: event.httpMethod,
      userAgent: event.headers['User-Agent'],
      sourceIp: event.requestContext.identity.sourceIp,
    });

    // Apply rate limiting
    const rateLimitCheck = checkRateLimit(event, RateLimitConfigs.REGISTRATION);
    if (!rateLimitCheck.allowed) {
      logger.warn('Registration rate limit exceeded', {
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
    const registerData = validateRequestBody(event, registerSchema) as RegisterRequest;

    // Initialize services
    const registrationService = new RegistrationService();
    const emailService = new EmailService();

    const isLocalDev = isLocalDevelopment();

    // Check if email already exists
    let emailExists;

    if (isLocalDev) {
      // In local development, only check database (skip Cognito entirely)
      logger.info('Local dev mode: Skipping Cognito, checking database only', {
        email: registerData.email,
      });
      const dbCheck = await registrationService.checkEmailExists(registerData.email);
      emailExists = [false, dbCheck]; // Cognito check = false, database check = actual result
    } else {
      // In production, check both Cognito and database
      const cognitoService = new CognitoRegistrationService();
      emailExists = await Promise.all([
        cognitoService.emailExists(registerData.email),
        registrationService.checkEmailExists(registerData.email),
      ]);
    }

    if (emailExists[0] || emailExists[1].database) {
      logger.warn('Registration attempt with existing email', {
        email: registerData.email,
        requestId,
      });

      return createResponse(400, {
        error: {
          code: 'EMAIL_EXISTS',
          message:
            'An account with this email address already exists. Please try logging in or use the password reset feature.',
          timestamp: new Date().toISOString(),
          requestId,
        },
      });
    }

    // Geocode address to coordinates
    let coordinates: { latitude: number; longitude: number } | null = null;
    try {
      coordinates = await registrationService.geocodeAddress(registerData.homeAddress);
      if (!coordinates) {
        logger.warn('Address geocoding failed, proceeding without coordinates', {
          address: registerData.homeAddress,
          requestId,
        });
      }
    } catch (geocodeError) {
      logger.error('Address geocoding error', {
        error: geocodeError.message,
        address: registerData.homeAddress,
        requestId,
      });

      return createResponse(400, {
        error: {
          code: 'GEOCODING_ERROR',
          message: 'Invalid address or geocoding failed. Please verify your address and try again.',
          details: { originalError: geocodeError.message },
          timestamp: new Date().toISOString(),
          requestId,
        },
      });
    }

    // Start transaction-like process
    let cognitoUserId: string = '';
    let rollbackNeeded = false;

    try {
      // Step 1: Create Cognito user (skip in local development)
      if (isLocalDev) {
        // Generate mock user ID for local development
        cognitoUserId = `local-dev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        logger.info('Local dev mode: Using mock Cognito user ID', {
          email: registerData.email,
          mockUserId: cognitoUserId,
        });
      } else {
        // Production: Create real Cognito user
        const cognitoService = new CognitoRegistrationService();
        const cognitoResult = await cognitoService.createRegistrationUser(registerData);
        cognitoUserId = cognitoResult.userId;
        rollbackNeeded = true;
      }

      // Step 2: Create employee database record
      const employeeRecord = await registrationService.createEmployeeRecord(
        cognitoUserId,
        registerData,
        coordinates
      );

      // Step 3: Generate and store verification token
      const tokenData = registrationService.generateVerificationToken();
      await registrationService.createVerificationToken(
        registerData.email,
        tokenData.token,
        tokenData.expiresAt
      );

      // Step 4: Send verification email
      const emailSent = await emailService.sendVerificationEmail(
        registerData.email,
        registerData.firstName,
        tokenData.token
      );

      if (!emailSent) {
        throw new Error('Failed to send verification email');
      }

      logger.info('User registration completed successfully', {
        email: registerData.email,
        cognitoUserId,
        employeeId: employeeRecord.id,
        hasCoordinates: !!coordinates,
        requestId,
      });

      const response: RegisterResponse = {
        userId: cognitoUserId,
        email: registerData.email,
        verificationRequired: true,
        message: `Registration successful! Please check your email at ${registerData.email} for verification instructions. The verification link will expire in 24 hours.`,
      };

      return applySecurityHeaders(createResponse(201, { data: response }), event.headers.origin);
    } catch (error) {
      // Rollback: If we created a Cognito user but failed later, we should clean up
      if (rollbackNeeded && cognitoUserId) {
        try {
          // In a production system, you might want to disable or delete the Cognito user
          logger.warn(
            'Registration failed after Cognito user creation, manual cleanup may be required',
            {
              cognitoUserId,
              email: registerData.email,
              requestId,
            }
          );
        } catch (rollbackError) {
          logger.error('Failed to rollback Cognito user creation', {
            error: rollbackError.message,
            cognitoUserId,
            requestId,
          });
        }
      }

      throw error; // Re-throw to be handled by outer catch
    }
  } catch (error) {
    logger.error('Registration failed', {
      error: error.message,
      stack: error.stack,
      requestId,
    });

    // Check for specific error types
    if (error.message.includes('already exists')) {
      return applySecurityHeaders(
        createResponse(400, {
          error: {
            code: 'EMAIL_EXISTS',
            message: 'An account with this email address already exists.',
            timestamp: new Date().toISOString(),
            requestId,
          },
        }),
        event.headers.origin
      );
    }

    if (error.message.includes('Invalid address') || error.message.includes('geocoding')) {
      return applySecurityHeaders(
        createResponse(400, {
          error: {
            code: 'GEOCODING_ERROR',
            message: 'Address validation failed. Please check your address and try again.',
            timestamp: new Date().toISOString(),
            requestId,
          },
        }),
        event.headers.origin
      );
    }

    if (error.name === 'ZodError') {
      return applySecurityHeaders(
        createResponse(400, {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid registration data',
            details: error.errors,
            timestamp: new Date().toISOString(),
            requestId,
          },
        }),
        event.headers.origin
      );
    }

    // Generic server error
    return applySecurityHeaders(
      createResponse(500, {
        error: {
          code: 'REGISTRATION_ERROR',
          message: 'Registration failed due to a server error. Please try again later.',
          timestamp: new Date().toISOString(),
          requestId,
        },
      }),
      event.headers.origin
    );
  }
};
