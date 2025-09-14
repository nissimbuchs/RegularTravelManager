import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as customResources from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { PolicyBuilder, PolicyConfig } from './policy-builder';
import { LogGroupFactory } from './log-group-factory';

/**
 * Builder for creating Lambda-backed custom resources with standardized configuration
 * Eliminates repetitive custom resource creation code
 */
export class CustomResourceBuilder {
  private policyBuilder: PolicyBuilder;
  private logGroupFactory: LogGroupFactory;

  constructor(
    private scope: Construct,
    private environment: string,
    private region: string,
    private account: string,
    private vpc: ec2.Vpc,
    private lambdaSecurityGroup: ec2.SecurityGroup
  ) {
    this.policyBuilder = new PolicyBuilder(region, account, environment);
    this.logGroupFactory = new LogGroupFactory(scope, environment);
  }

  /**
   * Create multiple custom resources from configuration
   */
  createCustomResources(
    resources: Record<string, CustomResourceConfig>
  ): Record<string, CustomResourceResult> {
    const result: Record<string, CustomResourceResult> = {};

    for (const [key, config] of Object.entries(resources)) {
      result[key] = this.createCustomResource(key, config);
    }

    return result;
  }

  /**
   * Create a single custom resource from configuration
   */
  createCustomResource(key: string, config: CustomResourceConfig): CustomResourceResult {
    // Create Lambda function
    const lambdaFunction = this.createLambdaFunction(key, config);

    // Add policies to Lambda function
    if (config.policies) {
      this.policyBuilder.addPoliciesToRole(lambdaFunction.role as iam.Role, config.policies);
    }

    // Create log group for provider
    const providerLogGroup = this.logGroupFactory.createLogGroup(`${key}Provider`, {
      name: `${config.functionName}-provider`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create custom resource provider
    const provider = new customResources.Provider(this.scope, `${this.toPascalCase(key)}Provider`, {
      onEventHandler: lambdaFunction,
      logGroup: providerLogGroup,
    });

    // Create custom resource
    const customResource = new cdk.CustomResource(this.scope, `${this.toPascalCase(key)}Resource`, {
      serviceToken: provider.serviceToken,
      properties: config.properties,
    });

    // Add dependencies
    if (config.dependencies) {
      config.dependencies.forEach(dep => {
        customResource.node.addDependency(dep);
      });
    }

    return {
      lambdaFunction,
      provider,
      customResource,
      logGroup: providerLogGroup,
    };
  }

  /**
   * Create Lambda function for custom resource
   */
  private createLambdaFunction(
    key: string,
    config: CustomResourceConfig
  ): lambdaNodejs.NodejsFunction {
    const constructId = `${this.toPascalCase(key)}Function`;
    const functionName = `rtm-${this.environment}-${config.functionName}`;

    const baseConfig: lambdaNodejs.NodejsFunctionProps = {
      functionName,
      entry: config.entry,
      handler: config.handler || 'handler',
      runtime: config.runtime || lambda.Runtime.NODEJS_18_X,
      timeout: config.timeout || cdk.Duration.minutes(5),
      memorySize: config.memorySize || 256,
      environment: {
        RTM_ENVIRONMENT: this.environment,
        ...config.environment,
      },
      bundling: {
        externalModules: ['@aws-sdk/*'],
        ...config.bundling,
      },
    };

    // Add VPC configuration if needed
    const lambdaConfig: lambdaNodejs.NodejsFunctionProps =
      config.needsVpc !== false
        ? {
            ...baseConfig,
            vpc: this.vpc,
            vpcSubnets: {
              subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            securityGroups: [this.lambdaSecurityGroup],
          }
        : baseConfig;

    return new lambdaNodejs.NodejsFunction(this.scope, constructId, lambdaConfig);
  }

  /**
   * Convert camelCase to PascalCase
   */
  private toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Custom resource configuration interface
 */
export interface CustomResourceConfig {
  /** Lambda function name suffix */
  functionName: string;
  /** Lambda entry point file path */
  entry: string;
  /** Lambda handler function name */
  handler?: string;
  /** Lambda runtime */
  runtime?: lambda.Runtime;
  /** Function timeout */
  timeout?: cdk.Duration;
  /** Memory size in MB */
  memorySize?: number;
  /** Whether function needs VPC access */
  needsVpc?: boolean;
  /** Environment variables */
  environment?: Record<string, string>;
  /** Bundling options */
  bundling?: Partial<lambdaNodejs.BundlingOptions>;
  /** IAM policies to attach */
  policies?: PolicyConfig[];
  /** Custom resource properties */
  properties?: Record<string, any>;
  /** Dependencies for the custom resource */
  dependencies?: any[];
}

/**
 * Custom resource creation result
 */
export interface CustomResourceResult {
  /** Lambda function */
  lambdaFunction: lambdaNodejs.NodejsFunction;
  /** Custom resource provider */
  provider: customResources.Provider;
  /** Custom resource */
  customResource: cdk.CustomResource;
  /** Log group */
  logGroup: logs.LogGroup;
}

/**
 * Pre-configured custom resource sets
 */
export const CustomResourceSets = {
  userCreator: (
    entryPath: string,
    userPool: any,
    database: any,
    userPoolArn: string
  ): CustomResourceConfig => ({
    functionName: 'user-creator',
    entry: entryPath,
    handler: 'handler',
    timeout: cdk.Duration.minutes(5),
    memorySize: 256,
    needsVpc: true,
    bundling: {
      nodeModules: ['node-fetch', 'pg'],
    },
    policies: [
      {
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminGetUser',
          'cognito-idp:ListUsers',
        ],
        resources: [userPoolArn],
      },
      {
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          'arn:aws:secretsmanager:{region}:{account}:secret:rtm-{environment}-db-credentials*',
        ],
      },
    ],
    dependencies: [userPool, database],
  }),

  postgisInstaller: (entryPath: string, database: any): CustomResourceConfig => ({
    functionName: 'postgis-installer',
    entry: entryPath,
    handler: 'postgisInstaller',
    timeout: cdk.Duration.minutes(5),
    needsVpc: true,
    environment: {
      DB_HOST: database.instanceEndpoint.hostname,
      DB_PORT: database.instanceEndpoint.port.toString(),
      DB_NAME: 'rtm_database',
    },
    bundling: {
      externalModules: ['pg-native'],
    },
    policies: [
      {
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          'arn:aws:secretsmanager:{region}:{account}:secret:rtm-{environment}-db-credentials*',
        ],
      },
    ],
    properties: {
      Version: '1.0.0', // Change to force re-installation
    },
    dependencies: [database],
  }),
};
