import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

/**
 * Centralized CloudFormation export management
 * Eliminates repetitive export code across infrastructure
 */
export class ExportManager {
  constructor(
    private scope: Construct,
    private environment: string
  ) {}

  /**
   * Create multiple CloudFormation exports from configuration
   */
  createExports(exports: Record<string, ExportConfig>): void {
    for (const [key, config] of Object.entries(exports)) {
      this.createExport(key, config);
    }
  }

  /**
   * Create a single CloudFormation export
   */
  createExport(key: string, config: ExportConfig): cdk.CfnOutput {
    const exportName = this.getExportName(config.exportName || key);
    const constructId = this.getConstructId(key);

    return new cdk.CfnOutput(this.scope, constructId, {
      value: config.value,
      description: config.description,
      exportName: exportName,
      condition: config.condition,
    });
  }

  /**
   * Get standardized export name
   */
  private getExportName(key: string): string {
    const kebabCase = this.toKebabCase(key);
    return `rtm-${this.environment}-${kebabCase}`;
  }

  /**
   * Get CDK construct ID for export
   */
  private getConstructId(key: string): string {
    const pascalCase = this.toPascalCase(key);
    return `${pascalCase}Output`;
  }

  /**
   * Convert camelCase to kebab-case
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '-$1')
      .replace(/^-/, '')
      .toLowerCase();
  }

  /**
   * Convert camelCase to PascalCase
   */
  private toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Export configuration interface
 */
export interface ExportConfig {
  /** Export value */
  value: string;
  /** Export description */
  description: string;
  /** Custom export name (defaults to key) */
  exportName?: string;
  /** Condition for conditional exports */
  condition?: cdk.CfnCondition;
}

/**
 * Pre-configured export sets for common infrastructure resources
 */
export const ExportSets = {
  cognito: (userPool: any, userPoolClient: any): Record<string, ExportConfig> => ({
    userPoolId: {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'user-pool-id',
    },
    userPoolClientId: {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'user-pool-client-id',
    },
  }),

  monitoring: (alertsTopic: any): Record<string, ExportConfig> => ({
    alertsTopicArn: {
      value: alertsTopic.topicArn,
      description: 'SNS Topic ARN for alerts',
      exportName: 'alerts-topic-arn',
    },
  }),

  dns: (hostedZone: any, rootDomain: string): Record<string, ExportConfig> => ({
    hostedZoneId: {
      value: hostedZone.hostedZoneId,
      description: 'Route 53 Hosted Zone ID',
      exportName: 'hosted-zone-id',
    },
    hostedZoneName: {
      value: rootDomain,
      description: 'Route 53 Hosted Zone Domain Name',
      exportName: 'hosted-zone-name',
    },
    hostedZoneNameServers: {
      value: cdk.Fn.join(',', hostedZone.hostedZoneNameServers || []),
      description: 'Route 53 Name Servers (configure these at your domain registrar)',
      exportName: 'name-servers',
    },
  }),

  ses: (domainName?: string): Record<string, ExportConfig> => ({
    sesDomainDkimRecords: {
      value: 'Check AWS Console for DKIM records',
      description: 'DKIM records to add to DNS',
      exportName: 'ses-dkim-records',
    },
  }),
};
