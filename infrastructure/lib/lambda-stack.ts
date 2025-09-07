import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cr from 'aws-cdk-lib/custom-resources';
import { InfrastructureStack } from './infrastructure-stack';

export interface LambdaStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'production';
  infrastructureStack: InfrastructureStack;
}

export class LambdaStack extends cdk.Stack {
  public healthFunction!: lambda.Function;
  public authorizerFunction!: lambda.Function;
  public setupTestUsersFunction!: lambda.Function;
  public loadSampleDataFunction!: lambda.Function;
  public getEmployeeProfileFunction!: lambda.Function;
  public updateEmployeeAddressFunction!: lambda.Function;
  public createProjectFunction!: lambda.Function;
  public createSubprojectFunction!: lambda.Function;
  public getActiveProjectsFunction!: lambda.Function;
  public getAllProjectsFunction!: lambda.Function;
  public getSubprojectsForProjectFunction!: lambda.Function;
  public searchProjectsFunction!: lambda.Function;
  public calculateDistanceFunction!: lambda.Function;
  public calculateAllowanceFunction!: lambda.Function;
  public calculateTravelCostFunction!: lambda.Function;
  public getCalculationAuditFunction!: lambda.Function;
  public invalidateCalculationCacheFunction!: lambda.Function;
  public cleanupExpiredCacheFunction!: lambda.Function;

  // Additional missing functions
  public adminProjectManagementFunction!: lambda.Function;
  public adminUserManagementFunction!: lambda.Function;
  public authUtilsFunction!: lambda.Function;
  public calculationsEngineFunction!: lambda.Function;
  public employeesTravelRequestsFunction!: lambda.Function;
  public managersDashboardFunction!: lambda.Function;
  public projectsManagementFunction!: lambda.Function;

  private getBaseEnvironmentVariables(environment: string): Record<string, string> {
    return {
      NODE_ENV: 'production', // Always production for Lambda
      RTM_ENVIRONMENT: environment, // dev/staging/production
      LOG_LEVEL: environment === 'production' ? 'info' : 'debug',
      // AWS_REGION is automatically set by Lambda runtime
    };
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
    const lambdaTimeout = config.lambdaTimeout;
    const lambdaMemory = config.lambdaMemory;

    // Create health check Lambda function
    this.createHealthFunction(environment, infrastructureStack, lambdaTimeout, lambdaMemory);

    // Create authentication Lambda functions
    this.createAuthFunctions(environment, infrastructureStack, lambdaTimeout, lambdaMemory);

    // Create employee management Lambda functions
    this.createEmployeeFunctions(environment, infrastructureStack, lambdaTimeout, lambdaMemory);

    // Create project management Lambda functions
    this.createProjectFunctions(environment, infrastructureStack, lambdaTimeout, lambdaMemory);

    // Create calculation engine Lambda functions
    this.createCalculationFunctions(environment, infrastructureStack, lambdaTimeout, lambdaMemory);

    // Create admin Lambda functions
    this.createAdminFunctions(environment, infrastructureStack, lambdaTimeout, lambdaMemory);

    // Create manager Lambda functions
    this.createManagerFunctions(environment, infrastructureStack, lambdaTimeout, lambdaMemory);

    // Create additional employee functions
    this.createAdditionalEmployeeFunctions(
      environment,
      infrastructureStack,
      lambdaTimeout,
      lambdaMemory
    );

    // Create additional project functions
    this.createAdditionalProjectFunctions(
      environment,
      infrastructureStack,
      lambdaTimeout,
      lambdaMemory
    );

    // Create utility functions
    this.createUtilityFunctions(environment, infrastructureStack, lambdaTimeout, lambdaMemory);

    // Connect Lambda functions to API Gateway
    this.connectToAPIGateway(environment, infrastructureStack);

    // Export Lambda function ARNs for API Gateway to reference
    this.exportLambdaArns(environment);
  }

  private createHealthFunction(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Create CloudWatch Log Group for health function
    const healthLogGroup = new logs.LogGroup(this, 'HealthFunctionLogGroup', {
      logGroupName: `/aws/lambda/rtm-${environment}-health`,
      retention:
        environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.healthFunction = new lambda.Function(this, 'HealthFunction', {
      functionName: `rtm-${environment}-health`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.health',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      logGroup: healthLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
        API_VERSION: '1.0.0',
      },
      description: 'Health check endpoint for RTM API',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Store Lambda function ARN for monitoring
    new ssm.StringParameter(this, 'HealthFunctionArn', {
      parameterName: `/rtm/${environment}/lambda/health-function-arn`,
      stringValue: this.healthFunction.functionArn,
    });

    // Add CloudWatch alarms for health function
    this.addLambdaAlarms(environment, 'Health', this.healthFunction, infrastructureStack);
  }

  private createAuthFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Lambda Authorizer function
    const authLogGroup = new logs.LogGroup(this, 'AuthorizerFunctionLogGroup', {
      logGroupName: `/aws/lambda/rtm-${environment}-authorizer`,
      retention:
        environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.authorizerFunction = new lambda.Function(this, 'AuthorizerFunction', {
      // auth-authorizer
      functionName: `rtm-${environment}-authorizer`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.authorizer',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      logGroup: authLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        COGNITO_USER_POOL_ID: infrastructureStack.userPool.userPoolId,
        COGNITO_CLIENT_ID: infrastructureStack.userPoolClient.userPoolClientId,
        BYPASS_AUTH: environment !== 'production' ? 'true' : 'false',
        API_VERSION: '1.0.0',
      },
      description: 'JWT token authorizer for RTM API',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Test users setup function (development only)
    if (environment !== 'production') {
      const setupUsersLogGroup = new logs.LogGroup(this, 'SetupTestUsersFunctionLogGroup', {
        logGroupName: `/aws/lambda/rtm-${environment}-setup-test-users`,
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      this.setupTestUsersFunction = new lambda.Function(this, 'SetupTestUsersFunction', {
        // auth-setup-test-users
        functionName: `rtm-${environment}-setup-test-users`,
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'index.setupTestUsers',
        code: lambda.Code.fromAsset('../apps/api/dist'),
        timeout: cdk.Duration.seconds(60), // Longer timeout for user creation
        memorySize: memory,
        role: infrastructureStack.lambdaRole,
        logGroup: setupUsersLogGroup,
        environment: {
          ...this.getBaseEnvironmentVariables(environment),
          COGNITO_USER_POOL_ID: infrastructureStack.userPool.userPoolId,
        },
        description: 'Create test users in Cognito for development',
        tracing: lambda.Tracing.ACTIVE,
      });

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
          ...this.getBaseEnvironmentVariables(environment),
          USER_POOL_ID: infrastructureStack.userPool.userPoolId,
        },
        description: 'Load sample data with dynamic Cognito user creation',
        tracing: lambda.Tracing.ACTIVE,
      });

      // Create Log Group for Custom Resource
      const customResourceLogGroup = new logs.LogGroup(
        this,
        'LoadSampleDataCustomResourceLogGroup',
        {
          logGroupName: `/aws/lambda/rtm-${environment}-load-sample-data-custom-resource`,
          retention: logs.RetentionDays.ONE_WEEK,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }
      );

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

  private createEmployeeFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Get Employee Profile function
    const profileLogGroup = new logs.LogGroup(this, 'GetEmployeeProfileFunctionLogGroup', {
      logGroupName: `/aws/lambda/rtm-${environment}-get-employee-profile`,
      retention:
        environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.getEmployeeProfileFunction = new lambda.Function(this, 'GetEmployeeProfileFunction', {
      // employees-profile
      functionName: `rtm-${environment}-get-employee-profile`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.getEmployeeProfile',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      logGroup: profileLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
      },
      description: 'Get employee profile information',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Update Employee Address function
    const updateAddressLogGroup = new logs.LogGroup(this, 'UpdateEmployeeAddressFunctionLogGroup', {
      logGroupName: `/aws/lambda/rtm-${environment}-update-employee-address`,
      retention:
        environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.updateEmployeeAddressFunction = new lambda.Function(
      this,
      'UpdateEmployeeAddressFunction',
      {
        functionName: `rtm-${environment}-update-employee-address`,
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'index.updateEmployeeAddress',
        code: lambda.Code.fromAsset('../apps/api/dist'),
        timeout: cdk.Duration.seconds(timeout),
        memorySize: memory,
        role: infrastructureStack.lambdaRole,
        vpc: infrastructureStack.vpc,
        vpcSubnets: {
          subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        logGroup: updateAddressLogGroup,
        environment: {
          NODE_ENV: environment,
          DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
          DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
          DB_NAME: 'rtm_database',
          LOG_LEVEL: environment === 'production' ? 'info' : 'debug',
        },
        description: 'Update employee home address',
        tracing: lambda.Tracing.ACTIVE,
      }
    );

    // Add Lambda alarms for employee functions
    this.addLambdaAlarms(
      environment,
      'GetEmployeeProfile',
      this.getEmployeeProfileFunction,
      infrastructureStack
    );
    this.addLambdaAlarms(
      environment,
      'UpdateEmployeeAddress',
      this.updateEmployeeAddressFunction,
      infrastructureStack
    );
  }

  private createProjectFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Create Project function
    const createProjectLogGroup = new logs.LogGroup(this, 'CreateProjectFunctionLogGroup', {
      logGroupName: `/aws/lambda/rtm-${environment}-create-project`,
      retention:
        environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.createProjectFunction = new lambda.Function(this, 'CreateProjectFunction', {
      functionName: `rtm-${environment}-create-project`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.createProject',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      logGroup: createProjectLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
      },
      description: 'Create new project (manager only)',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Create Subproject function
    const createSubprojectLogGroup = new logs.LogGroup(this, 'CreateSubprojectFunctionLogGroup', {
      logGroupName: `/aws/lambda/rtm-${environment}-create-subproject`,
      retention:
        environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.createSubprojectFunction = new lambda.Function(this, 'CreateSubprojectFunction', {
      functionName: `rtm-${environment}-create-subproject`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.createSubproject',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      logGroup: createSubprojectLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
        PLACE_INDEX_NAME: infrastructureStack.placeIndex.indexName,
      },
      description: 'Create new subproject with geocoding (manager only)',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Get Active Projects function
    const getActiveProjectsLogGroup = new logs.LogGroup(this, 'GetActiveProjectsFunctionLogGroup', {
      logGroupName: `/aws/lambda/rtm-${environment}-get-active-projects`,
      retention:
        environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.getActiveProjectsFunction = new lambda.Function(this, 'GetActiveProjectsFunction', {
      functionName: `rtm-${environment}-get-active-projects`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.getActiveProjects',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      logGroup: getActiveProjectsLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
      },
      description: 'Get all active projects for employee selection',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Get All Projects function (admin only)
    const getAllProjectsLogGroup = new logs.LogGroup(this, 'GetAllProjectsFunctionLogGroup', {
      logGroupName: `/aws/lambda/rtm-${environment}-get-all-projects`,
      retention:
        environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.getAllProjectsFunction = new lambda.Function(this, 'GetAllProjectsFunction', {
      functionName: `rtm-${environment}-get-all-projects`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.getAllProjects',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      logGroup: getAllProjectsLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
      },
      description: 'Get all projects (active and inactive) for admin use',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Get Subprojects for Project function
    const getSubprojectsLogGroup = new logs.LogGroup(
      this,
      'GetSubprojectsForProjectFunctionLogGroup',
      {
        logGroupName: `/aws/lambda/rtm-${environment}-get-subprojects-for-project`,
        retention:
          environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        removalPolicy:
          environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      }
    );

    this.getSubprojectsForProjectFunction = new lambda.Function(
      this,
      'GetSubprojectsForProjectFunction',
      {
        functionName: `rtm-${environment}-get-subprojects-for-project`,
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'index.getSubprojectsForProject',
        code: lambda.Code.fromAsset('../apps/api/dist'),
        timeout: cdk.Duration.seconds(timeout),
        memorySize: memory,
        role: infrastructureStack.lambdaRole,
        vpc: infrastructureStack.vpc,
        vpcSubnets: {
          subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        logGroup: getSubprojectsLogGroup,
        environment: {
          NODE_ENV: environment,
          DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
          DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
          DB_NAME: 'rtm_database',
          LOG_LEVEL: environment === 'production' ? 'info' : 'debug',
        },
        description: 'Get subprojects for a specific project',
        tracing: lambda.Tracing.ACTIVE,
      }
    );

    // Search Projects function
    const searchProjectsLogGroup = new logs.LogGroup(this, 'SearchProjectsFunctionLogGroup', {
      logGroupName: `/aws/lambda/rtm-${environment}-search-projects`,
      retention:
        environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.searchProjectsFunction = new lambda.Function(this, 'SearchProjectsFunction', {
      functionName: `rtm-${environment}-search-projects`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.searchProjects',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      logGroup: searchProjectsLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
      },
      description: 'Search projects by name or description',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Add Lambda alarms for project functions
    this.addLambdaAlarms(
      environment,
      'CreateProject',
      this.createProjectFunction,
      infrastructureStack
    );
    this.addLambdaAlarms(
      environment,
      'CreateSubproject',
      this.createSubprojectFunction,
      infrastructureStack
    );
    this.addLambdaAlarms(
      environment,
      'GetActiveProjects',
      this.getActiveProjectsFunction,
      infrastructureStack
    );
    this.addLambdaAlarms(
      environment,
      'GetAllProjects',
      this.getAllProjectsFunction,
      infrastructureStack
    );
    this.addLambdaAlarms(
      environment,
      'GetSubprojectsForProject',
      this.getSubprojectsForProjectFunction,
      infrastructureStack
    );
    this.addLambdaAlarms(
      environment,
      'SearchProjects',
      this.searchProjectsFunction,
      infrastructureStack
    );
  }

  private createCalculationFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Calculate Distance function
    const calculateDistanceLogGroup = new logs.LogGroup(this, 'CalculateDistanceFunctionLogGroup', {
      logGroupName: `/aws/lambda/rtm-${environment}-calculate-distance`,
      retention:
        environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.calculateDistanceFunction = new lambda.Function(this, 'CalculateDistanceFunction', {
      functionName: `rtm-${environment}-calculate-distance`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.calculateDistance',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      logGroup: calculateDistanceLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
      },
      description: 'Calculate distance between geographic points using PostGIS',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Calculate Allowance function
    const calculateAllowanceLogGroup = new logs.LogGroup(
      this,
      'CalculateAllowanceFunctionLogGroup',
      {
        logGroupName: `/aws/lambda/rtm-${environment}-calculate-allowance`,
        retention:
          environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        removalPolicy:
          environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      }
    );

    this.calculateAllowanceFunction = new lambda.Function(this, 'CalculateAllowanceFunction', {
      functionName: `rtm-${environment}-calculate-allowance`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.calculateAllowance',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      logGroup: calculateAllowanceLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
      },
      description: 'Calculate travel allowance from distance and rates',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Calculate Travel Cost function (main calculation engine)
    const calculateTravelCostLogGroup = new logs.LogGroup(
      this,
      'CalculateTravelCostFunctionLogGroup',
      {
        logGroupName: `/aws/lambda/rtm-${environment}-calculate-travel-cost`,
        retention:
          environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        removalPolicy:
          environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      }
    );

    this.calculateTravelCostFunction = new lambda.Function(this, 'CalculateTravelCostFunction', {
      functionName: `rtm-${environment}-calculate-travel-cost`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.calculateTravelCost',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      logGroup: calculateTravelCostLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
      },
      description: 'Calculate complete travel cost with audit trail',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Get Calculation Audit function
    const getCalculationAuditLogGroup = new logs.LogGroup(
      this,
      'GetCalculationAuditFunctionLogGroup',
      {
        logGroupName: `/aws/lambda/rtm-${environment}-get-calculation-audit`,
        retention:
          environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        removalPolicy:
          environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      }
    );

    this.getCalculationAuditFunction = new lambda.Function(this, 'GetCalculationAuditFunction', {
      functionName: `rtm-${environment}-get-calculation-audit`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.getCalculationAudit',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      logGroup: getCalculationAuditLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
      },
      description: 'Retrieve calculation audit records for compliance',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Invalidate Calculation Cache function
    const invalidateCalculationCacheLogGroup = new logs.LogGroup(
      this,
      'InvalidateCalculationCacheFunctionLogGroup',
      {
        logGroupName: `/aws/lambda/rtm-${environment}-invalidate-calculation-cache`,
        retention:
          environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        removalPolicy:
          environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      }
    );

    this.invalidateCalculationCacheFunction = new lambda.Function(
      this,
      'InvalidateCalculationCacheFunction',
      {
        functionName: `rtm-${environment}-invalidate-calculation-cache`,
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'index.invalidateCalculationCache',
        code: lambda.Code.fromAsset('../apps/api/dist'),
        timeout: cdk.Duration.seconds(timeout),
        memorySize: memory,
        role: infrastructureStack.lambdaRole,
        vpc: infrastructureStack.vpc,
        vpcSubnets: {
          subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        logGroup: invalidateCalculationCacheLogGroup,
        environment: {
          NODE_ENV: environment,
          DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
          DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
          DB_NAME: 'rtm_database',
          LOG_LEVEL: environment === 'production' ? 'info' : 'debug',
        },
        description: 'Invalidate calculation cache when data changes',
        tracing: lambda.Tracing.ACTIVE,
      }
    );

    // Cleanup Expired Cache function (maintenance)
    const cleanupExpiredCacheLogGroup = new logs.LogGroup(
      this,
      'CleanupExpiredCacheFunctionLogGroup',
      {
        logGroupName: `/aws/lambda/rtm-${environment}-cleanup-expired-cache`,
        retention:
          environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        removalPolicy:
          environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      }
    );

    this.cleanupExpiredCacheFunction = new lambda.Function(this, 'CleanupExpiredCacheFunction', {
      functionName: `rtm-${environment}-cleanup-expired-cache`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.cleanupExpiredCache',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      logGroup: cleanupExpiredCacheLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
      },
      description: 'Cleanup expired calculation cache entries',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Add Lambda alarms for calculation functions
    this.addLambdaAlarms(
      environment,
      'CalculateDistance',
      this.calculateDistanceFunction,
      infrastructureStack
    );
    this.addLambdaAlarms(
      environment,
      'CalculateAllowance',
      this.calculateAllowanceFunction,
      infrastructureStack
    );
    this.addLambdaAlarms(
      environment,
      'CalculateTravelCost',
      this.calculateTravelCostFunction,
      infrastructureStack
    );
    this.addLambdaAlarms(
      environment,
      'GetCalculationAudit',
      this.getCalculationAuditFunction,
      infrastructureStack
    );
    this.addLambdaAlarms(
      environment,
      'InvalidateCalculationCache',
      this.invalidateCalculationCacheFunction,
      infrastructureStack
    );
    this.addLambdaAlarms(
      environment,
      'CleanupExpiredCache',
      this.cleanupExpiredCacheFunction,
      infrastructureStack
    );
  }

  private createAdminFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Admin Project Management function
    const adminProjectManagementLogGroup = new logs.LogGroup(
      this,
      'AdminProjectManagementFunctionLogGroup',
      {
        logGroupName: `/aws/lambda/rtm-${environment}-admin-project-management`,
        retention:
          environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        removalPolicy:
          environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      }
    );

    this.adminProjectManagementFunction = new lambda.Function(
      this,
      'AdminProjectManagementFunction',
      {
        functionName: `rtm-${environment}-admin-project-management`,
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'index.adminProjectManagement',
        code: lambda.Code.fromAsset('../apps/api/dist'),
        timeout: cdk.Duration.seconds(timeout),
        memorySize: memory,
        role: infrastructureStack.lambdaRole,
        vpc: infrastructureStack.vpc,
        vpcSubnets: {
          subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [infrastructureStack.lambdaSecurityGroup],
        logGroup: adminProjectManagementLogGroup,
        environment: {
          ...this.getBaseEnvironmentVariables(environment),
          DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
          DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
          DB_NAME: 'rtm_database',
          COGNITO_USER_POOL_ID: infrastructureStack.userPool.userPoolId,
          API_VERSION: '1.0.0',
        },
        description: 'Admin project management (create, update, delete projects)',
        tracing: lambda.Tracing.ACTIVE,
      }
    );

    // Admin User Management function
    const adminUserManagementLogGroup = new logs.LogGroup(
      this,
      'AdminUserManagementFunctionLogGroup',
      {
        logGroupName: `/aws/lambda/rtm-${environment}-admin-user-management`,
        retention:
          environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        removalPolicy:
          environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      }
    );

    this.adminUserManagementFunction = new lambda.Function(this, 'AdminUserManagementFunction', {
      functionName: `rtm-${environment}-admin-user-management`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.adminUserManagement',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      logGroup: adminUserManagementLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
        COGNITO_USER_POOL_ID: infrastructureStack.userPool.userPoolId,
        COGNITO_CLIENT_ID: infrastructureStack.userPoolClient.userPoolClientId,
        API_VERSION: '1.0.0',
      },
      description: 'Admin user management (create, update, delete users)',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Add alarms for admin functions
    this.addLambdaAlarms(
      environment,
      'AdminProjectManagement',
      this.adminProjectManagementFunction,
      infrastructureStack
    );
    this.addLambdaAlarms(
      environment,
      'AdminUserManagement',
      this.adminUserManagementFunction,
      infrastructureStack
    );
  }

  private createManagerFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Managers Dashboard function
    const managersDashboardLogGroup = new logs.LogGroup(this, 'ManagersDashboardFunctionLogGroup', {
      logGroupName: `/aws/lambda/rtm-${environment}-managers-dashboard`,
      retention:
        environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.managersDashboardFunction = new lambda.Function(this, 'ManagersDashboardFunction', {
      functionName: `rtm-${environment}-managers-dashboard`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.managersDashboard',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      logGroup: managersDashboardLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
        COGNITO_USER_POOL_ID: infrastructureStack.userPool.userPoolId,
        API_VERSION: '1.0.0',
      },
      description: 'Manager dashboard with approval statistics and pending requests',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Add alarms for manager functions
    this.addLambdaAlarms(
      environment,
      'ManagersDashboard',
      this.managersDashboardFunction,
      infrastructureStack
    );
  }

  private createAdditionalEmployeeFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Employee Travel Requests function
    const employeesTravelRequestsLogGroup = new logs.LogGroup(
      this,
      'EmployeesTravelRequestsFunctionLogGroup',
      {
        logGroupName: `/aws/lambda/rtm-${environment}-employees-travel-requests`,
        retention:
          environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        removalPolicy:
          environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      }
    );

    this.employeesTravelRequestsFunction = new lambda.Function(
      this,
      'EmployeesTravelRequestsFunction',
      {
        functionName: `rtm-${environment}-employees-travel-requests`,
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'index.employeesTravelRequests',
        code: lambda.Code.fromAsset('../apps/api/dist'),
        timeout: cdk.Duration.seconds(timeout),
        memorySize: memory,
        role: infrastructureStack.lambdaRole,
        vpc: infrastructureStack.vpc,
        vpcSubnets: {
          subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        securityGroups: [infrastructureStack.lambdaSecurityGroup],
        logGroup: employeesTravelRequestsLogGroup,
        environment: {
          ...this.getBaseEnvironmentVariables(environment),
          DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
          DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
          DB_NAME: 'rtm_database',
          COGNITO_USER_POOL_ID: infrastructureStack.userPool.userPoolId,
          PLACE_INDEX_NAME: infrastructureStack.placeIndex.indexName,
          API_VERSION: '1.0.0',
        },
        description: 'Employee travel request management (create, update, submit)',
        tracing: lambda.Tracing.ACTIVE,
      }
    );

    // Add alarms for additional employee functions
    this.addLambdaAlarms(
      environment,
      'EmployeesTravelRequests',
      this.employeesTravelRequestsFunction,
      infrastructureStack
    );
  }

  private createAdditionalProjectFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Projects Management function
    const projectsManagementLogGroup = new logs.LogGroup(
      this,
      'ProjectsManagementFunctionLogGroup',
      {
        logGroupName: `/aws/lambda/rtm-${environment}-projects-management`,
        retention:
          environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        removalPolicy:
          environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      }
    );

    this.projectsManagementFunction = new lambda.Function(this, 'ProjectsManagementFunction', {
      functionName: `rtm-${environment}-projects-management`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.projectsManagement',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      logGroup: projectsManagementLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
        COGNITO_USER_POOL_ID: infrastructureStack.userPool.userPoolId,
        PLACE_INDEX_NAME: infrastructureStack.placeIndex.indexName,
        API_VERSION: '1.0.0',
      },
      description: 'Project management operations for all user roles',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Add alarms for additional project functions
    this.addLambdaAlarms(
      environment,
      'ProjectsManagement',
      this.projectsManagementFunction,
      infrastructureStack
    );
  }

  private createUtilityFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Auth Utils function (auth-auth-utils)
    const authUtilsLogGroup = new logs.LogGroup(this, 'AuthUtilsFunctionLogGroup', {
      logGroupName: `/aws/lambda/rtm-${environment}-auth-utils`,
      retention:
        environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.authUtilsFunction = new lambda.Function(this, 'AuthUtilsFunction', {
      // auth-auth-utils
      functionName: `rtm-${environment}-auth-utils`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.authUtils',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      logGroup: authUtilsLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        COGNITO_USER_POOL_ID: infrastructureStack.userPool.userPoolId,
        COGNITO_CLIENT_ID: infrastructureStack.userPoolClient.userPoolClientId,
        BYPASS_AUTH: environment !== 'production' ? 'true' : 'false',
        API_VERSION: '1.0.0',
      },
      description: 'Authentication utility functions',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Calculations Engine function
    const calculationsEngineLogGroup = new logs.LogGroup(
      this,
      'CalculationsEngineFunctionLogGroup',
      {
        logGroupName: `/aws/lambda/rtm-${environment}-calculations-engine`,
        retention:
          environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        removalPolicy:
          environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      }
    );

    this.calculationsEngineFunction = new lambda.Function(this, 'CalculationsEngineFunction', {
      functionName: `rtm-${environment}-calculations-engine`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.calculationsEngine',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
      logGroup: calculationsEngineLogGroup,
      environment: {
        ...this.getBaseEnvironmentVariables(environment),
        DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
        DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
        PLACE_INDEX_NAME: infrastructureStack.placeIndex.indexName,
        API_VERSION: '1.0.0',
      },
      description: 'Main calculations engine for travel cost computations',
      tracing: lambda.Tracing.ACTIVE,
    });

    // Add alarms for utility functions
    this.addLambdaAlarms(environment, 'AuthUtils', this.authUtilsFunction, infrastructureStack);
    this.addLambdaAlarms(
      environment,
      'CalculationsEngine',
      this.calculationsEngineFunction,
      infrastructureStack
    );
  }

  private connectToAPIGateway(environment: string, infrastructureStack: InfrastructureStack) {
    // API Gateway routes are managed in the separate ApiGatewayStack
    // This method is kept for compatibility but no longer creates routes
  }

  private exportLambdaArns(environment: string) {
    // Export Lambda function ARNs for API Gateway stack to import
    new cdk.CfnOutput(this, 'HealthFunctionArnExport', {
      value: this.healthFunction.functionArn,
      exportName: `rtm-${environment}-health-function-arn`,
    });

    new cdk.CfnOutput(this, 'AuthorizerFunctionArnExport', {
      value: this.authorizerFunction.functionArn,
      exportName: `rtm-${environment}-authorizer-function-arn`,
    });

    new cdk.CfnOutput(this, 'GetActiveProjectsFunctionArnExport', {
      value: this.getActiveProjectsFunction.functionArn,
      exportName: `rtm-${environment}-get-active-projects-function-arn`,
    });

    // Export employee function ARNs
    new cdk.CfnOutput(this, 'GetEmployeeProfileFunctionArnExport', {
      value: this.getEmployeeProfileFunction.functionArn,
      exportName: `rtm-${environment}-get-employee-profile-function-arn`,
    });

    new cdk.CfnOutput(this, 'UpdateEmployeeAddressFunctionArnExport', {
      value: this.updateEmployeeAddressFunction.functionArn,
      exportName: `rtm-${environment}-update-employee-address-function-arn`,
    });

    // Export project management function ARNs
    new cdk.CfnOutput(this, 'CreateProjectFunctionArnExport', {
      value: this.createProjectFunction.functionArn,
      exportName: `rtm-${environment}-create-project-function-arn`,
    });

    new cdk.CfnOutput(this, 'CreateSubprojectFunctionArnExport', {
      value: this.createSubprojectFunction.functionArn,
      exportName: `rtm-${environment}-create-subproject-function-arn`,
    });

    new cdk.CfnOutput(this, 'GetAllProjectsFunctionArnExport', {
      value: this.getAllProjectsFunction.functionArn,
      exportName: `rtm-${environment}-get-all-projects-function-arn`,
    });

    new cdk.CfnOutput(this, 'GetSubprojectsForProjectFunctionArnExport', {
      value: this.getSubprojectsForProjectFunction.functionArn,
      exportName: `rtm-${environment}-get-subprojects-for-project-function-arn`,
    });

    new cdk.CfnOutput(this, 'SearchProjectsFunctionArnExport', {
      value: this.searchProjectsFunction.functionArn,
      exportName: `rtm-${environment}-search-projects-function-arn`,
    });

    new cdk.CfnOutput(this, 'ProjectsManagementFunctionArnExport', {
      value: this.projectsManagementFunction.functionArn,
      exportName: `rtm-${environment}-projects-management-function-arn`,
    });

    new cdk.CfnOutput(this, 'AdminProjectManagementFunctionArnExport', {
      value: this.adminProjectManagementFunction.functionArn,
      exportName: `rtm-${environment}-admin-project-management-function-arn`,
    });

    // Export calculation engine function ARNs
    new cdk.CfnOutput(this, 'CalculateDistanceFunctionArnExport', {
      value: this.calculateDistanceFunction.functionArn,
      exportName: `rtm-${environment}-calculate-distance-function-arn`,
    });

    new cdk.CfnOutput(this, 'CalculateAllowanceFunctionArnExport', {
      value: this.calculateAllowanceFunction.functionArn,
      exportName: `rtm-${environment}-calculate-allowance-function-arn`,
    });

    new cdk.CfnOutput(this, 'CalculateTravelCostFunctionArnExport', {
      value: this.calculateTravelCostFunction.functionArn,
      exportName: `rtm-${environment}-calculate-travel-cost-function-arn`,
    });

    new cdk.CfnOutput(this, 'GetCalculationAuditFunctionArnExport', {
      value: this.getCalculationAuditFunction.functionArn,
      exportName: `rtm-${environment}-get-calculation-audit-function-arn`,
    });

    new cdk.CfnOutput(this, 'InvalidateCalculationCacheFunctionArnExport', {
      value: this.invalidateCalculationCacheFunction.functionArn,
      exportName: `rtm-${environment}-invalidate-calculation-cache-function-arn`,
    });

    new cdk.CfnOutput(this, 'CleanupExpiredCacheFunctionArnExport', {
      value: this.cleanupExpiredCacheFunction.functionArn,
      exportName: `rtm-${environment}-cleanup-expired-cache-function-arn`,
    });

    // Export travel request function ARNs
    new cdk.CfnOutput(this, 'EmployeesTravelRequestsFunctionArnExport', {
      value: this.employeesTravelRequestsFunction.functionArn,
      exportName: `rtm-${environment}-employees-travel-requests-function-arn`,
    });

    new cdk.CfnOutput(this, 'AdminUserManagementFunctionArnExport', {
      value: this.adminUserManagementFunction.functionArn,
      exportName: `rtm-${environment}-admin-user-management-function-arn`,
    });

    // Export manager dashboard function ARN
    new cdk.CfnOutput(this, 'ManagersDashboardFunctionArnExport', {
      value: this.managersDashboardFunction.functionArn,
      exportName: `rtm-${environment}-managers-dashboard-function-arn`,
    });
  }

  private addLambdaAlarms(
    environment: string,
    functionName: string,
    lambdaFunction: lambda.Function,
    infrastructureStack: InfrastructureStack
  ) {
    const functionNameLower = functionName.toLowerCase();

    // Lambda duration alarm
    const durationAlarm = new cdk.aws_cloudwatch.Alarm(this, `${functionName}DurationAlarm`, {
      alarmName: `rtm-${environment}-lambda-${functionNameLower}-duration`,
      alarmDescription: `${functionName} Lambda function high duration`,
      metric: lambdaFunction.metricDuration({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: environment === 'production' ? 5000 : 10000, // milliseconds
      evaluationPeriods: 2,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    durationAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(infrastructureStack.alertsTopic)
    );

    // Lambda error rate alarm
    const errorRateAlarm = new cdk.aws_cloudwatch.Alarm(this, `${functionName}ErrorRateAlarm`, {
      alarmName: `rtm-${environment}-lambda-${functionNameLower}-errors`,
      alarmDescription: `${functionName} Lambda function high error rate`,
      metric: lambdaFunction.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: environment === 'production' ? 2 : 5,
      evaluationPeriods: 2,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    errorRateAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(infrastructureStack.alertsTopic)
    );

    // Lambda throttle alarm
    const throttleAlarm = new cdk.aws_cloudwatch.Alarm(this, `${functionName}ThrottleAlarm`, {
      alarmName: `rtm-${environment}-lambda-${functionNameLower}-throttles`,
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
      new cdk.aws_cloudwatch_actions.SnsAction(infrastructureStack.alertsTopic)
    );
  }
}
