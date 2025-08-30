import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client } from 'pg';

describe('Basic Database Schema Tests (without PostGIS)', () => {
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

  beforeEach(async () => {
    // Clean up any existing tables
    const tables = [
      'request_status_history',
      'employee_address_history',
      'travel_requests',
      'subprojects',
      'projects',
      'employees',
    ];
    for (const table of tables) {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
  });

  describe('Basic Table Creation', () => {
    it('should create employees table without geometry columns', async () => {
      await client.query(`
        CREATE TABLE employees (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) NOT NULL UNIQUE,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          home_street VARCHAR(255) NOT NULL,
          home_city VARCHAR(100) NOT NULL,
          home_postal_code VARCHAR(20) NOT NULL,
          home_country VARCHAR(100) NOT NULL DEFAULT 'Switzerland',
          manager_id UUID REFERENCES employees(id),
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const result = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'employees' AND table_schema = 'public'
        ) as table_exists
      `);
      expect(result.rows[0].table_exists).toBe(true);
    });

    it('should create projects table with constraints', async () => {
      await client.query(`
        CREATE TABLE projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          default_cost_per_km DECIMAL(10,2) NOT NULL CHECK (default_cost_per_km > 0),
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const result = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'projects' AND table_schema = 'public'
        ) as table_exists
      `);
      expect(result.rows[0].table_exists).toBe(true);
    });

    it('should enforce positive cost constraint', async () => {
      await client.query(`
        CREATE TABLE projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          default_cost_per_km DECIMAL(10,2) NOT NULL CHECK (default_cost_per_km > 0),
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await expect(
        client.query(`
          INSERT INTO projects (name, default_cost_per_km)
          VALUES ('Test Project', -1.0)
        `)
      ).rejects.toThrow();
    });
  });

  describe('Basic Data Operations', () => {
    beforeEach(async () => {
      // Create basic tables for testing
      await client.query(`
        CREATE TABLE employees (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) NOT NULL UNIQUE,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          home_street VARCHAR(255) NOT NULL,
          home_city VARCHAR(100) NOT NULL,
          home_postal_code VARCHAR(20) NOT NULL,
          home_country VARCHAR(100) NOT NULL DEFAULT 'Switzerland',
          manager_id UUID REFERENCES employees(id),
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          default_cost_per_km DECIMAL(10,2) NOT NULL CHECK (default_cost_per_km > 0),
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });

    it('should insert and retrieve employee data', async () => {
      const insertResult = await client.query(`
        INSERT INTO employees (email, first_name, last_name, home_street, home_city, home_postal_code)
        VALUES ('test@example.com', 'Test', 'User', 'Test Street 1', 'Zürich', '8001')
        RETURNING id, email, first_name, last_name
      `);

      expect(insertResult.rows).toHaveLength(1);
      expect(insertResult.rows[0].email).toBe('test@example.com');
      expect(insertResult.rows[0].first_name).toBe('Test');
      expect(insertResult.rows[0].last_name).toBe('User');

      const selectResult = await client.query(`
        SELECT email, first_name, last_name, home_city, home_country
        FROM employees 
        WHERE email = 'test@example.com'
      `);

      expect(selectResult.rows).toHaveLength(1);
      expect(selectResult.rows[0].home_city).toBe('Zürich');
      expect(selectResult.rows[0].home_country).toBe('Switzerland');
    });

    it('should enforce email uniqueness', async () => {
      await client.query(`
        INSERT INTO employees (email, first_name, last_name, home_street, home_city, home_postal_code)
        VALUES ('unique@example.com', 'First', 'User', 'Street 1', 'City 1', '1001')
      `);

      await expect(
        client.query(`
          INSERT INTO employees (email, first_name, last_name, home_street, home_city, home_postal_code)
          VALUES ('unique@example.com', 'Second', 'User', 'Street 2', 'City 2', '2002')
        `)
      ).rejects.toThrow();
    });

    it('should handle manager-employee relationships', async () => {
      // Insert manager first
      const managerResult = await client.query(`
        INSERT INTO employees (email, first_name, last_name, home_street, home_city, home_postal_code)
        VALUES ('manager@example.com', 'Manager', 'User', 'Manager St', 'Zürich', '8001')
        RETURNING id
      `);

      const managerId = managerResult.rows[0].id;

      // Insert employee with manager relationship
      await client.query(
        `
        INSERT INTO employees (email, first_name, last_name, home_street, home_city, home_postal_code, manager_id)
        VALUES ('employee@example.com', 'Employee', 'User', 'Employee St', 'Bern', '3000', $1)
        RETURNING id
      `,
        [managerId]
      );

      // Verify relationship
      const relationshipResult = await client.query(`
        SELECT e.first_name as employee_name, m.first_name as manager_name
        FROM employees e
        JOIN employees m ON e.manager_id = m.id
        WHERE e.email = 'employee@example.com'
      `);

      expect(relationshipResult.rows).toHaveLength(1);
      expect(relationshipResult.rows[0].employee_name).toBe('Employee');
      expect(relationshipResult.rows[0].manager_name).toBe('Manager');
    });
  });
});
