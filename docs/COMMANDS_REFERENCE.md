# Commands Reference

This document provides a comprehensive reference for all available npm scripts in the RegularTravelManager project.

## Quick Reference - Essential Commands

```bash
npm run dev                 # Complete development setup + start everything
npm run build               # Build entire project
npm run deploy:dev          # Deploy all stacks to dev
npm run deploy:safe:dev     # Safe deploy with health checks (recommended)
npm run test                # Run all tests
./test-setup.sh            # Verify environment health
```

## Development Environment Commands

### Essential Development
```bash
npm run dev                 # Complete setup + start everything (recommended)
npm run build               # Build entire project
npm run test                # Run all tests
npm run lint                # Lint and fix code
npm run format              # Format code with Prettier
npm run clean               # Clean build artifacts and cache
```

### Development Environment Management
```bash
npm run dev:env             # Start infrastructure services only (Docker)
npm run dev:api             # Start API server only
npm run dev:web             # Start Angular app only
npm run dev:setup           # Setup infrastructure + database only
npm run dev:logs            # View service logs
npm run dev:clean           # Stop and remove all containers
npm run dev:restart         # Clean restart with complete setup
```

### Build Commands (Environment-Independent)
```bash
npm run build               # Build entire project (production-optimized)
npm run build:packages      # Build shared packages only
npm run build:apps          # Build API and web applications only
npm run build:frontend      # Build web application only
npm run build:infrastructure # Build AWS CDK infrastructure only
```

## AWS Deployment Commands

### Safe Deployment (Recommended)
```bash
npm run deploy:safe:dev          # Safe deploy to dev with health checks
npm run deploy:safe:staging      # Safe deploy to staging with health checks
npm run deploy:safe:production   # Safe deploy to production with health checks
```

### Full Stack Deployment
```bash
npm run deploy:dev               # Deploy all stacks to dev environment
npm run deploy:staging           # Deploy all stacks to staging environment
npm run deploy:production        # Deploy all stacks to production environment
```

### Frontend-Only Deployment (Faster for UI Changes)
```bash
npm run deploy:frontend:dev      # Deploy frontend to dev environment
npm run deploy:frontend:staging  # Deploy frontend to staging environment
npm run deploy:frontend:production # Deploy frontend to production environment
```

### Infrastructure Workspace Commands (from infrastructure directory)
```bash
cd infrastructure

# Full deployment
npm run deploy:dev               # Deploy all stacks to dev
npm run deploy:staging           # Deploy all stacks to staging
npm run deploy:production        # Deploy all stacks to production

# Individual stack deployment
npm run deploy:stack:infrastructure:dev  # Deploy core infrastructure only
npm run deploy:stack:lambda:dev         # Deploy Lambda functions only
npm run deploy:stack:api:dev            # Deploy API Gateway only
npm run deploy:stack:certificate:dev    # Deploy SSL certificates (us-east-1)
npm run deploy:stack:web:dev            # Deploy web stack only

# Web-specific deployments (includes certificate + web stacks)
npm run deploy:web:dev           # Deploy certificates + web for dev
npm run deploy:web:staging       # Deploy certificates + web for staging
npm run deploy:web:production    # Deploy certificates + web for production
```

### Health Checks and Cleanup
```bash
npm run health:check:dev         # Check dev environment health
npm run health:check:staging     # Check staging environment health
npm run health:check:production  # Check production environment health

npm run cleanup:logs:dev         # Clean orphaned log groups (dev)
npm run cleanup:logs:staging     # Clean orphaned log groups (staging)
npm run cleanup:logs:production  # Clean orphaned log groups (production)
```

### Environment Destruction with Cleanup
```bash
npm run destroy:clean:dev        # Destroy dev + clean log groups
npm run destroy:clean:staging    # Destroy staging + clean log groups
npm run destroy:clean:production # Destroy production + clean log groups
```

### Web Configuration Sync
```bash
npm run sync:web:dev             # Generate web config for dev
npm run sync:web:staging         # Generate web config for staging
npm run sync:web:production      # Generate web config for production
```

## Database Management Commands

```bash
npm run db:setup          # Complete setup: migrations + sample data with dynamic Cognito users
npm run db:migrate        # Run incremental schema migrations only
npm run db:seed           # Load sample data only (infrastructure/data/sample-data.sql)
npm run db:status         # Check current migration status
npm run db:reset          # Reset database completely (⚠️ Removes all data)
npm run db:validate       # Validate sample data integrity
```

**Database Setup Flow:**
1. **Schema Creation**: Professional migration system with version control
2. **Cognito Integration**: Automatically creates test users in Cognito with real IDs
3. **Sample Data**: Single source of truth with Swiss business data
4. **Consistency**: Same setup process across all environments

## Testing Commands

```bash
npm run test              # All tests in all workspaces
npm run test:integration  # Integration tests against LocalStack
npm run test:e2e          # E2E tests
npm run format            # Format code with Prettier
```

## AWS/LocalStack Commands

```bash
npm run aws:local:start   # Start LocalStack with initialization
npm run aws:local:status  # Check LocalStack health
npm run aws:local:init    # Initialize LocalStack services
```

## Project Cleanup Commands

```bash
npm run clean:all         # Complete nuclear cleanup - fresh start
npm run clean:docker      # Stop and remove Docker containers/volumes
npm run clean:deps        # Remove all node_modules and package-lock files
npm run clean:build       # Remove build artifacts and TypeScript cache
npm run clean:cache       # Clear development tool caches
```

**Complete Fresh Start Process:**
```bash
# 1. Complete cleanup
npm run clean:all

# 2. Fresh install and build
npm install
npm run build

# 3. Setup development environment
npm run dev:setup
```

## Workspace-Specific Commands

```bash
# Frontend (apps/web)
npm run dev --workspace=apps/web
npm run build --workspace=apps/web
npm run test --workspace=apps/web

# API (apps/api)
npm run dev --workspace=apps/api
npm run build --workspace=apps/api
npm run test --workspace=apps/api

# Infrastructure
npm run build --workspace=infrastructure
npm run deploy --workspace=infrastructure
npm run destroy --workspace=infrastructure
```

## Environment-Specific Workflows

### First Time Setup (< 15 minutes)
```bash
git clone <repository-url>
cd RegularTravelManager
npm install
npm run dev:setup           # Setup infrastructure + database
npm run dev                 # Start development environment
./test-setup.sh            # Verify complete setup
```

### Daily Development Workflow
```bash
npm run dev                 # Start everything
# ... develop and test ...
npm run test               # Run tests before committing
npm run lint               # Check code quality
```

### Deployment Workflow
```bash
# Safe deployment process (recommended)
npm run health:check:dev    # Check environment before deployment
npm run build               # Build all components
npm run test                # Run all tests
npm run deploy:safe:dev     # Safe deploy with health checks

# Deploy to staging for testing
npm run deploy:safe:staging
# ... test staging environment ...

# Deploy to production
npm run deploy:safe:production
```

### Troubleshooting Workflow
```bash
npm run dev:restart         # Clean restart services
npm run aws:local:status    # Check LocalStack health
npm run dev:logs            # View service logs
npm run health:check:dev    # Check deployment health
./test-setup.sh            # Verify complete environment
```

## Command Categories Explained

### Development vs Deployment
- **Local Development**: Runs code directly from source using Docker Compose for fast iteration
- **AWS Deployment**: Uses CDK to provision Lambda functions, S3 buckets, and cloud infrastructure

### Build Once, Deploy Everywhere
- The same production-optimized build artifact is deployed to all AWS environments
- Environment-specific configuration is injected at deployment/runtime
- No need for environment-specific builds

### Safe Deployment Process
1. Health check identifies potential conflicts
2. Cleanup orphaned CloudWatch log groups
3. Build all workspaces (packages, domains, apps, infrastructure)
4. Deploy 5 CDK stacks in correct order (Infrastructure → Lambda → API Gateway → Certificate → Web)
5. Output deployment URLs and status

## Benefits of This Command Structure

✅ **Clear Organization** - Commands grouped by purpose and environment
✅ **Safe Defaults** - Health checks and cleanup built into deployment process
✅ **Environment Separation** - Clear distinction between local dev and AWS deployment
✅ **Flexible Deployment** - Individual stack deployment or full stack deployment options
✅ **Production Ready** - Safe deployment with health monitoring and rollback support
✅ **Developer Friendly** - Fast local development with production parity

## Support and Troubleshooting

For command issues:
1. Check this reference document
2. Run `./test-setup.sh` to verify environment
3. Check service logs: `npm run dev:logs`
4. See [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for deployment issues
5. See [DEVELOPMENT_SETUP.md](../DEVELOPMENT_SETUP.md) for environment setup issues