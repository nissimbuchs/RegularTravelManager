import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

/**
 * Centralized SSM Parameter management to eliminate repetitive parameter creation
 */
export class ParameterManager {
  constructor(
    private scope: Construct,
    private environment: string
  ) {}

  /**
   * Create multiple SSM parameters from configuration
   */
  createParameters(parameters: Record<string, ParameterConfig>): void {
    for (const [key, config] of Object.entries(parameters)) {
      this.createParameter(key, config);
    }
  }

  /**
   * Create a single SSM parameter
   */
  createParameter(key: string, config: ParameterConfig): ssm.StringParameter {
    const parameterName = this.getParameterName(config.section, config.key || key);
    const constructId = this.getConstructId(key);

    return new ssm.StringParameter(this.scope, constructId, {
      parameterName,
      stringValue: config.value,
      description: config.description,
      tier: config.tier || ssm.ParameterTier.STANDARD,
    });
  }

  /**
   * Get standardized parameter name
   */
  private getParameterName(section: string, key: string): string {
    return `/rtm/${this.environment}/${section}/${key}`;
  }

  /**
   * Get CDK construct ID for parameter
   */
  private getConstructId(key: string): string {
    return key.charAt(0).toUpperCase() + key.slice(1) + 'Parameter';
  }
}

/**
 * Parameter configuration interface
 */
export interface ParameterConfig {
  /** Parameter section (e.g., 'database', 'cognito', 'config') */
  section: string;
  /** Parameter key (defaults to the object key) */
  key?: string;
  /** Parameter value */
  value: string;
  /** Parameter description */
  description?: string;
  /** Parameter tier */
  tier?: ssm.ParameterTier;
}

/**
 * Pre-configured parameter sets for common infrastructure resources
 */
export const ParameterSets = {
  database: (database: any): Record<string, ParameterConfig> => ({
    endpoint: {
      section: 'database',
      key: 'endpoint',
      value: database.instanceEndpoint.hostname,
      description: 'RDS PostgreSQL endpoint hostname',
    },
    port: {
      section: 'database',
      key: 'port',
      value: database.instanceEndpoint.port.toString(),
      description: 'RDS PostgreSQL port number',
    },
    readReplicaEndpoint: {
      section: 'database',
      key: 'read-replica-endpoint',
      value: database.instanceEndpoint.hostname, // Will be overridden for read replica
      description: 'RDS PostgreSQL read replica endpoint',
    },
  }),

  cognito: (userPool: any, userPoolClient: any): Record<string, ParameterConfig> => ({
    userPoolId: {
      section: 'cognito',
      key: 'user-pool-id',
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    },
    clientId: {
      section: 'cognito',
      key: 'client-id',
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    },
  }),

  location: (placeIndex: any): Record<string, ParameterConfig> => ({
    placeIndexName: {
      section: 'location',
      key: 'place-index-name',
      value: placeIndex.indexName,
      description: 'AWS Location Service Place Index name',
    },
  }),

  ses: (domainName?: string): Record<string, ParameterConfig> => ({
    domain: {
      section: 'ses',
      key: 'domain',
      value: domainName || '',
      description: 'SES verified domain name',
    },
    fromEmail: {
      section: 'ses',
      key: 'from-email',
      value: domainName ? `noreply@${domainName}` : 'test@example.com',
      description: 'Default from email address for SES',
    },
  }),

  config: (environment: string, region: string): Record<string, ParameterConfig> => ({
    environment: {
      section: 'config',
      key: 'environment',
      value: environment,
      description: 'Application environment',
    },
    region: {
      section: 'config',
      key: 'region',
      value: region,
      description: 'AWS region',
    },
  }),

  monitoring: (alertsTopic: any): Record<string, ParameterConfig> => ({
    alertsTopicArn: {
      section: 'monitoring',
      key: 'alerts-topic-arn',
      value: alertsTopic.topicArn,
      description: 'SNS topic ARN for alerts',
    },
  }),

  dns: (hostedZone: any, rootDomain: string): Record<string, ParameterConfig> => ({
    rootDomain: {
      section: 'dns',
      key: 'root-domain',
      value: rootDomain,
      description: 'Root domain name for hosted zone',
    },
    hostedZoneId: {
      section: 'dns',
      key: 'hosted-zone-id',
      value: hostedZone.hostedZoneId,
      description: 'Route 53 Hosted Zone ID',
    },
  }),

  performance: (environment: string): Record<string, ParameterConfig> => {
    const performanceConfig: Record<string, Record<string, number>> = {
      dev: {
        lambdaTimeout: 30,
        lambdaMemory: 512,
        lambdaReservedConcurrency: 10,
        dbConnections: 5,
      },
      staging: {
        lambdaTimeout: 30,
        lambdaMemory: 1024,
        lambdaReservedConcurrency: 50,
        dbConnections: 10,
      },
      production: {
        lambdaTimeout: 30,
        lambdaMemory: 1024,
        lambdaReservedConcurrency: 200,
        dbConnections: 20,
      },
    };

    const config = performanceConfig[environment] || performanceConfig.dev;
    const parameters: Record<string, ParameterConfig> = {};

    for (const [key, value] of Object.entries(config || {})) {
      parameters[key] = {
        section: 'config',
        key: key,
        value: value.toString(),
        description: `Performance setting: ${key}`,
      };
    }

    return parameters;
  },
};