import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cr from 'aws-cdk-lib/custom-resources';
import { InfrastructureStack } from './infrastructure-stack';
import { LambdaFunctionFactory } from './lambda-stack/function-factory';
import { LambdaExportManager } from './lambda-stack/export-manager';
import { LAMBDA_FUNCTIONS, DEV_ONLY_FUNCTIONS } from './lambda-stack/function-definitions';

export interface LambdaStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'production';
  infrastructureStack: InfrastructureStack;
}

export class LambdaStack extends cdk.Stack {
  // All Lambda functions accessible by camelCase key
  public functions: Record<string, lambda.Function> = {};

  // Legacy public properties for backward compatibility
  public get healthFunction() {
    return this.functions.health;
  }
  public get authorizerFunction() {
    return this.functions.authorizer;
  }
  public get setupTestUsersFunction() {
    return this.functions.setupTestUsers;
  }
  public loadSampleDataFunction!: lambda.Function; // Special handling for dev-only function
  public get getEmployeeProfileFunction() {
    return this.functions.getEmployeeProfile;
  }
  public get updateEmployeeAddressFunction() {
    return this.functions.updateEmployeeAddress;
  }
  public get getManagersFunction() {
    return this.functions.getManagers;
  }
  public get createProjectFunction() {
    return this.functions.createProject;
  }
  public get createSubprojectFunction() {
    return this.functions.createSubproject;
  }
  public get getActiveProjectsFunction() {
    return this.functions.getActiveProjects;
  }
  public get getAllProjectsFunction() {
    return this.functions.getAllProjects;
  }
  public get getProjectByIdFunction() {
    return this.functions.getProjectById;
  }
  public get getSubprojectsForProjectFunction() {
    return this.functions.getSubprojectsForProject;
  }
  public get getSubprojectByIdFunction() {
    return this.functions.getSubprojectById;
  }
  public get checkProjectReferencesFunction() {
    return this.functions.checkProjectReferences;
  }
  public get searchProjectsFunction() {
    return this.functions.searchProjects;
  }
  public get calculateDistanceFunction() {
    return this.functions.calculateDistance;
  }
  public get calculateAllowanceFunction() {
    return this.functions.calculateAllowance;
  }
  public get calculateTravelCostFunction() {
    return this.functions.calculateTravelCost;
  }
  public get getCalculationAuditFunction() {
    return this.functions.getCalculationAudit;
  }
  public get invalidateCalculationCacheFunction() {
    return this.functions.invalidateCalculationCache;
  }
  public get cleanupExpiredCacheFunction() {
    return this.functions.cleanupExpiredCache;
  }
  public get adminProjectManagementFunction() {
    return this.functions.adminProjectManagement;
  }
  public get adminUserManagementFunction() {
    return this.functions.adminUserManagement;
  }
  public get authUtilsFunction() {
    return this.functions.authUtils;
  }
  public get calculationsEngineFunction() {
    return this.functions.calculationsEngine;
  }
  public get employeesTravelRequestsFunction() {
    return this.functions.employeesTravelRequests;
  }
  public get managersDashboardFunction() {
    return this.functions.managersDashboard;
  }
  public get projectsManagementFunction() {
    return this.functions.projectsManagement;
  }

  // Registration Lambda functions (Story 5.1)
  public get registerUserFunction() {
    return this.functions.registerUser;
  }
  public get verifyEmailFunction() {
    return this.functions.verifyEmail;
  }
  public get resendVerificationFunction() {
    return this.functions.resendVerification;
  }
  public get registrationStatusFunction() {
    return this.functions.registrationStatus;
  }

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const { environment, infrastructureStack } = props;

    // Get performance configuration with defaults
    const performanceConfig = {
      dev: { lambdaTimeout: 30, lambdaMemory: 512 },
      staging: { lambdaTimeout: 30, lambdaMemory: 1024 },
      production: { lambdaTimeout: 30, lambdaMemory: 1024 },
    };

    const config = performanceConfig[environment];

    // Initialize function factory
    const functionFactory = new LambdaFunctionFactory(
      this,
      environment,
      infrastructureStack,
      config.lambdaTimeout,
      config.lambdaMemory
    );

    // Create all main Lambda functions from configuration
    this.functions = functionFactory.createFunctions(LAMBDA_FUNCTIONS);

    // Create development-only functions
    if (environment !== 'production') {
      const devFunctions = functionFactory.createFunctions(DEV_ONLY_FUNCTIONS);
      this.functions = { ...this.functions, ...devFunctions };

      // Create special sample data function (has custom configuration)
      this.createLoadSampleDataFunction(environment, infrastructureStack);
    }

    // Store Lambda function ARN for monitoring (health function)
    new ssm.StringParameter(this, 'HealthFunctionArn', {
      parameterName: `/rtm/${environment}/lambda/health-function-arn`,
      stringValue: this.healthFunction?.functionArn || '',
    });

    // Export all Lambda function ARNs
    const exportManager = new LambdaExportManager(this, environment);
    exportManager.exportFunctionArns(this.functions);

    console.log(`✅ Created ${Object.keys(this.functions).length} Lambda functions`);
  }

  /**
   * Create the special sample data loading function for development
   * This function has custom bundling requirements
   */
  private createLoadSampleDataFunction(
    environment: string,
    infrastructureStack: InfrastructureStack
  ) {
    // Sample data loading function (development only)
    const loadSampleDataLogGroup = new logs.LogGroup(this, 'LoadSampleDataFunctionLogGroup', {
      logGroupName: `/aws/lambda/rtm-${environment}-load-sample-data`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.loadSampleDataFunction = new lambda.Function(this, 'LoadSampleDataFunction', {
      functionName: `rtm-${environment}-load-sample-data`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'load-sample-data.handler',
      code: lambda.Code.fromAsset('src/lambda', {
        bundling: {
          image: lambda.Runtime.NODEJS_18_X.bundlingImage,
          command: [
            'bash',
            '-c',
            'cp -r . /tmp && cd /tmp && npm install --omit=dev && cp -r . /asset-output/',
          ],
        },
      }),
      timeout: cdk.Duration.seconds(300), // 5 minutes for data loading and user creation
      memorySize: 512, // More memory for database operations
      role: infrastructureStack.lambdaRole,
      logGroup: loadSampleDataLogGroup,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      environment: {
        NODE_ENV: 'production',
        RTM_ENVIRONMENT: environment,
        LOG_LEVEL: environment === 'production' ? 'info' : 'debug',
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
        USER_POOL_ID: infrastructureStack.userPool.userPoolId,
      },
      description: 'Load sample data with dynamic Cognito user creation',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Create Log Group for Custom Resource
    const customResourceLogGroup = new logs.LogGroup(this, 'LoadSampleDataCustomResourceLogGroup', {
      logGroupName: `/aws/lambda/rtm-${environment}-load-sample-data-custom-resource`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Custom Resource to automatically load sample data on stack deployment
    const loadSampleDataCustomResource = new cr.AwsCustomResource(
      this,
      'LoadSampleDataCustomResource',
      {
        onCreate: {
          service: 'Lambda',
          action: 'invoke',
          parameters: {
            FunctionName: this.loadSampleDataFunction.functionName,
            InvocationType: 'RequestResponse',
          },
          physicalResourceId: cr.PhysicalResourceId.of('load-sample-data-trigger'),
        },
        onUpdate: {
          service: 'Lambda',
          action: 'invoke',
          parameters: {
            FunctionName: this.loadSampleDataFunction.functionName,
            InvocationType: 'RequestResponse',
          },
        },
        policy: cr.AwsCustomResourcePolicy.fromStatements([
          new cdk.aws_iam.PolicyStatement({
            actions: ['lambda:InvokeFunction'],
            resources: [this.loadSampleDataFunction.functionArn],
          }),
        ]),
        timeout: cdk.Duration.minutes(10), // Allow time for sample data loading
        logGroup: customResourceLogGroup,
        installLatestAwsSdk: true,
      }
    );

    // Ensure custom resource depends on the Lambda function and database
    loadSampleDataCustomResource.node.addDependency(this.loadSampleDataFunction);
    loadSampleDataCustomResource.node.addDependency(infrastructureStack.database);
  }
}
