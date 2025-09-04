import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

interface MigrationRecord {
  version: string;
  filename: string;
  executed_at: Date;
  checksum: string;
}

export class MigrationRunner {
  private client: Client;

  constructor(databaseUrl: string) {
    this.client = new Client({
      connectionString: databaseUrl,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  private async createMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64) NOT NULL
      );
    `;
    await this.client.query(sql);
  }

  private calculateChecksum(content: string): string {
    // Simple checksum for migration content verification
    return Buffer.from(content).toString('base64').slice(0, 32);
  }

  async getExecutedMigrations(): Promise<MigrationRecord[]> {
    await this.createMigrationsTable();
    const result = await this.client.query(
      'SELECT version, filename, executed_at, checksum FROM schema_migrations ORDER BY version'
    );
    return result.rows;
  }

  async executeMigration(version: string, filename: string): Promise<void> {
    const migrationPath = join(__dirname, 'migrations', filename);
    const migrationContent = readFileSync(migrationPath, 'utf8');
    const checksum = this.calculateChecksum(migrationContent);

    // Ensure migrations table exists first
    await this.createMigrationsTable();

    // Check if migration already executed
    const existingResult = await this.client.query(
      'SELECT version, checksum FROM schema_migrations WHERE version = $1',
      [version]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      if (existing.checksum !== checksum) {
        throw new Error(
          `Migration ${version} has been modified since execution. Checksum mismatch.`
        );
      }
      console.log(`Migration ${version} already executed, skipping.`);
      return;
    }

    // Execute migration in transaction
    await this.client.query('BEGIN');
    try {
      console.log(`Executing migration: ${version} - ${filename}`);
      await this.client.query(migrationContent);

      // Record migration execution
      await this.client.query(
        'INSERT INTO schema_migrations (version, filename, checksum) VALUES ($1, $2, $3)',
        [version, filename, checksum]
      );

      await this.client.query('COMMIT');
      console.log(`Migration ${version} completed successfully.`);
    } catch (error) {
      await this.client.query('ROLLBACK');
      throw error;
    }
  }

  async rollbackMigration(version: string): Promise<void> {
    // Handle different version formats
    let rollbackFilename: string;
    let migrationVersion: string;

    if (version.endsWith('_rollback.sql')) {
      // Already a rollback filename
      rollbackFilename = version;
      migrationVersion = version.replace('_rollback.sql', '');
    } else if (version.endsWith('.sql')) {
      // Migration filename, create rollback filename
      rollbackFilename = version.replace('.sql', '_rollback.sql');
      migrationVersion = version.replace('.sql', '');
    } else {
      // Just version number
      rollbackFilename = `${version}_rollback.sql`;
      migrationVersion = version;
    }

    const rollbackPath = join(__dirname, 'migrations', rollbackFilename);

    try {
      const rollbackContent = readFileSync(rollbackPath, 'utf8');

      await this.client.query('BEGIN');
      try {
        console.log(`Rolling back migration: ${migrationVersion}`);
        await this.client.query(rollbackContent);

        // Remove migration record
        await this.client.query('DELETE FROM schema_migrations WHERE version = $1', [
          migrationVersion,
        ]);

        await this.client.query('COMMIT');
        console.log(`Rollback of ${migrationVersion} completed successfully.`);
      } catch (error) {
        await this.client.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      throw new Error(`Rollback file not found or error executing rollback: ${error}`);
    }
  }

  async runAllMigrations(): Promise<void> {
    const migrations = [
      { version: '001', filename: '001_initial_schema.sql' },
      { version: '002', filename: '002_add_cognito_fields.sql' },
      { version: '003', filename: '003_distance_calculation_functions.sql' },
    ];

    for (const migration of migrations) {
      await this.executeMigration(migration.version, migration.filename);
    }
  }

  async loadSampleData(): Promise<void> {
    const dataPath = join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'infrastructure',
      'data',
      'sample-data.sql'
    );
    const dataContent = readFileSync(dataPath, 'utf8');
    console.log('Loading comprehensive sample data...');
    await this.client.query(dataContent);
    console.log('Sample data loading completed.');
  }

  async reset(): Promise<void> {
    console.log('Resetting database...');
    // Get all executed migrations in reverse order
    const migrations = await this.getExecutedMigrations();
    migrations.reverse();

    for (const migration of migrations) {
      await this.rollbackMigration(migration.version + '_rollback.sql');
    }
    console.log('Database reset completed.');
  }
}

// CLI run command function (moved to program root for linting)
async function runCommand(runner: MigrationRunner, command: string): Promise<void> {
  try {
    await runner.connect();

    switch (command) {
      case 'migrate':
        await runner.runAllMigrations();
        break;
      case 'seed':
        await runner.loadSampleData();
        break;
      case 'setup':
        await runner.runAllMigrations();
        await runner.loadSampleData();
        break;
      case 'reset':
        await runner.reset();
        break;
      case 'status': {
        const executed = await runner.getExecutedMigrations();
        console.log('Executed migrations:');
        executed.forEach(m => console.log(`  ${m.version} - ${m.filename} (${m.executed_at})`));
        break;
      }
      default:
        console.log('Available commands: migrate, seed, setup, reset, status');
        console.log('Note: seed loads comprehensive Swiss business sample data');
    }
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await runner.disconnect();
  }
}

// CLI interface for migrations
if (require.main === module) {
  const command = process.argv[2];
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/travel_manager_dev';
  const runner = new MigrationRunner(databaseUrl);

  runCommand(runner, command);
}
