import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as customResources from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as path from 'path';

export interface WebStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'production';
}

export class WebStack extends cdk.Stack {
  public readonly webBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // Import required values from other stacks
    const apiUrl = cdk.Fn.importValue(`rtm-${environment}-api-url`);
    const userPoolId = cdk.Fn.importValue(`rtm-${environment}-user-pool-id`);
    const userPoolClientId = cdk.Fn.importValue(`rtm-${environment}-user-pool-client-id`);
    const alertsTopicArn = cdk.Fn.importValue(`rtm-${environment}-alerts-topic-arn`);

    // Extract API Gateway domain from the full URL for CloudFront origin
    // API URL format: https://xxxxxxxxxx.execute-api.eu-central-1.amazonaws.com/dev/
    const apiGatewayDomain = cdk.Fn.select(2, cdk.Fn.split('/', apiUrl)); // Gets the domain part

    // Create S3 bucket for static web content
    this.webBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: `rtm-${environment}-web-${this.account}-${this.region}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'production',
    });

    // Origin Access Control for CloudFront
    const originAccessControl = new cloudfront.S3OriginAccessControl(this, 'OriginAccessControl', {
      description: `OAC for ${this.webBucket.bucketName}`,
    });

    // CloudFront Function for SPA routing (exclude API paths)
    const spaRoutingFunction = new cloudfront.Function(this, 'SpaRoutingFunction', {
      functionName: `rtm-${environment}-spa-routing`,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  
  // Don't modify API requests - let them pass through to API Gateway origin
  if (uri.startsWith('/api/')) {
    return request;
  }
  
  // Check if the URI has a file extension
  // If not, it's likely a SPA route, so serve index.html
  if (!uri.includes('.')) {
    request.uri = '/index.html';
  }
  
  return request;
}
      `),
      comment: 'Routes SPA paths to index.html while preserving API paths',
    });

    // CloudFront distribution with API Gateway reverse proxy
    this.distribution = new cloudfront.Distribution(this, 'WebDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.webBucket, {
          originAccessControl,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        functionAssociations: [
          {
            function: spaRoutingFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(apiGatewayDomain, {
            originPath: `/${environment}`, // API Gateway stage path
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // Disable caching for API calls
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, // Support all HTTP methods
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER, // Forward all headers except Host
          compress: false, // Don't compress API responses
          smoothStreaming: false, // Not needed for API
        },
      },
      defaultRootObject: 'index.html',
      // Error responses removed - SPA routing is now handled by CloudFront Function
      priceClass:
        environment === 'production'
          ? cloudfront.PriceClass.PRICE_CLASS_ALL
          : cloudfront.PriceClass.PRICE_CLASS_100,
      comment: `RTM ${environment} Web Distribution with API Proxy - Updated`,
    });

    // Deploy web application to S3 with environment-specific source map handling
    const excludePatterns = ['assets/config/config.json', 'assets/config/config.*.json'];

    // Exclude source maps from staging and production for security
    if (environment !== 'dev') {
      excludePatterns.push('*.map');
    }

    new s3deploy.BucketDeployment(this, 'WebDeployment', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../apps/web/dist/web/browser'))],
      destinationBucket: this.webBucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      exclude: excludePatterns,
      // Source maps (.map files) are included in dev environment for debugging
      // but excluded from staging and production for security
    });

    // Generate web configuration file
    this.setupWebConfigGeneration(environment);

    // Setup CloudFront monitoring
    this.setupCloudFrontMonitoring(environment, alertsTopicArn);

    // Store web hosting configuration in SSM
    new ssm.StringParameter(this, 'WebBucketName', {
      parameterName: `/rtm/${environment}/web/bucket-name`,
      stringValue: this.webBucket.bucketName,
    });

    new ssm.StringParameter(this, 'WebDistributionId', {
      parameterName: `/rtm/${environment}/web/distribution-id`,
      stringValue: this.distribution.distributionId,
    });

    new ssm.StringParameter(this, 'WebDistributionDomainName', {
      parameterName: `/rtm/${environment}/web/domain-name`,
      stringValue: this.distribution.distributionDomainName,
    });

    // Export CloudFront domain for CORS configuration
    new cdk.CfnOutput(this, 'CloudFrontDomainOutput', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
      exportName: `rtm-${environment}-cloudfront-domain`,
    });

    // Output the web URL
    new cdk.CfnOutput(this, 'WebApplicationURL', {
      description: 'Web application URL',
      value: `https://${this.distribution.distributionDomainName}`,
      exportName: `rtm-${environment}-web-url`,
    });

    // Resource tagging
    this.setupResourceTags(environment);
  }

  private setupWebConfigGeneration(environment: string) {
    // Create Lambda function to generate web configuration
    const configGeneratorFunction = new lambdaNodejs.NodejsFunction(
      this,
      'WebConfigGeneratorFunction',
      {
        functionName: `rtm-${environment}-web-config-generator`,
        entry: path.join(__dirname, 'lambda/generate-web-config.ts'),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_18_X,
        timeout: cdk.Duration.minutes(2),
        memorySize: 256,
        bundling: {
          externalModules: ['@aws-sdk/*'],
          nodeModules: ['node-fetch'],
        },
      }
    );

    // Grant permissions to read SSM parameters
    configGeneratorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetParameter'],
        resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/rtm/${environment}/*`],
      })
    );

    // Grant permissions to upload to S3 bucket
    configGeneratorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:PutObject', 's3:PutObjectAcl'],
        resources: [`${this.webBucket.bucketArn}/assets/config/*`],
      })
    );

    // Create log group for config generator provider
    const configGeneratorLogGroup = new logs.LogGroup(this, 'WebConfigGeneratorProviderLogs', {
      logGroupName: `/aws/lambda/rtm-${environment}-web-config-generator-provider`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Custom Resource to trigger config generation
    const configGeneratorProvider = new customResources.Provider(
      this,
      'WebConfigGeneratorProvider',
      {
        onEventHandler: configGeneratorFunction,
        logGroup: configGeneratorLogGroup,
      }
    );

    const configGeneratorResource = new cdk.CustomResource(this, 'WebConfigGeneratorResource', {
      serviceToken: configGeneratorProvider.serviceToken,
      properties: {
        Environment: environment,
        WebBucketName: this.webBucket.bucketName,
        Region: this.region,
        // Add a timestamp to force updates when needed
        Timestamp: Date.now().toString(),
      },
    });

    // Ensure Custom Resource runs after all dependencies are ready
    configGeneratorResource.node.addDependency(this.webBucket);

    console.log(`Configured web config generation for ${environment} environment`);
  }

  private setupCloudFrontMonitoring(environment: string, alertsTopicArn: string) {
    // Import SNS topic for alerts
    const alertsTopic = cdk.aws_sns.Topic.fromTopicArn(this, 'ImportedAlertsTopic', alertsTopicArn);

    // CloudFront 4xx errors alarm
    const cloudFrontErrorsAlarm = new cloudwatch.Alarm(this, 'CloudFrontErrorsAlarm', {
      alarmName: `rtm-${environment}-cloudfront-4xx-errors`,
      alarmDescription: 'CloudFront 4xx error rate',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/CloudFront',
        metricName: '4xxErrorRate',
        dimensionsMap: {
          DistributionId: this.distribution.distributionId,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: environment === 'production' ? 5 : 10,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    cloudFrontErrorsAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    // CloudFront 5xx errors alarm
    const cloudFront5xxErrorsAlarm = new cloudwatch.Alarm(this, 'CloudFront5xxErrorsAlarm', {
      alarmName: `rtm-${environment}-cloudfront-5xx-errors`,
      alarmDescription: 'CloudFront 5xx error rate',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/CloudFront',
        metricName: '5xxErrorRate',
        dimensionsMap: {
          DistributionId: this.distribution.distributionId,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: environment === 'production' ? 1 : 5,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    cloudFront5xxErrorsAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    // CloudFront origin latency alarm
    const cloudFrontLatencyAlarm = new cloudwatch.Alarm(this, 'CloudFrontLatencyAlarm', {
      alarmName: `rtm-${environment}-cloudfront-origin-latency`,
      alarmDescription: 'CloudFront origin latency',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/CloudFront',
        metricName: 'OriginLatency',
        dimensionsMap: {
          DistributionId: this.distribution.distributionId,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: environment === 'production' ? 1000 : 2000, // milliseconds
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    cloudFrontLatencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));
  }

  private setupResourceTags(environment: string) {
    const tags = {
      Project: 'RegularTravelManager',
      Environment: environment,
      ManagedBy: 'CDK',
      CostCenter: 'IT-Operations',
      StackType: 'Frontend',
    };

    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}
