export type RTMEnvironment = 'local' | 'dev' | 'staging' | 'production';

export interface EnvironmentConfig {
  NODE_ENV: string;
  RTM_ENVIRONMENT: RTMEnvironment;
  AWS_REGION: string;
  AWS_ENDPOINT_URL?: string; // For LocalStack
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  COGNITO_USER_POOL_ID: string;
  COGNITO_CLIENT_ID: string;
  S3_BUCKET_NAME: string;
  LOCATION_PLACE_INDEX: string;
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const rtmEnvironment = getRTMEnvironment();
  const isLocal = rtmEnvironment === 'local';

  return {
    NODE_ENV: nodeEnv,
    RTM_ENVIRONMENT: rtmEnvironment,
    AWS_REGION: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-central-1',
    AWS_ENDPOINT_URL: isLocal ? process.env.AWS_ENDPOINT_URL : undefined,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    DATABASE_URL:
      process.env.DATABASE_URL || 'postgresql://nissim@localhost:5432/travel_manager_dev',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || 'local-pool-id',
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID || 'local-client-id',
    S3_BUCKET_NAME: getResourceName('rtm-documents', rtmEnvironment),
    LOCATION_PLACE_INDEX:
      process.env.PLACE_INDEX_NAME ||
      `rtm-${rtmEnvironment === 'local' ? 'dev' : rtmEnvironment}-places`,
  };
}

function getRTMEnvironment(): RTMEnvironment {
  // Check for explicit RTM_ENVIRONMENT variable first
  const rtmEnv = process.env.RTM_ENVIRONMENT as RTMEnvironment;
  if (rtmEnv && ['local', 'dev', 'staging', 'production'].includes(rtmEnv)) {
    return rtmEnv;
  }

  // Fall back to NODE_ENV mapping for backward compatibility
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'development') {
    return 'local';
  }
  if (nodeEnv === 'production') {
    return 'dev';
  } // Default AWS deployment is dev

  return 'local';
}

function getResourceName(baseName: string, environment: RTMEnvironment): string {
  if (environment === 'local') {
    return `${baseName}-dev`; // LocalStack uses dev suffix
  }
  return `${baseName}-${environment}`;
}

export function isLocalDevelopment(): boolean {
  return getRTMEnvironment() === 'local';
}

export function isProduction(): boolean {
  return getRTMEnvironment() === 'production';
}

export function isDev(): boolean {
  return getRTMEnvironment() === 'dev';
}

export function isStaging(): boolean {
  return getRTMEnvironment() === 'staging';
}

export function getRTMEnvironmentName(): RTMEnvironment {
  return getRTMEnvironment();
}
