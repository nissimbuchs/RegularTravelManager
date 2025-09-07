'use strict';
const __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        let desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
const __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, 'default', { enumerable: true, value: v });
      }
    : function (o, v) {
        o['default'] = v;
      });
const __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    const result = {};
    if (mod != null)
      for (const k in mod)
        if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
Object.defineProperty(exports, '__esModule', { value: true });
// Jest globals are available without explicit import
const cdk = __importStar(require('aws-cdk-lib'));
const client_cloudformation_1 = require('@aws-sdk/client-cloudformation');
const client_rds_1 = require('@aws-sdk/client-rds');
const client_cognito_identity_provider_1 = require('@aws-sdk/client-cognito-identity-provider');
const client_api_gateway_1 = require('@aws-sdk/client-api-gateway');
const client_location_1 = require('@aws-sdk/client-location');
const client_sns_1 = require('@aws-sdk/client-sns');
const client_cloudwatch_1 = require('@aws-sdk/client-cloudwatch');
const client_ssm_1 = require('@aws-sdk/client-ssm');
const infrastructure_stack_1 = require('../lib/infrastructure-stack');
// Integration tests that validate actual AWS resource deployment
// These tests require valid AWS credentials and may incur costs
// Run with: npm run test:integration
// Set SKIP_INTEGRATION=true to skip these tests
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION === 'true' || !process.env.CDK_DEPLOY_ACCOUNT;
const TEST_STACK_NAME = process.env.TEST_STACK_NAME || 'rtm-integration-test-stack';
const TEST_REGION = process.env.AWS_REGION || 'eu-central-1';
const TEST_ACCOUNT = process.env.CDK_DEPLOY_ACCOUNT;
describe.skip('Infrastructure Integration Tests', () => {
  let app;
  let stack;
  let cfnClient;
  let rdsClient;
  let cognitoClient;
  let apiGatewayClient;
  let locationClient;
  let snsClient;
  let cloudWatchClient;
  let ssmClient;
  beforeAll(async () => {
    if (SKIP_INTEGRATION) {
      if (!TEST_ACCOUNT) {
        console.log('⏭️  Skipping integration tests (CDK_DEPLOY_ACCOUNT not set)');
      } else {
        console.log('⏭️  Skipping integration tests (SKIP_INTEGRATION=true)');
      }
      return;
    }
    // Initialize AWS clients
    cfnClient = new client_cloudformation_1.CloudFormationClient({ region: TEST_REGION });
    rdsClient = new client_rds_1.RDSClient({ region: TEST_REGION });
    cognitoClient = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({
      region: TEST_REGION,
    });
    apiGatewayClient = new client_api_gateway_1.APIGatewayClient({ region: TEST_REGION });
    locationClient = new client_location_1.LocationClient({ region: TEST_REGION });
    snsClient = new client_sns_1.SNSClient({ region: TEST_REGION });
    cloudWatchClient = new client_cloudwatch_1.CloudWatchClient({ region: TEST_REGION });
    ssmClient = new client_ssm_1.SSMClient({ region: TEST_REGION });
    // Create test stack
    app = new cdk.App();
    stack = new infrastructure_stack_1.InfrastructureStack(app, TEST_STACK_NAME, {
      environment: 'dev',
      env: {
        account: TEST_ACCOUNT,
        region: TEST_REGION,
      },
    });
    console.log(`🚀 Test stack created: ${TEST_STACK_NAME}`);
  });
  afterAll(async () => {
    if (SKIP_INTEGRATION) {
      return;
    }
    console.log('🧹 Integration tests completed');
  });
  describe('Stack Deployment Validation', () => {
    it('should validate stack can be synthesized without errors', () => {
      expect(stack).toBeDefined();
      // Synthesize the stack to CloudFormation template
      const template = app.synth().getStackByName(TEST_STACK_NAME).template;
      expect(template).toBeDefined();
      expect(template.Resources).toBeDefined();
      // Verify critical resources are present
      const resources = Object.keys(template.Resources);
      expect(resources.some(r => template.Resources[r].Type === 'AWS::EC2::VPC')).toBe(true);
      expect(resources.some(r => template.Resources[r].Type === 'AWS::RDS::DBInstance')).toBe(true);
      expect(resources.some(r => template.Resources[r].Type === 'AWS::Cognito::UserPool')).toBe(
        true
      );
      expect(resources.some(r => template.Resources[r].Type === 'AWS::ApiGateway::RestApi')).toBe(
        true
      );
      expect(resources.some(r => template.Resources[r].Type === 'AWS::Location::PlaceIndex')).toBe(
        true
      );
      expect(resources.some(r => template.Resources[r].Type === 'AWS::SNS::Topic')).toBe(true);
    });
    it('should validate CloudWatch resources are created', { skip: SKIP_INTEGRATION }, () => {
      const template = app.synth().getStackByName(TEST_STACK_NAME).template;
      const resources = Object.keys(template.Resources);
      // Verify CloudWatch resources
      expect(resources.some(r => template.Resources[r].Type === 'AWS::CloudWatch::Alarm')).toBe(
        true
      );
      expect(resources.some(r => template.Resources[r].Type === 'AWS::CloudWatch::Dashboard')).toBe(
        true
      );
      expect(resources.some(r => template.Resources[r].Type === 'AWS::Logs::LogGroup')).toBe(true);
      // Count alarms - should have multiple alarms for different services
      const alarms = resources.filter(r => template.Resources[r].Type === 'AWS::CloudWatch::Alarm');
      expect(alarms.length).toBeGreaterThan(5); // API Gateway, RDS, Cognito, Lambda alarms
    });
    it('should validate SSM parameters are configured', { skip: SKIP_INTEGRATION }, () => {
      const template = app.synth().getStackByName(TEST_STACK_NAME).template;
      const resources = Object.keys(template.Resources);
      // Verify SSM parameters
      const ssmParams = resources.filter(r => template.Resources[r].Type === 'AWS::SSM::Parameter');
      expect(ssmParams.length).toBeGreaterThan(10); // Multiple configuration parameters
      // Check specific parameter patterns
      const paramNames = ssmParams.map(r => template.Resources[r].Properties.Name);
      expect(paramNames.some(name => name.includes('/database/endpoint'))).toBe(true);
      expect(paramNames.some(name => name.includes('/cognito/user-pool-id'))).toBe(true);
      expect(paramNames.some(name => name.includes('/api/gateway-id'))).toBe(true);
      expect(paramNames.some(name => name.includes('/monitoring/alerts-topic-arn'))).toBe(true);
    });
  });
  describe('Resource Configuration Validation', () => {
    it('should validate RDS instance configuration', { skip: SKIP_INTEGRATION }, () => {
      const template = app.synth().getStackByName(TEST_STACK_NAME).template;
      const resources = template.Resources;
      // Find RDS instance
      const rdsInstance = Object.values(resources).find(r => r.Type === 'AWS::RDS::DBInstance');
      expect(rdsInstance).toBeDefined();
      expect(rdsInstance.Properties.Engine).toBe('postgres');
      expect(rdsInstance.Properties.DBName).toBe('rtm_database');
      expect(rdsInstance.Properties.BackupRetentionPeriod).toBe(1); // dev environment
      expect(rdsInstance.Properties.DeletionProtection).toBe(false); // dev environment
    });
    it('should validate Cognito User Pool configuration', { skip: SKIP_INTEGRATION }, () => {
      const template = app.synth().getStackByName(TEST_STACK_NAME).template;
      const resources = template.Resources;
      // Find Cognito User Pool
      const userPool = Object.values(resources).find(r => r.Type === 'AWS::Cognito::UserPool');
      expect(userPool).toBeDefined();
      expect(userPool.Properties.UserPoolName).toBe('rtm-dev-users');
      expect(userPool.Properties.UsernameAttributes).toContain('email');
      // Verify password policy
      expect(userPool.Properties.Policies.PasswordPolicy.MinimumLength).toBe(12);
      expect(userPool.Properties.Policies.PasswordPolicy.RequireLowercase).toBe(true);
      expect(userPool.Properties.Policies.PasswordPolicy.RequireUppercase).toBe(true);
      expect(userPool.Properties.Policies.PasswordPolicy.RequireNumbers).toBe(true);
      expect(userPool.Properties.Policies.PasswordPolicy.RequireSymbols).toBe(true);
    });
    it('should validate API Gateway configuration', { skip: SKIP_INTEGRATION }, () => {
      const template = app.synth().getStackByName(TEST_STACK_NAME).template;
      const resources = template.Resources;
      // Find API Gateway
      const apiGateway = Object.values(resources).find(r => r.Type === 'AWS::ApiGateway::RestApi');
      expect(apiGateway).toBeDefined();
      expect(apiGateway.Properties.Name).toBe('rtm-dev-api');
      // Find deployment
      const deployment = Object.values(resources).find(
        r => r.Type === 'AWS::ApiGateway::Deployment'
      );
      expect(deployment).toBeDefined();
    });
    it('should validate VPC and networking configuration', { skip: SKIP_INTEGRATION }, () => {
      const template = app.synth().getStackByName(TEST_STACK_NAME).template;
      const resources = template.Resources;
      // Find VPC
      const vpc = Object.values(resources).find(r => r.Type === 'AWS::EC2::VPC');
      expect(vpc).toBeDefined();
      expect(vpc.Properties.CidrBlock).toBe('10.0.0.0/16');
      // Verify subnets - should have 6 subnets (2 AZs × 3 types)
      const subnets = Object.values(resources).filter(r => r.Type === 'AWS::EC2::Subnet');
      expect(subnets.length).toBe(6);
      // Verify NAT Gateway
      const natGateways = Object.values(resources).filter(r => r.Type === 'AWS::EC2::NatGateway');
      expect(natGateways.length).toBe(1); // Single NAT Gateway for cost optimization
    });
    it('should validate Location Service configuration', { skip: SKIP_INTEGRATION }, () => {
      const template = app.synth().getStackByName(TEST_STACK_NAME).template;
      const resources = template.Resources;
      // Find Place Index
      const placeIndex = Object.values(resources).find(r => r.Type === 'AWS::Location::PlaceIndex');
      expect(placeIndex).toBeDefined();
      expect(placeIndex.Properties.IndexName).toBe('rtm-dev-places');
      expect(placeIndex.Properties.DataSource).toBe('Here');
      expect(placeIndex.Properties.DataSourceConfiguration.IntendedUse).toBe('Storage');
    });
    it('should validate IAM roles and policies', { skip: SKIP_INTEGRATION }, () => {
      const template = app.synth().getStackByName(TEST_STACK_NAME).template;
      const resources = template.Resources;
      // Find Lambda execution role
      const lambdaRole = Object.values(resources).find(
        r => r.Type === 'AWS::IAM::Role' && r.Properties.RoleName === 'rtm-dev-lambda-role'
      );
      expect(lambdaRole).toBeDefined();
      expect(lambdaRole.Properties.AssumeRolePolicyDocument.Statement[0].Principal.Service).toBe(
        'lambda.amazonaws.com'
      );
      // Verify managed policies
      expect(lambdaRole.Properties.ManagedPolicyArns).toContain(
        'arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole'
      );
      // Find inline policies
      const policies = Object.values(resources).filter(r => r.Type === 'AWS::IAM::Policy');
      expect(policies.length).toBeGreaterThan(0);
    });
  });
  describe('Monitoring and Alerting Validation', () => {
    it('should validate CloudWatch alarms configuration', { skip: SKIP_INTEGRATION }, () => {
      const template = app.synth().getStackByName(TEST_STACK_NAME).template;
      const resources = template.Resources;
      // Find all alarms
      const alarms = Object.values(resources).filter(r => r.Type === 'AWS::CloudWatch::Alarm');
      expect(alarms.length).toBeGreaterThan(5);
      // Verify API Gateway alarms
      const apiAlarms = alarms.filter(alarm => alarm.Properties.AlarmName.includes('api'));
      expect(apiAlarms.length).toBeGreaterThan(2); // 4xx, 5xx, latency alarms
      // Verify RDS alarms
      const rdsAlarms = alarms.filter(alarm => alarm.Properties.AlarmName.includes('db'));
      expect(rdsAlarms.length).toBeGreaterThan(2); // CPU, connections, free space alarms
      // Verify Cognito alarms
      const cognitoAlarms = alarms.filter(alarm => alarm.Properties.AlarmName.includes('cognito'));
      expect(cognitoAlarms.length).toBeGreaterThan(0); // Throttling alarm
      // Verify Lambda alarms
      const lambdaAlarms = alarms.filter(alarm => alarm.Properties.AlarmName.includes('lambda'));
      expect(lambdaAlarms.length).toBeGreaterThan(0); // Concurrency alarm
    });
    it('should validate SNS topic for alerts', { skip: SKIP_INTEGRATION }, () => {
      const template = app.synth().getStackByName(TEST_STACK_NAME).template;
      const resources = template.Resources;
      // Find SNS topic
      const snsTopic = Object.values(resources).find(r => r.Type === 'AWS::SNS::Topic');
      expect(snsTopic).toBeDefined();
      expect(snsTopic.Properties.TopicName).toBe('rtm-dev-alerts');
      expect(snsTopic.Properties.DisplayName).toBe('RTM dev Alerts');
    });
    it('should validate CloudWatch dashboard', { skip: SKIP_INTEGRATION }, () => {
      const template = app.synth().getStackByName(TEST_STACK_NAME).template;
      const resources = template.Resources;
      // Find dashboard
      const dashboard = Object.values(resources).find(r => r.Type === 'AWS::CloudWatch::Dashboard');
      expect(dashboard).toBeDefined();
      expect(dashboard.Properties.DashboardName).toBe('rtm-dev-monitoring');
      // Verify dashboard body contains widgets
      const dashboardBody = JSON.parse(dashboard.Properties.DashboardBody);
      expect(dashboardBody.widgets).toBeDefined();
      expect(dashboardBody.widgets.length).toBeGreaterThan(3); // API Gateway and RDS widgets
    });
    it('should validate log groups configuration', { skip: SKIP_INTEGRATION }, () => {
      const template = app.synth().getStackByName(TEST_STACK_NAME).template;
      const resources = template.Resources;
      // Find log groups
      const logGroups = Object.values(resources).filter(r => r.Type === 'AWS::Logs::LogGroup');
      expect(logGroups.length).toBeGreaterThan(0);
      // Verify API Gateway log group
      const apiLogGroup = logGroups.find(lg => lg.Properties.LogGroupName.includes('apigateway'));
      expect(apiLogGroup).toBeDefined();
      expect(apiLogGroup.Properties.RetentionInDays).toBe(7); // dev environment
    });
  });
  describe('Auto-scaling Configuration Validation', () => {
    it(
      'should validate Lambda reserved concurrency configuration',
      { skip: SKIP_INTEGRATION },
      () => {
        const template = app.synth().getStackByName(TEST_STACK_NAME).template;
        // Find SSM parameter for Lambda reserved concurrency
        const resources = template.Resources;
        const ssmParams = Object.values(resources).filter(r => r.Type === 'AWS::SSM::Parameter');
        const concurrencyParam = ssmParams.find(
          param => param.Properties.Name === '/rtm/dev/config/lambdaReservedConcurrency'
        );
        expect(concurrencyParam).toBeDefined();
        expect(concurrencyParam.Properties.Value).toBe('10'); // dev environment
      }
    );
    it('should not have read replica in dev environment', { skip: SKIP_INTEGRATION }, () => {
      const template = app.synth().getStackByName(TEST_STACK_NAME).template;
      const resources = template.Resources;
      // Should not have read replica in dev environment
      const readReplica = Object.values(resources).find(
        r => r.Type === 'AWS::RDS::DBInstance' && r.Properties.SourceDBInstanceIdentifier
      );
      expect(readReplica).toBeUndefined();
    });
    it(
      'should validate production environment has read replica',
      { skip: SKIP_INTEGRATION },
      () => {
        // Create production stack for this test
        const prodApp = new cdk.App();
        const prodStack = new infrastructure_stack_1.InfrastructureStack(
          prodApp,
          'test-prod-stack',
          {
            environment: 'production',
            env: {
              account: TEST_ACCOUNT,
              region: TEST_REGION,
            },
          }
        );
        const template = prodApp.synth().getStackByName('test-prod-stack').template;
        const resources = template.Resources;
        // Should have read replica in production
        const readReplica = Object.values(resources).find(
          r => r.Type === 'AWS::RDS::DBInstance' && r.Properties.SourceDBInstanceIdentifier
        );
        expect(readReplica).toBeDefined();
        // Should have additional alarms for read replica
        const alarms = Object.values(resources).filter(r => r.Type === 'AWS::CloudWatch::Alarm');
        const replicaAlarms = alarms.filter(
          alarm =>
            alarm.Properties.AlarmName.includes('read-replica') ||
            alarm.Properties.AlarmName.includes('replication-lag')
        );
        expect(replicaAlarms.length).toBeGreaterThan(1);
      }
    );
  });
  describe('Resource Tagging Validation', () => {
    it('should validate all resources have proper tags', { skip: SKIP_INTEGRATION }, () => {
      const template = app.synth().getStackByName(TEST_STACK_NAME).template;
      const resources = template.Resources;
      // Check that stack-level tags are applied
      const rdsInstance = Object.values(resources).find(r => r.Type === 'AWS::RDS::DBInstance');
      expect(rdsInstance.Properties.Tags).toBeDefined();
      const tags = rdsInstance.Properties.Tags;
      expect(
        tags.find(tag => tag.Key === 'Project' && tag.Value === 'RegularTravelManager')
      ).toBeDefined();
      expect(tags.find(tag => tag.Key === 'Environment' && tag.Value === 'dev')).toBeDefined();
      expect(tags.find(tag => tag.Key === 'ManagedBy' && tag.Value === 'CDK')).toBeDefined();
      expect(
        tags.find(tag => tag.Key === 'CostCenter' && tag.Value === 'IT-Operations')
      ).toBeDefined();
    });
  });
});
// Helper function to wait for stack deployment (if implemented)
async function waitForStackReady(stackName, cfnClient) {
  try {
    const response = await cfnClient.send(
      new client_cloudformation_1.DescribeStacksCommand({ StackName: stackName })
    );
    const stack = response.Stacks?.[0];
    if (!stack) return false;
    const status = stack.StackStatus;
    if (
      status === client_cloudformation_1.StackStatus.CREATE_COMPLETE ||
      status === client_cloudformation_1.StackStatus.UPDATE_COMPLETE
    ) {
      return true;
    }
    if (
      status === client_cloudformation_1.StackStatus.CREATE_FAILED ||
      status === client_cloudformation_1.StackStatus.UPDATE_FAILED
    ) {
      throw new Error(`Stack ${stackName} failed with status: ${status}`);
    }
    return false;
  } catch (error) {
    if (error.name === 'ValidationError' && error.message.includes('does not exist')) {
      return false;
    }
    throw error;
  }
}
//# sourceMappingURL=infrastructure-integration.test.js.map
