import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { getEnvironmentConfig } from './config/environment-config';
import { CertificateValidationHelper } from './utils/certificate-validation-helper';

export interface CertificateStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'production';
}

/**
 * Certificate Stack for CloudFront SSL certificates
 * This stack must be deployed to us-east-1 region as required by CloudFront
 */
export class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const { environment } = props;
    const config = getEnvironmentConfig(environment);

    // Validate that this stack is being deployed to us-east-1
    if (this.region !== 'us-east-1') {
      console.warn(
        `⚠️  Certificate stack should be deployed to us-east-1, but is being deployed to ${this.region}`
      );
      console.warn('   CloudFront requires certificates to be in us-east-1 region');
    }

    // Only create certificate if custom domain is enabled
    if (!config.web.customDomainEnabled || !config.web.domainName) {
      throw new Error(
        `Custom domain must be enabled for certificate creation. Environment: ${environment}`
      );
    }

    const domainName = config.web.domainName;

    console.log(`🔐 Creating CloudFront certificate in us-east-1 for ${domainName}`);
    console.log(`📍 Stack region: ${this.region} (must be us-east-1 for CloudFront)`);

    // Create SSL certificate for the web subdomain with external DNS validation
    this.certificate = new acm.Certificate(this, 'WebCertificate', {
      domainName: domainName,
      certificateName: `rtm-${environment}-web-cert-cloudfront`,
      validation: acm.CertificateValidation.fromDns(),
    });

    // Store certificate ARN in SSM Parameter Store for cross-region access
    const certificateArnParameter = new ssm.StringParameter(this, 'WebCertificateArnParameter', {
      parameterName: `/rtm/${environment}/web/certificate-arn-us-east-1`,
      stringValue: this.certificate.certificateArn,
      description: `CloudFront SSL certificate ARN for ${domainName} (us-east-1)`,
    });

    // Store certificate ARN in SSM in the target region for web stack access
    // This will be accessible from other regions
    new ssm.StringParameter(this, 'WebCertificateArnGlobal', {
      parameterName: `/rtm/${environment}/web/cloudfront-certificate-arn`,
      stringValue: this.certificate.certificateArn,
      description: `Global reference to CloudFront SSL certificate ARN for ${domainName}`,
    });

    // Add certificate validation helper for DNS setup instructions
    const validationHelper = new CertificateValidationHelper(this, 'CertValidationHelper', {
      certificateArn: this.certificate.certificateArn,
      domainName: domainName,
      environment: environment,
    });

    // Log certificate validation instructions
    CertificateValidationHelper.logValidationInstructions(domainName);

    // Export certificate ARN for cross-region access
    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      description: `SSL Certificate ARN for ${domainName} (CloudFront compatible)`,
      exportName: `rtm-${environment}-web-certificate-arn`,
    });

    new cdk.CfnOutput(this, 'CertificateDomain', {
      value: domainName,
      description: 'Domain name for the SSL certificate',
      exportName: `rtm-${environment}-web-certificate-domain`,
    });

    new cdk.CfnOutput(this, 'CertificateRegion', {
      value: this.region,
      description: 'Region where the certificate was created (must be us-east-1 for CloudFront)',
      exportName: `rtm-${environment}-web-certificate-region`,
    });

    // Log completion
    CertificateValidationHelper.logPostCreation(domainName, this.certificate.certificateArn);

    console.log(`✅ Certificate stack configured for ${domainName}`);
    console.log(`📄 Certificate ARN will be available after deployment`);
    console.log(`🔗 Cross-region reference: rtm-${environment}-web-certificate-arn`);

    // Resource tagging
    this.setupResourceTags(environment);
  }

  private setupResourceTags(environment: string) {
    const tags = {
      Project: 'RegularTravelManager',
      Environment: environment,
      ManagedBy: 'CDK',
      CostCenter: 'IT-Operations',
      StackType: 'Certificate-CloudFront',
      Region: 'us-east-1',
    };

    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}
