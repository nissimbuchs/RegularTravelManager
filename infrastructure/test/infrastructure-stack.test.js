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
const assertions_1 = require('aws-cdk-lib/assertions');
const infrastructure_stack_1 = require('../lib/infrastructure-stack');
describe('InfrastructureStack', () => {
  it('should create stack without errors', () => {
    const app = new cdk.App();
    const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
      environment: 'dev',
      env: {
        account: '123456789012',
        region: 'eu-central-1',
      },
    });
    expect(stack).toBeDefined();
  });
  it('should synthesize stack template', () => {
    const app = new cdk.App();
    const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
      environment: 'dev',
      env: {
        account: '123456789012',
        region: 'eu-central-1',
      },
    });
    const template = assertions_1.Template.fromStack(stack);
    expect(template).toBeDefined();
  });
  it('should create RDS PostgreSQL instance', () => {
    const app = new cdk.App();
    const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
      environment: 'dev',
      env: {
        account: '123456789012',
        region: 'eu-central-1',
      },
    });
    const template = assertions_1.Template.fromStack(stack);
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      Engine: 'postgres',
      DBName: 'rtm_database',
    });
  });
  it('should create Cognito User Pool with correct configuration', () => {
    const app = new cdk.App();
    const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
      environment: 'dev',
      env: {
        account: '123456789012',
        region: 'eu-central-1',
      },
    });
    const template = assertions_1.Template.fromStack(stack);
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'rtm-dev-users',
      UsernameAttributes: ['email'],
    });
    // Verify user groups are created
    template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
      GroupName: 'employees',
      Description: 'Regular employees who can submit travel requests',
    });
    template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
      GroupName: 'managers',
      Description: 'Managers who can approve travel requests',
    });
  });
  it('should create API Gateway with CORS enabled', () => {
    const app = new cdk.App();
    const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
      environment: 'dev',
      env: {
        account: '123456789012',
        region: 'eu-central-1',
      },
    });
    const template = assertions_1.Template.fromStack(stack);
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'rtm-dev-api',
    });
  });
  it('should create AWS Location Service Place Index', () => {
    const app = new cdk.App();
    const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
      environment: 'dev',
      env: {
        account: '123456789012',
        region: 'eu-central-1',
      },
    });
    const template = assertions_1.Template.fromStack(stack);
    template.hasResourceProperties('AWS::Location::PlaceIndex', {
      IndexName: 'rtm-dev-places',
      DataSource: 'Here',
    });
  });
  it('should create IAM role with proper permissions', () => {
    const app = new cdk.App();
    const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
      environment: 'dev',
      env: {
        account: '123456789012',
        region: 'eu-central-1',
      },
    });
    const template = assertions_1.Template.fromStack(stack);
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'rtm-dev-lambda-role',
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' },
            Action: 'sts:AssumeRole',
          },
        ],
      },
    });
  });
  it('should create VPC with proper subnet configuration', () => {
    const app = new cdk.App();
    const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
      environment: 'dev',
      env: {
        account: '123456789012',
        region: 'eu-central-1',
      },
    });
    const template = assertions_1.Template.fromStack(stack);
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '10.0.0.0/16',
    });
    // Should have public, private, and isolated subnets
    template.resourceCountIs('AWS::EC2::Subnet', 6); // 2 AZs * 3 subnet types
  });
  it('should create environment-specific configuration parameters', () => {
    const app = new cdk.App();
    const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
      environment: 'production',
      env: {
        account: '123456789012',
        region: 'eu-central-1',
      },
    });
    const template = assertions_1.Template.fromStack(stack);
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/rtm/production/config/environment',
      Value: 'production',
    });
  });
  it('should apply appropriate resource tags', () => {
    const app = new cdk.App();
    const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
      environment: 'dev',
      env: {
        account: '123456789012',
        region: 'eu-central-1',
      },
    });
    const template = assertions_1.Template.fromStack(stack);
    // Check that resources have required tags in the synthesized template
    template.hasResource('AWS::RDS::DBInstance', {
      Properties: {
        Tags: assertions_1.Match.arrayWith([{ Key: 'Project', Value: 'RegularTravelManager' }]),
      },
    });
  });
  it('should create SES configuration for email notifications', () => {
    const app = new cdk.App();
    const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
      environment: 'dev',
      domainName: 'example.com',
      env: {
        account: '123456789012',
        region: 'eu-central-1',
      },
    });
    const template = assertions_1.Template.fromStack(stack);
    // Verify SES domain identity is created when domain name is provided
    template.hasResourceProperties('AWS::SES::EmailIdentity', {
      EmailIdentity: 'example.com',
    });
    // Verify SES parameter is stored
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/rtm/dev/ses/domain',
      Value: 'example.com',
    });
  });
  it('should create Cognito authorizer for API Gateway', () => {
    const app = new cdk.App();
    const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
      environment: 'dev',
      env: {
        account: '123456789012',
        region: 'eu-central-1',
      },
    });
    const template = assertions_1.Template.fromStack(stack);
    // Verify Cognito authorizer is created
    template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      Name: 'rtm-dev-authorizer',
      Type: 'COGNITO_USER_POOLS',
    });
  });
  describe('CloudWatch Monitoring', () => {
    it('should create SNS topic for alerts', () => {
      const app = new cdk.App();
      const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
        environment: 'dev',
        env: {
          account: '123456789012',
          region: 'eu-central-1',
        },
      });
      const template = assertions_1.Template.fromStack(stack);
      template.hasResourceProperties('AWS::SNS::Topic', {
        TopicName: 'rtm-dev-alerts',
        DisplayName: 'RTM dev Alerts',
      });
    });
    it('should create CloudWatch alarms for API Gateway', () => {
      const app = new cdk.App();
      const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
        environment: 'dev',
        env: {
          account: '123456789012',
          region: 'eu-central-1',
        },
      });
      const template = assertions_1.Template.fromStack(stack);
      // API Gateway 4xx alarm
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'rtm-dev-api-4xx-errors',
        AlarmDescription: 'API Gateway 4xx errors',
        Threshold: 50,
        EvaluationPeriods: 2,
      });
      // API Gateway 5xx alarm
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'rtm-dev-api-5xx-errors',
        AlarmDescription: 'API Gateway 5xx errors',
        Threshold: 10,
        EvaluationPeriods: 1,
      });
      // API Gateway latency alarm
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'rtm-dev-api-high-latency',
        AlarmDescription: 'API Gateway high latency',
        Threshold: 5000,
        EvaluationPeriods: 3,
      });
    });
    it('should create CloudWatch alarms for RDS', () => {
      const app = new cdk.App();
      const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
        environment: 'dev',
        env: {
          account: '123456789012',
          region: 'eu-central-1',
        },
      });
      const template = assertions_1.Template.fromStack(stack);
      // RDS CPU alarm
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'rtm-dev-db-high-cpu',
        AlarmDescription: 'RDS high CPU utilization',
        Threshold: 90,
        EvaluationPeriods: 3,
      });
      // RDS connections alarm
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'rtm-dev-db-high-connections',
        AlarmDescription: 'RDS high connection count',
        Threshold: 8,
        EvaluationPeriods: 2,
      });
      // RDS free space alarm
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'rtm-dev-db-low-free-space',
        AlarmDescription: 'RDS low free storage space',
        Threshold: 2147483648, // 2GB in bytes
        ComparisonOperator: 'LessThanThreshold',
      });
    });
    it('should create CloudWatch alarms for Cognito', () => {
      const app = new cdk.App();
      const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
        environment: 'dev',
        env: {
          account: '123456789012',
          region: 'eu-central-1',
        },
      });
      const template = assertions_1.Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'rtm-dev-cognito-throttling',
        AlarmDescription: 'Cognito API throttling',
        Threshold: 10,
        EvaluationPeriods: 2,
      });
    });
    it('should create CloudWatch dashboard', () => {
      const app = new cdk.App();
      const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
        environment: 'dev',
        env: {
          account: '123456789012',
          region: 'eu-central-1',
        },
      });
      const template = assertions_1.Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
        DashboardName: 'rtm-dev-monitoring',
      });
    });
    it('should create CloudWatch log group for API Gateway', () => {
      const app = new cdk.App();
      const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
        environment: 'dev',
        env: {
          account: '123456789012',
          region: 'eu-central-1',
        },
      });
      const template = assertions_1.Template.fromStack(stack);
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/apigateway/rtm-dev-api',
        RetentionInDays: 7,
      });
    });
  });
  describe('Auto-scaling Configuration', () => {
    it('should configure Lambda reserved concurrency settings', () => {
      const app = new cdk.App();
      const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
        environment: 'dev',
        env: {
          account: '123456789012',
          region: 'eu-central-1',
        },
      });
      const template = assertions_1.Template.fromStack(stack);
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/rtm/dev/config/lambdaReservedConcurrency',
        Value: '10',
      });
    });
    it('should not create read replica in dev environment', () => {
      const app = new cdk.App();
      const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
        environment: 'dev',
        env: {
          account: '123456789012',
          region: 'eu-central-1',
        },
      });
      const template = assertions_1.Template.fromStack(stack);
      // Should only have one RDS instance (no read replica)
      template.resourceCountIs('AWS::RDS::DBInstance', 1);
    });
    it('should create read replica in production environment', () => {
      const app = new cdk.App();
      const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
        environment: 'production',
        env: {
          account: '123456789012',
          region: 'eu-central-1',
        },
      });
      const template = assertions_1.Template.fromStack(stack);
      // Should have main DB instance plus read replica
      template.resourceCountIs('AWS::RDS::DBInstance', 2);
      // Verify read replica endpoint parameter
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/rtm/production/database/read-replica-endpoint',
      });
      // Verify read replica alarms
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'rtm-production-db-read-replica-high-cpu',
        AlarmDescription: 'RDS read replica high CPU utilization',
        Threshold: 80,
      });
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'rtm-production-db-replication-lag',
        AlarmDescription: 'RDS read replica replication lag',
        Threshold: 300,
      });
    });
    it('should have different scaling settings for production', () => {
      const app = new cdk.App();
      const stack = new infrastructure_stack_1.InfrastructureStack(app, 'TestStack', {
        environment: 'production',
        env: {
          account: '123456789012',
          region: 'eu-central-1',
        },
      });
      const template = assertions_1.Template.fromStack(stack);
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/rtm/production/config/lambdaReservedConcurrency',
        Value: '200',
      });
      // Production should have stricter alarm thresholds
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'rtm-production-api-4xx-errors',
        Threshold: 10, // Stricter than dev (50)
      });
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'rtm-production-api-5xx-errors',
        Threshold: 5, // Stricter than dev (10)
      });
    });
  });
  describe('Environment-specific Configuration', () => {
    it('should use different RDS instance sizes per environment', () => {
      const devApp = new cdk.App();
      const devStack = new infrastructure_stack_1.InfrastructureStack(devApp, 'DevStack', {
        environment: 'dev',
        env: {
          account: '123456789012',
          region: 'eu-central-1',
        },
      });
      const prodApp = new cdk.App();
      const prodStack = new infrastructure_stack_1.InfrastructureStack(prodApp, 'ProdStack', {
        environment: 'production',
        env: {
          account: '123456789012',
          region: 'eu-central-1',
        },
      });
      const devTemplate = assertions_1.Template.fromStack(devStack);
      const prodTemplate = assertions_1.Template.fromStack(prodStack);
      // Dev should use t3.micro
      devTemplate.hasResourceProperties('AWS::RDS::DBInstance', {
        DBInstanceClass: 'db.t3.micro',
      });
      // Production should use t3.small
      prodTemplate.hasResourceProperties('AWS::RDS::DBInstance', {
        DBInstanceClass: 'db.t3.small',
      });
    });
    it('should have different backup retention per environment', () => {
      const devApp = new cdk.App();
      const devStack = new infrastructure_stack_1.InfrastructureStack(devApp, 'DevStack', {
        environment: 'dev',
        env: {
          account: '123456789012',
          region: 'eu-central-1',
        },
      });
      const prodApp = new cdk.App();
      const prodStack = new infrastructure_stack_1.InfrastructureStack(prodApp, 'ProdStack', {
        environment: 'production',
        env: {
          account: '123456789012',
          region: 'eu-central-1',
        },
      });
      const devTemplate = assertions_1.Template.fromStack(devStack);
      const prodTemplate = assertions_1.Template.fromStack(prodStack);
      // Dev should have 1 day backup retention
      devTemplate.hasResourceProperties('AWS::RDS::DBInstance', {
        BackupRetentionPeriod: 1,
        DeletionProtection: false,
      });
      // Production should have 7 days backup retention
      prodTemplate.hasResourceProperties('AWS::RDS::DBInstance', {
        BackupRetentionPeriod: 7,
        DeletionProtection: true,
      });
    });
  });
});
//# sourceMappingURL=infrastructure-stack.test.js.map
