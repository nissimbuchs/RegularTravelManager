import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client as PgClient } from 'pg';

// CloudFormation Custom Resource event types
interface CustomResourceEvent {
  RequestType: 'Create' | 'Update' | 'Delete';
  ResponseURL: string;
  StackId: string;
  RequestId: string;
  ResourceType: string;
  LogicalResourceId: string;
  ResourceProperties: {
    UserPoolId: string;
    Users: Array<{
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      employeeId: string;
      groups: string[];
      role: string;
    }>;
    DatabaseUrl: string;
    DatabaseSecretArn: string;
    Environment: string;
  };
}

interface CustomResourceResponse {
  Status: 'SUCCESS' | 'FAILED';
  Reason?: string;
  PhysicalResourceId: string;
  StackId: string;
  RequestId: string;
  LogicalResourceId: string;
  Data?: Record<string, any>;
}

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'eu-central-1',
});

const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'eu-central-1',
});

export const handler = async (event: CustomResourceEvent): Promise<void> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const response: CustomResourceResponse = {
    Status: 'SUCCESS',
    PhysicalResourceId: `cognito-users-${event.RequestId}`,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  };

  try {
    const { RequestType, ResourceProperties } = event;

    // Check if we're in dev environment - skip real Cognito user creation
    const environment = ResourceProperties.Environment || 'dev';
    const isDevEnvironment = environment === 'dev' || environment === 'development' || environment === 'local';

    if (isDevEnvironment) {
      console.log(`Environment ${environment} detected - skipping real Cognito user creation (using mock users instead)`);
      response.Data = {
        Message: `Skipped user creation for ${environment} environment - using mock authentication`,
        Environment: environment,
        UseMockAuth: true,
      };
      await sendResponse(event.ResponseURL, response);
      return;
    }

    if (RequestType === 'Create' || RequestType === 'Update') {
      const { UserPoolId, Users, DatabaseUrl, DatabaseSecretArn } = ResourceProperties;
      await createOrUpdateUsers(UserPoolId, Users, DatabaseUrl, DatabaseSecretArn);
      response.Data = {
        Message: `Successfully processed ${Users.length} users`,
        UsersCreated: Users.length,
      };
    } else if (RequestType === 'Delete') {
      // For delete, we typically don't remove users as they may have data
      // Just log the deletion request
      console.log('Delete request received - keeping users intact');
      response.Data = {
        Message: 'Delete request processed - users preserved',
      };
    }
  } catch (error) {
    console.error('Error processing request:', error);
    response.Status = 'FAILED';
    response.Reason = error instanceof Error ? error.message : String(error);
  }

  // Send response to CloudFormation
  await sendResponse(event.ResponseURL, response);
};

async function createOrUpdateUsers(
  userPoolId: string,
  users: Array<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    groups: string[];
    role: string;
  }>,
  databaseUrl: string,
  databaseSecretArn: string
): Promise<void> {
  console.log(`Processing ${users.length} users for User Pool: ${userPoolId}`);

  // Get database credentials from Secrets Manager
  let actualDatabaseUrl = databaseUrl;
  if (databaseSecretArn) {
    try {
      const secretCommand = new GetSecretValueCommand({
        SecretId: databaseSecretArn,
      });
      const secretResponse = await secretsClient.send(secretCommand);
      const secret = JSON.parse(secretResponse.SecretString || '{}');

      // Replace [SECRET] placeholder with actual password
      actualDatabaseUrl = databaseUrl.replace('[SECRET]', secret.password);
      console.log('Successfully retrieved database credentials from Secrets Manager');
    } catch (error) {
      console.error('Failed to get database secret:', error);
      throw error;
    }
  }

  // Initialize database connection
  console.log('Attempting to connect to database with URL pattern:', actualDatabaseUrl.replace(/:[^:@]+@/, ':***@'));
  
  let dbClient: PgClient;
  try {
    dbClient = new PgClient({
      connectionString: actualDatabaseUrl,
      ssl: {
        rejectUnauthorized: false  // Required for AWS RDS connections from Lambda
      }
    });
  } catch (parseError) {
    console.error('Error creating database client:', parseError);
    throw new Error(`Database URL parsing failed: ${parseError}`);
  }
  await dbClient.connect();

  try {
    for (const user of users) {
      console.log(`Processing user: ${user.email}`);

      // Check if user already exists
      let existingUser: any = null;
      try {
        const getUserCommand = new AdminGetUserCommand({
          UserPoolId: userPoolId,
          Username: user.email,
        });
        existingUser = await cognitoClient.send(getUserCommand);
        console.log(`User ${user.email} already exists`);
      } catch (error: any) {
        if (error.name === 'UserNotFoundException') {
          console.log(`User ${user.email} does not exist, will create`);
        } else {
          throw error;
        }
      }

      let cognitoUserId: string;

      if (!existingUser) {
        // Create new user
        console.log(`Creating user: ${user.email}`);
        const createCommand = new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: user.email,
          UserAttributes: [
            { Name: 'email', Value: user.email },
            { Name: 'given_name', Value: user.firstName },
            { Name: 'family_name', Value: user.lastName },
            { Name: 'email_verified', Value: 'true' },
          ],
          TemporaryPassword: user.password,
          MessageAction: 'SUPPRESS', // Don't send welcome email
        });

        const createResult = await cognitoClient.send(createCommand);
        cognitoUserId = createResult.User?.Username || user.email;

        // Set permanent password
        console.log(`Setting permanent password for: ${user.email}`);
        const passwordCommand = new AdminSetUserPasswordCommand({
          UserPoolId: userPoolId,
          Username: cognitoUserId,
          Password: user.password,
          Permanent: true,
        });
        await cognitoClient.send(passwordCommand);
      } else {
        cognitoUserId = existingUser.Username;
        console.log(`Using existing user: ${cognitoUserId}`);
      }

      // Add user to groups
      for (const groupName of user.groups) {
        try {
          console.log(`Adding user ${user.email} to group: ${groupName}`);
          const groupCommand = new AdminAddUserToGroupCommand({
            UserPoolId: userPoolId,
            Username: cognitoUserId,
            GroupName: groupName,
          });
          await cognitoClient.send(groupCommand);
        } catch (error: any) {
          if (error.name === 'UserNotFoundException' || error.name === 'GroupNotFoundException') {
            console.warn(`Group ${groupName} not found, skipping`);
          } else {
            throw error;
          }
        }
      }

      // Sync with database using the existing sync function
      try {
        console.log(`Syncing user ${user.email} with database`);
        const syncResult = await dbClient.query(
          'SELECT sync_employee_with_cognito($1, $2, $3, $4) as employee_id',
          [user.email, cognitoUserId, user.firstName, user.lastName]
        );
        console.log(
          `Database sync completed for ${user.email}, employee_id: ${syncResult.rows[0].employee_id}`
        );
      } catch (dbError) {
        console.error(`Database sync failed for ${user.email}:`, dbError);
        // Continue with other users even if database sync fails
      }

      console.log(`Successfully processed user: ${user.email}`);
    }
  } finally {
    await dbClient.end();
  }
}

async function sendResponse(responseUrl: string, response: CustomResourceResponse): Promise<void> {
  const responseBody = JSON.stringify(response);
  console.log('Sending response:', responseBody);

  try {
    const fetch = (await import('node-fetch')).default;
    const result = await fetch(responseUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': '',
        'Content-Length': responseBody.length.toString(),
      },
      body: responseBody,
    });

    console.log('Response sent successfully:', result.status);
  } catch (error) {
    console.error('Failed to send response:', error);
    throw error;
  }
}
