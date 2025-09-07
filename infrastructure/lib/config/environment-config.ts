/**
 * Infrastructure Environment Configuration
 * Centralized configuration for environment-specific settings used by CDK stacks
 */

export interface EnvironmentConfig {
  corsOrigins: {
    /** Static CORS origins that are always allowed */
    static: string[];
    /** Whether to include the CloudFront distribution domain dynamically */
    includeCloudFrontDomain: boolean;
    /** Whether to include localhost domains for local development */
    includeLocalhost: boolean;
  };
  frontendDomains: {
    primary: string;
    additional?: string[];
  };
  api: {
    domainName?: string;
    customDomainEnabled: boolean;
  };
  monitoring: {
    enableDetailedLogs: boolean;
    enableXrayTracing: boolean;
  };
}

export const ENVIRONMENT_CONFIG: Record<string, EnvironmentConfig> = {
  dev: {
    corsOrigins: {
      static: ['*'], // Allow all origins for easier development
      includeCloudFrontDomain: false, // Wildcard already covers it
      includeLocalhost: false, // Wildcard already covers it
    },
    frontendDomains: {
      primary: 'http://localhost:4200',
      additional: ['http://localhost:3000']
    },
    api: {
      customDomainEnabled: false,
    },
    monitoring: {
      enableDetailedLogs: true,
      enableXrayTracing: true,
    },
  },

  staging: {
    corsOrigins: {
      static: ['https://staging-travel.company.com'],
      includeCloudFrontDomain: true, // Include deployed CloudFront domain
      includeLocalhost: true, // Allow local dev to test against staging
    },
    frontendDomains: {
      primary: 'https://staging-travel.company.com',
      additional: ['http://localhost:4200', 'http://localhost:3000']
    },
    api: {
      domainName: 'api-staging.company.com',
      customDomainEnabled: true,
    },
    monitoring: {
      enableDetailedLogs: true,
      enableXrayTracing: true,
    },
  },

  production: {
    corsOrigins: {
      static: ['https://travel.company.com'],
      includeCloudFrontDomain: true, // Include deployed CloudFront domain
      includeLocalhost: false, // No localhost in production
    },
    frontendDomains: {
      primary: 'https://travel.company.com'
    },
    api: {
      domainName: 'api.company.com',
      customDomainEnabled: true,
    },
    monitoring: {
      enableDetailedLogs: false, // Reduce costs in production
      enableXrayTracing: true,
    },
  },
};

/**
 * Get configuration for a specific environment
 * @param environment The environment name (dev, staging, production)
 * @returns Environment configuration object
 */
export function getEnvironmentConfig(environment: string): EnvironmentConfig {
  const config = ENVIRONMENT_CONFIG[environment];
  
  if (!config) {
    throw new Error(
      `Invalid environment: ${environment}. Must be one of: ${Object.keys(ENVIRONMENT_CONFIG).join(', ')}`
    );
  }
  
  return config;
}

/**
 * Get CORS origins for a specific environment
 * @param environment The environment name
 * @param cloudFrontDomain Optional CloudFront domain to include if configured
 * @returns Array of allowed CORS origins
 */
export function getCorsOrigins(environment: string, cloudFrontDomain?: string): string[] {
  const config = getEnvironmentConfig(environment);
  const corsConfig = config.corsOrigins;
  
  let origins = [...corsConfig.static];
  
  // Add CloudFront domain if configured and provided
  if (corsConfig.includeCloudFrontDomain && cloudFrontDomain) {
    origins.push(`https://${cloudFrontDomain}`);
  }
  
  // Add localhost domains if configured
  if (corsConfig.includeLocalhost) {
    origins.push('http://localhost:4200', 'http://localhost:3000');
  }
  
  return origins;
}