#!/usr/bin/env node

/**
 * Infrastructure Validation Script
 * Ensures that new API endpoints, Lambda functions, and routes are properly configured in CDK
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class InfrastructureValidator {
  constructor() {
    this.apiDir = path.join(process.cwd(), 'apps/api/src/handlers');
    this.infrastructureDir = path.join(process.cwd(), 'infrastructure/src');
    this.errors = [];
    this.warnings = [];
  }

  validateAll() {
    console.log('🔍 Starting Infrastructure Validation...\n');

    this.validateApiEndpoints();
    this.validateLambdaFunctions();
    this.validateEnvironmentVariables();
    this.validateCDKSynthesis();

    this.printResults();
    return this.errors.length === 0;
  }

  validateApiEndpoints() {
    console.log('📡 Validating API endpoints...');

    const handlerFiles = this.findHandlerFiles();
    const apiGatewayConfig = this.readApiGatewayConfig();
    
    for (const handlerFile of handlerFiles) {
      const endpoints = this.extractEndpointsFromHandler(handlerFile);
      
      for (const endpoint of endpoints) {
        if (!this.isEndpointInApiGateway(endpoint, apiGatewayConfig)) {
          this.errors.push(
            `❌ API endpoint ${endpoint.method} ${endpoint.path} found in ${handlerFile} but not configured in API Gateway CDK`
          );
        }
      }
    }

    console.log(`   Found ${handlerFiles.length} handler files`);
  }

  validateLambdaFunctions() {
    console.log('⚡ Validating Lambda functions...');

    const handlerFiles = this.findHandlerFiles();
    const lambdaStackConfig = this.readLambdaStackConfig();

    for (const handlerFile of handlerFiles) {
      const functionName = this.deriveFunctionName(handlerFile);
      
      if (!this.isLambdaInStack(functionName, lambdaStackConfig)) {
        this.errors.push(
          `❌ Lambda function ${functionName} (${handlerFile}) not found in Lambda stack CDK configuration`
        );
      }
    }

    console.log(`   Validated ${handlerFiles.length} Lambda functions`);
  }

  validateEnvironmentVariables() {
    console.log('🔧 Validating environment variables...');

    const handlerFiles = this.findHandlerFiles();
    const dockerComposeConfig = this.readDockerComposeConfig();
    const lambdaStackConfig = this.readLambdaStackConfig();

    for (const handlerFile of handlerFiles) {
      const envVars = this.extractEnvVarsFromHandler(handlerFile);
      
      for (const envVar of envVars) {
        // Check if env var is configured in development (docker-compose)
        if (!this.isEnvVarInDockerCompose(envVar, dockerComposeConfig)) {
          this.warnings.push(
            `⚠️  Environment variable ${envVar} used in ${handlerFile} but not found in docker-compose.yml`
          );
        }

        // Check if env var is configured in production (Lambda stack)
        if (!this.isEnvVarInLambdaStack(envVar, lambdaStackConfig)) {
          this.errors.push(
            `❌ Environment variable ${envVar} used in ${handlerFile} but not configured in Lambda stack`
          );
        }
      }
    }
  }

  validateCDKSynthesis() {
    console.log('🏗️  Validating CDK synthesis...');

    try {
      execSync('cd infrastructure && npm run synth', { stdio: 'pipe' });
      console.log('   ✅ CDK synthesis successful');
    } catch (error) {
      this.errors.push('❌ CDK synthesis failed - infrastructure configuration has errors');
      this.errors.push(`   Error: ${error.message}`);
    }
  }

  findHandlerFiles() {
    const handlerFiles = [];
    
    const scanDirectory = (dir) => {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          scanDirectory(filePath);
        } else if (file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.spec.ts')) {
          handlerFiles.push(filePath);
        }
      }
    };

    if (fs.existsSync(this.apiDir)) {
      scanDirectory(this.apiDir);
    }

    return handlerFiles;
  }

  extractEndpointsFromHandler(handlerFile) {
    const content = fs.readFileSync(handlerFile, 'utf8');
    const endpoints = [];

    // Look for common patterns in Lambda handlers
    const patterns = [
      // Fastify route definitions
      /fastify\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
      // Express-style route definitions  
      /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
      // API Gateway event path patterns
      /event\.httpMethod\s*===\s*['"`](GET|POST|PUT|DELETE|PATCH)['"`].*event\.path\s*===\s*['"`]([^'"`]+)['"`]/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        endpoints.push({
          method: match[1].toUpperCase(),
          path: match[2],
          file: handlerFile
        });
      }
    }

    return endpoints;
  }

  extractEnvVarsFromHandler(handlerFile) {
    const content = fs.readFileSync(handlerFile, 'utf8');
    const envVars = new Set();

    // Extract process.env.VARIABLE_NAME patterns
    const envPattern = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
    let match;
    
    while ((match = envPattern.exec(content)) !== null) {
      envVars.add(match[1]);
    }

    return Array.from(envVars);
  }

  readApiGatewayConfig() {
    const apiGatewayPath = path.join(this.infrastructureDir, 'api-gateway-stack.ts');
    
    if (!fs.existsSync(apiGatewayPath)) {
      this.warnings.push('⚠️  API Gateway stack file not found');
      return '';
    }

    return fs.readFileSync(apiGatewayPath, 'utf8');
  }

  readLambdaStackConfig() {
    const lambdaStackPath = path.join(this.infrastructureDir, 'lambda-stack.ts');
    
    if (!fs.existsSync(lambdaStackPath)) {
      this.warnings.push('⚠️  Lambda stack file not found');
      return '';
    }

    return fs.readFileSync(lambdaStackPath, 'utf8');
  }

  readDockerComposeConfig() {
    const dockerComposePath = path.join(process.cwd(), 'docker-compose.yml');
    
    if (!fs.existsSync(dockerComposePath)) {
      this.warnings.push('⚠️  docker-compose.yml not found');
      return '';
    }

    return fs.readFileSync(dockerComposePath, 'utf8');
  }

  isEndpointInApiGateway(endpoint, apiGatewayConfig) {
    // Simple pattern matching - could be enhanced with AST parsing
    const pathPattern = endpoint.path.replace(/\{[^}]+\}/g, '\\{[^}]+\\}'); // Convert {id} to regex
    const routeRegex = new RegExp(`${endpoint.method}.*['"\`]${pathPattern}['"\`]`, 'i');
    
    return routeRegex.test(apiGatewayConfig);
  }

  isLambdaInStack(functionName, lambdaStackConfig) {
    // Look for function name in Lambda stack configuration
    return lambdaStackConfig.includes(functionName);
  }

  isEnvVarInDockerCompose(envVar, dockerComposeConfig) {
    return dockerComposeConfig.includes(envVar);
  }

  isEnvVarInLambdaStack(envVar, lambdaStackConfig) {
    return lambdaStackConfig.includes(envVar);
  }

  deriveFunctionName(handlerFile) {
    // Convert file path to function name
    const relativePath = path.relative(this.apiDir, handlerFile);
    const functionName = relativePath
      .replace(/\.ts$/, '')
      .replace(/[\/\\]/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '');
    
    return functionName;
  }

  printResults() {
    console.log('\n📋 Infrastructure Validation Results:');
    console.log('='  .repeat(50));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All infrastructure validations passed!');
    } else {
      if (this.errors.length > 0) {
        console.log(`\n❌ ${this.errors.length} Error(s) Found:`);
        this.errors.forEach(error => console.log(`   ${error}`));
      }

      if (this.warnings.length > 0) {
        console.log(`\n⚠️  ${this.warnings.length} Warning(s):`);
        this.warnings.forEach(warning => console.log(`   ${warning}`));
      }
    }

    console.log('\n💡 To fix infrastructure issues:');
    console.log('   1. Update infrastructure CDK files');
    console.log('   2. Run "npm run infrastructure:plan" to see changes');
    console.log('   3. Run this validator again');
    console.log('='  .repeat(50));
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new InfrastructureValidator();
  const success = validator.validateAll();
  process.exit(success ? 0 : 1);
}

module.exports = InfrastructureValidator;