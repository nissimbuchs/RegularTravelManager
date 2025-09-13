import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
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
  public hostedZone?: route53.IHostedZone;
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
      'health', 'get-active-projects', 'get-employee-profile', 'update-employee-address',
      'get-managers', 'create-project', 'create-subproject', 'get-all-projects', 
      'get-project-by-id', 'get-subprojects-for-project', 'get-subproject-by-id',
      'check-project-references', 'search-projects', 'projects-management',
      'admin-project-management', 'calculate-distance', 'calculate-allowance',
      'calculate-travel-cost', 'get-calculation-audit', 'invalidate-calculation-cache',
      'cleanup-expired-cache', 'employees-travel-requests', 'admin-user-management',
      'managers-dashboard'
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

    // Setup custom domain and SSL certificate if enabled
    if (config.api.customDomainEnabled && config.api.domainName) {
      this.setupApiCustomDomain(environment, config.api.domainName);
    }

    // Store API configuration in SSM for reference
    new ssm.StringParameter(this, 'ApiGatewayId', {
      parameterName: `/rtm/${environment}/api/gateway-id`,
      stringValue: this.restApi.restApiId,
    });

    // Store API URL (custom domain if configured, otherwise default API Gateway URL)
    const apiUrl = config.api.customDomainEnabled && config.api.domainName && this.customDomain
      ? `https://${config.api.domainName}/`
      : this.restApi.url;

    new ssm.StringParameter(this, 'ApiGatewayUrl', {
      parameterName: `/rtm/${environment}/api/gateway-url`,
      stringValue: apiUrl,
    });

    // Output API Gateway URL
    new cdk.CfnOutput(this, 'ApiGatewayUrlOutput', {
      value: apiUrl,
      description: 'API Gateway URL',
      exportName: `rtm-${environment}-api-url`,
    });
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
    
    console.log(`✅ API Gateway routes configured with ${Object.keys(functions).length} Lambda functions`);
    console.log(`✅ Permissions granted to ${permissionManager.getGrantedFunctions().length} functions`);
  }

  private setupApiCustomDomain(environment: string, domainName: string) {
    // Extract the root domain from the subdomain (e.g., 'buchs.be' from 'api-staging.buchs.be')
    const domainParts = domainName.split('.');
    const rootDomain = domainParts.slice(-2).join('.'); // Get the last two parts (domain.tld)

    console.log(`Setting up API custom domain: ${domainName} for root domain: ${rootDomain}`);

    // Import the hosted zone that was created in InfrastructureStack
    const hostedZoneId = cdk.Fn.importValue(`rtm-${environment}-hosted-zone-id`);
    const hostedZoneName = cdk.Fn.importValue(`rtm-${environment}-hosted-zone-name`);
    this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'ApiHostedZone', {
      hostedZoneId: hostedZoneId,
      zoneName: hostedZoneName,
    });

    // Display comprehensive certificate validation instructions
    CertificateValidationHelper.logValidationInstructions(domainName);

    this.certificate = new acm.Certificate(this, 'ApiCertificate', {
      domainName: domainName,
      certificateName: `rtm-${environment}-api-cert`,
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    // Log post-creation status
    CertificateValidationHelper.logPostCreation(domainName, this.certificate.certificateArn);

    // Create helper to display validation records in CloudFormation outputs
    new CertificateValidationHelper(this, 'CertValidationHelper', {
      certificateArn: this.certificate.certificateArn,
      domainName: domainName,
      environment: environment,
    });

    // Create API Gateway custom domain
    this.customDomain = new apigateway.DomainName(this, 'ApiCustomDomain', {
      domainName: domainName,
      certificate: this.certificate,
    });

    // Add base path mapping to route root path to the staging stage
    this.customDomain.addBasePathMapping(this.restApi, {
      basePath: undefined, // Maps root path (/) to the API
      stage: this.restApi.deploymentStage,
    });

    // Create Route53 A record pointing to the API Gateway custom domain
    new route53.ARecord(this, 'ApiCustomDomainARecord', {
      zone: this.hostedZone,
      recordName: environment === 'production' ? 'api' : `api-${environment}`, // Dynamic subdomain based on environment
      target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayDomain(this.customDomain)),
    });

    console.log(`✅ API custom domain configured: ${domainName}`);
    console.log(`✅ Route53 A record created automatically: ${domainName} -> ${this.customDomain.domainNameAliasDomainName}`);

    // Store custom domain configuration in SSM
    new ssm.StringParameter(this, 'ApiCustomDomainCertificateArn', {
      parameterName: `/rtm/${environment}/api/certificate-arn`,
      stringValue: this.certificate.certificateArn,
    });

    new ssm.StringParameter(this, 'ApiCustomDomainName', {
      parameterName: `/rtm/${environment}/api/custom-domain`,
      stringValue: domainName,
    });

    console.log(`✅ API custom domain setup completed for ${domainName}`);
  }
}
