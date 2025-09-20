import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { InfrastructureStack } from '../infrastructure-stack';
import { LambdaFunctionConfig } from './function-definitions';

/**
 * Factory for creating Lambda functions with standardized configuration
 * Eliminates repetitive function creation code
 */
export class LambdaFunctionFactory {
  private functions: Map<string, lambda.Function> = new Map();

  constructor(
    private scope: Construct,
    private environment: string,
    private infrastructureStack: InfrastructureStack,
    private defaultTimeout: number,
    private defaultMemory: number
  ) {}

  /**
   * Create multiple Lambda functions from configuration
   */
  createFunctions(configs: Record<string, LambdaFunctionConfig>): Record<string, lambda.Function> {
    const result: Record<string, lambda.Function> = {};

    for (const [key, config] of Object.entries(configs)) {
      const func = this.createFunction(key, config);
      result[key] = func;
      this.functions.set(key, func);
    }

    return result;
  }

  /**
   * Create a single Lambda function from configuration
   */
  createFunction(key: string, config: LambdaFunctionConfig): lambda.Function {
    const logGroup = this.createLogGroup(config.name);
    const environmentVariables = this.buildEnvironmentVariables(config);

    const baseConfig: lambda.FunctionProps = {
      functionName: this.getFunctionName(config.name),
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: config.handler,
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(config.timeout || this.defaultTimeout),
      memorySize: config.memory || this.defaultMemory,
      role: this.infrastructureStack.lambdaRole,
      logGroup,
      environment: environmentVariables,
      description: config.description,
      tracing: lambda.Tracing.ACTIVE,
    };

    // Add VPC configuration if needed (default: true)
    const functionConfig: lambda.FunctionProps =
      config.needsVpc !== false
        ? {
            ...baseConfig,
            vpc: this.infrastructureStack.vpc,
            vpcSubnets: {
              subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            securityGroups: [this.infrastructureStack.lambdaSecurityGroup],
          }
        : baseConfig;

    const lambdaFunction = new lambda.Function(this.scope, config.id, functionConfig);

    // Automatically add CloudWatch alarms unless disabled
    if (config.enableAlarms !== false) {
      this.addLambdaAlarms(config.name, lambdaFunction);
    }

    return lambdaFunction;
  }

  /**
   * Get all created functions
   */
  getAllFunctions(): Record<string, lambda.Function> {
    const result: Record<string, lambda.Function> = {};
    for (const [key, func] of this.functions.entries()) {
      result[key] = func;
    }
    return result;
  }

  /**
   * Create standardized log group for Lambda function
   */
  private createLogGroup(functionName: string): logs.LogGroup {
    const logGroupName = `/aws/lambda/rtm-${this.environment}-${this.toKebabCase(functionName)}`;

    return new logs.LogGroup(this.scope, `${functionName}LogGroup`, {
      logGroupName,
      retention:
        this.environment === 'production'
          ? logs.RetentionDays.ONE_MONTH
          : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        this.environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });
  }

  /**
   * Build complete environment variables for function
   */
  private buildEnvironmentVariables(config: LambdaFunctionConfig): Record<string, string> {
    const baseEnvironment = this.getBaseEnvironmentVariables();
    const databaseEnvironment = this.getDatabaseEnvironmentVariables();

    // Get custom environment from config provider
    const customEnvironment = config.environmentConfig
      ? config.environmentConfig(this.environment, this.infrastructureStack)
      : {};

    // Merge additional environment variables
    const additionalEnvironment = config.additionalEnvironment || {};

    return {
      ...baseEnvironment,
      ...databaseEnvironment,
      ...customEnvironment,
      ...additionalEnvironment,
    };
  }

  /**
   * Get base environment variables
   */
  private getBaseEnvironmentVariables(): Record<string, string> {
    return {
      NODE_ENV: 'production', // Always production for Lambda
      RTM_ENVIRONMENT: this.environment, // dev/staging/production
      LOG_LEVEL: this.environment === 'production' ? 'info' : 'debug',
      // AWS_REGION is automatically set by Lambda runtime
    };
  }

  /**
   * Get database environment variables
   */
  private getDatabaseEnvironmentVariables(): Record<string, string> {
    return {
      DB_HOST: this.infrastructureStack.database.instanceEndpoint.hostname,
      DB_PORT: this.infrastructureStack.database.instanceEndpoint.port.toString(),
      DB_NAME: 'rtm_database',
    };
  }

  /**
   * Get standardized function name
   */
  private getFunctionName(displayName: string): string {
    return `rtm-${this.environment}-${this.toKebabCase(displayName)}`;
  }

  /**
   * Convert PascalCase to kebab-case
   */
  private toKebabCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '-$1')
      .replace(/^-/, '')
      .toLowerCase();
  }

  /**
   * Add standardized CloudWatch alarms for Lambda function
   */
  private addLambdaAlarms(functionName: string, lambdaFunction: lambda.Function): void {
    const functionNameLower = functionName.toLowerCase();

    // Lambda duration alarm
    const durationAlarm = new cdk.aws_cloudwatch.Alarm(this.scope, `${functionName}DurationAlarm`, {
      alarmName: `rtm-${this.environment}-lambda-${functionNameLower}-duration`,
      alarmDescription: `${functionName} Lambda function high duration`,
      metric: lambdaFunction.metricDuration({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: this.environment === 'production' ? 5000 : 10000, // milliseconds
      evaluationPeriods: 2,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    durationAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(this.infrastructureStack.alertsTopic)
    );

    // Lambda error rate alarm
    const errorRateAlarm = new cdk.aws_cloudwatch.Alarm(
      this.scope,
      `${functionName}ErrorRateAlarm`,
      {
        alarmName: `rtm-${this.environment}-lambda-${functionNameLower}-errors`,
        alarmDescription: `${functionName} Lambda function high error rate`,
        metric: lambdaFunction.metricErrors({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: this.environment === 'production' ? 2 : 5,
        evaluationPeriods: 2,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );
    errorRateAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(this.infrastructureStack.alertsTopic)
    );

    // Lambda throttle alarm
    const throttleAlarm = new cdk.aws_cloudwatch.Alarm(this.scope, `${functionName}ThrottleAlarm`, {
      alarmName: `rtm-${this.environment}-lambda-${functionNameLower}-throttles`,
      alarmDescription: `${functionName} Lambda function throttling`,
      metric: lambdaFunction.metricThrottles({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    throttleAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(this.infrastructureStack.alertsTopic)
    );
  }
}
