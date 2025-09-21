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
// Route53 imports removed - using external DNS with CNAME records
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as path from 'path';
import { getEnvironmentConfig } from './config/environment-config';
// CertificateValidationHelper removed - using native AWS Certificate validation

export interface WebStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'production';
  certificateStack?: any; // Reference to certificate stack for cross-region access
}

export class WebStack extends cdk.Stack {
  public readonly webBucket: s3.Bucket;
  // distribution removed - now handled by GlobalStack
  public certificate?: acm.ICertificate;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const { environment, certificateStack } = props;
    const config = getEnvironmentConfig(environment);

    // Import required values from other stacks
    const apiUrl = cdk.Fn.importValue(`rtm-${environment}-api-url`);
    const userPoolId = cdk.Fn.importValue(`rtm-${environment}-user-pool-id`);
    const userPoolClientId = cdk.Fn.importValue(`rtm-${environment}-user-pool-client-id`);
    const alertsTopicArn = cdk.Fn.importValue(`rtm-${environment}-alerts-topic-arn`);

    // Extract API Gateway domain from the full URL for CloudFront origin
    // API URL format: https://xxxxxxxxxx.execute-api.eu-central-1.amazonaws.com/dev/
    const apiGatewayDomain = cdk.Fn.select(2, cdk.Fn.split('/', apiUrl)); // Gets the domain part

    // Create S3 bucket for static web content with website hosting for global CloudFront
    this.webBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: `rtm-${environment}-web-${this.account}-${this.region}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: true, // Enable public read for website hosting
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS, // Allow website hosting
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'production',
    });

    // Store S3 website domain for global CloudFront distribution
    const websiteDomain = this.webBucket.bucketWebsiteDomainName;

    new ssm.StringParameter(this, 'WebBucketWebsiteDomain', {
      parameterName: `/rtm/${environment}/web/bucket-website-domain`,
      stringValue: websiteDomain,
    });

    console.log(`✅ S3 website hosting configured for global distribution:`);
    console.log(`   Website Domain: ${websiteDomain}`);
    console.log(`   SSM Parameter: /rtm/${environment}/web/bucket-website-domain`);
    console.log(`ℹ️ No CloudFront distribution - will be handled by global stack`);

    // Deploy web application to S3 with environment-specific source map handling
    const excludePatterns = ['assets/config/config.json', 'assets/config/config.*.json'];

    // Exclude source maps from staging and production for security
    if (environment !== 'dev') {
      excludePatterns.push('*.map');
    }

    new s3deploy.BucketDeployment(this, 'WebDeployment', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../apps/web/dist/web/browser'))],
      destinationBucket: this.webBucket,
      exclude: excludePatterns,
      // Source maps (.map files) are included in dev environment for debugging
      // but excluded from staging and production for security
      // Note: No CloudFront distribution - invalidation handled by global stack
    });

    // Generate web configuration file
    this.setupWebConfigGeneration(environment);

    // Store web hosting configuration in SSM
    new ssm.StringParameter(this, 'WebBucketName', {
      parameterName: `/rtm/${environment}/web/bucket-name`,
      stringValue: this.webBucket.bucketName,
    });

    // Export S3 website domain for global CloudFront configuration
    new cdk.CfnOutput(this, 'S3WebsiteDomainOutput', {
      value: websiteDomain,
      description: 'S3 website domain for global CloudFront origin',
      exportName: `rtm-${environment}-s3-website-domain`,
    });

    // Output the S3 website URL
    const webUrl = `http://${websiteDomain}`;

    new cdk.CfnOutput(this, 'WebApplicationURL', {
      description: 'S3 website URL (origin for global CloudFront)',
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
      },
    });

    // Ensure Custom Resource runs after all dependencies are ready
    configGeneratorResource.node.addDependency(this.webBucket);

    console.log(`Configured web config generation for ${environment} environment`);
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
