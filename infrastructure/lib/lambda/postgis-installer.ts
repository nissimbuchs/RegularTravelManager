import { CloudFormationCustomResourceEvent, CloudFormationCustomResourceResponse, Context } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';

interface DatabaseCredentials {
  username: string;
  password: string;
}

export const postgisInstaller = async (
  event: CloudFormationCustomResourceEvent,
  context: Context
): Promise<CloudFormationCustomResourceResponse> => {
  const { RequestType, LogicalResourceId, RequestId } = event;
  const environment = process.env.RTM_ENVIRONMENT || 'dev';

  console.log('PostGIS installer invoked', {
    RequestType,
    LogicalResourceId,
    RequestId,
    environment,
  });

  // Basic response structure
  let response: CloudFormationCustomResourceResponse = {
    Status: 'SUCCESS',
    RequestId,
    LogicalResourceId,
    StackId: event.StackId,
    PhysicalResourceId: `postgis-installer-${environment}`,
    Data: {},
  };

  try {
    if (RequestType === 'Delete') {
      // No cleanup needed for PostGIS extension
      console.log('Delete operation - no action needed');
      return response;
    }

    if (RequestType === 'Create' || RequestType === 'Update') {
      console.log('Installing PostGIS extension...');

      // Get database credentials from Secrets Manager
      const secretsClient = new SecretsManagerClient({
        region: process.env.AWS_REGION || 'eu-central-1',
      });

      const secretName = `rtm-${environment}-db-credentials`;
      console.log(`Retrieving credentials from secret: ${secretName}`);

      const secretResponse = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: secretName })
      );

      if (!secretResponse.SecretString) {
        throw new Error('Database credentials not found in Secrets Manager');
      }

      const credentials: DatabaseCredentials = JSON.parse(secretResponse.SecretString);

      // Connect to PostgreSQL database
      const client = new Client({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'rtm_database',
        user: credentials.username,
        password: credentials.password,
        ssl: {
          rejectUnauthorized: false, // Required for RDS SSL
        },
      });

      console.log('Connecting to database...');
      await client.connect();

      try {
        // Check if PostGIS is already installed
        const checkResult = await client.query(`
          SELECT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'postgis'
          ) as postgis_exists;
        `);

        const postgisExists = checkResult.rows[0].postgis_exists;
        console.log('PostGIS extension exists:', postgisExists);

        if (!postgisExists) {
          console.log('Installing PostGIS extension...');
          await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
          console.log('PostGIS extension installed successfully');
        } else {
          console.log('PostGIS extension already installed');
        }

        // Verify PostGIS installation by testing geography type
        console.log('Testing PostGIS functionality...');
        await client.query(`
          SELECT ST_AsText(ST_MakePoint(8.5417, 47.3769)::geography) as test_point;
        `);
        console.log('PostGIS functionality verified successfully');

        response.Data = {
          PostGISVersion: 'installed',
          Status: 'success',
        };

      } finally {
        await client.end();
        console.log('Database connection closed');
      }
    }

    console.log('PostGIS installer completed successfully');
    return response;

  } catch (error) {
    console.error('PostGIS installer failed:', error);

    response = {
      ...response,
      Status: 'FAILED',
      Reason: error instanceof Error ? error.message : 'Unknown error occurred',
    };

    return response;
  }
};