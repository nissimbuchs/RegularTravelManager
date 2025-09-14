# RegularTravelManager

Employee travel allowance management system built with Angular, Node.js, and AWS CDK.

## 🚀 Live Application Access

**🌐 Production Application (Dev Environment):**
- **Frontend**: https://dz57qvo83kxos.cloudfront.net
- **API Endpoint**: https://1kkd1bbkmh.execute-api.eu-central-1.amazonaws.com/dev/
- **Region**: eu-central-1 (Frankfurt)
- **Database**: `rtm-dev-infrastructure-databaseb269d8bb-ynfofwwlfkkm.c18k2mga4rnh.eu-central-1.rds.amazonaws.com`
- **Cognito User Pool**: `eu-central-1_LFA9Rhk2y`

## Overview

RegularTravelManager is a comprehensive solution for managing employee travel allowances, enabling employees to submit travel requests and managers to review and approve them. The system calculates distance-based allowances and provides a streamlined workflow for travel expense management.

## Technology Stack

- **Frontend**: Angular 17+ with TypeScript
- **Backend**: Node.js Lambda functions with TypeScript
- **Infrastructure**: AWS CDK 2.100+ in TypeScript
- **Database**: PostgreSQL with PostGIS (AWS RDS in production, Docker locally)
- **Authentication**: AWS Cognito
- **Testing**: Vitest for backend, Jest for Angular frontend
- **Code Quality**: ESLint + Prettier with pre-commit hooks

## Architecture

This project follows a Domain-Driven Design (DDD) approach with a monorepo structure using npm workspaces:

```
RegularTravelManager/
├── domains/                     # Domain Layer (Business Logic)
│   ├── travel-allowance/        # Core travel allowance domain
│   ├── employee-management/     # Employee data management
│   └── project-management/      # Project and location management
├── apps/                        # Application Layer
│   ├── web/                     # Angular 17+ Frontend
│   └── api/                     # Node.js Lambda Functions
├── packages/                    # Shared packages
│   └── shared/                  # Common types and utilities
├── infrastructure/              # AWS CDK Infrastructure as Code
└── docs/                        # Documentation
```

### AWS Infrastructure - 5-Stack CDK Architecture

The project uses a **5-stack CDK architecture** for better separation of concerns and deployment flexibility:

1. **InfrastructureStack** - Core backend resources: VPC, RDS, Cognito, Location Service, SES, SNS
2. **LambdaStack** - All Lambda functions and their configurations (~30 functions)
3. **ApiGatewayStack** - REST API, routes, and Lambda integrations
4. **CertificateStack** - SSL certificates for CloudFront (us-east-1 region)
5. **WebStack** - Frontend hosting: S3, CloudFront, web deployment

**Benefits**: Independent deployments, no circular dependencies, better CI/CD, cost optimization, faster deployments.

## Prerequisites

- **Node.js** 20.0.0 or higher
- **npm** 9.0.0 or higher
- **Docker Desktop** with Docker Compose
- **Git**
- **AWS CLI** (optional, for manual LocalStack testing)

## Quick Start (< 15 minutes)

### 1. Clone and Install
```bash
git clone <repository-url>
cd RegularTravelManager
npm install
```

### 2. Start Development Environment
```bash
# Complete setup (infrastructure + database + sample data)
npm run setup

# Start apps
npm run dev

# Verify setup
./test-setup.sh
```

### 3. Verify Setup

Visit: http://localhost:3000/health (when API is running)

**Expected response:**
```json
{
  "status": "ok",
  "environment": "development",
  "services": {
    "database": "connected",
    "localstack": "ready",
    "redis": "connected"
  }
}
```

## Essential Commands

### Development
```bash
npm run dev                 # Complete development setup + start everything
npm run build               # Build entire project
npm run test                # Run all tests
npm run lint                # Lint and fix code
./test-setup.sh            # Verify environment health
```

### AWS Deployment
```bash
npm run deploy:safe:dev          # Safe deploy to dev (recommended)
npm run deploy:safe:staging      # Safe deploy to staging (recommended)
npm run deploy:safe:production   # Safe deploy to production (recommended)

npm run deploy:frontend:dev      # Deploy frontend only (faster for UI changes)
npm run health:check:dev         # Check environment health
npm run cleanup:logs:dev         # Clean orphaned log groups
```

### Database
```bash
npm run db:setup          # Complete setup: migrations + sample data
npm run db:reset          # Reset database completely
npm run db:validate       # Validate sample data integrity
```

### Environment Management
```bash
npm run dev:restart       # Clean restart all services
npm run dev:clean         # Stop and remove all containers
npm run dev:logs          # View service logs
```

**📖 For complete command reference, see [COMMANDS_REFERENCE.md](./docs/COMMANDS_REFERENCE.md)**

## Sample Data & Authentication

The development environment includes comprehensive Swiss business sample data with 10 test users across admin, manager, and employee roles.

**Quick user switching in development:**
```javascript
// In browser console (F12)
localStorage.setItem('mockUser', 'admin1');     // Hans Zimmermann (CEO)
localStorage.setItem('mockUser', 'manager1');   // Thomas Müller
localStorage.setItem('mockUser', 'employee1');  // Anna Schneider
window.location.reload();
```

**AWS Production Access:**
- **URL**: https://dz57qvo83kxos.cloudfront.net
- **Admin**: admin1@company.ch / `AdminPass123!Test`
- **Manager**: manager1@company.ch / `ManagerPass123!`
- **Employee**: employee1@company.ch / `EmployeePass123!`

**📖 For complete user details, see [SAMPLE_DATA.md](./docs/SAMPLE_DATA.md)**

## Environment Configuration

| Environment | Frontend URL | API Access | Authentication |
|-------------|--------------|-------------|----------------|
| **Local Development** | `http://localhost:4200` | `http://localhost:3000` | Mock authentication |
| **AWS Dev** | `https://dz57qvo83kxos.cloudfront.net` | `/api/*` (CloudFront proxy) | AWS Cognito |
| **AWS Staging** | Staging CloudFront URL | `/api/*` (CloudFront proxy) | AWS Cognito |
| **AWS Production** | Production CloudFront URL | `/api/*` (CloudFront proxy) | AWS Cognito |

## Development Benefits

✅ **< 15 minute setup** for new developers
✅ **Full offline development** - no internet required
✅ **95% production parity** with LocalStack
✅ **Cost savings** - ~€200/month per developer
✅ **Zero code changes** between local and production
✅ **Consistent behavior** across environments

## Building & Deployment

### Build Once, Deploy Everywhere
```bash
npm run build                    # Creates single production-optimized artifact
npm run deploy:safe:dev          # Deploys artifact to dev with dev config
npm run deploy:safe:staging      # Deploys same artifact to staging with staging config
npm run deploy:safe:production   # Deploys same artifact to production with production config
```

**Runtime Configuration**: Environment-specific configuration is injected at deployment time, ensuring true portability.

### Safe Deployment Process
1. Health check identifies potential conflicts
2. Cleanup orphaned CloudWatch log groups
3. Build all workspaces (packages, domains, apps, infrastructure)
4. Deploy 5 CDK stacks in correct order
5. Output deployment URLs and status

**Prerequisites for AWS Deployment:**
- AWS CLI configured with appropriate credentials
- AWS CDK CLI: `npm install -g aws-cdk`
- AWS account bootstrapped: `cd infrastructure && npm run bootstrap`

## Workspace Organization

- **`domains/`**: Business logic organized by bounded contexts
- **`apps/web/`**: Angular frontend application
- **`apps/api/`**: Node.js Lambda functions
- **`packages/shared/`**: Common types and utilities
- **`infrastructure/`**: AWS CDK infrastructure code

## Development Guidelines

- **Type Sharing**: Define types in `packages/shared`
- **State Management**: RxJS services with BehaviorSubjects
- **Error Handling**: Standardized error interceptors and handlers
- **Testing**: 80% minimum coverage, comprehensive integration tests
- **Code Quality**: ESLint + Prettier with pre-commit hooks

**📖 For complete development standards, see [docs/architecture/07-development-standards.md](./docs/architecture/07-development-standards.md)**

## Troubleshooting

### Common Issues
```bash
# Services not starting
npm run dev:restart

# LocalStack issues
npm run aws:local:status
docker logs rtm-localstack

# Database issues
npm run db:status
npm run db:validate

# Deployment issues
npm run health:check:dev
npm run cleanup:logs:dev
```

**📖 For detailed troubleshooting, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**

## Contributing

1. **Branching**: Use feature branches with descriptive names
2. **Commits**: Follow conventional commit format
3. **Code Quality**: All code must pass linting and tests
4. **Testing**: Write tests for new features and bug fixes
5. **Documentation**: Update documentation for significant changes

## Documentation

- **[FAQ.md](./docs/FAQ.md)** - Frequently asked questions
- **[COMMANDS_REFERENCE.md](./docs/COMMANDS_REFERENCE.md)** - Complete command reference
- **[SAMPLE_DATA.md](./docs/SAMPLE_DATA.md)** - Development users and test data
- **[DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md)** - Comprehensive setup guide
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Deployment issues and solutions
- **[ENVIRONMENTS.md](./ENVIRONMENTS.md)** - Environment configuration guide
- **[docs/architecture/](./docs/architecture/)** - Technical architecture documentation

## Support

For questions or support:
1. Check [FAQ.md](./docs/FAQ.md) for common questions
2. Review relevant documentation above
3. Run `./test-setup.sh` to verify environment health
4. Create an issue in the project repository

## License

This project is proprietary software. All rights reserved.