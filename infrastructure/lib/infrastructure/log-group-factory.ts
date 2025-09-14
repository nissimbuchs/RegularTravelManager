import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

/**
 * Factory for creating CloudWatch Log Groups with standardized configuration
 * Eliminates repetitive log group creation code
 */
export class LogGroupFactory {
  constructor(
    private scope: Construct,
    private environment: string
  ) {}

  /**
   * Create multiple log groups from configuration
   */
  createLogGroups(logGroups: Record<string, LogGroupConfig>): Record<string, logs.LogGroup> {
    const result: Record<string, logs.LogGroup> = {};

    for (const [key, config] of Object.entries(logGroups)) {
      result[key] = this.createLogGroup(key, config);
    }

    return result;
  }

  /**
   * Create a single log group from configuration
   */
  createLogGroup(key: string, config: LogGroupConfig): logs.LogGroup {
    const logGroupName = this.getLogGroupName(config);
    const constructId = this.getConstructId(key);

    // Get environment-specific retention
    const retention = this.getEnvironmentRetention(config.retention);

    // Get environment-specific removal policy
    const removalPolicy = this.getEnvironmentRemovalPolicy(config.removalPolicy);

    return new logs.LogGroup(this.scope, constructId, {
      logGroupName,
      retention,
      removalPolicy,
      encryptionKey: config.encryptionKey,
    });
  }

  /**
   * Get standardized log group name
   */
  private getLogGroupName(config: LogGroupConfig): string {
    if (config.customLogGroupName) {
      return config.customLogGroupName;
    }

    const service = config.service || 'lambda';
    const name = config.name;

    return `/aws/${service}/rtm-${this.environment}-${name}`;
  }

  /**
   * Get CDK construct ID for log group
   */
  private getConstructId(key: string): string {
    const pascalCase = this.toPascalCase(key);
    return `${pascalCase}LogGroup`;
  }

  /**
   * Get environment-specific retention
   */
  private getEnvironmentRetention(retention?: RetentionConfig): logs.RetentionDays {
    if (retention && typeof retention === 'object') {
      return retention[this.environment as keyof RetentionConfig] || retention.dev;
    }

    if (retention && typeof retention === 'string') {
      return retention as logs.RetentionDays;
    }

    // Default environment-specific retention
    const defaultRetention = {
      dev: logs.RetentionDays.ONE_WEEK,
      staging: logs.RetentionDays.TWO_WEEKS,
      production: logs.RetentionDays.ONE_MONTH,
    };

    return (
      defaultRetention[this.environment as keyof typeof defaultRetention] ||
      logs.RetentionDays.ONE_WEEK
    );
  }

  /**
   * Get environment-specific removal policy
   */
  private getEnvironmentRemovalPolicy(removalPolicy?: RemovalPolicyConfig): cdk.RemovalPolicy {
    if (removalPolicy && typeof removalPolicy === 'object') {
      return removalPolicy[this.environment as keyof RemovalPolicyConfig] || removalPolicy.dev;
    }

    if (removalPolicy && typeof removalPolicy === 'string') {
      return removalPolicy as cdk.RemovalPolicy;
    }

    // Default environment-specific removal policy
    return this.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
  }

  /**
   * Convert camelCase to PascalCase
   */
  private toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Log group configuration interface
 */
export interface LogGroupConfig {
  /** Log group name identifier */
  name: string;
  /** AWS service (default: lambda) */
  service?: 'lambda' | 'apigateway' | 'ecs' | 'eks';
  /** Custom log group name (overrides standard naming) */
  customLogGroupName?: string;
  /** Log retention configuration */
  retention?: RetentionConfig;
  /** Removal policy configuration */
  removalPolicy?: RemovalPolicyConfig;
  /** Encryption key for log group */
  encryptionKey?: cdk.aws_kms.IKey;
}

/**
 * Retention configuration - can be a single value or environment-specific
 */
export type RetentionConfig =
  | logs.RetentionDays
  | {
      dev: logs.RetentionDays;
      staging: logs.RetentionDays;
      production: logs.RetentionDays;
    };

/**
 * Removal policy configuration - can be a single value or environment-specific
 */
export type RemovalPolicyConfig =
  | cdk.RemovalPolicy
  | {
      dev: cdk.RemovalPolicy;
      staging: cdk.RemovalPolicy;
      production: cdk.RemovalPolicy;
    };

/**
 * Pre-configured log group sets for common services
 */
export const LogGroupSets = {
  apiGateway: (): Record<string, LogGroupConfig> => ({
    apiGateway: {
      name: 'api',
      service: 'apigateway',
      retention: {
        dev: logs.RetentionDays.ONE_WEEK,
        staging: logs.RetentionDays.TWO_WEEKS,
        production: logs.RetentionDays.ONE_MONTH,
      },
    },
  }),

  customResources: (): Record<string, LogGroupConfig> => ({
    userCreatorProvider: {
      name: 'user-creator-provider',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    },
    postgisInstallerProvider: {
      name: 'postgis-installer-provider',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    },
  }),

  lambdaFunctions: (functionNames: string[]): Record<string, LogGroupConfig> => {
    const result: Record<string, LogGroupConfig> = {};

    functionNames.forEach(name => {
      result[name] = {
        name,
        service: 'lambda',
      };
    });

    return result;
  },
};
