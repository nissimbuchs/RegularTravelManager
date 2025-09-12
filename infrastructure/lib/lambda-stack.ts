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
  public getManagersFunction!: lambda.Function;
  public createProjectFunction!: lambda.Function;
  public createSubprojectFunction!: lambda.Function;
  public getActiveProjectsFunction!: lambda.Function;
  public getAllProjectsFunction!: lambda.Function;
  public getProjectByIdFunction!: lambda.Function;
  public getSubprojectsForProjectFunction!: lambda.Function;
  public getSubprojectByIdFunction!: lambda.Function;
  public checkProjectReferencesFunction!: lambda.Function;
  // public listAdminUsersFunction!: lambda.Function;
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

  private getDatabaseEnvironmentVariables(
    infrastructureStack: InfrastructureStack
  ): Record<string, string> {
    return {
      DB_HOST: infrastructureStack.database.instanceEndpoint.hostname,
      DB_PORT: infrastructureStack.database.instanceEndpoint.port.toString(),
      DB_NAME: 'rtm_database',
    };
  }

  private getCompleteEnvironmentVariables(
    environment: string,
    infrastructureStack: InfrastructureStack
  ): Record<string, string> {
    return {
      ...this.getBaseEnvironmentVariables(environment),
      ...this.getDatabaseEnvironmentVariables(infrastructureStack),
    };
  }

  /**
   * Create standardized log group for Lambda functions
   */
  private createLogGroup(functionName: string, environment: string): logs.LogGroup {
    return new logs.LogGroup(this, `${functionName}LogGroup`, {
      logGroupName: `/aws/lambda/rtm-${environment}-${functionName.toLowerCase().replace(/([A-Z])/g, '-$1').replace(/^-/, '')}`,
      retention: environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });
  }

  /**
   * Create standardized Lambda function with common configuration including alarms
   */
  private createLambdaFunction(
    id: string,
    functionName: string,
    handler: string,
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number,
    additionalEnvironment: Record<string, string> = {},
    description?: string,
    needsVpc: boolean = true,
    enableAlarms: boolean = true
  ): lambda.Function {
    const logGroup = this.createLogGroup(functionName, environment);

    const baseConfig: lambda.FunctionProps = {
      functionName: `rtm-${environment}-${functionName.toLowerCase().replace(/([A-Z])/g, '-$1').replace(/^-/, '')}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler,
      code: lambda.Code.fromAsset('../apps/api/dist'),
      timeout: cdk.Duration.seconds(timeout),
      memorySize: memory,
      role: infrastructureStack.lambdaRole,
      logGroup,
      environment: {
        ...this.getCompleteEnvironmentVariables(environment, infrastructureStack),
        ...additionalEnvironment,
      },
      description: description || `${functionName} Lambda function`,
      tracing: lambda.Tracing.ACTIVE,
    };

    // Add VPC configuration if needed (most functions need it for database access)
    const functionConfig: lambda.FunctionProps = needsVpc ? {
      ...baseConfig,
      vpc: infrastructureStack.vpc,
      vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [infrastructureStack.lambdaSecurityGroup],
    } : baseConfig;

    const lambdaFunction = new lambda.Function(this, id, functionConfig);

    // Automatically add CloudWatch alarms unless disabled
    if (enableAlarms) {
      this.addLambdaAlarms(environment, functionName, lambdaFunction, infrastructureStack);
    }

    return lambdaFunction;
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
    this.healthFunction = this.createLambdaFunction(
      'HealthFunction',
      'Health',
      'index.health',
      environment,
      infrastructureStack,
      timeout,
      memory,
      { API_VERSION: '1.0.0' },
      'Health check endpoint for RTM API'
    );

    // Store Lambda function ARN for monitoring
    new ssm.StringParameter(this, 'HealthFunctionArn', {
      parameterName: `/rtm/${environment}/lambda/health-function-arn`,
      stringValue: this.healthFunction.functionArn,
    });

    // Alarms are automatically added by createLambdaFunction
  }

  private createAuthFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Lambda Authorizer function
    this.authorizerFunction = this.createLambdaFunction(
      'AuthorizerFunction',
      'Authorizer',
      'index.authorizer',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {
        COGNITO_USER_POOL_ID: infrastructureStack.userPool.userPoolId,
        COGNITO_CLIENT_ID: infrastructureStack.userPoolClient.userPoolClientId,
        BYPASS_AUTH: environment === 'dev' ? 'true' : 'false', // Enable mock auth for dev environment
        API_VERSION: '1.0.0',
      },
      'JWT token authorizer for RTM API'
    );

    // Test users setup function (development only)
    if (environment !== 'production') {
      this.setupTestUsersFunction = this.createLambdaFunction(
        'SetupTestUsersFunction',
        'SetupTestUsers',
        'index.setupTestUsers',
        environment,
        infrastructureStack,
        60, // Longer timeout for user creation
        memory,
        { COGNITO_USER_POOL_ID: infrastructureStack.userPool.userPoolId },
        'Create test users in Cognito for development',
        false // No VPC needed for Cognito operations
      );

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
    this.getEmployeeProfileFunction = this.createLambdaFunction(
      'GetEmployeeProfileFunction',
      'GetEmployeeProfile',
      'index.getEmployeeProfile',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {},
      'Get employee profile information'
    );

    // Update Employee Address function
    this.updateEmployeeAddressFunction = this.createLambdaFunction(
      'UpdateEmployeeAddressFunction',
      'UpdateEmployeeAddress',
      'index.updateEmployeeAddress',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {},
      'Update employee home address'
    );

    // Get Managers function
    this.getManagersFunction = this.createLambdaFunction(
      'GetManagersFunction',
      'GetManagers',
      'index.getManagers',
      environment,
      infrastructureStack,
      timeout,
      memory,
      { LOG_LEVEL: environment === 'production' ? 'info' : 'debug' },
      'Get list of managers for dropdown selection'
    );

    // Alarms are automatically added by createLambdaFunction
  }

  private createProjectFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Create Project function
    this.createProjectFunction = this.createLambdaFunction(
      'CreateProjectFunction',
      'CreateProject',
      'index.createProject',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {},
      'Create new project (manager only)'
    );

    // Create Subproject function
    this.createSubprojectFunction = this.createLambdaFunction(
      'CreateSubprojectFunction',
      'CreateSubproject',
      'index.createSubproject',
      environment,
      infrastructureStack,
      timeout,
      memory,
      { PLACE_INDEX_NAME: infrastructureStack.placeIndex.indexName },
      'Create new subproject with geocoding (manager only)'
    );

    // Get Active Projects function
    this.getActiveProjectsFunction = this.createLambdaFunction(
      'GetActiveProjectsFunction',
      'GetActiveProjects',
      'index.getActiveProjects',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {},
      'Get all active projects for employee selection'
    );

    // Get All Projects function (admin only)
    this.getAllProjectsFunction = this.createLambdaFunction(
      'GetAllProjectsFunction',
      'GetAllProjects',
      'index.getAllProjects',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {},
      'Get all projects (active and inactive) for admin use'
    );

    // Get Project by ID function
    this.getProjectByIdFunction = this.createLambdaFunction(
      'GetProjectByIdFunction',
      'GetProjectById',
      'index.getProjectById',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {},
      'Get single project by ID'
    );

    // Get Subprojects for Project function
    this.getSubprojectsForProjectFunction = this.createLambdaFunction(
      'GetSubprojectsForProjectFunction',
      'GetSubprojectsForProject',
      'index.getSubprojectsForProject',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {},
      'Get subprojects for a specific project'
    );

    // Get Subproject by ID function
    this.getSubprojectByIdFunction = this.createLambdaFunction(
      'GetSubprojectByIdFunction',
      'GetSubprojectById',
      'index.getSubprojectById',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {},
      'Get single subproject by ID'
    );

    // Check Project References function
    this.checkProjectReferencesFunction = this.createLambdaFunction(
      'CheckProjectReferencesFunction',
      'CheckProjectReferences',
      'index.checkProjectReferences',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {},
      'Check project references and dependencies'
    );

    // Search Projects function
    this.searchProjectsFunction = this.createLambdaFunction(
      'SearchProjectsFunction',
      'SearchProjects',
      'index.searchProjects',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {},
      'Search projects by name or description'
    );

    // Alarms are automatically added by createLambdaFunction
  }

  private createCalculationFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Calculate Distance function
    this.calculateDistanceFunction = this.createLambdaFunction(
      'CalculateDistanceFunction',
      'CalculateDistance',
      'index.calculateDistance',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {},
      'Calculate distance between geographic points using PostGIS'
    );

    // Calculate Allowance function
    this.calculateAllowanceFunction = this.createLambdaFunction(
      'CalculateAllowanceFunction',
      'CalculateAllowance',
      'index.calculateAllowance',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {},
      'Calculate travel allowance from distance and rates'
    );

    // Calculate Travel Cost function (main calculation engine)
    this.calculateTravelCostFunction = this.createLambdaFunction(
      'CalculateTravelCostFunction',
      'CalculateTravelCost',
      'index.calculateTravelCost',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {},
      'Calculate complete travel cost with audit trail'
    );

    // Get Calculation Audit function
    this.getCalculationAuditFunction = this.createLambdaFunction(
      'GetCalculationAuditFunction',
      'GetCalculationAudit',
      'index.getCalculationAudit',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {},
      'Retrieve calculation audit records for compliance'
    );

    // Invalidate Calculation Cache function
    this.invalidateCalculationCacheFunction = this.createLambdaFunction(
      'InvalidateCalculationCacheFunction',
      'InvalidateCalculationCache',
      'index.invalidateCalculationCache',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {},
      'Invalidate calculation cache when data changes'
    );

    // Cleanup Expired Cache function (maintenance)
    this.cleanupExpiredCacheFunction = this.createLambdaFunction(
      'CleanupExpiredCacheFunction',
      'CleanupExpiredCache',
      'index.cleanupExpiredCache',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {},
      'Cleanup expired calculation cache entries'
    );

    // Alarms are automatically added by createLambdaFunction
  }

  private createAdminFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Admin Project Management function
    this.adminProjectManagementFunction = this.createLambdaFunction(
      'AdminProjectManagementFunction',
      'AdminProjectManagement',
      'index.adminProjectManagement',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {
        COGNITO_USER_POOL_ID: infrastructureStack.userPool.userPoolId,
        API_VERSION: '1.0.0',
      },
      'Admin project management (create, update, delete projects)'
    );

    // Admin User Management function
    this.adminUserManagementFunction = this.createLambdaFunction(
      'AdminUserManagementFunction',
      'AdminUserManagement',
      'index.adminUserManagement',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {
        COGNITO_USER_POOL_ID: infrastructureStack.userPool.userPoolId,
        COGNITO_CLIENT_ID: infrastructureStack.userPoolClient.userPoolClientId,
        API_VERSION: '1.0.0',
      },
      'Admin user management (create, update, delete users)'
    );

    // Alarms are automatically added by createLambdaFunction
  }

  private createManagerFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Managers Dashboard function
    this.managersDashboardFunction = this.createLambdaFunction(
      'ManagersDashboardFunction',
      'ManagersDashboard',
      'index.managersDashboard',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {
        COGNITO_USER_POOL_ID: infrastructureStack.userPool.userPoolId,
        API_VERSION: '1.0.0',
      },
      'Manager dashboard with approval statistics and pending requests'
    );

    // Alarms are automatically added by createLambdaFunction
  }

  private createAdditionalEmployeeFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Employee Travel Requests function
    this.employeesTravelRequestsFunction = this.createLambdaFunction(
      'EmployeesTravelRequestsFunction',
      'EmployeesTravelRequests',
      'index.employeesTravelRequests',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {
        COGNITO_USER_POOL_ID: infrastructureStack.userPool.userPoolId,
        PLACE_INDEX_NAME: infrastructureStack.placeIndex.indexName,
        API_VERSION: '1.0.0',
      },
      'Employee travel request management (create, update, submit)'
    );

    // Alarms are automatically added by createLambdaFunction
  }

  private createAdditionalProjectFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Projects Management function
    this.projectsManagementFunction = this.createLambdaFunction(
      'ProjectsManagementFunction',
      'ProjectsManagement',
      'index.projectsManagement',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {
        COGNITO_USER_POOL_ID: infrastructureStack.userPool.userPoolId,
        PLACE_INDEX_NAME: infrastructureStack.placeIndex.indexName,
        API_VERSION: '1.0.0',
      },
      'Project management operations for all user roles'
    );

    // Alarms are automatically added by createLambdaFunction
  }

  private createUtilityFunctions(
    environment: string,
    infrastructureStack: InfrastructureStack,
    timeout: number,
    memory: number
  ) {
    // Auth Utils function (auth-auth-utils)
    this.authUtilsFunction = this.createLambdaFunction(
      'AuthUtilsFunction',
      'AuthUtils',
      'index.authUtils',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {
        COGNITO_USER_POOL_ID: infrastructureStack.userPool.userPoolId,
        COGNITO_CLIENT_ID: infrastructureStack.userPoolClient.userPoolClientId,
        BYPASS_AUTH: environment === 'dev' ? 'true' : 'false', // Enable mock auth for dev environment
        API_VERSION: '1.0.0',
      },
      'Authentication utility functions',
      false // No VPC needed for auth utils
    );

    // Calculations Engine function
    this.calculationsEngineFunction = this.createLambdaFunction(
      'CalculationsEngineFunction',
      'CalculationsEngine',
      'index.calculationsEngine',
      environment,
      infrastructureStack,
      timeout,
      memory,
      {
        PLACE_INDEX_NAME: infrastructureStack.placeIndex.indexName,
        API_VERSION: '1.0.0',
      },
      'Main calculations engine for travel cost computations'
    );

    // Alarms are automatically added by createLambdaFunction
  }

  private connectToAPIGateway(_environment: string, _infrastructureStack: InfrastructureStack) {
    // API Gateway routes are managed in the separate ApiGatewayStack
    // This method is kept for compatibility but no longer creates routes
  }

  /**
   * Centralized method to export Lambda function ARNs
   */
  private exportLambdaArn(
    exportId: string, 
    functionArn: string, 
    exportName: string
  ): void {
    new cdk.CfnOutput(this, exportId, {
      value: functionArn,
      exportName: exportName,
    });
  }

  private exportLambdaArns(environment: string) {
    // Export Lambda function ARNs for API Gateway stack to import using centralized method
    this.exportLambdaArn('HealthFunctionArnExport', this.healthFunction.functionArn, `rtm-${environment}-health-function-arn`);
    this.exportLambdaArn('AuthorizerFunctionArnExport', this.authorizerFunction.functionArn, `rtm-${environment}-authorizer-function-arn`);
    this.exportLambdaArn('GetActiveProjectsFunctionArnExport', this.getActiveProjectsFunction.functionArn, `rtm-${environment}-get-active-projects-function-arn`);
    
    // Export employee function ARNs
    this.exportLambdaArn('GetEmployeeProfileFunctionArnExport', this.getEmployeeProfileFunction.functionArn, `rtm-${environment}-get-employee-profile-function-arn`);
    this.exportLambdaArn('UpdateEmployeeAddressFunctionArnExport', this.updateEmployeeAddressFunction.functionArn, `rtm-${environment}-update-employee-address-function-arn`);
    this.exportLambdaArn('GetManagersFunctionArnExport', this.getManagersFunction.functionArn, `rtm-${environment}-get-managers-function-arn`);

    // Export project management function ARNs
    this.exportLambdaArn('CreateProjectFunctionArnExport', this.createProjectFunction.functionArn, `rtm-${environment}-create-project-function-arn`);
    this.exportLambdaArn('CreateSubprojectFunctionArnExport', this.createSubprojectFunction.functionArn, `rtm-${environment}-create-subproject-function-arn`);
    this.exportLambdaArn('GetAllProjectsFunctionArnExport', this.getAllProjectsFunction.functionArn, `rtm-${environment}-get-all-projects-function-arn`);
    this.exportLambdaArn('GetProjectByIdFunctionArnExport', this.getProjectByIdFunction.functionArn, `rtm-${environment}-get-project-by-id-function-arn`);
    this.exportLambdaArn('GetSubprojectsForProjectFunctionArnExport', this.getSubprojectsForProjectFunction.functionArn, `rtm-${environment}-get-subprojects-for-project-function-arn`);
    this.exportLambdaArn('GetSubprojectByIdFunctionArnExport', this.getSubprojectByIdFunction.functionArn, `rtm-${environment}-get-subproject-by-id-function-arn`);
    this.exportLambdaArn('CheckProjectReferencesFunctionArnExport', this.checkProjectReferencesFunction.functionArn, `rtm-${environment}-check-project-references-function-arn`);

    // new cdk.CfnOutput(this, 'ListAdminUsersFunctionArnExport', {
    //   value: this.listAdminUsersFunction.functionArn,
    //   exportName: `rtm-${environment}-list-admin-users-function-arn`,
    // });

    this.exportLambdaArn('SearchProjectsFunctionArnExport', this.searchProjectsFunction.functionArn, `rtm-${environment}-search-projects-function-arn`);
    this.exportLambdaArn('ProjectsManagementFunctionArnExport', this.projectsManagementFunction.functionArn, `rtm-${environment}-projects-management-function-arn`);
    this.exportLambdaArn('AdminProjectManagementFunctionArnExport', this.adminProjectManagementFunction.functionArn, `rtm-${environment}-admin-project-management-function-arn`);

    // Export calculation engine function ARNs
    this.exportLambdaArn('CalculateDistanceFunctionArnExport', this.calculateDistanceFunction.functionArn, `rtm-${environment}-calculate-distance-function-arn`);
    this.exportLambdaArn('CalculateAllowanceFunctionArnExport', this.calculateAllowanceFunction.functionArn, `rtm-${environment}-calculate-allowance-function-arn`);
    this.exportLambdaArn('CalculateTravelCostFunctionArnExport', this.calculateTravelCostFunction.functionArn, `rtm-${environment}-calculate-travel-cost-function-arn`);
    this.exportLambdaArn('GetCalculationAuditFunctionArnExport', this.getCalculationAuditFunction.functionArn, `rtm-${environment}-get-calculation-audit-function-arn`);
    this.exportLambdaArn('InvalidateCalculationCacheFunctionArnExport', this.invalidateCalculationCacheFunction.functionArn, `rtm-${environment}-invalidate-calculation-cache-function-arn`);
    this.exportLambdaArn('CleanupExpiredCacheFunctionArnExport', this.cleanupExpiredCacheFunction.functionArn, `rtm-${environment}-cleanup-expired-cache-function-arn`);

    // Export travel request function ARNs
    this.exportLambdaArn('EmployeesTravelRequestsFunctionArnExport', this.employeesTravelRequestsFunction.functionArn, `rtm-${environment}-employees-travel-requests-function-arn`);
    this.exportLambdaArn('AdminUserManagementFunctionArnExport', this.adminUserManagementFunction.functionArn, `rtm-${environment}-admin-user-management-function-arn`);
    
    // Export manager dashboard function ARN
    this.exportLambdaArn('ManagersDashboardFunctionArnExport', this.managersDashboardFunction.functionArn, `rtm-${environment}-managers-dashboard-function-arn`);
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
