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

      // Update employee record
      const employeeQuery = `
        UPDATE employees 
        SET email_verified_at = CURRENT_TIMESTAMP,
            account_status = 'active',
            profile_updated_at = CURRENT_TIMESTAMP
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
      const homeAddress = `${registerData.homeAddress.street}, ${registerData.homeAddress.city}, ${registerData.homeAddress.postalCode}, ${registerData.homeAddress.country}`;

      let insertQuery: string;
      let queryParams: any[];

      if (coordinates) {
        // Insert with coordinates using PostGIS POINT
        insertQuery = `
          INSERT INTO employees (
            id, cognito_user_id, email, first_name, last_name, 
            home_address, home_location, role, is_active, 
            registration_source, account_status, created_at
          )
          VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, 
            ST_SetSRID(ST_MakePoint($6, $7), 4326), 'employee', false,
            'registration', 'pending_verification', CURRENT_TIMESTAMP
          )
          RETURNING id, cognito_user_id as "cognitoUserId", email, first_name as "firstName", 
                   last_name as "lastName", home_address as "homeAddress", role, is_active as "isActive", 
                   created_at as "registeredAt"
        `;
        queryParams = [
          cognitoUserId,
          registerData.email,
          registerData.firstName,
          registerData.lastName,
          homeAddress,
          coordinates.longitude, // PostGIS uses longitude first
          coordinates.latitude,
        ];
      } else {
        // Insert without coordinates
        insertQuery = `
          INSERT INTO employees (
            id, cognito_user_id, email, first_name, last_name, 
            home_address, role, is_active, registration_source, 
            account_status, created_at
          )
          VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, 'employee', false,
            'registration', 'pending_verification', CURRENT_TIMESTAMP
          )
          RETURNING id, cognito_user_id as "cognitoUserId", email, first_name as "firstName", 
                   last_name as "lastName", home_address as "homeAddress", role, is_active as "isActive", 
                   created_at as "registeredAt"
        `;
        queryParams = [
          cognitoUserId,
          registerData.email,
          registerData.firstName,
          registerData.lastName,
          homeAddress,
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
        SELECT is_active, email_verified_at, account_status 
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
}
