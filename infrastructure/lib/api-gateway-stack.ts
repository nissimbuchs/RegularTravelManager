import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { getCorsOrigins, getEnvironmentConfig } from './config/environment-config';

export interface ApiGatewayStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'production';
  cloudFrontDomain?: string;
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const { environment, cloudFrontDomain } = props;

    // Create API Gateway
    this.restApi = new apigateway.RestApi(this, 'API', {
      restApiName: `rtm-${environment}-api`,
      description: `RegularTravelManager API - ${environment}`,
      defaultCorsPreflightOptions: {
        allowOrigins: getCorsOrigins(environment, cloudFrontDomain),
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
        ],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowCredentials: true,
      },
      deployOptions: {
        stageName: environment,
        loggingLevel: getEnvironmentConfig(environment).monitoring.enableDetailedLogs
          ? apigateway.MethodLoggingLevel.INFO
          : apigateway.MethodLoggingLevel.ERROR,
        dataTraceEnabled: getEnvironmentConfig(environment).monitoring.enableDetailedLogs,
        metricsEnabled: true,
        tracingEnabled: getEnvironmentConfig(environment).monitoring.enableXrayTracing,
      },
    });

    // Import Lambda functions from exported ARNs with sameEnvironment flag
    const authorizerFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedAuthorizerFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-authorizer-function-arn`),
        sameEnvironment: true, // Allows permission grants since functions are in same account
      }
    );

    const healthFunction = lambda.Function.fromFunctionAttributes(this, 'ImportedHealthFunction', {
      functionArn: cdk.Fn.importValue(`rtm-${environment}-health-function-arn`),
      sameEnvironment: true,
    });

    const getActiveProjectsFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedGetActiveProjectsFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-get-active-projects-function-arn`),
        sameEnvironment: true,
      }
    );

    // Import employee profile functions
    const getEmployeeProfileFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedGetEmployeeProfileFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-get-employee-profile-function-arn`),
        sameEnvironment: true,
      }
    );

    const updateEmployeeAddressFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedUpdateEmployeeAddressFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-update-employee-address-function-arn`),
        sameEnvironment: true,
      }
    );

    // Import project management functions
    const createProjectFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedCreateProjectFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-create-project-function-arn`),
        sameEnvironment: true,
      }
    );

    const createSubprojectFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedCreateSubprojectFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-create-subproject-function-arn`),
        sameEnvironment: true,
      }
    );

    const getAllProjectsFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedGetAllProjectsFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-get-all-projects-function-arn`),
        sameEnvironment: true,
      }
    );

    const getSubprojectsForProjectFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedGetSubprojectsForProjectFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-get-subprojects-for-project-function-arn`),
        sameEnvironment: true,
      }
    );

    const searchProjectsFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedSearchProjectsFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-search-projects-function-arn`),
        sameEnvironment: true,
      }
    );

    const projectsManagementFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedProjectsManagementFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-projects-management-function-arn`),
        sameEnvironment: true,
      }
    );

    const adminProjectManagementFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedAdminProjectManagementFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-admin-project-management-function-arn`),
        sameEnvironment: true,
      }
    );

    // Import calculation engine functions
    const calculateDistanceFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedCalculateDistanceFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-calculate-distance-function-arn`),
        sameEnvironment: true,
      }
    );

    const calculateAllowanceFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedCalculateAllowanceFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-calculate-allowance-function-arn`),
        sameEnvironment: true,
      }
    );

    const calculateTravelCostFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedCalculateTravelCostFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-calculate-travel-cost-function-arn`),
        sameEnvironment: true,
      }
    );

    const getCalculationAuditFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedGetCalculationAuditFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-get-calculation-audit-function-arn`),
        sameEnvironment: true,
      }
    );

    const invalidateCalculationCacheFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedInvalidateCalculationCacheFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-invalidate-calculation-cache-function-arn`),
        sameEnvironment: true,
      }
    );

    const cleanupExpiredCacheFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedCleanupExpiredCacheFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-cleanup-expired-cache-function-arn`),
        sameEnvironment: true,
      }
    );

    // Import travel request functions
    const employeesTravelRequestsFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedEmployeesTravelRequestsFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-employees-travel-requests-function-arn`),
        sameEnvironment: true,
      }
    );

    const adminUserManagementFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedAdminUserManagementFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-admin-user-management-function-arn`),
        sameEnvironment: true,
      }
    );

    // Import manager dashboard function
    const managersDashboardFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedManagersDashboardFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-managers-dashboard-function-arn`),
        sameEnvironment: true,
      }
    );

    // Create Lambda authorizer using the imported authorizer function
    const authorizer = new apigateway.RequestAuthorizer(this, 'LambdaAuthorizer', {
      handler: authorizerFunction,
      identitySources: [apigateway.IdentitySource.header('Authorization')],
      authorizerName: `rtm-${environment}-authorizer`,
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    // Grant API Gateway permission to invoke authorizer function
    authorizerFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    // Configure API routes with imported Lambda functions
    this.configureRoutes(
      environment,
      healthFunction,
      getActiveProjectsFunction,
      authorizer,
      getEmployeeProfileFunction,
      updateEmployeeAddressFunction,
      createProjectFunction,
      createSubprojectFunction,
      getAllProjectsFunction,
      getSubprojectsForProjectFunction,
      searchProjectsFunction,
      projectsManagementFunction,
      adminProjectManagementFunction,
      calculateDistanceFunction,
      calculateAllowanceFunction,
      calculateTravelCostFunction,
      getCalculationAuditFunction,
      invalidateCalculationCacheFunction,
      cleanupExpiredCacheFunction,
      employeesTravelRequestsFunction,
      adminUserManagementFunction,
      managersDashboardFunction
    );

    // Store API configuration in SSM for reference
    new ssm.StringParameter(this, 'ApiGatewayId', {
      parameterName: `/rtm/${environment}/api/gateway-id`,
      stringValue: this.restApi.restApiId,
    });

    new ssm.StringParameter(this, 'ApiGatewayUrl', {
      parameterName: `/rtm/${environment}/api/gateway-url`,
      stringValue: this.restApi.url,
    });

    // Output API Gateway URL
    new cdk.CfnOutput(this, 'ApiGatewayUrlOutput', {
      value: this.restApi.url,
      description: 'API Gateway URL',
      exportName: `rtm-${environment}-api-url`,
    });
  }

  private configureRoutes(
    environment: string,
    healthFunction: lambda.IFunction,
    getActiveProjectsFunction: lambda.IFunction,
    authorizer: apigateway.RequestAuthorizer,
    getEmployeeProfileFunction: lambda.IFunction,
    updateEmployeeAddressFunction: lambda.IFunction,
    createProjectFunction: lambda.IFunction,
    createSubprojectFunction: lambda.IFunction,
    getAllProjectsFunction: lambda.IFunction,
    getSubprojectsForProjectFunction: lambda.IFunction,
    searchProjectsFunction: lambda.IFunction,
    projectsManagementFunction: lambda.IFunction,
    adminProjectManagementFunction: lambda.IFunction,
    calculateDistanceFunction: lambda.IFunction,
    calculateAllowanceFunction: lambda.IFunction,
    calculateTravelCostFunction: lambda.IFunction,
    getCalculationAuditFunction: lambda.IFunction,
    invalidateCalculationCacheFunction: lambda.IFunction,
    cleanupExpiredCacheFunction: lambda.IFunction,
    employeesTravelRequestsFunction: lambda.IFunction,
    adminUserManagementFunction: lambda.IFunction,
    managersDashboardFunction: lambda.IFunction
  ) {
    const defaultMethodOptions = {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    };

    // Health endpoint (public - no auth required)
    const healthResource = this.restApi.root.addResource('health');
    const healthIntegration = new apigateway.LambdaIntegration(healthFunction);
    healthResource.addMethod('GET', healthIntegration, {
      authorizationType: apigateway.AuthorizationType.NONE,
    });

    // Grant API Gateway permission to invoke health function
    healthFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    // Projects endpoint (protected)
    const projectsResource = this.restApi.root.addResource('projects');
    const projectsIntegration = new apigateway.LambdaIntegration(getActiveProjectsFunction);
    projectsResource.addMethod('GET', projectsIntegration, defaultMethodOptions);

    // Grant API Gateway permission to invoke projects function
    getActiveProjectsFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    // Employee endpoints (protected)
    const employeesResource = this.restApi.root.addResource('employees');
    const employeeByIdResource = employeesResource.addResource('{cognitoUserId}');

    // GET /employees/{cognitoUserId} - Get employee profile
    const getEmployeeProfileIntegration = new apigateway.LambdaIntegration(
      getEmployeeProfileFunction
    );
    employeeByIdResource.addMethod('GET', getEmployeeProfileIntegration, defaultMethodOptions);

    // PUT /employees/{cognitoUserId}/address - Update employee address
    const addressResource = employeeByIdResource.addResource('address');
    const updateAddressIntegration = new apigateway.LambdaIntegration(
      updateEmployeeAddressFunction
    );
    addressResource.addMethod('PUT', updateAddressIntegration, defaultMethodOptions);

    // GET /employees/{cognitoUserId}/address-history - Get address change history
    const addressHistoryResource = addressResource.addResource('history');
    addressHistoryResource.addMethod('GET', getEmployeeProfileIntegration, defaultMethodOptions); // Reuse profile function

    // Grant API Gateway permission to invoke employee functions
    getEmployeeProfileFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    updateEmployeeAddressFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    // Geocoding endpoint (protected)
    const geocodingResource = this.restApi.root.addResource('geocoding');
    const geocodingAddressResource = geocodingResource.addResource('address');

    // POST /geocoding/address - Geocode address to coordinates
    const geocodingIntegration = new apigateway.LambdaIntegration(updateEmployeeAddressFunction); // Reuse for geocoding
    geocodingAddressResource.addMethod('POST', geocodingIntegration, defaultMethodOptions);

    // Project management endpoints (admin protected)
    // GET /projects - List all projects (for admin), use existing projects resource
    const getAllProjectsIntegration = new apigateway.LambdaIntegration(getAllProjectsFunction);
    projectsResource.addMethod('POST', new apigateway.LambdaIntegration(createProjectFunction), defaultMethodOptions); // Create project

    // Project by ID endpoints
    const projectByIdResource = projectsResource.addResource('{id}');
    const projectManagementIntegration = new apigateway.LambdaIntegration(projectsManagementFunction);
    
    // PUT /projects/{id} - Update project
    projectByIdResource.addMethod('PUT', projectManagementIntegration, defaultMethodOptions);
    
    // DELETE /projects/{id} - Delete project
    projectByIdResource.addMethod('DELETE', projectManagementIntegration, defaultMethodOptions);

    // GET /projects/{id}/subprojects - Get subprojects for project
    const subprojectsResource = projectByIdResource.addResource('subprojects');
    const getSubprojectsIntegration = new apigateway.LambdaIntegration(getSubprojectsForProjectFunction);
    subprojectsResource.addMethod('GET', getSubprojectsIntegration, defaultMethodOptions);

    // Subproject management endpoints
    const subprojectsRootResource = this.restApi.root.addResource('subprojects');
    
    // POST /subprojects - Create new subproject
    const createSubprojectIntegration = new apigateway.LambdaIntegration(createSubprojectFunction);
    subprojectsRootResource.addMethod('POST', createSubprojectIntegration, defaultMethodOptions);

    // PUT /subprojects/{id} - Update subproject
    // DELETE /subprojects/{id} - Delete subproject
    const subprojectByIdResource = subprojectsRootResource.addResource('{id}');
    subprojectByIdResource.addMethod('PUT', projectManagementIntegration, defaultMethodOptions);
    subprojectByIdResource.addMethod('DELETE', projectManagementIntegration, defaultMethodOptions);

    // Admin project management endpoints
    const adminResource = this.restApi.root.addResource('admin');
    const adminProjectsResource = adminResource.addResource('projects');
    const adminProjectManagementIntegration = new apigateway.LambdaIntegration(adminProjectManagementFunction);
    
    // GET /admin/projects - Admin list all projects with filtering
    adminProjectsResource.addMethod('GET', adminProjectManagementIntegration, defaultMethodOptions);

    // Project search endpoint
    const searchResource = projectsResource.addResource('search');
    const searchProjectsIntegration = new apigateway.LambdaIntegration(searchProjectsFunction);
    searchResource.addMethod('GET', searchProjectsIntegration, defaultMethodOptions);

    // Grant API Gateway permission to invoke project management functions
    createProjectFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    createSubprojectFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    getAllProjectsFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    getSubprojectsForProjectFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    searchProjectsFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    projectsManagementFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    adminProjectManagementFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    // Calculation engine endpoints (protected)
    const calculationsResource = this.restApi.root.addResource('calculations');
    
    // POST /calculations/distance - Calculate distance between coordinates
    const distanceResource = calculationsResource.addResource('distance');
    const calculateDistanceIntegration = new apigateway.LambdaIntegration(calculateDistanceFunction);
    distanceResource.addMethod('POST', calculateDistanceIntegration, defaultMethodOptions);

    // POST /calculations/allowance - Calculate allowance with cost rates  
    const allowanceResource = calculationsResource.addResource('allowance');
    const calculateAllowanceIntegration = new apigateway.LambdaIntegration(calculateAllowanceFunction);
    allowanceResource.addMethod('POST', calculateAllowanceIntegration, defaultMethodOptions);

    // POST /calculations/preview - Real-time calculation preview
    const previewResource = calculationsResource.addResource('preview');
    const calculateTravelCostIntegration = new apigateway.LambdaIntegration(calculateTravelCostFunction);
    previewResource.addMethod('POST', calculateTravelCostIntegration, defaultMethodOptions);

    // GET /calculations/audit/{requestId} - Calculation audit trail
    const auditResource = calculationsResource.addResource('audit');
    const auditByIdResource = auditResource.addResource('{requestId}');
    const getCalculationAuditIntegration = new apigateway.LambdaIntegration(getCalculationAuditFunction);
    auditByIdResource.addMethod('GET', getCalculationAuditIntegration, defaultMethodOptions);

    // Cache management endpoints
    const cacheResource = calculationsResource.addResource('cache');
    
    // POST /calculations/cache/invalidate - Cache invalidation
    const invalidateResource = cacheResource.addResource('invalidate');
    const invalidateCalculationCacheIntegration = new apigateway.LambdaIntegration(invalidateCalculationCacheFunction);
    invalidateResource.addMethod('POST', invalidateCalculationCacheIntegration, defaultMethodOptions);

    // DELETE /calculations/cache/expired - Cleanup expired cache
    const expiredResource = cacheResource.addResource('expired');
    const cleanupExpiredCacheIntegration = new apigateway.LambdaIntegration(cleanupExpiredCacheFunction);
    expiredResource.addMethod('DELETE', cleanupExpiredCacheIntegration, defaultMethodOptions);

    // Grant API Gateway permission to invoke calculation functions
    calculateDistanceFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    calculateAllowanceFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    calculateTravelCostFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    getCalculationAuditFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    invalidateCalculationCacheFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    cleanupExpiredCacheFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    // Travel request endpoints (protected)
    const travelRequestsResource = this.restApi.root.addResource('travel-requests');
    
    // POST /travel-requests - Submit new travel request
    const employeesTravelRequestsIntegration = new apigateway.LambdaIntegration(employeesTravelRequestsFunction);
    travelRequestsResource.addMethod('POST', employeesTravelRequestsIntegration, defaultMethodOptions);

    // GET /travel-requests - Get employee's travel requests (handled by same function)
    travelRequestsResource.addMethod('GET', employeesTravelRequestsIntegration, defaultMethodOptions);

    // Employee manager endpoints - reuse existing employeesResource
    const managersResource = employeesResource.addResource('managers');
    
    // GET /employees/managers - Get managers for selection
    const adminUserManagementIntegration = new apigateway.LambdaIntegration(adminUserManagementFunction);
    managersResource.addMethod('GET', adminUserManagementIntegration, defaultMethodOptions);

    // Grant API Gateway permission to invoke travel request functions
    employeesTravelRequestsFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    adminUserManagementFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    // Manager dashboard endpoints (protected)
    const managerResource = this.restApi.root.addResource('manager');
    const managerRequestsResource = managerResource.addResource('requests');
    
    // Manager dashboard integration
    const managersDashboardIntegration = new apigateway.LambdaIntegration(managersDashboardFunction);
    
    // GET /manager/requests - Get manager's pending requests
    managerRequestsResource.addMethod('GET', managersDashboardIntegration, defaultMethodOptions);
    
    // Manager request actions with ID parameter
    const managerRequestIdResource = managerRequestsResource.addResource('{id}');
    
    // GET /manager/requests/{id}/context - Get employee context data
    const contextResource = managerRequestIdResource.addResource('context');
    contextResource.addMethod('GET', managersDashboardIntegration, defaultMethodOptions);
    
    // PUT /manager/requests/{id}/approve - Approve individual request
    const approveResource = managerRequestIdResource.addResource('approve');
    approveResource.addMethod('PUT', managersDashboardIntegration, defaultMethodOptions);
    
    // PUT /manager/requests/{id}/reject - Reject individual request  
    const rejectResource = managerRequestIdResource.addResource('reject');
    rejectResource.addMethod('PUT', managersDashboardIntegration, defaultMethodOptions);

    // Grant API Gateway permission to invoke manager dashboard function
    managersDashboardFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
  }
}
