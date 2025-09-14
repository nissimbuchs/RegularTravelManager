import * as iam from 'aws-cdk-lib/aws-iam';

/**
 * Builder for creating reusable IAM policy patterns
 * Eliminates repetitive policy statement creation
 */
export class PolicyBuilder {
  constructor(
    private region: string,
    private account: string,
    private environment: string
  ) {}

  /**
   * Add multiple policies to a role from configuration
   */
  addPoliciesToRole(role: iam.Role, policies: PolicyConfig[]): void {
    policies.forEach(policy => {
      const statement = this.createPolicyStatement(policy);
      role.addToPolicy(statement);
    });
  }

  /**
   * Create a policy statement from configuration
   */
  createPolicyStatement(config: PolicyConfig): iam.PolicyStatement {
    // Resolve resource ARNs using templates
    const resources = config.resources.map(resource => this.resolveResourceArn(resource));

    return new iam.PolicyStatement({
      effect: config.effect || iam.Effect.ALLOW,
      actions: config.actions,
      resources,
      conditions: config.conditions,
    });
  }

  /**
   * Resolve resource ARN templates
   */
  private resolveResourceArn(resource: string): string {
    return resource
      .replace('{region}', this.region)
      .replace('{account}', this.account)
      .replace('{environment}', this.environment);
  }
}

/**
 * Policy configuration interface
 */
export interface PolicyConfig {
  /** IAM actions */
  actions: string[];
  /** Resource ARNs (supports templates: {region}, {account}, {environment}) */
  resources: string[];
  /** Policy effect */
  effect?: iam.Effect;
  /** Conditions */
  conditions?: { [key: string]: { [key: string]: string | string[] } };
}

/**
 * Pre-configured policy sets for common services
 */
export const PolicySets = {
  rds: (databaseResourceId: string): PolicyConfig => ({
    actions: ['rds-db:connect'],
    resources: [`arn:aws:rds-db:{region}:{account}:dbuser:${databaseResourceId}/rtm_admin`],
  }),

  secretsManager: (): PolicyConfig => ({
    actions: ['secretsmanager:GetSecretValue'],
    resources: [
      'arn:aws:secretsmanager:{region}:{account}:secret:rtm-{environment}-db-credentials*',
    ],
  }),

  cognito: (userPoolArn: string): PolicyConfig => ({
    actions: [
      'cognito-idp:AdminGetUser',
      'cognito-idp:AdminListGroupsForUser',
      'cognito-idp:AdminUpdateUserAttributes',
      'cognito-idp:AdminCreateUser',
      'cognito-idp:AdminSetUserPassword',
      'cognito-idp:AdminAddUserToGroup',
      'cognito-idp:ListUsers',
      'cognito-idp:AdminDisableUser',
      'cognito-idp:AdminEnableUser',
    ],
    resources: [userPoolArn],
  }),

  location: (placeIndexArn: string): PolicyConfig => ({
    actions: ['geo:SearchPlaceIndexForText', 'geo:SearchPlaceIndexForPosition'],
    resources: [placeIndexArn],
  }),

  ses: (): PolicyConfig => ({
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['arn:aws:ses:{region}:{account}:identity/*'],
  }),

  parameterStore: (): PolicyConfig => ({
    actions: ['ssm:GetParameter', 'ssm:GetParameters'],
    resources: ['arn:aws:ssm:{region}:{account}:parameter/rtm/{environment}/*'],
  }),

  cognitoUserCreation: (userPoolArn: string): PolicyConfig => ({
    actions: [
      'cognito-idp:AdminCreateUser',
      'cognito-idp:AdminSetUserPassword',
      'cognito-idp:AdminAddUserToGroup',
      'cognito-idp:AdminGetUser',
      'cognito-idp:ListUsers',
      'cognito-idp:AdminDisableUser',
      'cognito-idp:AdminEnableUser',
    ],
    resources: [userPoolArn],
  }),

  vpcLambda: (): PolicyConfig => ({
    actions: [
      'ec2:CreateNetworkInterface',
      'ec2:DescribeNetworkInterfaces',
      'ec2:DeleteNetworkInterface',
    ],
    resources: ['*'], // VPC permissions require wildcard
  }),
};
