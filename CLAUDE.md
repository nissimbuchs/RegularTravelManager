# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RegularTravelManager is a Swiss employee travel allowance management system built with Angular 17+, Node.js Lambda functions, and AWS services. The project uses a **LocalStack development environment** providing 95% AWS production parity for local development.

## Development Commands

### Quick Start
```bash
# Start development environment (< 15 minutes)
npm run dev:env           # Start infrastructure (PostgreSQL, Redis, LocalStack)
npm run localstack:init   # Initialize AWS services (DynamoDB, S3)
./test-setup.sh          # Verify environment health

# Start development
npm run dev:full          # Start everything
npm run dev:api:local     # API server only
npm run dev:web           # Angular app only
```

### Environment Management
```bash
npm run dev:env:logs      # View service logs
npm run dev:env:restart   # Clean restart all services
npm run dev:env:clean     # Stop and remove all containers
npm run localstack:status # Check LocalStack health
```

### Testing Commands
```bash
npm run test              # All tests
npm run test:integration  # Integration tests against LocalStack
npm run test:e2e:local   # E2E tests in local environment
```

## Architecture

### Local Development Stack
- **PostgreSQL** (port 5432) → AWS RDS in production
- **Redis** (port 6379) → AWS ElastiCache in production
- **LocalStack** (port 4566) → AWS Services in production
  - DynamoDB (projects, subprojects)
  - S3 (document storage)
  - Location Service (mocked)

### Technology Stack
- **Frontend**: Angular 17+ with TypeScript, Angular Material UI
- **Backend**: Node.js 20+ with TypeScript, Lambda functions
- **Database**: PostgreSQL 15 with PostGIS extension
- **Infrastructure**: AWS CDK 2.100+ in TypeScript
- **Development**: Docker Compose + LocalStack for AWS parity

### Key Service Configurations
```typescript
// Environment auto-detection
const isLocal = process.env.NODE_ENV === 'development';
const awsEndpoint = isLocal ? 'http://localhost:4566' : undefined;

// Database connection
DATABASE_URL: 'postgresql://nissim:devpass123@localhost:5432/travel_manager_dev'
```

## Development Guidelines

### Before Starting Development
1. **Always run environment health check**: `./test-setup.sh`
2. **Check service logs if issues arise**: `npm run dev:env:logs`
3. **Use LocalStack for all AWS operations in development**
4. **Code should work identically in local and production environments**

### When Adding New Features
- **Use existing AWS service factory** in `apps/api/src/services/aws-factory.ts`
- **Add tests that run against LocalStack services**
- **Update environment configuration if new services needed**
- **Verify changes work in both local and production modes**

### Troubleshooting
- **Services not starting**: `npm run dev:env:restart`
- **LocalStack issues**: `docker logs rtm-localstack`
- **Database issues**: `docker logs rtm-postgres`
- **Reset everything**: `npm run dev:env:clean && npm run dev:env && npm run localstack:init`

## File Structure

```
RegularTravelManager/
├── apps/
│   ├── api/                 # Node.js Lambda functions
│   └── web/                 # Angular frontend
├── docs/
│   ├── architecture.md      # Complete architecture documentation
│   └── DEVELOPMENT_SETUP.md # Detailed setup guide
├── localstack/
│   └── init/               # LocalStack initialization scripts
├── docker-compose.yml      # Development infrastructure
└── test-setup.sh          # Environment verification script
```

## Development Authentication

### Production-Matching Test Users
The development environment uses mock authentication with production-matching test users:

| User | Email | Name | Role | Employee ID |
|------|-------|------|------|-------------|
| **employee1** | employee1@company.com | John Employee | Employee | EMP001 |
| **employee2** | employee2@company.com | Jane Worker | Employee | EMP002 |
| **manager1** | manager1@company.com | Bob Manager | Manager | MGR001 |
| **manager2** | manager2@company.com | Alice Director | Manager | MGR002 |

### Switching Users in Development
In the browser console (F12), run:
```javascript
// Switch to different users (default: employee1)
localStorage.setItem('mockUser', 'employee1');
localStorage.setItem('mockUser', 'employee2');
localStorage.setItem('mockUser', 'manager1');
localStorage.setItem('mockUser', 'manager2');
window.location.reload();
```

### Authentication Architecture
- **Development**: Mock authentication with production user data
- **Production**: AWS Cognito with real user management
- **LocalStack**: Cognito is Pro feature - uses mock authentication
- **User data**: Consistent across frontend auth service and backend API

## Notes

- **Environment parity**: Local development provides 95% AWS production parity
- **Authentication parity**: Production-matching users with easy role switching
- **Cost savings**: ~€200/month per developer using LocalStack vs real AWS
- **Setup time**: < 15 minutes for new developers
- **Offline development**: Full development capability without internet
- **Documentation**: See DEVELOPMENT_SETUP.md for detailed troubleshooting