import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

/**
 * Factory for creating CloudWatch alarms with standardized configuration
 * Eliminates repetitive alarm creation code
 */
export class AlarmFactory {
  constructor(
    private scope: Construct,
    private environment: string,
    private alertsTopic: sns.Topic
  ) {}

  /**
   * Create multiple alarms from configuration
   */
  createAlarms(alarms: Record<string, AlarmConfig>): Record<string, cloudwatch.Alarm> {
    const result: Record<string, cloudwatch.Alarm> = {};
    
    for (const [key, config] of Object.entries(alarms)) {
      result[key] = this.createAlarm(key, config);
    }
    
    return result;
  }

  /**
   * Create a single alarm from configuration
   */
  createAlarm(key: string, config: AlarmConfig): cloudwatch.Alarm {
    const alarmName = this.getAlarmName(config.name || key);
    const constructId = this.getConstructId(key);

    // Get environment-specific threshold
    const threshold = this.getEnvironmentThreshold(config.threshold);
    
    const alarm = new cloudwatch.Alarm(this.scope, constructId, {
      alarmName,
      alarmDescription: config.description,
      metric: config.metric,
      threshold,
      evaluationPeriods: config.evaluationPeriods || 2,
      comparisonOperator: config.comparisonOperator || cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: config.treatMissingData || cloudwatch.TreatMissingData.NOT_BREACHING,
      datapointsToAlarm: config.datapointsToAlarm,
    });

    // Add SNS action unless explicitly disabled
    if (config.enableSnsAction !== false) {
      alarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertsTopic));
    }

    // Add custom actions if provided
    if (config.customActions) {
      config.customActions.forEach(action => alarm.addAlarmAction(action));
    }

    return alarm;
  }

  /**
   * Get standardized alarm name
   */
  private getAlarmName(name: string): string {
    const kebabCase = this.toKebabCase(name);
    return `rtm-${this.environment}-${kebabCase}`;
  }

  /**
   * Get CDK construct ID for alarm
   */
  private getConstructId(key: string): string {
    const pascalCase = this.toPascalCase(key);
    return `${pascalCase}Alarm`;
  }

  /**
   * Get environment-specific threshold
   */
  private getEnvironmentThreshold(threshold: ThresholdConfig): number {
    if (typeof threshold === 'number') {
      return threshold;
    }
    
    return threshold[this.environment as keyof ThresholdConfig] || threshold.dev;
  }

  /**
   * Convert camelCase to kebab-case
   */
  private toKebabCase(str: string): string {
    return str.replace(/([A-Z])/g, '-$1').replace(/^-/, '').toLowerCase();
  }

  /**
   * Convert camelCase to PascalCase
   */
  private toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Alarm configuration interface
 */
export interface AlarmConfig {
  /** Alarm name (defaults to key) */
  name?: string;
  /** Alarm description */
  description: string;
  /** CloudWatch metric */
  metric: cloudwatch.IMetric;
  /** Threshold value or environment-specific values */
  threshold: ThresholdConfig;
  /** Number of evaluation periods */
  evaluationPeriods?: number;
  /** Comparison operator */
  comparisonOperator?: cloudwatch.ComparisonOperator;
  /** How to treat missing data */
  treatMissingData?: cloudwatch.TreatMissingData;
  /** Number of datapoints that must be breaching */
  datapointsToAlarm?: number;
  /** Whether to enable SNS action (default: true) */
  enableSnsAction?: boolean;
  /** Custom alarm actions */
  customActions?: cloudwatch.IAlarmAction[];
}

/**
 * Threshold configuration - can be a single value or environment-specific
 */
export type ThresholdConfig = number | {
  dev: number;
  staging: number;
  production: number;
};

/**
 * Pre-configured alarm sets for common resources
 */
export const AlarmSets = {
  database: (database: any): Record<string, AlarmConfig> => ({
    dbCpu: {
      name: 'db-high-cpu',
      description: 'RDS high CPU utilization',
      metric: database.metricCPUUtilization({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: { dev: 90, staging: 85, production: 80 },
      evaluationPeriods: 3,
    },
    dbConnections: {
      name: 'db-high-connections',
      description: 'RDS high connection count',
      metric: database.metricDatabaseConnections({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: { dev: 8, staging: 12, production: 15 },
      evaluationPeriods: 2,
    },
    dbFreeSpace: {
      name: 'db-low-free-space',
      description: 'RDS low free storage space',
      metric: database.metricFreeStorageSpace({
        statistic: 'Average',
        period: cdk.Duration.minutes(15),
      }),
      threshold: 2 * 1024 * 1024 * 1024, // 2GB in bytes
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    },
  }),

  readReplica: (readReplica: any): Record<string, AlarmConfig> => ({
    readReplicaCpu: {
      name: 'db-read-replica-high-cpu',
      description: 'RDS read replica high CPU utilization',
      metric: readReplica.metricCPUUtilization({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
    },
    replicationLag: {
      name: 'db-replication-lag',
      description: 'RDS read replica replication lag',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'ReadReplicaLag',
        dimensionsMap: {
          DBInstanceIdentifier: readReplica.instanceIdentifier,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 300, // 5 minutes in seconds
      evaluationPeriods: 2,
    },
  }),

  cognito: (userPool: any): Record<string, AlarmConfig> => ({
    cognitoThrottle: {
      name: 'cognito-throttling',
      description: 'Cognito API throttling',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Cognito',
        metricName: 'UserPoolRequestThrottled',
        dimensionsMap: {
          UserPool: userPool.userPoolId,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: { dev: 10, staging: 8, production: 5 },
      evaluationPeriods: 2,
    },
  }),

  lambda: (): Record<string, AlarmConfig> => ({
    lambdaConcurrency: {
      name: 'lambda-high-concurrency',
      description: 'Lambda high concurrency usage',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'ConcurrentExecutions',
        statistic: 'Maximum',
        period: cdk.Duration.minutes(1),
      }),
      threshold: { dev: 100, staging: 400, production: 800 },
      evaluationPeriods: 3,
    },
  }),
};