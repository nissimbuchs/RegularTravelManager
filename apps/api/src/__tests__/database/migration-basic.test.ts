import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';

describe('Basic Migration System Tests (without PostGIS)', () => {
  let client: Client;
  const testDbUrl =
    process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/travel_manager_test';

  beforeAll(async () => {
    client = new Client({ connectionString: testDbUrl });
    await client.connect();
    // Ensure we're using the public schema
    await client.query('SET search_path TO public');
  });

  afterAll(async () => {
    await client.end();
  });

  it('should create schema_migrations table', async () => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64) NOT NULL
      )
    `);

    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'schema_migrations' AND table_schema = 'public'
      ) as table_exists
    `);

    expect(result.rows[0].table_exists).toBe(true);
  });

  it('should run a basic migration without PostGIS', async () => {
    // Clean up first
    const tablesToDrop = [
      'travel_requests',
      'subprojects',
      'projects',
      'employees',
      'schema_migrations',
    ];
    for (const table of tablesToDrop) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }

    // Create migrations table
    await client.query(`
      CREATE TABLE schema_migrations (
        version VARCHAR(50) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64) NOT NULL
      )
    `);

    // Run basic migration without PostGIS
    const basicMigration = `
      CREATE TABLE employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        home_street VARCHAR(255) NOT NULL,
        home_city VARCHAR(100) NOT NULL,
        home_postal_code VARCHAR(20) NOT NULL,
        home_country VARCHAR(100) NOT NULL DEFAULT 'Switzerland',
        -- Note: home_location would be GEOMETRY(POINT, 4326) with PostGIS
        home_latitude DECIMAL(10, 8),
        home_longitude DECIMAL(11, 8),
        manager_id UUID REFERENCES employees(id),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        default_cost_per_km DECIMAL(10,2) NOT NULL CHECK (default_cost_per_km > 0),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE subprojects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id),
        name VARCHAR(255) NOT NULL,
        street_address VARCHAR(255) NOT NULL,
        city VARCHAR(100) NOT NULL,
        postal_code VARCHAR(20) NOT NULL,
        country VARCHAR(100) NOT NULL DEFAULT 'Switzerland',
        -- Note: location would be GEOMETRY(POINT, 4326) with PostGIS
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        cost_per_km DECIMAL(10,2) NOT NULL CHECK (cost_per_km > 0),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create basic indexes
      CREATE INDEX idx_employees_manager_id ON employees(manager_id);
      CREATE INDEX idx_projects_is_active ON projects(is_active);
      CREATE INDEX idx_subprojects_project_id ON subprojects(project_id);
      CREATE INDEX idx_subprojects_is_active ON subprojects(is_active);
    `;

    // Execute migration
    await client.query('BEGIN');
    try {
      await client.query(basicMigration);

      // Record migration
      await client.query(`
        INSERT INTO schema_migrations (version, filename, checksum) 
        VALUES ('001_basic', '001_basic_schema.sql', 'test_checksum')
      `);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    // Verify tables were created
    const tables = ['employees', 'projects', 'subprojects'];
    for (const table of tables) {
      const result = await client.query(
        `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = $1 AND table_schema = 'public'
        ) as table_exists
      `,
        [table]
      );
      expect(result.rows[0].table_exists).toBe(true);
    }

    // Verify migration was recorded
    const migrationResult = await client.query(`
      SELECT version, filename FROM schema_migrations WHERE version = '001_basic'
    `);
    expect(migrationResult.rows).toHaveLength(1);
    expect(migrationResult.rows[0].filename).toBe('001_basic_schema.sql');
  });

  it('should insert Swiss business test data', async () => {
    // Ensure tables exist from previous test
    const hasEmployees = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'employees' AND table_schema = 'public'
      ) as table_exists
    `);

    if (!hasEmployees.rows[0].table_exists) {
      // Skip this test if tables don't exist
      return;
    }

    // Insert Swiss test data
    const managerResult = await client.query(`
      INSERT INTO employees (email, first_name, last_name, home_street, home_city, home_postal_code, home_latitude, home_longitude)
      VALUES ('hans.mueller@company.ch', 'Hans', 'Müller', 'Bahnhofstrasse 123', 'Zürich', '8001', 47.376887, 8.540192)
      RETURNING id
    `);

    const managerId = managerResult.rows[0].id;

    await client.query(
      `
      INSERT INTO employees (email, first_name, last_name, home_street, home_city, home_postal_code, home_latitude, home_longitude, manager_id)
      VALUES ('anna.schneider@company.ch', 'Anna', 'Schneider', 'Kramgasse 45', 'Bern', '3011', 46.947974, 7.447447, $1)
    `,
      [managerId]
    );

    // Insert project
    const projectResult = await client.query(`
      INSERT INTO projects (name, description, default_cost_per_km)
      VALUES ('Digital Transformation Initiative', 'Company-wide digital transformation project', 0.70)
      RETURNING id
    `);

    const projectId = projectResult.rows[0].id;

    // Insert subproject
    await client.query(
      `
      INSERT INTO subprojects (project_id, name, street_address, city, postal_code, latitude, longitude, cost_per_km)
      VALUES ($1, 'Geneva Digital Hub', 'Rue du Rhône 65', 'Genève', '1204', 46.204391, 6.143158, 0.70)
    `,
      [projectId]
    );

    // Verify data
    const employeeCount = await client.query('SELECT COUNT(*) as count FROM employees');
    expect(parseInt(employeeCount.rows[0].count)).toBe(2);

    const swissEmployees = await client.query(`
      SELECT first_name, last_name, home_city 
      FROM employees 
      WHERE home_country = 'Switzerland'
      ORDER BY first_name
    `);

    expect(swissEmployees.rows).toHaveLength(2);
    expect(swissEmployees.rows[0].first_name).toBe('Anna');
    expect(swissEmployees.rows[0].home_city).toBe('Bern');
    expect(swissEmployees.rows[1].first_name).toBe('Hans');
    expect(swissEmployees.rows[1].home_city).toBe('Zürich');
  });
});
