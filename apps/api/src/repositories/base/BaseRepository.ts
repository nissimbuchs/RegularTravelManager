import { db } from '../../database/connection';
import { logger } from '../../middleware/logger';

export abstract class BaseRepository {
  /**
   * Execute a query with parameters and return the result
   */
  protected async query(sql: string, params: any[] = []): Promise<any> {
    try {
      const result = await db.query(sql, params);
      return result;
    } catch (error) {
      logger.error('Database query failed', {
        sql: sql.substring(0, 200), // Log first 200 chars of SQL
        params,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Transform snake_case database columns to camelCase for API responses
   */
  protected toCamelCase(obj: any): any {
    if (!obj) {
      return obj;
    }

    const camelCaseObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      camelCaseObj[camelKey] = value;
    }
    return camelCaseObj;
  }

  /**
   * Transform array of database rows to camelCase
   */
  protected toCamelCaseArray(rows: any[]): any[] {
    return rows.map(row => this.toCamelCase(row));
  }

  /**
   * Build dynamic SET clause for UPDATE queries
   */
  protected buildUpdateClause(
    fields: Record<string, any>,
    startIndex: number = 1
  ): {
    setClauses: string[];
    values: any[];
    nextIndex: number;
  } {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = startIndex;

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        // Convert camelCase to snake_case for database
        const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        setClauses.push(`${dbKey} = $${paramIndex++}`);
        values.push(value);
      }
    }

    return { setClauses, values, nextIndex: paramIndex };
  }

  /**
   * Build dynamic WHERE clause for filtering
   */
  protected buildWhereClause(
    conditions: Record<string, any>,
    startIndex: number = 1
  ): {
    whereClause: string;
    values: any[];
    nextIndex: number;
  } {
    const whereParts: string[] = [];
    const values: any[] = [];
    let paramIndex = startIndex;

    for (const [key, value] of Object.entries(conditions)) {
      if (value !== undefined) {
        // Convert camelCase to snake_case for database
        const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        whereParts.push(`${dbKey} = $${paramIndex++}`);
        values.push(value);
      }
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
    return { whereClause, values, nextIndex: paramIndex };
  }
}
