import { APIGatewayProxyEvent } from 'aws-lambda';
import { 
  CognitoIdentityProviderClient, 
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  ListUsersCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { logger } from '../../middleware/logger';

// User context extracted from Lambda authorizer
export interface UserContext {
  sub: string;
  email: string;
  cognitoUsername: string;
  isManager: boolean;
  groups: string[];
}

// Extract user context from API Gateway event (populated by authorizer)
export function getUserContextFromEvent(event: APIGatewayProxyEvent): UserContext {
  const requestContext = event.requestContext as any;
  const authorizerContext = requestContext.authorizer;

  if (!authorizerContext) {
    throw new Error('No authorization context found');
  }

  return {
    sub: authorizerContext.sub,
    email: authorizerContext.email,
    cognitoUsername: authorizerContext.cognitoUsername,
    isManager: authorizerContext.isManager === 'true',
    groups: JSON.parse(authorizerContext.groups || '[]')
  };
}

// Cognito admin operations
export class CognitoAdminService {
  private client: CognitoIdentityProviderClient;
  private userPoolId: string;

  constructor() {
    this.client = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION || 'eu-central-1'
    });
    this.userPoolId = process.env.COGNITO_USER_POOL_ID || '';
  }

  async createUser(
    email: string,
    firstName: string,
    lastName: string,
    tempPassword: string,
    isManager: boolean = false
  ): Promise<string> {
    logger.info('Creating Cognito user', { email, isManager });

    try {
      // Create user
      const createCommand = new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'given_name', Value: firstName },
          { Name: 'family_name', Value: lastName },
          { Name: 'email_verified', Value: 'true' }
        ],
        TemporaryPassword: tempPassword,
        MessageAction: 'SUPPRESS' // Don't send welcome email for testing
      });

      const createResult = await this.client.send(createCommand);
      const username = createResult.User?.Username || email;

      // Set permanent password
      const passwordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        Password: tempPassword,
        Permanent: true
      });
      
      await this.client.send(passwordCommand);

      // Add to appropriate group
      const groupName = isManager ? 'managers' : 'employees';
      const groupCommand = new AdminAddUserToGroupCommand({
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: groupName
      });

      await this.client.send(groupCommand);

      logger.info('User created successfully', { 
        username, 
        email, 
        group: groupName 
      });

      return username;

    } catch (error) {
      logger.error('Failed to create user', { 
        error: error.message, 
        email 
      });
      throw error;
    }
  }

  async getUserDetails(username: string) {
    try {
      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: username
      });

      const result = await this.client.send(command);
      
      // Get user groups
      const groupsCommand = new AdminListGroupsForUserCommand({
        UserPoolId: this.userPoolId,
        Username: username
      });

      const groupsResult = await this.client.send(groupsCommand);

      return {
        username: result.Username,
        attributes: result.UserAttributes,
        groups: groupsResult.Groups?.map(g => g.GroupName) || [],
        enabled: result.Enabled,
        status: result.UserStatus
      };

    } catch (error) {
      logger.error('Failed to get user details', { 
        error: error.message, 
        username 
      });
      throw error;
    }
  }

  async listUsers(limit: number = 50) {
    try {
      const command = new ListUsersCommand({
        UserPoolId: this.userPoolId,
        Limit: limit
      });

      const result = await this.client.send(command);
      
      return result.Users?.map(user => ({
        username: user.Username,
        attributes: user.Attributes,
        enabled: user.Enabled,
        status: user.UserStatus,
        created: user.UserCreateDate,
        modified: user.UserLastModifiedDate
      })) || [];

    } catch (error) {
      logger.error('Failed to list users', { error: error.message });
      throw error;
    }
  }
}

// Permission checking utilities
export function requireManager(userContext: UserContext): void {
  if (!userContext.isManager) {
    throw new Error('Manager role required');
  }
}

export function requireSameUserOrManager(userContext: UserContext, targetUserId: string): void {
  if (userContext.sub !== targetUserId && !userContext.isManager) {
    throw new Error('Access denied: can only access own data or manager required');
  }
}

// Default test users configuration
export const TEST_USERS = [
  {
    email: 'employee1@company.com',
    firstName: 'John',
    lastName: 'Employee',
    password: 'TempPass123!',
    isManager: false
  },
  {
    email: 'employee2@company.com', 
    firstName: 'Jane',
    lastName: 'Worker',
    password: 'TempPass123!',
    isManager: false
  },
  {
    email: 'manager1@company.com',
    firstName: 'Bob',
    lastName: 'Manager',
    password: 'TempPass123!',
    isManager: true
  },
  {
    email: 'manager2@company.com',
    firstName: 'Alice',
    lastName: 'Director',
    password: 'TempPass123!',
    isManager: true
  }
];

export async function createTestUsers(): Promise<void> {
  const cognitoService = new CognitoAdminService();
  
  logger.info('Creating test users', { count: TEST_USERS.length });

  for (const user of TEST_USERS) {
    try {
      await cognitoService.createUser(
        user.email,
        user.firstName,
        user.lastName,
        user.password,
        user.isManager
      );
      logger.info('Test user created', { email: user.email });
    } catch (error) {
      // Continue if user already exists
      if (error.name === 'UsernameExistsException') {
        logger.info('Test user already exists', { email: user.email });
      } else {
        logger.error('Failed to create test user', { 
          email: user.email, 
          error: error.message 
        });
      }
    }
  }
}