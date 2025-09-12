import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * Centralized export management for Lambda function ARNs
 * Eliminates repetitive export code
 */
export class LambdaExportManager {
  constructor(
    private scope: Construct,
    private environment: string
  ) {}

  /**
   * Export ARNs for all Lambda functions
   */
  exportFunctionArns(functions: Record<string, lambda.Function>): void {
    for (const [key, func] of Object.entries(functions)) {
      this.exportFunctionArn(key, func);
    }
  }

  /**
   * Export ARN for a single Lambda function
   */
  exportFunctionArn(functionKey: string, lambdaFunction: lambda.Function): void {
    const exportName = this.getExportName(functionKey);
    const exportId = this.getExportId(functionKey);
    
    new cdk.CfnOutput(this.scope, exportId, {
      value: lambdaFunction.functionArn,
      exportName: exportName,
      description: `ARN for ${functionKey} Lambda function`,
    });
  }

  /**
   * Get CloudFormation export name for function
   */
  private getExportName(functionKey: string): string {
    const kebabCase = this.toKebabCase(functionKey);
    return `rtm-${this.environment}-${kebabCase}-function-arn`;
  }

  /**
   * Get CDK export construct ID for function
   */
  private getExportId(functionKey: string): string {
    const pascalCase = this.toPascalCase(functionKey);
    return `${pascalCase}FunctionArnExport`;
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