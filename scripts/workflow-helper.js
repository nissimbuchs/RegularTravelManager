#!/usr/bin/env node

/**
 * Development Workflow Helper
 * Provides developers with guided workflow commands for infrastructure-aware development
 */

const { execSync } = require('child_process');
const readline = require('readline');

class WorkflowHelper {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async runGuidedWorkflow() {
    console.log('🚀 RegularTravelManager Development Workflow Helper');
    console.log('='  .repeat(50));
    
    const action = await this.ask(`
What would you like to do?
1. Start working on a new story (infrastructure assessment)
2. Complete story work (infrastructure validation)
3. Generate infrastructure from features
4. Validate current infrastructure state
5. Plan infrastructure changes (CDK diff)
6. Quick development setup

Enter your choice (1-6): `);

    switch (action.trim()) {
      case '1':
        await this.startStoryWorkflow();
        break;
      case '2':
        await this.completeStoryWorkflow();
        break;
      case '3':
        await this.generateInfrastructureWorkflow();
        break;
      case '4':
        await this.validateInfrastructureWorkflow();
        break;
      case '5':
        await this.planInfrastructureWorkflow();
        break;
      case '6':
        await this.quickSetupWorkflow();
        break;
      default:
        console.log('❌ Invalid choice. Please run the script again.');
    }

    this.rl.close();
  }

  async startStoryWorkflow() {
    console.log('\n📝 Starting Story Workflow - Infrastructure Assessment');
    console.log('-'  .repeat(50));
    
    console.log('Running story infrastructure checker...\n');
    
    try {
      execSync('npm run story:start', { stdio: 'inherit' });
    } catch (error) {
      console.log('❌ Story infrastructure checker failed');
      process.exit(1);
    }
  }

  async completeStoryWorkflow() {
    console.log('\n✅ Completing Story Workflow - Infrastructure Validation');
    console.log('-'  .repeat(55));
    
    console.log('Step 1: Validating infrastructure consistency...\n');
    
    try {
      execSync('npm run infrastructure:validate', { stdio: 'inherit' });
      console.log('\n✅ Infrastructure validation passed!');
    } catch (error) {
      console.log('\n❌ Infrastructure validation failed!');
      console.log('Please fix the infrastructure issues before completing your story.');
      return;
    }

    console.log('\nStep 2: Reviewing infrastructure changes...\n');
    
    try {
      execSync('npm run infrastructure:plan', { stdio: 'inherit' });
      
      const proceed = await this.ask('\nDo the infrastructure changes look correct? (y/n): ');
      
      if (proceed.toLowerCase().startsWith('y')) {
        console.log('\n🎉 Story infrastructure validation complete!');
        console.log('Your story is ready for code review and deployment.');
      } else {
        console.log('\n⚠️  Please review and fix the infrastructure changes.');
        console.log('Run this workflow again after making corrections.');
      }
    } catch (error) {
      console.log('\n❌ Infrastructure planning failed');
      console.log('Please check your CDK configuration.');
    }
  }

  async generateInfrastructureWorkflow() {
    console.log('\n🏗️  Generating Infrastructure from Feature Definitions');
    console.log('-'  .repeat(55));
    
    try {
      execSync('npm run infrastructure:generate', { stdio: 'inherit' });
      console.log('\n✅ Infrastructure generation complete!');
      console.log('Generated CDK templates are ready for customization.');
    } catch (error) {
      console.log('\n❌ Infrastructure generation failed');
    }
  }

  async validateInfrastructureWorkflow() {
    console.log('\n🔍 Validating Current Infrastructure State');
    console.log('-'  .repeat(40));
    
    try {
      execSync('npm run infrastructure:validate', { stdio: 'inherit' });
      console.log('\n✅ Infrastructure validation complete!');
    } catch (error) {
      console.log('\n❌ Infrastructure validation found issues');
      console.log('Please review the errors above and fix them.');
    }
  }

  async planInfrastructureWorkflow() {
    console.log('\n📋 Planning Infrastructure Changes (CDK Diff)');
    console.log('-'  .repeat(45));
    
    try {
      execSync('npm run infrastructure:plan', { stdio: 'inherit' });
    } catch (error) {
      console.log('\n❌ Infrastructure planning failed');
      console.log('Please check your CDK configuration.');
    }
  }

  async quickSetupWorkflow() {
    console.log('\n⚡ Quick Development Environment Setup');
    console.log('-'  .repeat(40));
    
    console.log('Step 1: Starting development environment...');
    try {
      execSync('npm run dev:env', { stdio: 'inherit' });
    } catch (error) {
      console.log('❌ Failed to start development environment');
      return;
    }

    console.log('\nStep 2: Setting up database...');
    try {
      execSync('npm run db:setup', { stdio: 'inherit' });
    } catch (error) {
      console.log('❌ Failed to setup database');
      return;
    }

    console.log('\nStep 3: Validating environment health...');
    try {
      execSync('./test-setup.sh', { stdio: 'inherit' });
      console.log('\n🎉 Development environment ready!');
      console.log('You can now start development with "npm run dev"');
    } catch (error) {
      console.log('\n⚠️  Environment health check failed');
      console.log('Please check the logs and fix any issues.');
    }
  }

  async ask(question) {
    return new Promise(resolve => {
      this.rl.question(question, answer => {
        resolve(answer.trim());
      });
    });
  }
}

// Run workflow helper if called directly
if (require.main === module) {
  const helper = new WorkflowHelper();
  helper.runGuidedWorkflow().catch(console.error);
}

module.exports = WorkflowHelper;