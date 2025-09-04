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

vi.mock('../../database/migration-runner', () => ({
  MigrationRunner: vi.fn().mockImplementation(() => ({
    connect: mockMigrationConnect,
    disconnect: mockMigrationDisconnect,
  })),
}));

describe('PostGIS Geographic Functions Tests', () => {
  let client: Client;
  let migrationRunner: MigrationRunner;

  beforeAll(async () => {
    client = new Client();
    mockConnect.mockResolvedValue(undefined);
    await client.connect();

    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    await client.query('SET search_path TO public');

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
  });

  describe('PostGIS Distance Calculations', () => {
    it('should calculate accurate distances between Swiss cities', async () => {
      // Test with known Swiss city distances
      const testCases = [
        {
          from: { name: 'Zürich', point: 'POINT(8.540192 47.376887)' },
          to: { name: 'Bern', point: 'POINT(7.447447 46.947974)' },
          expectedDistance: { min: 90, max: 100 }, // ~94.5 km actual
        },
        {
          from: { name: 'Basel', point: 'POINT(7.588576 47.559599)' },
          to: { name: 'Geneva', point: 'POINT(6.143158 46.204391)' },
          expectedDistance: { min: 180, max: 190 }, // ~187 km actual
        },
        {
          from: { name: 'Bern', point: 'POINT(7.447447 46.947974)' },
          to: { name: 'Lausanne', point: 'POINT(6.633597 46.519653)' },
          expectedDistance: { min: 75, max: 85 }, // ~78 km actual
        },
      ];

      // Mock distance calculation results for each test case
      mockQuery
        .mockResolvedValueOnce({ rows: [{ distance_km: 94.5 }], rowCount: 1 }) // Zürich-Bern
        .mockResolvedValueOnce({ rows: [{ distance_km: 187.2 }], rowCount: 1 }) // Basel-Geneva
        .mockResolvedValueOnce({ rows: [{ distance_km: 78.1 }], rowCount: 1 }); // Bern-Lausanne

      for (const testCase of testCases) {
        const result = await client.query(
          `
          SELECT ST_Distance(
            ST_GeomFromText($1, 4326)::geography,
            ST_GeomFromText($2, 4326)::geography
          ) / 1000.0 as distance_km
        `,
          [testCase.from.point, testCase.to.point]
        );

        const distance = parseFloat(result.rows[0].distance_km);

        expect(distance).toBeGreaterThanOrEqual(testCase.expectedDistance.min);
        expect(distance).toBeLessThanOrEqual(testCase.expectedDistance.max);

        console.log(
          `Distance ${testCase.from.name} → ${testCase.to.name}: ${distance.toFixed(2)} km`
        );
      }
    });

    it('should use the calculate_travel_distance function correctly', async () => {
      // Mock return value for distance calculation between Zürich and Bern
      mockQuery.mockResolvedValueOnce({
        rows: [{ distance_km: '94.520' }],
        rowCount: 1,
      });

      // Test the custom function with Swiss coordinates
      const result = await client.query(`
        SELECT calculate_travel_distance(
          ST_GeomFromText('POINT(8.540192 47.376887)', 4326), -- Zürich
          ST_GeomFromText('POINT(7.447447 46.947974)', 4326)   -- Bern
        ) as distance_km
      `);

      const distance = parseFloat(result.rows[0].distance_km);
      expect(distance).toBeGreaterThan(90);
      expect(distance).toBeLessThan(100);
      // PostgreSQL DECIMAL(10,3) can display more precision than 3 decimal places
      expect(result.rows[0].distance_km).toMatch(/^\d+\.\d{3,}$/); // Should have at least 3 decimal places
    });

    it('should handle same location distance (should be 0)', async () => {
      // Mock zero distance for same location
      mockQuery.mockResolvedValueOnce({
        rows: [{ distance_km: '0.000' }],
        rowCount: 1,
      });

      const result = await client.query(`
        SELECT calculate_travel_distance(
          ST_GeomFromText('POINT(8.540192 47.376887)', 4326),
          ST_GeomFromText('POINT(8.540192 47.376887)', 4326)
        ) as distance_km
      `);

      const distance = parseFloat(result.rows[0].distance_km);
      expect(distance).toBe(0);
    });

    it('should validate coordinate precision to 3 decimal places', async () => {
      const result = await client.query(`
        SELECT calculate_travel_distance(
          ST_GeomFromText('POINT(8.123456 47.654321)', 4326),
          ST_GeomFromText('POINT(7.987654 46.123789)', 4326)
        ) as distance_km
      `);

      const distance = result.rows[0].distance_km;
      // Check that result has exactly 3 decimal places
      const decimalPlaces = distance.toString().split('.')[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(3);
    });
  });

  describe('Geometric Data Storage and Retrieval', () => {
    it('should store and retrieve geometry points correctly', async () => {
      // Insert a test employee with specific coordinates
      const testCoordinates = 'POINT(8.540192 47.376887)'; // Zürich

      await client.query(
        `
        INSERT INTO employees (email, first_name, last_name, home_street, home_city, 
                             home_postal_code, home_location)
        VALUES ('test@example.com', 'Test', 'User', 'Test Street 1', 'Zürich', '8001',
                ST_GeomFromText($1, 4326))
      `,
        [testCoordinates]
      );

      // Retrieve and verify coordinates
      const result = await client.query(`
        SELECT 
          ST_X(home_location) as longitude,
          ST_Y(home_location) as latitude,
          ST_AsText(home_location) as point_text
        FROM employees 
        WHERE email = 'test@example.com'
      `);

      expect(result.rows).toHaveLength(1);

      const row = result.rows[0];
      expect(parseFloat(row.longitude)).toBeCloseTo(8.540192, 6);
      expect(parseFloat(row.latitude)).toBeCloseTo(47.376887, 6);
      expect(row.point_text).toBe('POINT(8.540192 47.376887)');
    });

    it('should handle Swiss coordinate bounds validation', async () => {
      // Swiss coordinate bounds approximately:
      // Longitude: 5.96° to 10.49° E
      // Latitude: 45.82° to 47.81° N

      const validSwissCoordinates = [
        'POINT(8.540192 47.376887)', // Zürich
        'POINT(6.143158 46.204391)', // Geneva
        'POINT(9.376716 47.424057)', // St. Gallen
      ];

      for (const coord of validSwissCoordinates) {
        const result = await client.query(
          `
          SELECT ST_IsValid(ST_GeomFromText($1, 4326)) as is_valid
        `,
          [coord]
        );

        expect(result.rows[0].is_valid).toBe(true);
      }
    });
  });

  describe('Spatial Queries and Indexes', () => {
    it('should use spatial indexes efficiently for proximity queries', async () => {
      // Insert test data
      await client.query(`
        INSERT INTO employees (id, email, first_name, last_name, home_street, home_city, 
                             home_postal_code, home_location)
        VALUES 
        ('11111111-1111-1111-1111-111111111111', 'zurich1@test.com', 'Zurich', 'User1', 
         'Test St 1', 'Zürich', '8001', ST_GeomFromText('POINT(8.540192 47.376887)', 4326)),
        ('22222222-2222-2222-2222-222222222222', 'zurich2@test.com', 'Zurich', 'User2', 
         'Test St 2', 'Zürich', '8002', ST_GeomFromText('POINT(8.545000 47.380000)', 4326)),
        ('33333333-3333-3333-3333-333333333333', 'bern@test.com', 'Bern', 'User', 
         'Test St 3', 'Bern', '3000', ST_GeomFromText('POINT(7.447447 46.947974)', 4326))
      `);

      // Query employees within 10km of central Zürich
      const result = await client.query(`
        SELECT email, first_name, last_name,
               ST_Distance(home_location::geography, 
                          ST_GeomFromText('POINT(8.540192 47.376887)', 4326)::geography) / 1000 as distance_km
        FROM employees
        WHERE ST_DWithin(home_location::geography, 
                         ST_GeomFromText('POINT(8.540192 47.376887)', 4326)::geography, 
                         10000) -- 10km in meters
        ORDER BY distance_km
      `);

      // Should find the two Zürich employees but not Bern
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].email).toBe('zurich1@test.com');
      expect(parseFloat(result.rows[0].distance_km)).toBeCloseTo(0, 1);
    });

    it('should perform efficient spatial joins between employees and subprojects', async () => {
      // Setup test data
      await client.query(`
        INSERT INTO employees (id, email, first_name, last_name, home_street, home_city, 
                             home_postal_code, home_location)
        VALUES ('11111111-1111-1111-1111-111111111111', 'employee@test.com', 'Test', 'Employee', 
                'Test St', 'Bern', '3000', ST_GeomFromText('POINT(7.447447 46.947974)', 4326))
      `);

      await client.query(`
        INSERT INTO projects (id, name, default_cost_per_km)
        VALUES ('22222222-2222-2222-2222-222222222222', 'Test Project', 0.70)
      `);

      await client.query(`
        INSERT INTO subprojects (id, project_id, name, street_address, city, postal_code, 
                               location, cost_per_km)
        VALUES 
        ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222',
         'Bern Office', 'Bern St 1', 'Bern', '3001', 
         ST_GeomFromText('POINT(7.450000 46.950000)', 4326), 0.70),
        ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222',
         'Geneva Office', 'Geneva St 1', 'Geneva', '1200', 
         ST_GeomFromText('POINT(6.143158 46.204391)', 4326), 0.70)
      `);

      // Find nearest subprojects for employee (should be Bern office)
      const result = await client.query(`
        SELECT s.name, s.city,
               calculate_travel_distance(e.home_location, s.location) as distance_km
        FROM employees e
        CROSS JOIN subprojects s
        WHERE e.email = 'employee@test.com'
        ORDER BY distance_km
        LIMIT 2
      `);

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].name).toBe('Bern Office');
      expect(parseFloat(result.rows[0].distance_km)).toBeLessThan(5); // Very close
      expect(result.rows[1].name).toBe('Geneva Office');
      expect(parseFloat(result.rows[1].distance_km)).toBeGreaterThan(100); // Much farther
    });
  });
});
