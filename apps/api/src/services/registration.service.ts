import { Pool } from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { logger } from '../middleware/logger';
import { RegisterRequest, VerificationToken, Address } from '@rtm/shared';
import { getDatabaseConnection } from '../utils/database';

export interface EmployeeRecord {
  id: string;
  cognitoUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  homeAddress: string;
  homeCoordinates?: { x: number; y: number };
  role: 'employee' | 'manager' | 'admin';
  isActive: boolean;
  registeredAt: Date;
  emailVerifiedAt?: Date;
  profileCompletedAt?: Date;
}

export class RegistrationService {
  private db: Pool;

  constructor() {
    this.db = getDatabaseConnection();
  }

  /**
   * Generate secure verification token with 24-hour expiration
   */
  generateVerificationToken(): { token: string; expiresAt: Date } {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour validity

    return { token, expiresAt };
  }

  /**
   * Hash password using bcrypt for temporary storage if needed
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Store verification token in database
   */
  async createVerificationToken(
    email: string,
    token: string,
    expiresAt: Date
  ): Promise<VerificationToken> {
    const client = await this.db.connect();

    try {
      const query = `
        INSERT INTO user_registrations (email, verification_token, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) 
        DO UPDATE SET 
          verification_token = $2,
          expires_at = $3,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, email, verification_token as token, expires_at as "expiresAt", created_at as "createdAt"
      `;

      const result = await client.query(query, [email, token, expiresAt]);

      if (result.rows.length === 0) {
        throw new Error('Failed to create verification token');
      }

      logger.info('Verification token created', {
        email,
        expiresAt: expiresAt.toISOString(),
      });

      return {
        id: result.rows[0].id,
        email: result.rows[0].email,
        token: result.rows[0].token,
        expiresAt: result.rows[0].expiresAt,
        createdAt: result.rows[0].createdAt,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Validate verification token
   */
  async validateVerificationToken(email: string, token: string): Promise<boolean> {
    const client = await this.db.connect();

    try {
      const query = `
        SELECT id, expires_at, verified_at
        FROM user_registrations 
        WHERE email = $1 AND verification_token = $2
      `;

      const result = await client.query(query, [email, token]);

      if (result.rows.length === 0) {
        logger.warn('Invalid verification token attempt', { email });
        return false;
      }

      const tokenData = result.rows[0];
      const now = new Date();

      // Check if token is expired
      if (now > tokenData.expires_at) {
        logger.warn('Expired verification token attempt', {
          email,
          expiresAt: tokenData.expires_at,
        });
        return false;
      }

      // Check if already verified
      if (tokenData.verified_at) {
        logger.info('Token already verified', { email });
        return true;
      }

      return true;
    } finally {
      client.release();
    }
  }

  /**
   * Mark email as verified
   */
  async markEmailVerified(email: string, token: string): Promise<boolean> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Update verification token status
      const tokenQuery = `
        UPDATE user_registrations 
        SET verified_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = $1 AND verification_token = $2 AND verified_at IS NULL
        RETURNING id
      `;

      const tokenResult = await client.query(tokenQuery, [email, token]);

      if (tokenResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      // Update employee record - activate the account after email verification
      const employeeQuery = `
        UPDATE employees
        SET is_active = true,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = $1
      `;

      await client.query(employeeQuery, [email]);

      await client.query('COMMIT');

      logger.info('Email verification completed', { email });
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to mark email as verified', { error: error.message, email });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if email already exists in Cognito or employees table
   */
  async checkEmailExists(email: string): Promise<{ cognito: boolean; database: boolean }> {
    const client = await this.db.connect();

    try {
      // Check database first
      const dbQuery = 'SELECT id FROM employees WHERE email = $1';
      const dbResult = await client.query(dbQuery, [email]);

      return {
        cognito: false, // Will be checked in Cognito service
        database: dbResult.rows.length > 0,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Geocode address to coordinates using PostGIS
   */
  async geocodeAddress(address: Address): Promise<{ latitude: number; longitude: number } | null> {
    const client = await this.db.connect();

    try {
      // For now, use a simple geocoding approach
      // In production, this would integrate with a real geocoding service
      const fullAddress = `${address.street}, ${address.city}, ${address.postalCode}, ${address.country}`;

      // Swiss postal code validation
      if (address.country.toLowerCase() === 'switzerland') {
        const swissPostalPattern = /^\d{4}$/;
        if (!swissPostalPattern.test(address.postalCode)) {
          throw new Error('Invalid Swiss postal code format. Must be 4 digits.');
        }
      }

      // Mock coordinates for major Swiss cities (in production, use real geocoding)
      const cityCoordinates: Record<string, { latitude: number; longitude: number }> = {
        zurich: { latitude: 47.3769, longitude: 8.5417 },
        zürich: { latitude: 47.3769, longitude: 8.5417 },
        geneva: { latitude: 46.2044, longitude: 6.1432 },
        genève: { latitude: 46.2044, longitude: 6.1432 },
        basel: { latitude: 47.5596, longitude: 7.5886 },
        bern: { latitude: 46.948, longitude: 7.4474 },
        lausanne: { latitude: 46.5197, longitude: 6.6323 },
        winterthur: { latitude: 47.4999, longitude: 8.7226 },
        lucern: { latitude: 47.0502, longitude: 8.3093 },
        lugano: { latitude: 46.0037, longitude: 8.9511 },
        'st. gallen': { latitude: 47.4245, longitude: 9.3767 },
      };

      const cityKey = address.city.toLowerCase();
      const coordinates = cityCoordinates[cityKey];

      if (coordinates) {
        logger.info('Address geocoded successfully', {
          address: fullAddress,
          coordinates,
        });
        return coordinates;
      }

      // If city not found in our mock data, use Zurich as default for Switzerland
      if (address.country.toLowerCase() === 'switzerland') {
        logger.warn('City not found in geocoding database, using Zurich coordinates', {
          city: address.city,
          coordinates: cityCoordinates.zurich,
        });
        return cityCoordinates.zurich;
      }

      logger.warn('Could not geocode address', { address: fullAddress });
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Create employee database record
   */
  async createEmployeeRecord(
    cognitoUserId: string,
    registerData: RegisterRequest,
    coordinates?: { latitude: number; longitude: number }
  ): Promise<EmployeeRecord> {
    const client = await this.db.connect();

    try {
      let insertQuery: string;
      let queryParams: any[];

      // Generate unique employee ID for registration users
      const employeeId = await this.generateEmployeeId(client, 'EMP');

      if (coordinates) {
        // Insert with coordinates using PostGIS POINT
        insertQuery = `
          INSERT INTO employees (
            id, cognito_user_id, email, first_name, last_name,
            home_street, home_city, home_postal_code, home_country,
            home_location, employee_id, is_active, created_at
          )
          VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8,
            ST_SetSRID(ST_MakePoint($9, $10), 4326), $11, false, CURRENT_TIMESTAMP
          )
          RETURNING id, cognito_user_id as "cognitoUserId", email, first_name as "firstName",
                   last_name as "lastName", home_street as "homeStreet", home_city as "homeCity",
                   home_postal_code as "homePostalCode", home_country as "homeCountry",
                   employee_id as "employeeId", is_active as "isActive", created_at as "registeredAt"
        `;
        queryParams = [
          cognitoUserId,
          registerData.email,
          registerData.firstName,
          registerData.lastName,
          registerData.homeAddress.street,
          registerData.homeAddress.city,
          registerData.homeAddress.postalCode,
          registerData.homeAddress.country,
          coordinates.longitude, // PostGIS uses longitude first
          coordinates.latitude,
          employeeId,
        ];
      } else {
        // Insert without coordinates
        insertQuery = `
          INSERT INTO employees (
            id, cognito_user_id, email, first_name, last_name,
            home_street, home_city, home_postal_code, home_country,
            employee_id, is_active, created_at
          )
          VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, false, CURRENT_TIMESTAMP
          )
          RETURNING id, cognito_user_id as "cognitoUserId", email, first_name as "firstName",
                   last_name as "lastName", home_street as "homeStreet", home_city as "homeCity",
                   home_postal_code as "homePostalCode", home_country as "homeCountry",
                   employee_id as "employeeId", is_active as "isActive", created_at as "registeredAt"
        `;
        queryParams = [
          cognitoUserId,
          registerData.email,
          registerData.firstName,
          registerData.lastName,
          registerData.homeAddress.street,
          registerData.homeAddress.city,
          registerData.homeAddress.postalCode,
          registerData.homeAddress.country,
          employeeId,
        ];
      }

      const result = await client.query(insertQuery, queryParams);

      if (result.rows.length === 0) {
        throw new Error('Failed to create employee record');
      }

      const employee = result.rows[0];

      logger.info('Employee record created', {
        employeeId: employee.id,
        email: employee.email,
        cognitoUserId,
      });

      return {
        ...employee,
        homeCoordinates: coordinates
          ? { x: coordinates.longitude, y: coordinates.latitude }
          : undefined,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get registration status
   */
  async getRegistrationStatus(email: string): Promise<{
    isVerified: boolean;
    registrationComplete: boolean;
    accountEnabled: boolean;
  }> {
    const client = await this.db.connect();

    try {
      // Check verification status
      const verificationQuery = `
        SELECT verified_at FROM user_registrations WHERE email = $1
      `;
      const verificationResult = await client.query(verificationQuery, [email]);

      // Check employee record status
      const employeeQuery = `
        SELECT is_active
        FROM employees WHERE email = $1
      `;
      const employeeResult = await client.query(employeeQuery, [email]);

      const isVerified =
        verificationResult.rows.length > 0 && verificationResult.rows[0].verified_at !== null;
      const accountEnabled = employeeResult.rows.length > 0 && employeeResult.rows[0].is_active;
      const registrationComplete = isVerified && accountEnabled;

      return {
        isVerified,
        registrationComplete,
        accountEnabled,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Clean up expired verification tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const client = await this.db.connect();

    try {
      const query = `
        DELETE FROM user_registrations
        WHERE expires_at < CURRENT_TIMESTAMP AND verified_at IS NULL
        RETURNING id
      `;

      const result = await client.query(query);
      const deletedCount = result.rows.length;

      if (deletedCount > 0) {
        logger.info('Cleaned up expired verification tokens', { count: deletedCount });
      }

      return deletedCount;
    } finally {
      client.release();
    }
  }

  /**
   * Get employee details by email for local development
   */
  async getEmployeeByEmail(email: string): Promise<any> {
    const client = await this.db.connect();

    try {
      const query = `
        SELECT
          id, cognito_user_id, email, first_name, last_name,
          home_street, home_city, home_postal_code, home_country,
          employee_id, is_active, created_at
        FROM employees
        WHERE email = $1
      `;

      const result = await client.query(query, [email.toLowerCase()]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get employee by email', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Generate unique employee ID in format: PREFIX-NNNN (e.g., EMP-0001)
   */
  private async generateEmployeeId(client: any, prefix: 'EMP' | 'MGR' | 'ADM'): Promise<string> {
    try {
      // Find the highest existing number for this prefix
      const query = `
        SELECT employee_id
        FROM employees
        WHERE employee_id LIKE $1
        ORDER BY employee_id DESC
        LIMIT 1
      `;

      const result = await client.query(query, [`${prefix}-%`]);

      let nextNumber = 1;
      if (result.rows.length > 0) {
        const lastId = result.rows[0].employee_id;
        const lastNumber = parseInt(lastId.split('-')[1]);
        nextNumber = lastNumber + 1;
      }

      // Format with leading zeros (e.g., EMP-0001)
      const employeeId = `${prefix}-${nextNumber.toString().padStart(4, '0')}`;

      logger.info('Generated employee ID', { employeeId, prefix });
      return employeeId;
    } catch (error) {
      logger.error('Failed to generate employee ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        prefix,
      });
      throw error;
    }
  }
}
