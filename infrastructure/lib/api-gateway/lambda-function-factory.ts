import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

/**
 * Factory for importing Lambda functions from CloudFormation exports
 * Eliminates repetitive fromFunctionAttributes calls
 */
export class LambdaFunctionFactory {
  private functions: Map<string, lambda.IFunction> = new Map();

  constructor(
    private scope: Construct,
    private environment: string
  ) {}

  /**
   * Import a Lambda function by name with automatic ARN lookup
   */
  getFunction(functionName: string): lambda.IFunction {
    if (this.functions.has(functionName)) {
      return this.functions.get(functionName)!;
    }

    const arnExportName = `rtm-${this.environment}-${functionName}-function-arn`;
    const constructId = `Imported${this.toPascalCase(functionName)}Function`;

    const func = lambda.Function.fromFunctionAttributes(this.scope, constructId, {
      functionArn: cdk.Fn.importValue(arnExportName),
      sameEnvironment: true, // Allows permission grants
    });

    this.functions.set(functionName, func);
    return func;
  }

  /**
   * Import multiple Lambda functions at once
   */
  getFunctions(functionNames: string[]): Record<string, lambda.IFunction> {
    const result: Record<string, lambda.IFunction> = {};

    for (const name of functionNames) {
      result[name] = this.getFunction(name);
    }

    return result;
  }

  /**
   * Get all imported functions for permission granting
   */
  getAllFunctions(): lambda.IFunction[] {
    return Array.from(this.functions.values());
  }

  private toPascalCase(kebabCase: string): string {
    return kebabCase
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}
