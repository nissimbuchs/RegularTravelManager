export interface EnvironmentConfig {
  NODE_ENV: string;
  AWS_REGION: string;
  AWS_ENDPOINT_URL?: string;  // For LocalStack
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
  const isLocal = process.env.NODE_ENV === 'development';
  
  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    AWS_REGION: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-central-1',
    AWS_ENDPOINT_URL: isLocal ? process.env.AWS_ENDPOINT_URL : undefined,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://nissim@localhost:5432/travel_manager_dev',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || 'local-pool-id',
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID || 'local-client-id',
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || (isLocal ? 'rtm-documents-dev' : 'rtm-documents-prod'),
    LOCATION_PLACE_INDEX: process.env.LOCATION_PLACE_INDEX || (isLocal ? 'rtm-swiss-places-dev' : 'rtm-swiss-places-prod')
  };
}

export function isLocalDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}