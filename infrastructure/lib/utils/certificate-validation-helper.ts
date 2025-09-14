import * as cdk from 'aws-cdk-lib';
import * as customResources from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

/**
 * Custom resource to extract and display certificate validation CNAME records
 * This helps users understand what DNS records they need to add during deployment
 */
export class CertificateValidationHelper extends Construct {
  public readonly validationRecords: customResources.AwsCustomResource;

  constructor(
    scope: Construct,
    id: string,
    props: {
      certificateArn: string;
      domainName: string;
      environment: string;
    }
  ) {
    super(scope, id);

    const { certificateArn, domainName, environment } = props;

    // Custom resource to get certificate validation records
    this.validationRecords = new customResources.AwsCustomResource(
      this,
      'GetCertificateValidation',
      {
        onUpdate: {
          service: 'ACM',
          action: 'describeCertificate',
          parameters: {
            CertificateArn: certificateArn,
          },
          physicalResourceId: customResources.PhysicalResourceId.of(
            `cert-validation-${environment}-${Date.now()}`
          ),
        },
        policy: customResources.AwsCustomResourcePolicy.fromSdkCalls({
          resources: [certificateArn],
        }),
      }
    );

    // Dependencies are automatically handled by CDK when using certificateArn

    // Create outputs for the validation records

    new cdk.CfnOutput(this, 'CertificateValidationInstructions', {
      description: `DNS Validation Instructions for ${domainName}`,
      value: 'Check the validation record outputs below for CNAME details',
    });

    new cdk.CfnOutput(this, 'ValidationDomainName', {
      description: 'Domain being validated',
      value: domainName,
    });

    // Note: The actual CNAME records will be available in CloudFormation events
    // This output provides a reference point for users
    new cdk.CfnOutput(this, 'ValidationStatus', {
      description: 'Certificate validation status and instructions',
      value: `Certificate validation required for ${domainName}. Check CloudFormation events for CNAME record details if deployment pauses.`,
    });
  }

  /**
   * Add console logging for certificate validation process
   */
  public static logValidationInstructions(domainName: string): void {
    console.log('\n🔐 CERTIFICATE VALIDATION PROCESS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Domain: ${domainName}`);
    console.log('📝 Validation Method: DNS (CNAME record required)');
    console.log('');
    console.log('🚨 IF DEPLOYMENT PAUSES:');
    console.log('   1. Open AWS Console → CloudFormation → Your Stack → Events');
    console.log('   2. Look for "Content of DNS Record" message');
    console.log('   3. Copy the CNAME Name and Value from the message');
    console.log('   4. Add the CNAME record to your DNS provider');
    console.log('   5. Wait 1-10 minutes for DNS propagation');
    console.log('');
    console.log('📋 Example CNAME format:');
    console.log('   Name: _1234abcd5678.your-domain.com');
    console.log('   Type: CNAME');
    console.log('   Value: _abcd1234.xyzvalidation.acm-validations.aws');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  /**
   * Add post-certificate creation logging
   */
  public static logPostCreation(domainName: string, certificateArn: string): void {
    console.log('\n✅ CERTIFICATE CREATION INITIATED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Domain: ${domainName}`);
    console.log(`🆔 Certificate ARN: ${certificateArn.substring(0, 60)}...`);
    console.log('⏳ Status: Waiting for DNS validation...');
    console.log('');
    console.log('💡 TIPS:');
    console.log('   • Validation records are automatically created in Route53 hosted zones');
    console.log('   • External domains require manual CNAME record creation');
    console.log('   • Validation typically takes 1-5 minutes after DNS propagation');
    console.log('   • Check CloudFormation events if deployment appears stuck');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}
