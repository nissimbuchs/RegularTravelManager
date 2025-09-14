import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDatabaseConnection(): Pool {
  if (!pool) {
    const databaseUrl =
      process.env.DATABASE_URL ||
      'postgresql://nissim:devpass123@localhost:5432/travel_manager_dev';

    pool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    // Handle pool errors
    pool.on('error', err => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
}
