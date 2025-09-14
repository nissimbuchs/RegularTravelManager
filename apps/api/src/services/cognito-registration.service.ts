import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  AdminGetUserCommand,
  UsernameExistsException,
  UserNotFoundException,
  AdminEnableUserCommand,
  AdminDisableUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { logger } from '../middleware/logger';
import { RegisterRequest } from '@rtm/shared';

export interface CognitoUserCreationResult {
  userId: string;
  username: string;
  isEnabled: boolean;
  needsPasswordReset: boolean;
}

export class CognitoRegistrationService {
  private client: CognitoIdentityProviderClient;
  private userPoolId: string;
  private isLocalDevelopment: boolean;

  constructor() {
    this.isLocalDevelopment =
      process.env.NODE_ENV === 'development' || process.env.MOCK_COGNITO === 'true';

    if (this.isLocalDevelopment) {
      this.userPoolId = 'local-user-pool-id';
      logger.info('Using mock Cognito service for local development');
    } else {
      this.client = new CognitoIdentityProviderClient({
        region: process.env.AWS_REGION || 'eu-central-1',
      });
      this.userPoolId = process.env.COGNITO_USER_POOL_ID || '';

      if (!this.userPoolId) {
        throw new Error('COGNITO_USER_POOL_ID environment variable is required');
      }
    }
  }

  /**
   * Check if email already exists in Cognito User Pool
   */
  async emailExists(email: string): Promise<boolean> {
    if (this.isLocalDevelopment) {
      // Mock implementation for local development
      logger.info('Mock Cognito - Checking if email exists', { email });

      // Return false to allow registration (simulating user doesn't exist)
      // You can add specific emails to test existing user scenarios
      const existingEmails = ['existing@example.com', 'test.existing@company.com'];
      return existingEmails.includes(email);
    }

    try {
      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
      });

      await this.client.send(command);
      return true; // User exists
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        return false; // User doesn't exist
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Create new Cognito user for registration
   * User is created in disabled state until email verification
   */
  async createRegistrationUser(registerData: RegisterRequest): Promise<CognitoUserCreationResult> {
    logger.info('Creating Cognito user for registration', {
      email: registerData.email,
    });

    if (this.isLocalDevelopment) {
      // Mock implementation for local development
      logger.info('Mock Cognito - Creating registration user', {
        email: registerData.email,
        firstName: registerData.firstName,
        lastName: registerData.lastName,
      });

      // Check if user already exists
      const userExists = await this.emailExists(registerData.email);
      if (userExists) {
        throw new Error('User already exists with this email address');
      }

      // Generate mock user ID
      const mockUserId = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      return {
        userId: mockUserId,
        username: registerData.email,
        isEnabled: false, // Disabled until verification
        needsPasswordReset: false,
      };
    }

    try {
      // Check if user already exists
      const userExists = await this.emailExists(registerData.email);
      if (userExists) {
        throw new Error('User already exists with this email address');
      }

      // Generate temporary password (user won't use this directly)
      const tempPassword = this.generateTemporaryPassword();

      // Create user in disabled state
      const createCommand = new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: registerData.email,
        UserAttributes: [
          { Name: 'email', Value: registerData.email },
          { Name: 'given_name', Value: registerData.firstName },
          { Name: 'family_name', Value: registerData.lastName },
          { Name: 'email_verified', Value: 'false' }, // Will be set to true after verification
        ],
        TemporaryPassword: tempPassword,
        MessageAction: 'SUPPRESS', // Don't send Cognito welcome email
        DesiredDeliveryMediums: ['EMAIL'],
      });

      const createResult = await this.client.send(createCommand);
      const username = createResult.User?.Username || registerData.email;
      const userId = createResult.User?.Attributes?.find(attr => attr.Name === 'sub')?.Value || '';

      if (!userId) {
        throw new Error('Failed to get user ID from Cognito response');
      }

      // Set permanent password
      const passwordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        Password: registerData.password,
        Permanent: true,
      });

      await this.client.send(passwordCommand);

      // Add to employees group (default role)
      const groupCommand = new AdminAddUserToGroupCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: 'employees',
      });

      await this.client.send(groupCommand);

      // Disable user until email verification
      const disableCommand = new AdminDisableUserCommand({
        UserPoolId: this.userPoolId,
        Username: username,
      });

      await this.client.send(disableCommand);

      logger.info('Cognito user created successfully', {
        userId,
        username,
        email: registerData.email,
        isEnabled: false,
      });

      return {
        userId,
        username,
        isEnabled: false,
        needsPasswordReset: false,
      };
    } catch (error) {
      logger.error('Failed to create Cognito user for registration', {
        error: error.message,
        email: registerData.email,
      });

      if (error instanceof UsernameExistsException) {
        throw new Error('User already exists with this email address');
      }

      throw error;
    }
  }

  /**
   * Enable Cognito user after email verification
   */
  async enableUserAfterVerification(email: string): Promise<boolean> {
    try {
      logger.info('Enabling Cognito user after email verification', { email });

      // Enable the user
      const enableCommand = new AdminEnableUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
      });

      await this.client.send(enableCommand);

      logger.info('Cognito user enabled successfully', { email });
      return true;
    } catch (error) {
      logger.error('Failed to enable Cognito user after verification', {
        error: error.message,
        email,
      });
      throw error;
    }
  }

  /**
   * Get user details from Cognito
   */
  async getUserDetails(email: string) {
    try {
      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
      });

      const result = await this.client.send(command);

      return {
        username: result.Username,
        userId: result.UserAttributes?.find(attr => attr.Name === 'sub')?.Value || '',
        email: result.UserAttributes?.find(attr => attr.Name === 'email')?.Value || '',
        enabled: result.Enabled,
        status: result.UserStatus,
        emailVerified:
          result.UserAttributes?.find(attr => attr.Name === 'email_verified')?.Value === 'true',
        created: result.UserCreateDate,
        lastModified: result.UserLastModifiedDate,
      };
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update email verification status in Cognito
   */
  async markEmailVerified(email: string): Promise<boolean> {
    try {
      // This would typically be handled by Cognito's verification flow
      // For now, we'll enable the user which marks them as verified
      await this.enableUserAfterVerification(email);
      return true;
    } catch (error) {
      logger.error('Failed to mark email as verified in Cognito', {
        error: error.message,
        email,
      });
      return false;
    }
  }

  /**
   * Generate secure temporary password for initial user creation
   */
  private generateTemporaryPassword(): string {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    // Ensure password meets Cognito requirements
    password += 'A'; // uppercase
    password += 'a'; // lowercase
    password += '1'; // number
    password += '!'; // special character

    // Fill remaining characters randomly
    for (let i = 4; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => 0.5 - Math.random())
      .join('');
  }
}
