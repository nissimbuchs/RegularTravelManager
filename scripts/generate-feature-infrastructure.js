#!/usr/bin/env node

/**
 * Feature Infrastructure Generator
 * Generates CDK code from feature infrastructure definitions
 */

const fs = require('fs');
const path = require('path');

class FeatureInfrastructureGenerator {
  constructor() {
    this.featuresDir = path.join(process.cwd(), 'apps/api/src/features');
    this.infrastructureDir = path.join(process.cwd(), 'infrastructure/src');
  }

  generateAllFeatureInfrastructure() {
    console.log('🏗️  Generating CDK infrastructure from feature definitions...\n');

    const features = this.discoverFeatures();

    for (const feature of features) {
      console.log(`Processing feature: ${feature.name}`);
      this.generateLambdaStack(feature);
      this.generateApiGatewayRoutes(feature);
    }

    this.generateMasterInfrastructureFile(features);
    console.log('\n✅ Infrastructure generation complete!');
  }

  discoverFeatures() {
    const features = [];

    if (!fs.existsSync(this.featuresDir)) {
      console.log('⚠️  Features directory not found');
      return features;
    }

    const featureDirs = fs.readdirSync(this.featuresDir);

    for (const featureDir of featureDirs) {
      const featurePath = path.join(this.featuresDir, featureDir);
      const infrastructureFile = path.join(featurePath, 'infrastructure.ts');

      if (fs.statSync(featurePath).isDirectory() && fs.existsSync(infrastructureFile)) {
        try {
          // Dynamic import would be used in real implementation
          // For this template, we'll generate based on file structure
          features.push({
            name: featureDir,
            path: featurePath,
            infrastructureFile: infrastructureFile,
          });
        } catch (error) {
          console.log(`⚠️  Could not load infrastructure for ${featureDir}: ${error.message}`);
        }
      }
    }

    return features;
  }

  generateLambdaStack(feature) {
    const templatePath = path.join(this.infrastructureDir, 'templates');
    const outputPath = path.join(this.infrastructureDir, `${feature.name}-lambda-stack.ts`);

    // Create templates directory if it doesn't exist
    if (!fs.existsSync(templatePath)) {
      fs.mkdirSync(templatePath, { recursive: true });
    }

    const lambdaStackTemplate = this.generateLambdaStackTemplate(feature);

    fs.writeFileSync(outputPath, lambdaStackTemplate);
    console.log(`   Generated: ${path.relative(process.cwd(), outputPath)}`);
  }

  generateApiGatewayRoutes(feature) {
    const outputPath = path.join(this.infrastructureDir, `${feature.name}-api-routes.ts`);

    const apiRoutesTemplate = this.generateApiRoutesTemplate(feature);

    fs.writeFileSync(outputPath, apiRoutesTemplate);
    console.log(`   Generated: ${path.relative(process.cwd(), outputPath)}`);
  }

  generateLambdaStackTemplate(feature) {
    return `import { Construct } from 'constructs';
import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { Role, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';

/**
 * Generated Lambda Stack for ${feature.name}
 * This file is auto-generated from apps/api/src/features/${feature.name}/infrastructure.ts
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Regenerate with: npm run infrastructure:generate
 */

export class ${this.toPascalCase(feature.name)}LambdaStack extends Stack {
  public readonly functions: { [key: string]: Function } = {};

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.createLambdaFunctions();
    this.createIAMRoles();
  }

  private createLambdaFunctions() {
    // TODO: Replace with actual feature infrastructure definition
    
    // Example Lambda function based on feature structure
    this.functions['example-function'] = new Function(this, 'ExampleFunction', {
      runtime: Runtime.NODEJS_20_X,
      handler: 'apps/api/dist/handlers/${feature.name}/example.handler',
      code: Code.fromAsset('apps/api/dist'),
      timeout: Duration.seconds(10),
      memorySize: 256,
      environment: {
        DATABASE_URL: process.env.DATABASE_URL || '',
        AWS_REGION: process.env.AWS_REGION || 'eu-central-1',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info'
      }
    });
  }

  private createIAMRoles() {
    // Create IAM role with necessary permissions
    const lambdaRole = new Role(this, '${this.toPascalCase(feature.name)}LambdaRole', {
      assumedBy: new (require('aws-cdk-lib/aws-iam')).ServicePrincipal('lambda.amazonaws.com'),
    });

    // Add basic Lambda execution permissions
    lambdaRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream', 
        'logs:PutLogEvents'
      ],
      resources: ['*']
    }));

    // Add RDS connection permission
    lambdaRole.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['rds-db:connect'],
      resources: ['*']
    }));

    // Apply role to all functions
    Object.values(this.functions).forEach(func => {
      func.role?.attachInlinePolicy;
    });
  }
}`;
  }

  generateApiRoutesTemplate(feature) {
    return `import { RestApi, LambdaIntegration, IAuthorizer } from 'aws-cdk-lib/aws-apigateway';
import { Function } from 'aws-cdk-lib/aws-lambda';

/**
 * Generated API Routes for ${feature.name}
 * This file is auto-generated from apps/api/src/features/${feature.name}/infrastructure.ts
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Regenerate with: npm run infrastructure:generate
 */

export class ${this.toPascalCase(feature.name)}ApiRoutes {
  
  static addRoutes(
    api: RestApi, 
    functions: { [key: string]: Function },
    authorizer: IAuthorizer
  ): void {
    
    // TODO: Replace with actual API routes from feature infrastructure definition
    
    // Example API route based on feature structure  
    const exampleResource = api.root.addResource('${feature.name}');
    
    // GET /${feature.name}
    exampleResource.addMethod('GET', new LambdaIntegration(functions['example-function']), {
      authorizer: authorizer
    });
    
    // POST /${feature.name}  
    exampleResource.addMethod('POST', new LambdaIntegration(functions['example-function']), {
      authorizer: authorizer
    });
  }
}`;
  }

  generateMasterInfrastructureFile(features) {
    const outputPath = path.join(this.infrastructureDir, 'generated-infrastructure.ts');

    const imports = features
      .map(
        feature =>
          `import { ${this.toPascalCase(feature.name)}LambdaStack } from './${feature.name}-lambda-stack';`
      )
      .join('\n');

    const exports = features
      .map(
        feature =>
          `export { ${this.toPascalCase(feature.name)}LambdaStack } from './${feature.name}-lambda-stack';`
      )
      .join('\n');

    const masterFile = `/**
 * Master Infrastructure File
 * Auto-generated from all feature infrastructure definitions
 * 
 * ⚠️  DO NOT EDIT MANUALLY - Regenerate with: npm run infrastructure:generate
 */

${imports}

${exports}

/**
 * All discovered features:
 * ${features.map(f => `- ${f.name}`).join('\n * ')}
 */

export const DISCOVERED_FEATURES = [
  ${features.map(f => `'${f.name}'`).join(',\n  ')}
];`;

    fs.writeFileSync(outputPath, masterFile);
    console.log(`   Generated: ${path.relative(process.cwd(), outputPath)}`);
  }

  toPascalCase(str) {
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}

// Run generator if called directly
if (require.main === module) {
  const generator = new FeatureInfrastructureGenerator();
  generator.generateAllFeatureInfrastructure();
}

module.exports = FeatureInfrastructureGenerator;
