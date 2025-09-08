#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from './infrastructure-stack';
import { LambdaStack } from './lambda-stack';
import { ApiGatewayStack } from './api-gateway-stack';
import { WebStack } from './web-stack';

const app = new cdk.App();

// Configuration helper to avoid direct process.env access
const getConfig = () => ({
  environment: app.node.tryGetContext('environment') || 'dev',
  domainName: app.node.tryGetContext('domainName'),
  account: app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT || '123456789012',
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

// Create the Web stack (frontend hosting)
const webStackName = `rtm-${config.environment}-web`;
const webStack = new WebStack(app, webStackName, {
  environment: config.environment,
  env: {
    account: config.account,
    region: config.region,
  },
  description: `RegularTravelManager Web frontend for ${config.environment} environment`,
  tags: {
    Project: 'RegularTravelManager',
    Environment: config.environment,
    ManagedBy: 'CDK',
  },
});

// Set up proper dependencies: Infrastructure → Lambda → API Gateway → Web
lambdaStack.addDependency(infrastructureStack);
apiGatewayStack.addDependency(lambdaStack);
webStack.addDependency(apiGatewayStack);
webStack.addDependency(infrastructureStack); // WebStack needs cognito exports from infrastructure

// Synthesize all stacks
app.synth();
