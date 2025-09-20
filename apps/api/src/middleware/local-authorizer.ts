#!/usr/bin/env node
/**
 * Local Development Authorizer Middleware
 *
 * Simulates AWS API Gateway Lambda Authorizer behavior for local development.
 * Provides consistent authorization context matching production environment.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../database/connection';

export interface AuthContext {
  sub: string;
  email: string;
  cognitoUsername: string;
  isManager: boolean;
  isAdmin: boolean;
  groups: string[];
}

// Mock user mappings for local development
const MOCK_USER_MAPPINGS = {
  'admin1': { employeeId: 'ADM-0001', groups: ['administrators', 'managers', 'employees'] },
  'admin2': { employeeId: 'ADM-0002', groups: ['administrators', 'managers', 'employees'] },
  'manager1': { employeeId: 'MGR-0001', groups: ['managers', 'employees'] },
  'manager2': { employeeId: 'MGR-0002', groups: ['managers', 'employees'] },
  'employee1': { employeeId: 'EMP-0001', groups: ['employees'] },
  'employee2': { employeeId: 'EMP-0002', groups: ['employees'] },
  'employee3': { employeeId: 'EMP-0003', groups: ['employees'] },
  'employee4': { employeeId: 'EMP-0004', groups: ['employees'] },
  'employee5': { employeeId: 'EMP-0005', groups: ['employees'] },
  'employee6': { employeeId: 'EMP-0006', groups: ['employees'] },
};

/**
 * Extract mock user identifier from various sources
 */
function extractMockUser(req: Request): string {
  // Priority 1: Check Authorization header for mock token
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      if (token.startsWith('mock-jwt-token-')) {
        const identifier = token.replace('mock-jwt-token-', '');
        // Check if it's a UUID or username
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(identifier)) {
          // It's a username like "employee1"
          return identifier;
        }
      }
    }
  }

  // Priority 2: Check custom headers
  const mockUser = req.headers['x-mock-user'] || req.headers['x-user-email'];
  if (mockUser && typeof mockUser === 'string') {
    // Extract username from email if needed
    if (mockUser.includes('@')) {
      const username = mockUser.split('@')[0];
      if (MOCK_USER_MAPPINGS[username]) {
        return username;
      }
    }
    if (MOCK_USER_MAPPINGS[mockUser]) {
      return mockUser;
    }
  }

  // Priority 3: Default to employee1
  console.log('⚠️ No mock user specified, defaulting to employee1');
  return 'employee1';
}

/**
 * Lookup user details from database
 */
async function getUserFromDatabase(mockUser: string): Promise<AuthContext | null> {
  try {
    const mapping = MOCK_USER_MAPPINGS[mockUser];
    if (!mapping) {
      return null;
    }

    const result = await db.query(
      `SELECT
        id,
        cognito_user_id,
        email,
        first_name,
        last_name,
        employee_id
      FROM employees
      WHERE employee_id = $1
      LIMIT 1`,
      [mapping.employeeId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const employee = result.rows[0];
    const isAdmin = mapping.groups.includes('administrators');
    const isManager = mapping.groups.includes('managers');

    return {
      sub: employee.cognito_user_id || employee.id,
      email: employee.email,
      cognitoUsername: employee.email,
      isManager,
      isAdmin,
      groups: mapping.groups,
    };
  } catch (error) {
    console.error('Database lookup failed:', error);
    return null;
  }
}

/**
 * Create fallback auth context when database is unavailable
 */
function createFallbackContext(mockUser: string): AuthContext {
  const mapping = MOCK_USER_MAPPINGS[mockUser] || MOCK_USER_MAPPINGS['employee1'];
  const email = `${mockUser}@company.ch`;
  const isAdmin = mapping.groups.includes('administrators');
  const isManager = mapping.groups.includes('managers');

  // Generate consistent UUID for mock user
  const uuidMap = {
    'admin1': '11111111-1111-1111-1111-111111111111',
    'admin2': '22222222-2222-2222-2222-222222222222',
    'manager1': '33333333-3333-3333-3333-333333333333',
    'manager2': '44444444-4444-4444-4444-444444444444',
    'employee1': '55555555-5555-5555-5555-555555555555',
    'employee2': '66666666-6666-6666-6666-666666666666',
    'employee3': '77777777-7777-7777-7777-777777777777',
    'employee4': '88888888-8888-8888-8888-888888888888',
    'employee5': '99999999-9999-9999-9999-999999999999',
    'employee6': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  };

  return {
    sub: uuidMap[mockUser] || uuidMap['employee1'],
    email,
    cognitoUsername: email,
    isManager,
    isAdmin,
    groups: mapping.groups,
  };
}

/**
 * Public endpoints that don't require authentication
 */
const PUBLIC_ENDPOINTS = [
  '/health',
  '/api/health',
  '/api/auth/register',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/auth/registration-status',
];

/**
 * Check if endpoint is public
 */
function isPublicEndpoint(path: string): boolean {
  return PUBLIC_ENDPOINTS.some(endpoint => path.startsWith(endpoint));
}

/**
 * Local Authorizer Middleware
 *
 * Simulates AWS API Gateway Lambda Authorizer for local development
 */
export async function localAuthorizerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip auth for public endpoints
  if (isPublicEndpoint(req.path)) {
    console.log(`✅ Public endpoint ${req.path} - skipping auth`);
    return next();
  }

  try {
    // Extract mock user
    const mockUser = extractMockUser(req);
    console.log(`🔐 Authorizing mock user: ${mockUser} for ${req.method} ${req.path}`);

    // Get user context (try database first, fallback to hardcoded)
    let authContext = await getUserFromDatabase(mockUser);
    if (!authContext) {
      console.log(`⚠️ User ${mockUser} not in database, using fallback context`);
      authContext = createFallbackContext(mockUser);
    }

    // Attach auth context to request (simulating API Gateway authorizer context)
    req['authContext'] = authContext;
    req['requestContext'] = {
      requestId: `local-${Date.now()}`,
      authorizer: {
        claims: {
          sub: authContext.sub,
          email: authContext.email,
          'cognito:groups': authContext.groups.join(','),
        },
        sub: authContext.sub,
        email: authContext.email,
        cognitoUsername: authContext.cognitoUsername,
        isManager: authContext.isManager.toString(),
        isAdmin: authContext.isAdmin.toString(),
        groups: JSON.stringify(authContext.groups),
      },
    };

    console.log(`✅ Authorization successful for ${mockUser}:`, {
      sub: authContext.sub.substring(0, 8) + '...',
      email: authContext.email,
      isManager: authContext.isManager,
      isAdmin: authContext.isAdmin,
      groups: authContext.groups,
    });

    next();
  } catch (error) {
    console.error('❌ Authorization failed:', error);
    res.status(401).json({
      error: 'Unauthorized',
      message: error instanceof Error ? error.message : 'Authorization failed',
    });
  }
}

/**
 * Extract auth context from request (for use in handlers)
 */
export function getAuthContext(req: Request): AuthContext {
  const context = req['authContext'];
  if (!context) {
    throw new Error('No authorization context found');
  }
  return context;
}

/**
 * Check if user has required role
 */
export function requireRole(req: Request, role: 'admin' | 'manager'): void {
  const context = getAuthContext(req);

  if (role === 'admin' && !context.isAdmin) {
    throw new Error('Administrator role required');
  }

  if (role === 'manager' && !context.isManager && !context.isAdmin) {
    throw new Error('Manager role required');
  }
}