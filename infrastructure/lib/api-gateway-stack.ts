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
    
    const healthFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedHealthFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-health-function-arn`),
        sameEnvironment: true,
      }
    );
    
    const getActiveProjectsFunction = lambda.Function.fromFunctionAttributes(
      this,
      'ImportedGetActiveProjectsFunction',
      {
        functionArn: cdk.Fn.importValue(`rtm-${environment}-get-active-projects-function-arn`),
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
    this.configureRoutes(environment, healthFunction, getActiveProjectsFunction, authorizer);

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
    authorizer: apigateway.RequestAuthorizer
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

    // Additional endpoints can be added here following the same pattern
    // GET /employees/{cognitoUserId} - handled by employee profile Lambda function
    // PUT /employees/{cognitoUserId}/address - handled by address update Lambda function  
    // POST /projects - handled by create project Lambda function
    // GET /calculations/distance - handled by distance calculation Lambda function
    // GET /managers/dashboard - handled by manager dashboard Lambda function
    // GET /admin/users - handled by admin user management Lambda function
  }
}