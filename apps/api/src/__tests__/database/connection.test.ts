import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, getDatabaseConfig } from '../../database/connection';

// Mock pg module
vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
    options: {
      max: 5,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 10000,
    },
  })),
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn(),
  })),
}));

describe('Database Connection Tests', () => {
  let mockPool: any;

  beforeEach(() => {
    const { Pool } = require('pg');
    mockPool = new Pool();
    vi.clearAllMocks();
  });

  describe('DatabaseConnection Configuration', () => {
    it('should configure database connection with correct pool settings', () => {
      const config = {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'test_user',
        password: 'test_pass',
        ssl: false,
        maxConnections: 10,
        connectionTimeoutMs: 5000,
        idleTimeoutMs: 2000,
      };

      db.configure(config);

      const { Pool } = require('pg');
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          user: 'test_user',
          password: 'test_pass',
          ssl: false,
          max: 10,
          min: 0,
          idleTimeoutMillis: 2000,
          connectionTimeoutMillis: 5000,
          allowExitOnIdle: true,
          application_name: 'travel-manager-api',
        })
      );
    });

    it('should handle SSL configuration correctly', () => {
      const config = {
        host: 'rds-proxy.amazonaws.com',
        port: 5432,
        database: 'prod_db',
        username: 'prod_user',
        password: 'prod_pass',
        ssl: true,
      };

      db.configure(config);

      const { Pool } = require('pg');
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false },
        })
      );
    });
  });

  describe('Query Execution', () => {
    it('should execute queries with timing and logging', async () => {
      const config = {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'test_user',
        password: 'test_pass',
      };

      db.configure(config);

      const mockQueryResult = { rows: [{ id: 1, name: 'test' }] };
      mockPool.query.mockResolvedValue(mockQueryResult);

      const result = await db.query('SELECT * FROM test WHERE id = $1', [1]);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', [1]);
      expect(result).toEqual(mockQueryResult);
    });

    it('should handle query errors properly', async () => {
      const config = {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'test_user',
        password: 'test_pass',
      };

      db.configure(config);

      const mockError = new Error('Database connection failed');
      mockPool.query.mockRejectedValue(mockError);

      await expect(db.query('SELECT * FROM test')).rejects.toThrow('Database connection failed');
    });
  });

  describe('Connection Pool Management', () => {
    it('should return connection pool information', async () => {
      const config = {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'test_user',
        password: 'test_pass',
        maxConnections: 5,
      };

      db.configure(config);

      const info = await db.getConnectionInfo();

      expect(info).toEqual({
        totalConnections: 0,
        idleConnections: 0,
        waitingClients: 0,
        config: {
          max: 5,
          idleTimeoutMs: 1000,
          connectionTimeoutMs: 10000,
        },
      });
    });

    it('should close connection pool properly', async () => {
      const config = {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'test_user',
        password: 'test_pass',
      };

      db.configure(config);
      await db.close();

      expect(mockPool.end).toHaveBeenCalled();
    });
  });

  describe('Environment Configuration', () => {
    it('should generate production configuration correctly', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        NODE_ENV: 'production',
        RDS_PROXY_ENDPOINT: 'rds-proxy.eu-central-1.rds.amazonaws.com',
        DB_PORT: '5432',
        DB_NAME: 'travel_manager_prod',
        DB_USERNAME: 'prod_user',
        DB_PASSWORD: 'secure_password',
      };

      const config = getDatabaseConfig();

      expect(config).toEqual({
        host: 'rds-proxy.eu-central-1.rds.amazonaws.com',
        port: 5432,
        database: 'travel_manager_prod',
        username: 'prod_user',
        password: 'secure_password',
        ssl: true,
        maxConnections: 3,
        connectionTimeoutMs: 5000,
        idleTimeoutMs: 1000,
      });

      process.env = originalEnv;
    });

    it('should generate development configuration correctly', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_NAME: 'travel_manager_dev',
        DB_USERNAME: 'nissim',
        DB_PASSWORD: '',
      };

      const config = getDatabaseConfig();

      expect(config).toEqual({
        host: 'localhost',
        port: 5432,
        database: 'travel_manager_dev',
        username: 'nissim',
        password: '',
        ssl: false,
        maxConnections: 10,
        connectionTimeoutMs: 10000,
        idleTimeoutMs: 30000,
      });

      process.env = originalEnv;
    });
  });

  describe('Database Testing Functions', () => {
    it('should test database connection successfully', async () => {
      const config = {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'test_user',
        password: 'test_pass',
      };

      db.configure(config);

      mockPool.query.mockResolvedValue({
        rows: [{ current_time: '2023-08-30T10:00:00Z', db_version: 'PostgreSQL 15.0' }],
      });

      const result = await db.testConnection();

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT NOW() as current_time, version() as db_version'
      );
    });

    it('should test PostGIS functionality correctly', async () => {
      const config = {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'test_user',
        password: 'test_pass',
      };

      db.configure(config);

      // Mock PostGIS distance calculation (Zürich to Bern ~94.5 km)
      mockPool.query.mockResolvedValue({
        rows: [{ distance_km: '94.567' }],
      });

      const result = await db.testPostGIS();

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('ST_Distance'));
    });

    it('should fail PostGIS test with incorrect distance', async () => {
      const config = {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        username: 'test_user',
        password: 'test_pass',
      };

      db.configure(config);

      // Mock incorrect distance calculation
      mockPool.query.mockResolvedValue({
        rows: [{ distance_km: '500.0' }], // Way too far for Zürich-Bern
      });

      const result = await db.testPostGIS();

      expect(result).toBe(false);
    });
  });
});
