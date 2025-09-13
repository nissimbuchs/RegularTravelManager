/**
 * Infrastructure Environment Configuration
 * Centralized configuration for environment-specific settings used by CDK stacks
 */

export interface EnvironmentConfig {
  api: {
    domainName?: string;
    customDomainEnabled: boolean;
  };
  web: {
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
    api: {
      domainName: 'api-dev.buchs.be',
      customDomainEnabled: true,
    },
    web: {
      domainName: 'rtfm-dev.buchs.be',
      customDomainEnabled: true,
    },
    monitoring: {
      enableDetailedLogs: true,
      enableXrayTracing: true,
    },
  },

  staging: {
    api: {
      domainName: 'api-staging.buchs.be',
      customDomainEnabled: true,
    },
    web: {
      domainName: 'rtfm-staging.buchs.be',
      customDomainEnabled: true,
    },
    monitoring: {
      enableDetailedLogs: true,
      enableXrayTracing: true,
    },
  },

  production: {
    api: {
      domainName: 'api.buchs.be',
      customDomainEnabled: true,
    },
    web: {
      domainName: 'rtfm.buchs.be',
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
