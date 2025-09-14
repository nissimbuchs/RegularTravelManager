import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
  Context,
} from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';

interface DatabaseCredentials {
  username: string;
  password: string;
}

interface MigrationFile {
  version: string;
  filename: string;
  content: string;
}

export const migrationRunner = async (
  event: CloudFormationCustomResourceEvent,
  context: Context
): Promise<CloudFormationCustomResourceResponse> => {
  const { RequestType, LogicalResourceId, RequestId } = event;
  const environment = process.env.RTM_ENVIRONMENT || 'dev';

  console.log('Migration runner invoked', {
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
    PhysicalResourceId: `migration-runner-${environment}`,
    Data: {},
  };

  try {
    if (RequestType === 'Delete') {
      // No rollback on delete - migrations remain applied
      console.log('Delete operation - migrations remain applied');
      return response;
    }

    if (RequestType === 'Create' || RequestType === 'Update') {
      console.log('Running database migrations...');

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
        // Ensure migrations table exists
        await createMigrationsTable(client);

        // Get all migrations to run
        const migrations = getMigrations();
        console.log(`Found ${migrations.length} migration files`);

        let executedCount = 0;
        let skippedCount = 0;

        // Execute each migration
        for (const migration of migrations) {
          const wasExecuted = await executeMigration(client, migration);
          if (wasExecuted) {
            executedCount++;
          } else {
            skippedCount++;
          }
        }

        console.log(
          `Migration run completed: ${executedCount} executed, ${skippedCount} skipped`
        );

        response.Data = {
          MigrationsExecuted: executedCount,
          MigrationsSkipped: skippedCount,
          TotalMigrations: migrations.length,
          Status: 'success',
        };
      } finally {
        await client.end();
        console.log('Database connection closed');
      }
    }

    console.log('Migration runner completed successfully');
    return response;
  } catch (error) {
    console.error('Migration runner failed:', error);

    response = {
      ...response,
      Status: 'FAILED',
      Reason: error instanceof Error ? error.message : 'Unknown error occurred',
    };

    return response;
  }
};

async function createMigrationsTable(client: Client): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(50) PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      checksum VARCHAR(64) NOT NULL
    );
  `;
  await client.query(sql);
  console.log('Schema migrations table ensured');
}

async function executeMigration(client: Client, migration: MigrationFile): Promise<boolean> {
  const checksum = calculateChecksum(migration.content);

  // Check if migration already executed
  const existingResult = await client.query(
    'SELECT version, checksum FROM schema_migrations WHERE version = $1',
    [migration.version]
  );

  if (existingResult.rows.length > 0) {
    const existing = existingResult.rows[0];
    if (existing.checksum !== checksum) {
      throw new Error(
        `Migration ${migration.version} has been modified since execution. Checksum mismatch.`
      );
    }
    console.log(`Migration ${migration.version} already executed, skipping.`);
    return false;
  }

  // Execute migration in transaction
  await client.query('BEGIN');
  try {
    console.log(`Executing migration: ${migration.version} - ${migration.filename}`);
    await client.query(migration.content);

    // Record migration execution
    await client.query(
      'INSERT INTO schema_migrations (version, filename, checksum) VALUES ($1, $2, $3)',
      [migration.version, migration.filename, checksum]
    );

    await client.query('COMMIT');
    console.log(`Migration ${migration.version} completed successfully.`);
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Migration ${migration.version} failed:`, error);
    throw error;
  }
}

function calculateChecksum(content: string): string {
  // Simple checksum for migration content verification
  return Buffer.from(content).toString('base64').slice(0, 32);
}

function getMigrations(): MigrationFile[] {
  // Migration files are bundled as part of the Lambda
  // This will be populated with embedded migration content
  const migrations: MigrationFile[] = [
    {
      version: '004',
      filename: '004_user_registration_table.sql',
      content: `-- Migration 004: Create user_registrations table for Story 5.1 - User Registration
-- This table stores email verification tokens for the registration process

CREATE TABLE user_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  verification_token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_user_registrations_email ON user_registrations(email);
CREATE INDEX idx_user_registrations_token ON user_registrations(verification_token);
CREATE INDEX idx_user_registrations_expires ON user_registrations(expires_at);

-- Add comments for documentation
COMMENT ON TABLE user_registrations IS 'Stores email verification tokens for user registration process (Story 5.1)';
COMMENT ON COLUMN user_registrations.email IS 'Email address being verified';
COMMENT ON COLUMN user_registrations.verification_token IS 'Unique token sent via email for verification';
COMMENT ON COLUMN user_registrations.expires_at IS 'When the verification token expires (24 hours)';
COMMENT ON COLUMN user_registrations.verified_at IS 'When the email was verified (NULL if not verified)';`,
    },
  ];

  // Sort migrations by version to ensure proper execution order
  return migrations.sort((a, b) => a.version.localeCompare(b.version));
}