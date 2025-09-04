# Command Reference

This document provides a comprehensive reference for all available npm scripts in the RegularTravelManager project after the package.json refactoring.

## Quick Reference

### Most Common Commands
```bash
npm run run:local:setup   # Complete development setup + start everything
npm run build             # Build entire project
npm run test              # Run all tests
npm run deploy            # Build + deploy to AWS
```

## Organized Command Structure

### 🔨 Build Commands
```bash
npm run build                     # Build entire project (packages → domains → apps → infrastructure)
npm run build:packages           # Build shared packages only
npm run build:domains            # Build domain packages only
npm run build:apps               # Build API and web applications only
npm run build:infrastructure     # Build AWS CDK infrastructure only
```

### 🚀 Deploy Commands
```bash
npm run deploy                   # Build + deploy to default environment
npm run deploy:staging           # Build + deploy to staging environment
npm run deploy:production        # Build + deploy to production environment
```

### ▶️ Run Commands - Local Development
```bash
npm run run:local:setup          # Complete setup + start API & web apps (RECOMMENDED)
npm run run:local                # Alias for run:local:setup
npm run run:local:api            # Start API server only
npm run run:local:web            # Start Angular app only
npm run run:local:env            # Start infrastructure services (Docker)
npm run run:local:env:logs       # View service logs
npm run run:local:env:restart    # Clean restart with complete setup
npm run run:local:env:clean      # Stop and remove all containers
```

### ☁️ Run Commands - AWS/LocalStack
```bash
npm run run:aws:localstack         # Start LocalStack with initialization
npm run run:aws:localstack:status  # Check LocalStack health
npm run run:aws:localstack:pro     # Switch to LocalStack Pro mode  
npm run run:aws:localstack:community # Switch to LocalStack Community mode
npm run run:aws:sam                # Start SAM local API Gateway
```

### 🗄️ Database Commands
```bash
npm run db:setup                 # Run migrations + load sample data
npm run db:migrate               # Run database migrations only
npm run db:seed                  # Load comprehensive sample data only
npm run db:status                # Check migration status
npm run db:reset                 # Reset database and reload (⚠️ Removes all data)
npm run db:validate              # Validate sample data integrity
```

### 🧪 Test Commands
```bash
npm run test                     # All tests
npm run test:integration         # Integration tests against LocalStack
npm run test:e2e                 # E2E tests in local environment
```

### 🛠️ Utility Commands
```bash
npm run clean                    # Clean build artifacts and cache
npm run lint                     # Run ESLint with auto-fix
npm run format                   # Format code with Prettier
npm run type-check               # TypeScript type checking
npm run debug:api                # Start API in debug mode
npm run logs:localstack          # View LocalStack container logs
npm run logs:postgres            # View PostgreSQL container logs
npm run logs:redis               # View Redis container logs
```

## Legacy Aliases (Backward Compatibility)

All existing commands continue to work via aliases:

```bash
# Legacy command                 # New command
npm run dev                   →  npm run run:local:setup
npm run dev:full              →  npm run run:local:setup  
npm run dev:api               →  npm run run:local:api
npm run dev:web               →  npm run run:local:web
npm run dev:env               →  npm run run:local:env
npm run dev:setup             →  npm run run:local:env && ./scripts/setup-development.sh
npm run dev:env:logs          →  npm run run:local:env:logs
npm run dev:env:clean         →  npm run run:local:env:clean
npm run dev:env:restart       →  npm run run:local:env:restart
npm run dev:api:local         →  cd apps/api && NODE_ENV=development npm run dev
npm run test:e2e:local        →  npm run test:e2e
npm run sam:local             →  npm run run:aws:sam
npm run localstack:status     →  npm run run:aws:localstack:status
npm run localstack:pro        →  npm run run:aws:localstack:pro
npm run localstack:community  →  npm run run:aws:localstack:community
```

## Command Naming Convention

The new command structure follows these patterns:

- **`build:`** - Building/compilation commands
- **`deploy:`** - Deployment commands  
- **`run:local:`** - Local development commands
- **`run:aws:`** - AWS/LocalStack commands
- **`db:`** - Database management commands
- **`test:`** - Testing commands

## Environment-Specific Workflows

### First Time Setup
```bash
git clone <repository-url>
cd RegularTravelManager
npm install
npm run run:local:setup
./test-setup.sh
```

### Daily Development
```bash
npm run run:local:setup        # Start everything
# ... develop ...
npm run test                   # Run tests
npm run lint                   # Check code quality
```

### Before Deployment
```bash
npm run build                  # Build all components
npm run test                   # Run all tests
npm run deploy:staging         # Deploy to staging
# ... test staging ...
npm run deploy:production      # Deploy to production
```

### Troubleshooting
```bash
npm run run:local:env:restart  # Clean restart services
npm run run:aws:localstack:status # Check LocalStack
npm run logs:localstack        # View LocalStack logs
npm run logs:postgres          # View database logs
```

## Benefits of New Structure

✅ **Clear Organization** - Commands grouped by purpose  
✅ **Consistent Naming** - Predictable command patterns  
✅ **Environment Separation** - Clear local vs AWS distinction  
✅ **Backward Compatibility** - All old commands still work  
✅ **Easier Discovery** - Logical grouping helps find commands  
✅ **Better Documentation** - Self-documenting command structure  

## Migration Guide

### For Existing Developers
- Continue using existing commands (they're aliased)
- Gradually adopt new command structure
- Update any scripts or documentation

### For New Developers  
- Use the new organized command structure
- Start with `npm run run:local:setup`
- Refer to this document for command reference

## Support

For questions about commands or issues:
1. Check this reference document
2. Run `./test-setup.sh` to verify environment
3. Check service logs with `npm run run:local:env:logs`