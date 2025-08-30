import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client } from 'pg';
import { MigrationRunner } from '../../database/migration-runner';

describe('Database Schema Tests', () => {
  let client: Client;
  let migrationRunner: MigrationRunner;
  const testDbUrl =
    process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/travel_manager_test';

  beforeAll(async () => {
    client = new Client({ connectionString: testDbUrl });
    await client.connect();
    // Ensure we're using the public schema
    await client.query('SET search_path TO public');
    migrationRunner = new MigrationRunner(testDbUrl);
    await migrationRunner.connect();
  });

  afterAll(async () => {
    await client.end();
    await migrationRunner.disconnect();
  });

  beforeEach(async () => {
    // Reset database for each test
    try {
      // Drop all tables in correct order
      const tables = [
        'request_status_history',
        'employee_address_history',
        'travel_requests',
        'subprojects',
        'projects',
        'employees',
        'schema_migrations',
      ];

      for (const table of tables) {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      }

      // Run migrations fresh
      await migrationRunner.runAllMigrations();
    } catch (error) {
      console.log('Reset error (may be expected):', error.message);
      // Continue anyway - fresh migration should work
      await migrationRunner.runAllMigrations();
    }
  });

  describe('PostGIS Extension', () => {
    it('should have PostGIS extension enabled', async () => {
      const result = await client.query(`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'postgis'
        ) as postgis_enabled
      `);
      expect(result.rows[0].postgis_enabled).toBe(true);
    });

    it('should have uuid-ossp extension enabled', async () => {
      const result = await client.query(`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
        ) as uuid_enabled
      `);
      expect(result.rows[0].uuid_enabled).toBe(true);
    });
  });

  describe('Table Creation', () => {
    it('should create all required tables', async () => {
      const expectedTables = [
        'employees',
        'projects',
        'subprojects',
        'travel_requests',
        'employee_address_history',
        'request_status_history',
      ];

      for (const table of expectedTables) {
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
    });

    it('should have correct column types for employees table', async () => {
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'employees'
        ORDER BY ordinal_position
      `);

      const columns = result.rows.reduce((acc, row) => {
        acc[row.column_name] = {
          type: row.data_type,
          nullable: row.is_nullable === 'YES',
          default: row.column_default,
        };
        return acc;
      }, {});

      expect(columns.id.type).toBe('uuid');
      expect(columns.email.type).toBe('character varying');
      expect(columns.home_location.type).toBe('USER-DEFINED'); // PostGIS geometry type
      expect(columns.is_active.nullable).toBe(false);
    });
  });

  describe('Foreign Key Constraints', () => {
    it('should enforce manager_id foreign key in employees table', async () => {
      // Try to insert employee with non-existent manager
      await expect(
        client.query(`
          INSERT INTO employees (email, first_name, last_name, home_street, home_city, 
                               home_postal_code, home_location, manager_id)
          VALUES ('test@example.com', 'Test', 'User', 'Test St', 'Test City', '1234',
                  ST_GeomFromText('POINT(8.0 47.0)', 4326), 
                  '00000000-0000-0000-0000-000000000000')
        `)
      ).rejects.toThrow();
    });

    it('should enforce project_id foreign key in subprojects table', async () => {
      await expect(
        client.query(`
          INSERT INTO subprojects (project_id, name, street_address, city, postal_code, 
                                 location, cost_per_km)
          VALUES ('00000000-0000-0000-0000-000000000000', 'Test Project', 'Test St', 
                  'Test City', '1234', ST_GeomFromText('POINT(8.0 47.0)', 4326), 1.0)
        `)
      ).rejects.toThrow();
    });
  });

  describe('Business Rule Constraints', () => {
    it('should enforce positive cost_per_km in projects table', async () => {
      await expect(
        client.query(`
          INSERT INTO projects (name, default_cost_per_km)
          VALUES ('Test Project', -1.0)
        `)
      ).rejects.toThrow();
    });

    it('should enforce valid status values in travel_requests', async () => {
      // First create required reference data
      await client.query(`
        INSERT INTO employees (id, email, first_name, last_name, home_street, home_city, 
                             home_postal_code, home_location)
        VALUES ('11111111-1111-1111-1111-111111111111', 'manager@test.com', 'Manager', 
                'User', 'Test St', 'Test City', '1234',
                ST_GeomFromText('POINT(8.0 47.0)', 4326))
      `);

      await client.query(`
        INSERT INTO employees (id, email, first_name, last_name, home_street, home_city, 
                             home_postal_code, home_location, manager_id)
        VALUES ('22222222-2222-2222-2222-222222222222', 'employee@test.com', 'Employee', 
                'User', 'Test St', 'Test City', '1234',
                ST_GeomFromText('POINT(8.0 47.0)', 4326),
                '11111111-1111-1111-1111-111111111111')
      `);

      await client.query(`
        INSERT INTO projects (id, name, default_cost_per_km)
        VALUES ('33333333-3333-3333-3333-333333333333', 'Test Project', 1.0)
      `);

      await client.query(`
        INSERT INTO subprojects (id, project_id, name, street_address, city, postal_code, 
                               location, cost_per_km)
        VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
                'Test Subproject', 'Test St', 'Test City', '1234',
                ST_GeomFromText('POINT(8.0 47.0)', 4326), 1.0)
      `);

      // Now try invalid status
      await expect(
        client.query(`
          INSERT INTO travel_requests (employee_id, manager_id, project_id, subproject_id,
                                     days_per_week, justification, status, 
                                     calculated_distance_km, calculated_allowance_chf)
          VALUES ('22222222-2222-2222-2222-222222222222', 
                  '11111111-1111-1111-1111-111111111111',
                  '33333333-3333-3333-3333-333333333333',
                  '44444444-4444-4444-4444-444444444444',
                  3, 'Valid justification text', 'invalid_status', 10.5, 25.0)
        `)
      ).rejects.toThrow();
    });

    it('should enforce days_per_week range (1-7)', async () => {
      // Setup reference data first
      await client.query(`
        INSERT INTO employees (id, email, first_name, last_name, home_street, home_city, 
                             home_postal_code, home_location)
        VALUES ('11111111-1111-1111-1111-111111111111', 'manager@test.com', 'Manager', 
                'User', 'Test St', 'Test City', '1234',
                ST_GeomFromText('POINT(8.0 47.0)', 4326))
      `);

      await client.query(`
        INSERT INTO employees (id, email, first_name, last_name, home_street, home_city, 
                             home_postal_code, home_location, manager_id)
        VALUES ('22222222-2222-2222-2222-222222222222', 'employee@test.com', 'Employee', 
                'User', 'Test St', 'Test City', '1234',
                ST_GeomFromText('POINT(8.0 47.0)', 4326),
                '11111111-1111-1111-1111-111111111111')
      `);

      await client.query(`
        INSERT INTO projects (id, name, default_cost_per_km)
        VALUES ('33333333-3333-3333-3333-333333333333', 'Test Project', 1.0)
      `);

      await client.query(`
        INSERT INTO subprojects (id, project_id, name, street_address, city, postal_code, 
                               location, cost_per_km)
        VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
                'Test Subproject', 'Test St', 'Test City', '1234',
                ST_GeomFromText('POINT(8.0 47.0)', 4326), 1.0)
      `);

      // Test invalid days_per_week values
      await expect(
        client.query(`
          INSERT INTO travel_requests (employee_id, manager_id, project_id, subproject_id,
                                     days_per_week, justification, status, 
                                     calculated_distance_km, calculated_allowance_chf)
          VALUES ('22222222-2222-2222-2222-222222222222', 
                  '11111111-1111-1111-1111-111111111111',
                  '33333333-3333-3333-3333-333333333333',
                  '44444444-4444-4444-4444-444444444444',
                  0, 'Valid justification text', 'pending', 10.5, 25.0)
        `)
      ).rejects.toThrow();

      await expect(
        client.query(`
          INSERT INTO travel_requests (employee_id, manager_id, project_id, subproject_id,
                                     days_per_week, justification, status, 
                                     calculated_distance_km, calculated_allowance_chf)
          VALUES ('22222222-2222-2222-2222-222222222222', 
                  '11111111-1111-1111-1111-111111111111',
                  '33333333-3333-3333-3333-333333333333',
                  '44444444-4444-4444-4444-444444444444',
                  8, 'Valid justification text', 'pending', 10.5, 25.0)
        `)
      ).rejects.toThrow();
    });

    it('should enforce minimum justification length', async () => {
      // Setup reference data
      await client.query(`
        INSERT INTO employees (id, email, first_name, last_name, home_street, home_city, 
                             home_postal_code, home_location)
        VALUES ('11111111-1111-1111-1111-111111111111', 'manager@test.com', 'Manager', 
                'User', 'Test St', 'Test City', '1234',
                ST_GeomFromText('POINT(8.0 47.0)', 4326))
      `);

      await client.query(`
        INSERT INTO employees (id, email, first_name, last_name, home_street, home_city, 
                             home_postal_code, home_location, manager_id)
        VALUES ('22222222-2222-2222-2222-222222222222', 'employee@test.com', 'Employee', 
                'User', 'Test St', 'Test City', '1234',
                ST_GeomFromText('POINT(8.0 47.0)', 4326),
                '11111111-1111-1111-1111-111111111111')
      `);

      await client.query(`
        INSERT INTO projects (id, name, default_cost_per_km)
        VALUES ('33333333-3333-3333-3333-333333333333', 'Test Project', 1.0)
      `);

      await client.query(`
        INSERT INTO subprojects (id, project_id, name, street_address, city, postal_code, 
                               location, cost_per_km)
        VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
                'Test Subproject', 'Test St', 'Test City', '1234',
                ST_GeomFromText('POINT(8.0 47.0)', 4326), 1.0)
      `);

      // Test too short justification
      await expect(
        client.query(`
          INSERT INTO travel_requests (employee_id, manager_id, project_id, subproject_id,
                                     days_per_week, justification, status, 
                                     calculated_distance_km, calculated_allowance_chf)
          VALUES ('22222222-2222-2222-2222-222222222222', 
                  '11111111-1111-1111-1111-111111111111',
                  '33333333-3333-3333-3333-333333333333',
                  '44444444-4444-4444-4444-444444444444',
                  3, 'Too short', 'pending', 10.5, 25.0)
        `)
      ).rejects.toThrow();
    });
  });

  describe('Database Indexes', () => {
    it('should have spatial indexes on geometry columns', async () => {
      const result = await client.query(`
        SELECT indexname, tablename, indexdef
        FROM pg_indexes 
        WHERE tablename IN ('employees', 'subprojects')
        AND indexdef LIKE '%USING gist%'
      `);

      const spatialIndexes = result.rows.map(row => row.indexname);
      expect(spatialIndexes).toContain('idx_employees_location');
      expect(spatialIndexes).toContain('idx_subprojects_location');
    });

    it('should have performance indexes on frequently queried columns', async () => {
      const result = await client.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'travel_requests'
      `);

      const indexes = result.rows.map(row => row.indexname);
      expect(indexes).toContain('idx_travel_requests_employee_id');
      expect(indexes).toContain('idx_travel_requests_manager_id');
      expect(indexes).toContain('idx_travel_requests_status');
    });
  });
});
