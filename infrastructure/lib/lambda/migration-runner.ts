import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
  Context,
} from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Client } from 'pg';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

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
  const version = event.ResourceProperties?.Version || '1.0.0';

  console.log('Migration runner invoked', {
    RequestType,
    LogicalResourceId,
    RequestId,
    environment,
    version,
  });

  // Basic response structure - include version in PhysicalResourceId to force updates
  let response: CloudFormationCustomResourceResponse = {
    Status: 'SUCCESS',
    RequestId,
    LogicalResourceId,
    StackId: event.StackId,
    PhysicalResourceId: `migration-runner-${environment}-${version}`,
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

        console.log(`Migration run completed: ${executedCount} executed, ${skippedCount} skipped`);

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
  // Read migration files from the bundled migrations directory
  const migrationsDir = '/var/task/migrations';
  const migrations: MigrationFile[] = [];

  try {
    // Get all .sql files from migrations directory
    const files = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort alphabetically to ensure proper order

    for (const filename of files) {
      // Extract version number from filename (e.g., "021-add-employee-profile-fields.sql" -> "021")
      const versionMatch = filename.match(/^(\d+)/);
      if (!versionMatch) {
        console.log(`Skipping file ${filename} - no version number found`);
        continue;
      }

      const version = versionMatch[1];
      if (!version) {
        console.log(`Skipping file ${filename} - invalid version format`);
        continue;
      }

      const content = readFileSync(join(migrationsDir, filename), 'utf8');

      migrations.push({
        version,
        filename,
        content,
      });

      console.log(`Loaded migration ${version}: ${filename}`);
    }

    console.log(`Loaded ${migrations.length} migration files from ${migrationsDir}`);
    return migrations.sort((a, b) => a.version.localeCompare(b.version));
  } catch (error) {
    console.error('Error reading migration files:', error);
    throw new Error(`Failed to load migration files from ${migrationsDir}: ${error}`);
  }
}
