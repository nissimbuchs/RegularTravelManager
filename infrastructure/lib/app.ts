#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from './infrastructure-stack';
import { LambdaStack } from './lambda-stack';
import { ApiGatewayStack } from './api-gateway-stack';
import { WebStack } from './web-stack';
import { CertificateStack } from './certificate-stack';
import { GlobalStack } from './global-stack';
import { getEnvironmentConfig } from './config/environment-config';

const app = new cdk.App();

// Configuration helper to avoid direct process.env access
const getConfig = () => ({
  environment: app.node.tryGetContext('environment') || 'dev',
  domainName: app.node.tryGetContext('domainName'),
  account: app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT || '991687235565',
  region: app.node.tryGetContext('region') || process.env.CDK_DEFAULT_REGION || 'eu-central-1',
});

const config = getConfig();

// Validate environment
if (!['dev', 'staging', 'production'].includes(config.environment)) {
  throw new Error(
    `Invalid environment: ${config.environment}. Must be one of: dev, staging, production`
  );
}

// Stack naming convention: rtm-{environment}-infrastructure
const stackName = `rtm-${config.environment}-infrastructure`;

// Create the infrastructure stack
const infrastructureStack = new InfrastructureStack(app, stackName, {
  environment: config.environment,
  domainName: config.domainName,
  env: {
    account: config.account,
    region: config.region, // Swiss data residency
  },
  description: `RegularTravelManager infrastructure for ${config.environment} environment`,
  tags: {
    Project: 'RegularTravelManager',
    Environment: config.environment,
    ManagedBy: 'CDK',
  },
});

// Create the Lambda stack (depends on infrastructure)
const lambdaStackName = `rtm-${config.environment}-lambda`;
const lambdaStack = new LambdaStack(app, lambdaStackName, {
  environment: config.environment,
  infrastructureStack: infrastructureStack,
  env: {
    account: config.account,
    region: config.region,
  },
  description: `RegularTravelManager Lambda functions for ${config.environment} environment`,
  tags: {
    Project: 'RegularTravelManager',
    Environment: config.environment,
    ManagedBy: 'CDK',
  },
});

// Create the API Gateway stack (depends only on Lambda exports)
// Note: CORS includes both static origins from environment-config.ts and dynamic CloudFront domain from WebStack
const apiGatewayStackName = `rtm-${config.environment}-api-gateway`;
const apiGatewayStack = new ApiGatewayStack(app, apiGatewayStackName, {
  environment: config.environment,
  env: {
    account: config.account,
    region: config.region,
  },
  description: `RegularTravelManager API Gateway for ${config.environment} environment`,
  tags: {
    Project: 'RegularTravelManager',
    Environment: config.environment,
    ManagedBy: 'CDK',
  },
});

// Create the Certificate stack (CloudFront SSL certificates in us-east-1) - only if custom domains enabled
const envConfig = getEnvironmentConfig(config.environment);
let certificateStack: CertificateStack | undefined;

if (envConfig.web.customDomainEnabled && envConfig.api.customDomainEnabled) {
  const certificateStackName = `rtm-${config.environment}-certificate`;
  certificateStack = new CertificateStack(app, certificateStackName, {
    environment: config.environment,
    env: {
      account: config.account,
      region: 'us-east-1', // CloudFront requires certificates in us-east-1
    },
    crossRegionReferences: true, // Enable cross-region references
    description: `RegularTravelManager SSL certificates for ${config.environment} environment (CloudFront)`,
    tags: {
      Project: 'RegularTravelManager',
      Environment: config.environment,
      ManagedBy: 'CDK',
    },
  });
}

// Create the Web stack (frontend hosting - S3 only, no CloudFront)
const webStackName = `rtm-${config.environment}-web`;
const webStack = new WebStack(app, webStackName, {
  environment: config.environment,
  certificateStack: certificateStack, // Pass certificate stack for cross-region reference
  env: {
    account: config.account,
    region: config.region,
  },
  crossRegionReferences: true, // Enable cross-region references
  description: `RegularTravelManager Web frontend for ${config.environment} environment`,
  tags: {
    Project: 'RegularTravelManager',
    Environment: config.environment,
    ManagedBy: 'CDK',
  },
});

// Create the Global stack (persistent CloudFront distribution for stable CNAME records)
const globalStackName = `rtm-${config.environment}-global`;
const globalStack = new GlobalStack(app, globalStackName, {
  environment: config.environment,
  certificateStack: certificateStack, // Use existing certificate from us-east-1
  env: {
    account: config.account,
    region: config.region, // Deploy in same region as other stacks for easier SSM access
  },
  crossRegionReferences: true, // Enable cross-region certificate access
  description: `RegularTravelManager Global CloudFront for ${config.environment} environment`,
  tags: {
    Project: 'RegularTravelManager',
    Environment: config.environment,
    ManagedBy: 'CDK',
    StackType: 'Global',
  },
});

// Set up proper dependencies: Infrastructure → Lambda → API Gateway → Web
// NOTE: Global stack has NO dependencies - it uses SSM lookups with fallbacks
lambdaStack.addDependency(infrastructureStack);
apiGatewayStack.addDependency(lambdaStack);
webStack.addDependency(apiGatewayStack);
webStack.addDependency(infrastructureStack); // WebStack needs cognito exports from infrastructure

// IMPORTANT: Global stack has NO dependencies to allow API Gateway and Web stacks to be deleted freely
// Global stack will use SSM parameter lookups with fallback defaults when origins are missing

// Synthesize all stacks
app.synth();
