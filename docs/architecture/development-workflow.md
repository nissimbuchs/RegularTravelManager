# Development Workflow

## Local Development Setup (LocalStack + Docker Compose)

### Prerequisites
- **Node.js** 20.0.0 or higher
- **npm** 9.0.0 or higher  
- **Docker Desktop** with Docker Compose
- **Git**

### Quick Start (< 15 minutes)

```bash
# 1. Clone and install
npm install

# 2. Start development environment (complete setup + start apps)
npm run run:local:setup   # Complete setup + start API & web apps
./test-setup.sh          # Verify environment health

# Alternative: individual commands
npm run run:local:env           # Start infrastructure only (PostgreSQL, Redis, LocalStack)
npm run run:aws:localstack      # Initialize AWS services (DynamoDB, S3)
npm run run:local:api           # API server against local infrastructure  
npm run run:local:web           # Angular frontend
```

### Development Environment Benefits
✅ **< 15 minute setup** for new developers  
✅ **95% production parity** with real AWS behavior  
✅ **Zero cost** for AWS services during development  
✅ **Offline development** capability  
✅ **Same codebase** deploys to all environments

## Environment Management Commands

```bash
# Quick commands (recommended)
npm run run:local:setup   # Complete setup + start everything
npm run run:local         # Alias for run:local:setup

# Environment management
npm run run:local:env           # Start all Docker services
npm run run:local:env:logs      # View service logs  
npm run run:local:env:clean     # Stop & remove all containers
npm run run:local:env:restart   # Clean restart all services

# Development servers
npm run run:local:api           # API server only
npm run run:local:web           # Angular app only

# AWS/LocalStack
npm run run:aws:localstack            # Start LocalStack + initialization
npm run run:aws:localstack:status     # Check LocalStack health

# Utilities
./test-setup.sh          # Verify environment

# Legacy aliases (backward compatibility)
npm run dev               # Same as run:local:setup
npm run dev:env           # Same as run:local:env
npm run localstack:status # Same as run:aws:localstack:status
```

## Automatic Environment Configuration

The development environment automatically detects and configures services:

```typescript
// apps/api/src/config/environment.ts
export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  AWS_ENDPOINT_URL: isLocal ? 'http://localhost:4566' : undefined,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://nissim:devpass123@localhost:5432/travel_manager_dev',
  
  // Auto-switches between local and production AWS services
  COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || 'local-pool-id',
  S3_BUCKET_NAME: isLocal ? 'rtm-documents-dev' : 'rtm-documents-prod'
};
```
