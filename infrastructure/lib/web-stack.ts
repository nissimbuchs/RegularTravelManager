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
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'path';
import { getEnvironmentConfig } from './config/environment-config';
import { CertificateValidationHelper } from './utils/certificate-validation-helper';

export interface WebStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'production';
}

export class WebStack extends cdk.Stack {
  public readonly webBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public hostedZone?: route53.IHostedZone;
  public certificate?: acm.ICertificate;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const { environment } = props;
    const config = getEnvironmentConfig(environment);

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

    // Setup custom domain and SSL certificate if enabled
    if (config.web.customDomainEnabled && config.web.domainName) {
      this.setupCustomDomain(environment, config.web.domainName);
    }

    // CloudFront distribution configuration
    const distributionConfig: cloudfront.DistributionProps = {
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
          origin: new origins.HttpOrigin(apiGatewayDomain),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // Disable caching for API calls
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, // Support all HTTP methods
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER, // Forward all headers except Host
          compress: false, // Don't compress API responses
          smoothStreaming: false, // Not needed for API
        },
      },
      defaultRootObject: 'index.html',
      priceClass:
        environment === 'production'
          ? cloudfront.PriceClass.PRICE_CLASS_ALL
          : cloudfront.PriceClass.PRICE_CLASS_100,
      comment: `RTM ${environment} Web Distribution with API Proxy - Updated`,
    };

    // Add custom domain configuration if enabled
    if (config.web.customDomainEnabled && config.web.domainName && this.certificate) {
      Object.assign(distributionConfig, {
        domainNames: [config.web.domainName],
        certificate: this.certificate,
      });
    }

    // CloudFront distribution with API Gateway reverse proxy
    this.distribution = new cloudfront.Distribution(this, 'WebDistribution', distributionConfig);

    // Create Route53 A record pointing to the CloudFront distribution
    if (config.web.customDomainEnabled && config.web.domainName && this.hostedZone) {
      new route53.ARecord(this, 'WebCustomDomainARecord', {
        zone: this.hostedZone,
        recordName: environment === 'production' ? 'rtm' : `rtm-${environment}`, // Just the subdomain
        target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(this.distribution)),
      });

      console.log(`✅ Web custom domain configured: ${config.web.domainName}`);
      console.log(`✅ Route53 A record created automatically: ${config.web.domainName} -> ${this.distribution.distributionDomainName}`);
    } else if (config.web.customDomainEnabled && config.web.domainName) {
      console.log(`Custom domain enabled: ${config.web.domainName}`);
      console.log(`CloudFront distribution: ${this.distribution.distributionDomainName}`);
      console.log(`⚠️  No hosted zone available - manual DNS configuration required`);
    }

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

    // Output the web URL (custom domain if configured, otherwise CloudFront domain)
    const webUrl = config.web.customDomainEnabled && config.web.domainName 
      ? `https://${config.web.domainName}`
      : `https://${this.distribution.distributionDomainName}`;

    new cdk.CfnOutput(this, 'WebApplicationURL', {
      description: 'Web application URL',
      value: webUrl,
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

  private setupCustomDomain(environment: string, domainName: string) {
    // Extract the root domain from the subdomain (e.g., 'buchs.be' from 'rtm-staging.buchs.be')
    const domainParts = domainName.split('.');
    const rootDomain = domainParts.slice(-2).join('.'); // Get the last two parts (domain.tld)

    console.log(`Setting up custom domain: ${domainName} for root domain: ${rootDomain}`);

    // Import the hosted zone that was created in InfrastructureStack
    const hostedZoneId = cdk.Fn.importValue(`rtm-${environment}-hosted-zone-id`);
    const hostedZoneName = cdk.Fn.importValue(`rtm-${environment}-hosted-zone-name`);
    this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: hostedZoneId,
      zoneName: hostedZoneName,
    });

    // Create SSL certificate for the web subdomain with DNS validation
    // CloudFront requires certificates to be in us-east-1 region
    // Using DnsValidatedCertificate as it supports cross-region deployment
    CertificateValidationHelper.logValidationInstructions(domainName);

    this.certificate = new acm.DnsValidatedCertificate(this, 'WebCertificate', {
      domainName: domainName,
      hostedZone: this.hostedZone,
      region: 'us-east-1', // Required for CloudFront
    });

    // Log post-creation status
    CertificateValidationHelper.logPostCreation(domainName, this.certificate.certificateArn);

    // Store certificate ARN in SSM for reference
    new ssm.StringParameter(this, 'WebCertificateArn', {
      parameterName: `/rtm/${environment}/web/certificate-arn`,
      stringValue: this.certificate.certificateArn,
    });

    // Store custom domain in SSM
    new ssm.StringParameter(this, 'WebCustomDomain', {
      parameterName: `/rtm/${environment}/web/custom-domain`,
      stringValue: domainName,
    });

    console.log(`✅ Custom domain setup completed for ${domainName}`);
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
