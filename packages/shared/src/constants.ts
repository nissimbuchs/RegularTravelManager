// Common constants shared across all domains and applications

export const API_ENDPOINTS = {
  HEALTH: '/health',
  AUTH: '/auth',
  USERS: '/users',
  TRAVEL_REQUESTS: '/travel-requests',
  PROJECTS: '/projects',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const DISTANCE_CALCULATION = {
  MINIMUM_DISTANCE_KM: 5,
  ALLOWANCE_PER_KM: 0.42, // EUR per kilometer
} as const;
