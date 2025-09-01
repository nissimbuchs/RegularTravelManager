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

# 2. Start development environment
npm run dev:env           # Start infrastructure (PostgreSQL, Redis, LocalStack)
npm run localstack:init   # Initialize AWS services (DynamoDB, S3)
./test-setup.sh          # Verify environment health

# 3. Start development
npm run dev:full          # Start infrastructure + API + web app
npm run dev:api:local     # API server against local infrastructure  
npm run dev:web           # Angular frontend
```

### Development Environment Benefits
✅ **< 15 minute setup** for new developers  
✅ **95% production parity** with real AWS behavior  
✅ **Zero cost** for AWS services during development  
✅ **Offline development** capability  
✅ **Same codebase** deploys to all environments

## Environment Management Commands

```bash
# Environment management
npm run dev:env           # Start all Docker services
npm run dev:env:logs      # View service logs  
npm run dev:env:clean     # Stop & remove all containers
npm run dev:env:restart   # Clean restart all services

# Development servers
npm run dev:full          # Start everything
npm run dev:api:local     # API server only
npm run dev:web           # Angular app only

# Utilities
npm run localstack:status # Check LocalStack health
./test-setup.sh          # Verify environment
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
