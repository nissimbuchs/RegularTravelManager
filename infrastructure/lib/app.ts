#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from './infrastructure-stack';

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
new InfrastructureStack(app, stackName, {
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

// Synthesize all stacks
app.synth();
