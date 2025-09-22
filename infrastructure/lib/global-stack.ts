import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { getEnvironmentConfig } from './config/environment-config';
import { CertificateValidationHelper } from './utils/certificate-validation-helper';

export interface GlobalStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'production';
  webOriginDomain?: string;
  apiOriginDomain?: string;
  certificateStack?: any; // Reference to certificate stack for cross-region access
}

/**
 * Global CloudFront Stack - Provides stable CNAME targets
 *
 * This stack creates a persistent CloudFront distribution that acts as a stable entry point
 * for both web and API traffic. The underlying API Gateway and Web stacks can be destroyed
 * and redeployed without affecting the CNAME records, as this distribution remains persistent.
 *
 * The origins can be updated by passing them as props when other stacks deploy.
 */
export class GlobalStack extends cdk.Stack {
  public distribution!: cloudfront.Distribution;
  public webCertificate?: acm.ICertificate;

  constructor(scope: Construct, id: string, props: GlobalStackProps) {
    super(scope, id, props);

    const { environment, webOriginDomain, apiOriginDomain, certificateStack } = props;
    const config = getEnvironmentConfig(environment);

    // Import certificate from certificate stack if custom domains are enabled
    if (config.web.customDomainEnabled && config.api.customDomainEnabled && certificateStack) {
      // Use direct reference to certificate from the certificate stack
      // CDK handles cross-region references automatically with crossRegionReferences: true
      this.webCertificate = certificateStack.certificate;
    } else {
      console.log('ℹ️ Custom domains not enabled, skipping certificate configuration');
    }

    // Create persistent CloudFront distribution
    this.createGlobalDistribution(environment, config, webOriginDomain, apiOriginDomain);

    // Store global configuration in SSM
    this.storeGlobalConfiguration(environment);
  }

  private createGlobalDistribution(
    environment: string,
    config: any,
    webOriginDomain?: string,
    apiOriginDomain?: string
  ) {
    // Use provided origins or create SSM parameter references
    // Since CloudFront needs actual domain names, we use CloudFormation references
    // that get resolved at runtime rather than synthesis-time lookups

    let webBucketDomain: string;
    let apiGatewayDomain: string;

    if (webOriginDomain) {
      webBucketDomain = webOriginDomain;
    } else {
      // Use CloudFormation reference to SSM parameter (resolved at runtime)
      const webParamRef = ssm.StringParameter.fromStringParameterName(
        this,
        'WebBucketDomainParam',
        `/rtm/${environment}/web/bucket-website-domain`
      );
      webBucketDomain = webParamRef.stringValue;
    }

    if (apiOriginDomain) {
      apiGatewayDomain = apiOriginDomain;
    } else {
      // Use CloudFormation reference to SSM parameter (resolved at runtime)
      const apiParamRef = ssm.StringParameter.fromStringParameterName(
        this,
        'ApiGatewayDomainParam',
        `/rtm/${environment}/api/gateway-domain`
      );
      apiGatewayDomain = apiParamRef.stringValue;
    }

    console.log(`🌍 Creating global distribution with origins:`);
    console.log(`   Web: ${webBucketDomain}`);
    console.log(`   API: ${apiGatewayDomain}`);
    console.log(`💡 Origins will be resolved from SSM parameters at runtime`);

    // Create CloudFront function for SPA routing
    const spaRoutingFunction = new cloudfront.Function(this, 'SPARoutingFunction', {
      functionName: `rtm-${environment}-spa-routing-global`,
      code: cloudfront.FunctionCode.fromInline(`
        function handler(event) {
          var request = event.request;
          var uri = request.uri;

          // Check if the request is for the API
          if (uri.startsWith('/api/')) {
            return request;
          }

          // Handle SPA routing for the web application
          if (!uri.includes('.') && uri !== '/') {
            request.uri = '/index.html';
          }

          return request;
        }
      `),
      comment: `SPA routing function for ${environment} environment - Global Distribution`,
    });

    // Create the base distribution configuration with real origins
    const distributionConfig: cloudfront.DistributionProps = {
      defaultBehavior: {
        origin: new origins.HttpOrigin(webBucketDomain, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY, // S3 website hosting only supports HTTP
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
            originPath: `/${environment}`,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          compress: false,
        },
      },
      defaultRootObject: 'index.html',
      priceClass:
        environment === 'production'
          ? cloudfront.PriceClass.PRICE_CLASS_ALL
          : cloudfront.PriceClass.PRICE_CLASS_100,
      comment: `RTM ${environment} Global Distribution - Persistent CNAME targets`,
    };

    // Add custom domains and certificate if configured
    if (config.web.customDomainEnabled && config.api.customDomainEnabled && this.webCertificate) {
      Object.assign(distributionConfig, {
        domainNames: [config.web.domainName, config.api.domainName],
        certificate: this.webCertificate,
      });
    }

    // Create the persistent CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'GlobalDistribution', distributionConfig);

    console.log('🌍 Global CloudFront Distribution Created');
    console.log(`✅ Persistent CloudFront domain: ${this.distribution.distributionDomainName}`);

    if (config.web.customDomainEnabled && config.api.customDomainEnabled) {
      console.log(
        `🔗 Web domain: ${config.web.domainName} → ${this.distribution.distributionDomainName}`
      );
      console.log(
        `🔗 API domain: ${config.api.domainName} → ${this.distribution.distributionDomainName}`
      );
      console.log('');
      console.log('📋 DNS Configuration (ONE TIME SETUP):');
      console.log(
        `   ${config.web.domainName.split('.')[0]} CNAME ${this.distribution.distributionDomainName}`
      );
      console.log(
        `   ${config.api.domainName.split('.')[0]} CNAME ${this.distribution.distributionDomainName}`
      );
      console.log('');
      console.log(
        '✨ After this setup, you can destroy/redeploy API Gateway and Web stacks freely!'
      );
    }
  }

  private storeGlobalConfiguration(environment: string) {
    // Store the persistent CloudFront domain for other stacks to reference
    new ssm.StringParameter(this, 'GlobalDistributionDomain', {
      parameterName: `/rtm/${environment}/global/distribution-domain`,
      stringValue: this.distribution.distributionDomainName,
    });

    new ssm.StringParameter(this, 'GlobalDistributionId', {
      parameterName: `/rtm/${environment}/global/distribution-id`,
      stringValue: this.distribution.distributionId,
    });

    // Output the persistent CloudFront domain
    new cdk.CfnOutput(this, 'PersistentCloudFrontDomain', {
      value: this.distribution.distributionDomainName,
      description: 'Persistent CloudFront domain for stable CNAME records',
      exportName: `rtm-${environment}-global-domain`,
    });

    new cdk.CfnOutput(this, 'GlobalDistributionIdOutput', {
      value: this.distribution.distributionId,
      description: 'Global CloudFront distribution ID',
      exportName: `rtm-${environment}-global-distribution-id`,
    });
  }
}
