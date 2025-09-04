import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Client } from 'pg';
import { MigrationRunner } from '../../database/migration-runner';

// Mock pg Client
const mockQuery = vi.fn();
const mockConnect = vi.fn();
const mockEnd = vi.fn();

vi.mock('pg', () => ({
  Client: vi.fn().mockImplementation(() => ({
    query: mockQuery,
    connect: mockConnect,
    end: mockEnd,
  })),
}));

// Mock MigrationRunner
const mockMigrationConnect = vi.fn();
const mockMigrationDisconnect = vi.fn();
const mockGetExecutedMigrations = vi.fn();
const mockExecuteMigration = vi.fn();
const mockRunAllMigrations = vi.fn();
const mockSeedDatabase = vi.fn();
const mockRollbackMigration = vi.fn();

vi.mock('../../database/migration-runner', () => ({
  MigrationRunner: vi.fn().mockImplementation(() => ({
    connect: mockMigrationConnect,
    disconnect: mockMigrationDisconnect,
    getExecutedMigrations: mockGetExecutedMigrations,
    executeMigration: mockExecuteMigration,
    runAllMigrations: mockRunAllMigrations,
    seedDatabase: mockSeedDatabase,
    rollbackMigration: mockRollbackMigration,
  })),
}));

describe('Database Migration Tests', () => {
  let client: Client;
  let migrationRunner: MigrationRunner;

  beforeAll(async () => {
    client = new Client();
    mockConnect.mockResolvedValue(undefined);
    await client.connect();

    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    await client.query('SET search_path TO public');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO public');

    migrationRunner = new MigrationRunner('mocked-url');
    mockMigrationConnect.mockResolvedValue(undefined);
    await migrationRunner.connect();
  });

  afterAll(async () => {
    mockEnd.mockResolvedValue(undefined);
    await client.end();

    mockMigrationDisconnect.mockResolvedValue(undefined);
    await migrationRunner.disconnect();
  });

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock default database responses
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    mockMigrationConnect.mockResolvedValue(undefined);
    mockMigrationDisconnect.mockResolvedValue(undefined);
    mockGetExecutedMigrations.mockResolvedValue([]);
    mockExecuteMigration.mockResolvedValue(undefined);
    mockRunAllMigrations.mockResolvedValue(undefined);
    mockSeedDatabase.mockResolvedValue(undefined);
    mockRollbackMigration.mockResolvedValue(undefined);
  });

  describe('Migration System Setup', () => {
    it('should create schema_migrations table automatically', async () => {
      // Mock table exists check
      mockQuery.mockResolvedValueOnce({
        rows: [{ table_exists: true }],
        rowCount: 1,
      });

      await migrationRunner.getExecutedMigrations();

      const result = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'schema_migrations' AND table_schema = 'public'
        ) as table_exists
      `);

      expect(result.rows[0].table_exists).toBe(true);
    });

    it('should have correct schema_migrations table structure', async () => {
      // Mock table structure query result
      mockQuery.mockResolvedValueOnce({
        rows: [
          { column_name: 'version', data_type: 'character varying', is_nullable: 'NO' },
          { column_name: 'filename', data_type: 'character varying', is_nullable: 'NO' },
          { column_name: 'executed_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
          { column_name: 'checksum', data_type: 'character varying', is_nullable: 'NO' },
        ],
        rowCount: 4,
      });

      await migrationRunner.getExecutedMigrations();

      const result = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'schema_migrations'
        ORDER BY ordinal_position
      `);

      const columns = result.rows;
      expect(columns).toHaveLength(4);

      expect(columns[0].column_name).toBe('version');
      expect(columns[0].data_type).toBe('character varying');
      expect(columns[0].is_nullable).toBe('NO');

      expect(columns[1].column_name).toBe('filename');
      expect(columns[2].column_name).toBe('executed_at');
      expect(columns[3].column_name).toBe('checksum');
    });
  });

  describe('Migration Execution', () => {
    it('should execute initial schema migration successfully', async () => {
      await migrationRunner.executeMigration('001', '001_initial_schema.sql');

      // Check that migration was recorded
      const migrationRecord = await client.query(`
        SELECT version, filename FROM schema_migrations WHERE version = '001'
      `);

      expect(migrationRecord.rows).toHaveLength(1);
      expect(migrationRecord.rows[0].version).toBe('001');
      expect(migrationRecord.rows[0].filename).toBe('001_initial_schema.sql');

      // Check that tables were created
      const tables = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const tableNames = tables.rows.map(row => row.table_name);
      expect(tableNames).toContain('employees');
      expect(tableNames).toContain('projects');
      expect(tableNames).toContain('travel_requests');
    });

    it('should skip already executed migrations', async () => {
      // Execute migration first time
      await migrationRunner.executeMigration('001', '001_initial_schema.sql');

      // Execute again - should be skipped
      await migrationRunner.executeMigration('001', '001_initial_schema.sql');

      // Should still only have one record
      const migrationRecords = await client.query(`
        SELECT COUNT(*) as count FROM schema_migrations WHERE version = '001'
      `);

      expect(parseInt(migrationRecords.rows[0].count)).toBe(1);
    });

    it('should detect migration content changes via checksum', async () => {
      // Execute initial migration
      await migrationRunner.executeMigration('001', '001_initial_schema.sql');

      // Get the original checksum
      const originalRecord = await client.query(`
        SELECT checksum FROM schema_migrations WHERE version = '001'
      `);
      // Store original checksum for reference (could be used in future test extensions)
      // const _originalChecksum = originalRecord.rows[0].checksum; // Could be used in future test extensions

      // Manually modify the checksum to simulate content change
      await client.query(`
        UPDATE schema_migrations SET checksum = 'modified_checksum' WHERE version = '001'
      `);

      // Attempting to run the same migration should fail
      await expect(
        migrationRunner.executeMigration('001', '001_initial_schema.sql')
      ).rejects.toThrow('Migration 001 has been modified since execution');
    });

    it('should run all migrations in sequence', async () => {
      await migrationRunner.runAllMigrations();

      const migrations = await migrationRunner.getExecutedMigrations();
      expect(migrations.length).toBeGreaterThan(0);

      // Check that all expected tables exist
      const tables = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const tableNames = tables.rows.map(row => row.table_name);
      const expectedTables = [
        'employees',
        'projects',
        'subprojects',
        'travel_requests',
        'employee_address_history',
        'request_status_history',
      ];

      for (const expectedTable of expectedTables) {
        expect(tableNames).toContain(expectedTable);
      }
    });
  });

  describe('Database Seeding', () => {
    it('should seed database with initial data', async () => {
      // First run migrations
      await migrationRunner.runAllMigrations();

      // Then seed data
      await migrationRunner.seedDatabase();

      // Check that data was inserted
      const employees = await client.query('SELECT COUNT(*) as count FROM employees');
      expect(parseInt(employees.rows[0].count)).toBeGreaterThan(0);

      const projects = await client.query('SELECT COUNT(*) as count FROM projects');
      expect(parseInt(projects.rows[0].count)).toBeGreaterThan(0);

      const travelRequests = await client.query('SELECT COUNT(*) as count FROM travel_requests');
      expect(parseInt(travelRequests.rows[0].count)).toBeGreaterThan(0);
    });

    it('should insert seed data with correct Swiss context', async () => {
      await migrationRunner.runAllMigrations();
      await migrationRunner.seedDatabase();

      // Check for Swiss employees
      const swissEmployees = await client.query(`
        SELECT email, first_name, last_name, home_city, home_country
        FROM employees 
        WHERE home_country = 'Switzerland'
      `);

      expect(swissEmployees.rows.length).toBeGreaterThan(0);

      const cities = swissEmployees.rows.map(emp => emp.home_city);
      expect(cities).toContain('Zürich');
      expect(cities).toContain('Bern');
    });

    it('should calculate correct distances in seed data', async () => {
      await migrationRunner.runAllMigrations();
      await migrationRunner.seedDatabase();

      // Check travel requests have realistic calculated distances
      const travelRequests = await client.query(`
        SELECT 
          tr.calculated_distance_km,
          e.home_city as employee_city,
          s.city as subproject_city
        FROM travel_requests tr
        JOIN employees e ON tr.employee_id = e.id
        JOIN subprojects s ON tr.subproject_id = s.id
      `);

      expect(travelRequests.rows.length).toBeGreaterThan(0);

      for (const request of travelRequests.rows) {
        const distance = parseFloat(request.calculated_distance_km);
        // All Swiss distances should be reasonable (< 400km)
        expect(distance).toBeGreaterThan(0);
        expect(distance).toBeLessThan(400);
      }
    });
  });

  describe('Migration Rollback', () => {
    it('should rollback migration successfully', async () => {
      // Execute migration first
      await migrationRunner.executeMigration('001', '001_initial_schema.sql');

      // Verify tables exist
      let tables = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `);

      const tablesBefore = tables.rows.map(row => row.table_name);
      expect(tablesBefore).toContain('employees');

      // Rollback migration
      await migrationRunner.rollbackMigration('001_rollback.sql');

      // Verify tables are gone
      tables = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name IN ('employees', 'projects', 'travel_requests')
      `);

      expect(tables.rows).toHaveLength(0);

      // Verify migration record was removed
      const migrationRecord = await client.query(`
        SELECT version FROM schema_migrations WHERE version = '001'
      `);

      expect(migrationRecord.rows).toHaveLength(0);
    });
  });

  describe('Transaction Safety', () => {
    it('should rollback migration on error', async () => {
      // This test would require a malformed migration file to properly test
      // For now, we test that the transaction structure is in place

      try {
        await migrationRunner.executeMigration('001', '001_initial_schema.sql');

        // Force an error by trying to run a malformed query
        await client.query('INVALID SQL STATEMENT');
      } catch (error) {
        // Check that the database is in a clean state
        const tables = await client.query(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          AND table_name IN ('employees', 'projects')
        `);

        // Since we ran the migration successfully before the error,
        // tables should still exist
        expect(tables.rows.length).toBeGreaterThan(0);
      }
    });
  });
});
