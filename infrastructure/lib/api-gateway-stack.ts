import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as logs from 'aws-cdk-lib/aws-logs';
// Route53 imports removed - using external DNS with CNAME records
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { getEnvironmentConfig } from './config/environment-config';
import { LambdaFunctionFactory } from './api-gateway/lambda-function-factory';
import { ApiRouteBuilder, API_ROUTES } from './api-gateway/route-configuration';
import { ApiPermissionManager } from './api-gateway/permission-manager';
import { CertificateValidationHelper } from './utils/certificate-validation-helper';

export interface ApiGatewayStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'production';
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;
  public customDomain?: apigateway.DomainName;
  public certificate?: acm.ICertificate;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const { environment } = props;
    const config = getEnvironmentConfig(environment);

    // Create API Gateway without CORS (CloudFront reverse proxy handles same-origin requests)
    this.restApi = new apigateway.RestApi(this, 'API', {
      restApiName: `rtm-${environment}-api`,
      description: `RegularTravelManager API - ${environment}`,
      // No CORS configuration needed - CloudFront reverse proxy makes requests same-origin
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

    // Initialize Lambda function factory for clean imports
    const functionFactory = new LambdaFunctionFactory(this, environment);

    // Import authorizer function separately (needed for authorizer creation)
    const authorizerFunction = functionFactory.getFunction('authorizer');

    // Import all required Lambda functions using factory
    const functionNames = [
      'health',
      'get-active-projects',
      'get-employee-profile',
      'update-employee-address',
      'get-managers',
      'create-project',
      'create-subproject',
      'get-all-projects',
      'get-project-by-id',
      'get-subprojects-for-project',
      'get-subproject-by-id',
      'check-project-references',
      'search-projects',
      'projects-management',
      'admin-project-management',
      'calculate-distance',
      'calculate-allowance',
      'calculate-travel-cost',
      'get-calculation-audit',
      'invalidate-calculation-cache',
      'cleanup-expired-cache',
      'employees-travel-requests',
      'admin-user-management',
      'admin-role-management',
      'user-get-profile',
      'user-update-profile',
      'managers-dashboard',
      'employees-dashboard',
      'register-user',
      'verify-email',
      'resend-verification',
      'registration-status',
    ];

    const functions = functionFactory.getFunctions(functionNames);

    // Create Lambda authorizer using TOKEN authorizer
    // This is the correct approach for JWT Bearer tokens
    const authorizer = new apigateway.TokenAuthorizer(this, 'LambdaAuthorizerV3', {
      handler: authorizerFunction,
      authorizerName: `rtm-${environment}-authorizer-v3`,
      resultsCacheTtl: cdk.Duration.minutes(0), // Disable caching for development
      identitySource: 'method.request.header.Authorization', // Explicitly specify Authorization header
      validationRegex: '^Bearer [-0-9A-Za-z._~+/]+=*$', // JWT token validation regex
    });

    // Grant API Gateway permission to invoke authorizer function
    authorizerFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    // Enable API Gateway CloudWatch access logging for debugging
    const accessLogGroup = new logs.LogGroup(this, 'ApiGatewayAccessLogGroup', {
      logGroupName: `/aws/apigateway/rtm-${environment}-access-logs`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Configure stage with access logging
    const stage = this.restApi.deploymentStage;
    const cfnStage = stage.node.defaultChild as apigateway.CfnStage;
    cfnStage.accessLogSetting = {
      destinationArn: accessLogGroup.logGroupArn,
      format: JSON.stringify({
        requestId: '$context.requestId',
        requestTime: '$context.requestTime',
        httpMethod: '$context.httpMethod',
        resourcePath: '$context.resourcePath',
        status: '$context.status',
        error: '$context.error.message',
        authorizerError: '$context.authorizer.error',
        authorizerLatency: '$context.authorizer.latency',
        authorizerStatus: '$context.authorizer.status',
        authorizerPrincipalId: '$context.authorizer.principalId',
        integration: '$context.integration.error',
        responseLength: '$context.responseLength',
        ip: '$context.identity.sourceIp',
        userAgent: '$context.identity.userAgent',
      }),
    };

    // Configure API routes using the new route builder system
    this.configureRoutes(environment, functions, authorizer);

    // Store API configuration in SSM for global CloudFront distribution
    new ssm.StringParameter(this, 'ApiGatewayId', {
      parameterName: `/rtm/${environment}/api/gateway-id`,
      stringValue: this.restApi.restApiId,
    });

    // Store API Gateway URL (always use default domain for global distribution)
    new ssm.StringParameter(this, 'ApiGatewayUrl', {
      parameterName: `/rtm/${environment}/api/gateway-url`,
      stringValue: this.restApi.url,
    });

    // Store API Gateway domain (without https://) for global CloudFront origin
    // Use CloudFormation intrinsic functions to extract domain from URL at deployment time
    const apiGatewayDomain = cdk.Fn.select(2, cdk.Fn.split('/', this.restApi.url));
    new ssm.StringParameter(this, 'ApiGatewayDomain', {
      parameterName: `/rtm/${environment}/api/gateway-domain`,
      stringValue: apiGatewayDomain,
      description: `API Gateway domain for CloudFront origin`,
    });

    // Output API Gateway URL
    new cdk.CfnOutput(this, 'ApiGatewayUrlOutput', {
      value: this.restApi.url,
      description: 'API Gateway URL (used as origin for global CloudFront)',
      exportName: `rtm-${environment}-api-url`,
    });

    console.log(`✅ API Gateway configured for global distribution:`);
    console.log(`   API URL: ${this.restApi.url}`);
    console.log(`   API Domain: ${apiGatewayDomain}`);
    console.log(`   SSM Parameter: /rtm/${environment}/api/gateway-domain`);
    console.log(`ℹ️ No custom domain - will be handled by global CloudFront distribution`);
  }

  private configureRoutes(
    environment: string,
    functions: Record<string, lambda.IFunction>,
    authorizer: apigateway.IAuthorizer
  ) {
    // Initialize route builder with functions and authorizer
    const routeBuilder = new ApiRouteBuilder(this.restApi, functions, authorizer);

    // Build all API routes from configuration
    routeBuilder.buildRouteGroups(API_ROUTES);

    // Initialize permission manager and grant all permissions
    const permissionManager = new ApiPermissionManager(functions);
    permissionManager.grantAllPermissions();

    console.log(
      `✅ API Gateway routes configured with ${Object.keys(functions).length} Lambda functions`
    );
    console.log(
      `✅ Permissions granted to ${permissionManager.getGrantedFunctions().length} functions`
    );
  }
}
