import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';

/**
 * Centralized permission management for API Gateway Lambda integrations
 * Eliminates repetitive grantInvoke calls throughout the codebase
 */
export class ApiPermissionManager {
  private grantedFunctions: Set<string> = new Set();

  constructor(private functions: Record<string, lambda.IFunction>) {}

  /**
   * Grant API Gateway invoke permissions to all functions
   * Automatically handles deduplication
   */
  grantAllPermissions(): void {
    for (const [name, func] of Object.entries(this.functions)) {
      this.grantPermission(func, name);
    }
  }

  /**
   * Grant permission to specific function by name
   */
  grantPermissionByName(functionName: string): void {
    const func = this.functions[functionName];
    if (!func) {
      throw new Error(`Function '${functionName}' not found`);
    }
    this.grantPermission(func, functionName);
  }

  /**
   * Grant permissions to multiple functions by name
   */
  grantPermissionsByNames(functionNames: string[]): void {
    for (const name of functionNames) {
      this.grantPermissionByName(name);
    }
  }

  /**
   * Grant permission to a single function (with deduplication)
   */
  private grantPermission(func: lambda.IFunction, identifier: string): void {
    if (this.grantedFunctions.has(identifier)) {
      return; // Already granted
    }

    func.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    this.grantedFunctions.add(identifier);
  }

  /**
   * Get list of functions that have been granted permissions
   */
  getGrantedFunctions(): string[] {
    return Array.from(this.grantedFunctions);
  }

  /**
   * Check if a function has been granted permissions
   */
  hasPermission(functionName: string): boolean {
    return this.grantedFunctions.has(functionName);
  }
}
