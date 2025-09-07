#!/usr/bin/env node

/**
 * Story Infrastructure Checker
 * Interactive tool to help developers complete infrastructure checklist for their stories
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class StoryInfrastructureChecker {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.checklist = {
      frontend: [],
      backend: [],
      infrastructure: [],
      environment: [],
    };
  }

  async runInteractiveCheck() {
    console.log('🚀 Story Infrastructure Checker');
    console.log('='.repeat(40));
    console.log('This tool helps ensure your story has all required infrastructure updates.\n');

    const storyName = await this.ask('📝 What is your story name/ID? ');
    console.log(`\nChecking infrastructure requirements for: ${storyName}\n`);

    await this.checkFrontendChanges();
    await this.checkBackendChanges();
    await this.checkInfrastructureChanges();
    await this.checkEnvironmentChanges();

    this.generateSummary(storyName);
    this.rl.close();
  }

  async checkFrontendChanges() {
    console.log('🎨 Frontend Changes Assessment');
    console.log('-'.repeat(30));

    if (await this.askYesNo('Will you create new Angular components or pages?')) {
      const components = await this.ask('List the component names (comma-separated): ');
      this.checklist.frontend.push(`New components: ${components}`);
    }

    if (await this.askYesNo('Will you need new NgRx actions, effects, or selectors?')) {
      const stateChanges = await this.ask('Describe the state management changes: ');
      this.checklist.frontend.push(`State management: ${stateChanges}`);
    }

    if (await this.askYesNo('Will you add new routes or modify routing?')) {
      const routes = await this.ask('List the new/modified routes: ');
      this.checklist.frontend.push(`Routing changes: ${routes}`);
    }

    if (await this.askYesNo('Will you need new HTTP service methods for API calls?')) {
      const services = await this.ask('Describe the API integration changes: ');
      this.checklist.frontend.push(`API integration: ${services}`);
    }

    console.log('');
  }

  async checkBackendChanges() {
    console.log('⚡ Backend Changes Assessment');
    console.log('-'.repeat(30));

    if (await this.askYesNo('Will you create new API endpoints?')) {
      const endpoints = await this.ask('List endpoints (e.g., POST /users, GET /users/{id}): ');
      this.checklist.backend.push(`New API endpoints: ${endpoints}`);

      const lambdaFunctions = await this.ask('List Lambda handler files needed: ');
      this.checklist.backend.push(`Lambda functions: ${lambdaFunctions}`);
    }

    if (await this.askYesNo('Will you modify the database schema?')) {
      const dbChanges = await this.ask('Describe database changes (tables, columns, indexes): ');
      this.checklist.backend.push(`Database changes: ${dbChanges}`);

      const migration = await this.ask('Migration script name: ');
      this.checklist.backend.push(`Migration: ${migration}`);
    }

    if (await this.askYesNo('Will you modify authentication or authorization?')) {
      const authChanges = await this.ask('Describe auth changes: ');
      this.checklist.backend.push(`Auth changes: ${authChanges}`);
    }

    console.log('');
  }

  async checkInfrastructureChanges() {
    console.log('🏗️  Infrastructure Changes Assessment');
    console.log('-'.repeat(35));

    if (this.checklist.backend.some(item => item.includes('endpoints'))) {
      console.log('⚠️  Detected API endpoints - API Gateway routes required!');
      this.checklist.infrastructure.push(
        '✅ Update API Gateway routes in infrastructure/src/api-gateway-stack.ts'
      );
    }

    if (this.checklist.backend.some(item => item.includes('Lambda'))) {
      console.log('⚠️  Detected Lambda functions - CDK Lambda stack update required!');
      this.checklist.infrastructure.push(
        '✅ Update Lambda functions in infrastructure/src/lambda-stack.ts'
      );
    }

    if (await this.askYesNo('Will you need new environment variables?')) {
      const envVars = await this.ask('List environment variables needed: ');
      this.checklist.infrastructure.push(`Environment variables: ${envVars}`);
    }

    if (await this.askYesNo('Will you need new IAM permissions?')) {
      const permissions = await this.ask('Describe required permissions: ');
      this.checklist.infrastructure.push(`IAM permissions: ${permissions}`);
    }

    if (await this.askYesNo('Will you use additional AWS services (S3, SES, etc.)?')) {
      const services = await this.ask('List AWS services: ');
      this.checklist.infrastructure.push(`AWS services: ${services}`);
    }

    console.log('');
  }

  async checkEnvironmentChanges() {
    console.log('🐳 Development Environment Changes');
    console.log('-'.repeat(35));

    if (await this.askYesNo('Will you need new Docker services in development?')) {
      const services = await this.ask('Describe Docker services needed: ');
      this.checklist.environment.push(`Docker services: ${services}`);
    }

    if (await this.askYesNo('Will you need new LocalStack services?')) {
      const localstack = await this.ask('List LocalStack services: ');
      this.checklist.environment.push(`LocalStack services: ${localstack}`);
    }

    if (await this.askYesNo('Will you need new sample/seed data?')) {
      const seedData = await this.ask('Describe sample data changes: ');
      this.checklist.environment.push(`Sample data: ${seedData}`);
    }

    console.log('');
  }

  generateSummary(storyName) {
    console.log('📋 Infrastructure Checklist Summary');
    console.log('='.repeat(40));

    const hasInfrastructureWork =
      this.checklist.backend.length > 0 ||
      this.checklist.infrastructure.length > 0 ||
      this.checklist.environment.length > 0;

    if (!hasInfrastructureWork) {
      console.log('✅ No infrastructure changes required for this story!');
      console.log('   You can proceed with development.');
      return;
    }

    console.log(`\n🚨 INFRASTRUCTURE WORK REQUIRED for ${storyName}:\n`);

    if (this.checklist.frontend.length > 0) {
      console.log('🎨 Frontend:');
      this.checklist.frontend.forEach(item => console.log(`   • ${item}`));
      console.log('');
    }

    if (this.checklist.backend.length > 0) {
      console.log('⚡ Backend:');
      this.checklist.backend.forEach(item => console.log(`   • ${item}`));
      console.log('');
    }

    if (this.checklist.infrastructure.length > 0) {
      console.log('🏗️  Infrastructure (CDK):');
      this.checklist.infrastructure.forEach(item => console.log(`   • ${item}`));
      console.log('');
    }

    if (this.checklist.environment.length > 0) {
      console.log('🐳 Development Environment:');
      this.checklist.environment.forEach(item => console.log(`   • ${item}`));
      console.log('');
    }

    console.log('📝 Next Steps:');
    console.log('   1. Complete all infrastructure items above');
    console.log('   2. Run "npm run infrastructure:validate" to check your work');
    console.log('   3. Run "npm run infrastructure:plan" to review CDK changes');
    console.log('   4. Include infrastructure checklist in your PR');

    console.log('\n⚠️  IMPORTANT: Do not mark story as complete until infrastructure is updated!');
  }

  async ask(question) {
    return new Promise(resolve => {
      this.rl.question(question, answer => {
        resolve(answer.trim());
      });
    });
  }

  async askYesNo(question) {
    const answer = await this.ask(`${question} (y/n): `);
    return answer.toLowerCase().startsWith('y');
  }
}

// Run checker if called directly
if (require.main === module) {
  const checker = new StoryInfrastructureChecker();
  checker.runInteractiveCheck().catch(console.error);
}

module.exports = StoryInfrastructureChecker;
