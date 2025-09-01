import { Pool, PoolConfig } from 'pg';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
}

class DatabaseConnection {
  private pool: Pool | null = null;
  private config: DatabaseConfig | null = null;

  configure(config: DatabaseConfig): void {
    this.config = config;

    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,

      // Connection pool settings optimized for Lambda
      max: config.maxConnections || 5, // Small pool for Lambda - RDS Proxy handles scaling
      min: 0, // No minimum connections - Lambda functions start fresh
      idleTimeoutMillis: config.idleTimeoutMs || 1000, // Release connections quickly
      connectionTimeoutMillis: config.connectionTimeoutMs || 10000,

      // Lambda-specific optimizations
      allowExitOnIdle: true, // Allow process to exit when idle
      application_name: 'travel-manager-api',
    };

    this.pool = new Pool(poolConfig);

    // Connection pool event handlers for monitoring
    this.pool.on('connect', () => {
      console.log('Database connection established');
    });

    this.pool.on('error', err => {
      console.error('Database pool error:', err);
    });

    this.pool.on('acquire', () => {
      console.debug('Database connection acquired from pool');
    });

    this.pool.on('release', () => {
      console.debug('Database connection released to pool');
    });
  }

  async getPool(): Promise<Pool> {
    if (!this.pool) {
      throw new Error('Database not configured. Call configure() first.');
    }
    return this.pool;
  }

  async query(text: string, params?: any[]): Promise<any> {
    const pool = await this.getPool();
    const start = Date.now();

    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;

      console.debug(`Query executed in ${duration}ms: ${text.substring(0, 50)}...`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`Query failed after ${duration}ms:`, error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW() as current_time, version() as db_version');
      console.log('Database connection test successful:', result.rows[0]);
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  async testPostGIS(): Promise<boolean> {
    try {
      const result = await this.query(`
        SELECT 
          ST_Distance(
            ST_GeomFromText('POINT(8.540192 47.376887)', 4326)::geography,  -- Zürich
            ST_GeomFromText('POINT(7.447447 46.947974)', 4326)::geography   -- Bern
          ) / 1000.0 as distance_km
      `);

      const distanceKm = parseFloat(result.rows[0].distance_km);
      console.log(`PostGIS test successful. Zürich to Bern distance: ${distanceKm.toFixed(2)} km`);

      // Expected distance is approximately 94-95 km
      if (distanceKm > 90 && distanceKm < 100) {
        return true;
      } else {
        console.error('PostGIS distance calculation seems incorrect');
        return false;
      }
    } catch (error) {
      console.error('PostGIS test failed:', error);
      return false;
    }
  }

  async getConnectionInfo(): Promise<any> {
    const pool = await this.getPool();
    return {
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingClients: pool.waitingCount,
      config: {
        max: pool.options.max,
        idleTimeoutMs: pool.options.idleTimeoutMillis,
        connectionTimeoutMs: pool.options.connectionTimeoutMillis,
      },
    };
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('Database connection pool closed');
    }
  }
}

// Singleton instance for Lambda reuse
export const db = new DatabaseConnection();

// Lambda handler helper to ensure graceful shutdown
export async function withDatabaseConnection<T>(handler: () => Promise<T>): Promise<T> {
  try {
    return await handler();
  } finally {
    // In Lambda, we might want to keep connections alive for reuse
    // Only close on explicit shutdown or error
  }
}

// Configuration helpers for different environments
export function getDatabaseConfig(): DatabaseConfig {
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, use RDS Proxy endpoint
  if (isProduction) {
    return {
      host: process.env.RDS_PROXY_ENDPOINT || '',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'travel_manager',
      username: process.env.DB_USERNAME || '',
      password: process.env.DB_PASSWORD || '',
      ssl: true,
      maxConnections: 3, // Small pool when using RDS Proxy
      connectionTimeoutMs: 5000,
      idleTimeoutMs: 1000,
    };
  }

  // Development/test configuration
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'travel_manager_dev',
    username: process.env.DB_USERNAME || 'nissim',
    password: process.env.DB_PASSWORD || '',
    ssl: false,
    maxConnections: 10, // Larger pool for development
    connectionTimeoutMs: 10000,
    idleTimeoutMs: 30000,
  };
}

// Initialize database connection based on environment
export async function initializeDatabase(): Promise<void> {
  const config = getDatabaseConfig();
  db.configure(config);

  // Test connections
  const connectionOk = await db.testConnection();
  const postGisOk = await db.testPostGIS();

  if (!connectionOk) {
    throw new Error('Database connection failed');
  }

  if (!postGisOk) {
    throw new Error('PostGIS functionality test failed');
  }

  console.log('Database initialized successfully');
}

// Health check specific function
export async function testDatabaseConnection(): Promise<void> {
  if (!db) {
    throw new Error('Database not configured');
  }

  const isConnected = await db.testConnection();
  if (!isConnected) {
    throw new Error('Database connection test failed');
  }
}
