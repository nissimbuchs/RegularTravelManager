import { describe, it, expect } from 'vitest';
import { getDatabaseConfig } from '../../database/connection';

describe('Database Connection Configuration Tests', () => {
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
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'password',
      };

      const config = getDatabaseConfig();

      expect(config).toEqual({
        host: 'localhost',
        port: 5432,
        database: 'travel_manager_dev',
        username: 'postgres',
        password: 'password',
        ssl: false,
        maxConnections: 10,
        connectionTimeoutMs: 10000,
        idleTimeoutMs: 30000,
      });

      process.env = originalEnv;
    });

    it('should use default values when environment variables are missing', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        NODE_ENV: 'test',
        // Remove database-specific env vars
      };
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;
      delete process.env.DB_NAME;
      delete process.env.DB_USERNAME;
      delete process.env.DB_PASSWORD;

      const config = getDatabaseConfig();

      expect(config.host).toBe('localhost');
      expect(config.port).toBe(5432);
      expect(config.database).toBe('travel_manager_dev');
      expect(config.ssl).toBe(false);

      process.env = originalEnv;
    });
  });

  describe('Configuration Validation', () => {
    it('should have appropriate connection limits for production', () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, NODE_ENV: 'production' };

      const config = getDatabaseConfig();

      expect(config.maxConnections).toBeLessThanOrEqual(5); // Lambda-appropriate
      expect(config.connectionTimeoutMs).toBeLessThanOrEqual(10000); // Reasonable timeout
      expect(config.idleTimeoutMs).toBeLessThanOrEqual(5000); // Quick cleanup

      process.env = originalEnv;
    });

    it('should enable SSL for production environments', () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, NODE_ENV: 'production' };

      const config = getDatabaseConfig();

      expect(config.ssl).toBe(true);

      process.env = originalEnv;
    });

    it('should disable SSL for development environments', () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, NODE_ENV: 'development' };

      const config = getDatabaseConfig();

      expect(config.ssl).toBe(false);

      process.env = originalEnv;
    });
  });
});
