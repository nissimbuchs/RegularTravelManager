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

## Technology Stack

- **Frontend**: Angular 17+ with TypeScript
- **Backend**: Node.js Lambda functions with TypeScript
- **Infrastructure**: AWS CDK 2.100+ in TypeScript
- **Database**: PostgreSQL with PostGIS (AWS RDS in production, Docker locally)
- **Authentication**: AWS Cognito
- **Testing**: Vitest for backend, Jest for Angular frontend
- **Code Quality**: ESLint + Prettier with pre-commit hooks

## AWS Infrastructure Architecture

The project uses a **5-stack CDK architecture** for better separation of concerns and deployment flexibility:

### Stack Overview

1. **InfrastructureStack** (`rtm-{env}-infrastructure`)
   - Core backend resources: VPC, RDS, Cognito, Location Service, SES, SNS
   - Exports: User Pool ID, Database endpoints, SNS Topic ARN

2. **LambdaStack** (`rtm-{env}-lambda`)
   - All Lambda functions and their configurations
   - Depends on: InfrastructureStack
   - Exports: ~30 Lambda function ARNs

3. **ApiGatewayStack** (`rtm-{env}-api-gateway`)
   - REST API, routes, and Lambda integrations
   - Depends on: LambdaStack (via imports)
   - Exports: API Gateway URL

4. **CertificateStack** (`rtm-{env}-certificate`)
   - SSL certificates for CloudFront distribution
   - Region: us-east-1 (CloudFront requirement)
   - Exports: Certificate ARN for cross-region access

5. **WebStack** (`rtm-{env}-web`)
   - Frontend hosting: S3, CloudFront, web deployment
   - Depends on: ApiGatewayStack + InfrastructureStack + CertificateStack (via imports)
   - Exports: CloudFront domain URL

### Deployment Benefits

- ✅ **Independent deployments**: Update frontend without touching backend
- ✅ **No circular dependencies**: Clean linear dependency chain
- ✅ **Better CI/CD**: Each stack can have its own deployment pipeline
- ✅ **Cost optimization**: Destroy/recreate individual stacks as needed
- ✅ **Faster deployments**: Deploy only what changed

## Prerequisites

- **Node.js** 20.0.0 or higher
- **npm** 9.0.0 or higher  
- **Docker Desktop** with Docker Compose
- **Git**
- **AWS CLI** (optional, for manual LocalStack testing)

## Database Architecture

The project uses a **consolidated database setup approach** with PostgreSQL as the primary database:

- **Schema Management**: API migrations in `apps/api/src/database/migrations/` (source of truth)
- **Sample Data**: Single file at `infrastructure/data/sample-data.sql` with dynamic Cognito user creation
- **Local Development**: PostgreSQL with PostGIS via Docker
- **Production**: AWS RDS PostgreSQL with PostGIS extension
- **Migration System**: Professional incremental migrations with rollback support

**Key Benefits:**
- ✅ Single source of truth for database schema and sample data
- ✅ Automatic Cognito user creation with real user IDs (no hardcoded values)
- ✅ Environment consistency across development, staging, and production
- ✅ Professional migration-based approach with version control

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

**What `npm run dev` does automatically:**
- ✅ Starts infrastructure services (PostgreSQL, Redis, LocalStack)
- ✅ Waits for services to be ready
- ✅ Runs database migrations
- ✅ Loads comprehensive Swiss business sample data
- ✅ Initializes AWS services in LocalStack
- ✅ Starts API server on :3000 and Angular app on :4200
- ✅ Verifies complete environment setup

### 3. Alternative Development Options

```bash
# Option A: Complete setup + start everything (recommended)
npm run dev

# Option B: Start services individually
npm run dev:env           # Infrastructure services only
npm run dev:api           # API server only (after env setup)
npm run dev:web           # Angular app only

# Option C: Environment management
npm run dev:setup         # Setup infrastructure + database only
npm run dev:logs          # View service logs
npm run dev:clean         # Stop and remove all containers
npm run dev:restart       # Clean restart with complete setup
```

### 4. Verify Setup

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

### 5. Development Authentication & Sample Data

The development environment includes comprehensive sample data with production-matching test users:

#### Admin Users (Full System Access)
| User | Email | Name | Role | Employee ID |
|------|-------|------|------|-------------|
| **admin1** | admin1@company.ch | Hans Zimmermann | CEO/Admin | ADM-0001 |
| **admin2** | admin2@company.ch | Maria Weber | IT Admin | ADM-0002 |

#### Managers
| User | Email | Name | Role | Employee ID |
|------|-------|------|------|-------------|
| **manager1** | manager1@company.ch | Thomas Müller | Regional Manager | MGR-0001 |
| **manager2** | manager2@company.ch | Sophie Dubois | Regional Manager | MGR-0002 |

#### Employees
| User | Email | Name | Role | Employee ID | City |
|------|-------|------|------|-------------|------|
| **employee1** | employee1@company.ch | Anna Schneider | Developer | EMP-0001 | Bern |
| **employee2** | employee2@company.ch | Marco Rossi | Project Coordinator | EMP-0002 | Lugano |
| **employee3** | employee3@company.ch | Lisa Meier | Business Analyst | EMP-0003 | St. Gallen |
| **employee4** | employee4@company.ch | Pierre Martin | Marketing Specialist | EMP-0004 | Lausanne |
| **employee5** | employee5@company.ch | Julia Fischer | Technical Consultant | EMP-0005 | Basel |
| **employee6** | employee6@company.ch | Michael Keller | Sales Representative | EMP-0006 | Winterthur |

#### Sample Data Includes:
- **4 Projects**: Digital Transformation, Infrastructure Modernization, Customer Experience, Sustainability
- **8 Subprojects**: Precise Swiss locations with accurate coordinates
- **5 Travel Requests**: Complete lifecycle examples (pending, approved, rejected, withdrawn)
- **Audit Trails**: Status change history and address change tracking
- **Swiss Geographic Coverage**: All major cities with real coordinates

**To switch users in development:**
```javascript
// In browser console (F12) - No passwords required in development

// Admin Users (full system access)
localStorage.setItem('mockUser', 'admin1');     // Hans Zimmermann (CEO)
localStorage.setItem('mockUser', 'admin2');     // Maria Weber (IT Admin)

// Managers
localStorage.setItem('mockUser', 'manager1');   // Thomas Müller
localStorage.setItem('mockUser', 'manager2');   // Sophie Dubois

// Employees (default: employee1)
localStorage.setItem('mockUser', 'employee1');  // Anna Schneider (Bern)
localStorage.setItem('mockUser', 'employee2');  // Marco Rossi (Lugano)
localStorage.setItem('mockUser', 'employee3');  // Lisa Meier (St. Gallen)
localStorage.setItem('mockUser', 'employee4');  // Pierre Martin (Lausanne)
localStorage.setItem('mockUser', 'employee5');  // Julia Fischer (Basel)
localStorage.setItem('mockUser', 'employee6');  // Michael Keller (Winterthur)

window.location.reload();
```

**Mock User ID Mapping (UUID format for consistency):**
- admin1@company.ch → `11111111-1111-1111-1111-111111111111`
- admin2@company.ch → `22222222-2222-2222-2222-222222222222`
- manager1@company.ch → `33333333-3333-3333-3333-333333333333`
- manager2@company.ch → `44444444-4444-4444-4444-444444444444`
- employee1@company.ch → `55555555-5555-5555-5555-555555555555`
- employee2@company.ch → `66666666-6666-6666-6666-666666666666`
- employee3@company.ch → `77777777-7777-7777-7777-777777777777`
- employee4@company.ch → `88888888-8888-8888-8888-888888888888`
- employee5@company.ch → `99999999-9999-9999-9999-999999999999`
- employee6@company.ch → `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`

**Note:** Development uses mock authentication - no passwords required. Production uses AWS Cognito with real authentication.

### 6. AWS Production Environment Access

**🌐 Live Application URL**: https://dz57qvo83kxos.cloudfront.net

#### AWS Cognito Test Users & Passwords

**Admin Users (Full System Access):**
- **admin1@company.ch** (Hans Zimmermann, CEO) - Password: `AdminPass123!Test`
- **admin2@company.ch** (Maria Weber, IT Admin) - Password: `AdminPass123!Test`

**Managers:**
- **manager1@company.ch** (Thomas Müller, Regional Manager) - Password: `ManagerPass123!`
- **manager2@company.ch** (Sophie Dubois, Regional Manager) - Password: `ManagerPass123!`

**Employees:**
- **employee1@company.ch** (Anna Schneider, Developer) - Password: `EmployeePass123!`
- **employee2@company.ch** (Marco Rossi, Project Coordinator) - Password: `EmployeePass123!`
- **employee3@company.ch** (Lisa Meier, Business Analyst) - Password: `EmployeePass123!`
- **employee4@company.ch** (Pierre Martin, Marketing Specialist) - Password: `EmployeePass123!`
- **employee5@company.ch** (Julia Fischer, Technical Consultant) - Password: `EmployeePass123!`
- **employee6@company.ch** (Michael Keller, Sales Representative) - Password: `EmployeePass123!`

**AWS Production Environment Details:**
- **Frontend URL:** `https://dz57qvo83kxos.cloudfront.net` (Angular app with CloudFront CDN)
- **API Endpoint:** `https://1kkd1bbkmh.execute-api.eu-central-1.amazonaws.com/dev/` (available through CloudFront at `/api/*`)
- **Region:** `eu-central-1` (Frankfurt)  
- **Database:** AWS RDS PostgreSQL with complete sample data
- **Authentication:** AWS Cognito User Pool with real user management
- **Architecture:** 5-stack CDK deployment with CloudFront distribution and API Gateway integration

**✅ Available Features:**
- Complete Swiss business sample data (10 employees, 4 projects, 8 subprojects, 5 travel requests)
- Real-time distance calculations with PostGIS
- Travel allowance management workflow
- Manager approval processes
- Admin user and project management
- Comprehensive audit trails

## Environment Configuration

The project uses clear environment naming conventions:

| Environment File | Purpose | Frontend URL | API Access | Authentication |
|------------------|---------|--------------|-------------|----------------|
| `environment.ts` | **Local Development** | `http://localhost:4200` | `http://localhost:3000` | Mock authentication |
| `environment.dev.ts` | **AWS Dev Environment** (Current) | `https://dz57qvo83kxos.cloudfront.net` | `/api/*` (CloudFront proxy) | AWS Cognito authentication |
| `environment.staging.ts` | **AWS Staging** (Future) | Staging CloudFront URL | `/api/*` (CloudFront proxy) | Real Cognito authentication |
| `environment.prod.ts` | **AWS Production** (Future) | Production CloudFront URL | `/api/*` (CloudFront proxy) | Real Cognito authentication |

### Build Commands by Environment
```bash
# Local development (default)
npm run start:local

# Build commands
npm run build                     # Build entire project
npm run build:frontend           # Build frontend only

# Full deployment (all stacks)
npm run deploy:dev               # Deploy all stacks to dev
npm run deploy:staging           # Deploy all stacks to staging
npm run deploy:production        # Deploy all stacks to production

# Safe deployments with health checks (recommended)
npm run deploy:safe:dev          # Safe deploy to dev
npm run deploy:safe:staging      # Safe deploy to staging
npm run deploy:safe:production   # Safe deploy to production

# Frontend-only deployment (faster for UI changes)
npm run deploy:frontend:dev      # Deploy frontend to dev
npm run deploy:frontend:staging  # Deploy frontend to staging
npm run deploy:frontend:production # Deploy frontend to production
```

See [ENVIRONMENTS.md](./ENVIRONMENTS.md) for detailed environment configuration guide.

## Development Environment

### Local AWS Services (LocalStack)

Our development environment provides **95% production parity** using LocalStack:

| Service | Local Port | Production | Description |
|---------|------------|------------|-------------|
| PostgreSQL | :5432 | AWS RDS | Primary database with PostGIS extension |
| Redis | :6379 | ElastiCache | Caching layer |
| LocalStack | :4566 | AWS | S3, Location Service, Lambda, etc. |
| S3 | via :4566 | AWS S3 | Document storage |
| Location Service | via :4566 | AWS Location | Geocoding and mapping |

### Key Benefits

✅ **< 15 minute setup** for new developers  
✅ **Full offline development** - no internet required  
✅ **Cost savings** - ~€200/month per developer  
✅ **Zero code changes** between local and production  
✅ **Consistent behavior** across environments  

### Development Commands

#### **Essential Commands**
```bash
npm run dev               # Complete setup + start everything (recommended)
npm run build             # Build entire project
npm run deploy            # Build + deploy to AWS
npm run test              # Run all tests
npm run lint              # Lint and fix code
npm run clean             # Clean build artifacts
./test-setup.sh          # Verify environment + sample data
```

#### **Development Environment**
```bash
npm run dev:env           # Start infrastructure services only
npm run dev:api           # Start API server only
npm run dev:web           # Start Angular app only
npm run dev:setup         # Setup infrastructure + database only
npm run dev:logs          # View service logs
npm run dev:clean         # Stop and remove all containers
npm run dev:restart       # Clean restart with complete setup
```

#### **Build & Deploy**
```bash
npm run build:packages    # Build shared packages only
npm run build:apps        # Build API and web applications only
npm run build:infrastructure # Build AWS CDK infrastructure only

# Environment-specific frontend builds
npm run build:frontend:dev     # Build for AWS dev environment
npm run build:frontend:staging # Build for AWS staging environment  
npm run build:frontend:prod    # Build for AWS production environment

# Safe deployment commands (recommended)
npm run deploy:safe:dev           # Safe deploy to dev with health checks
npm run deploy:safe:staging       # Safe deploy to staging with health checks
npm run deploy:safe:production    # Safe deploy to production with health checks

# Full stack deployments
npm run deploy:dev                # Deploy all stacks to dev environment
npm run deploy:staging            # Deploy all stacks to staging environment
npm run deploy:production         # Deploy all stacks to production environment

# Frontend-only deployments (faster for UI changes)
npm run deploy:frontend:dev       # Deploy frontend to dev environment
npm run deploy:frontend:staging   # Deploy frontend to staging environment
npm run deploy:frontend:production # Deploy frontend to production environment

# Infrastructure workspace commands (from infrastructure directory)
cd infrastructure
npm run deploy:dev                # Deploy all stacks to dev
npm run deploy:staging            # Deploy all stacks to staging
npm run deploy:production         # Deploy all stacks to production

# Individual stack deployment
npm run deploy:stack:infrastructure:dev    # Deploy core infrastructure only
npm run deploy:stack:lambda:dev           # Deploy Lambda functions only
npm run deploy:stack:api:dev              # Deploy API Gateway only
npm run deploy:stack:certificate:dev      # Deploy SSL certificates (us-east-1)
npm run deploy:stack:web:dev              # Deploy web stack only

# Cross-region certificate + web deployment
npm run deploy:web:dev            # Deploy certificates + web for dev
npm run deploy:web:staging        # Deploy certificates + web for staging
npm run deploy:web:production     # Deploy certificates + web for production

# Health checks and cleanup
npm run health:check:dev          # Check dev environment health
npm run health:check:staging      # Check staging environment health
npm run health:check:production   # Check production environment health
npm run cleanup:logs:dev          # Clean orphaned log groups (dev)
npm run cleanup:logs:staging      # Clean orphaned log groups (staging)
npm run cleanup:logs:production   # Clean orphaned log groups (production)

# Environment destruction with cleanup
npm run destroy:clean:dev         # Destroy dev + clean log groups
npm run destroy:clean:staging     # Destroy staging + clean log groups
npm run destroy:clean:production  # Destroy production + clean log groups

# Web configuration sync
npm run sync:web:dev              # Generate web config for dev
npm run sync:web:staging          # Generate web config for staging
npm run sync:web:production       # Generate web config for production
```

#### **Database Management** (Consolidated Approach)
```bash
npm run db:setup          # Complete setup: migrations + sample data with dynamic Cognito users
npm run db:migrate        # Run incremental schema migrations only (apps/api/src/database/migrations/)
npm run db:seed           # Load sample data only (infrastructure/data/sample-data.sql)
npm run db:status         # Check current migration status
npm run db:reset          # Reset database completely
npm run db:validate       # Validate sample data integrity
```

**Database Setup Flow:**
1. **Schema Creation**: Uses professional migration system with version control
2. **Cognito Integration**: Automatically creates test users in Cognito with real IDs  
3. **Sample Data**: Single source of truth with Swiss business data
4. **Consistency**: Same setup process across all environments

#### **Testing & Quality**
```bash
npm run test:integration  # Integration tests against LocalStack
npm run test:e2e          # E2E tests
npm run format            # Format code with Prettier
```

#### **Utilities**
```bash
npm run localstack:init   # Initialize LocalStack services
npm run localstack:status # Check LocalStack health
```

### Building the Project

```bash
# Build all workspaces (packages → domains → apps → infrastructure)
npm run build

# Build specific components
npm run build:packages        # Build shared packages only
npm run build:apps           # Build API and web applications only
npm run build:infrastructure # Build AWS CDK infrastructure only

# Build specific workspace (direct)
npm run build --workspace=apps/web
npm run build --workspace=apps/api
```

### Deployment

The project includes a streamlined and safe deployment process using AWS CDK:

```bash
# Safe deployment with health checks (recommended)
npm run deploy:safe:dev          # Safe deploy to dev environment
npm run deploy:safe:staging      # Safe deploy to staging environment
npm run deploy:safe:production   # Safe deploy to production environment

# Standard full deployment
npm run deploy:dev               # Deploy all stacks to dev
npm run deploy:staging           # Deploy all stacks to staging
npm run deploy:production        # Deploy all stacks to production

# Frontend-only deployment (faster for UI changes)
npm run deploy:frontend:dev      # Build + deploy frontend to dev
npm run deploy:frontend:staging  # Build + deploy frontend to staging
npm run deploy:frontend:production # Build + deploy frontend to production

# Safe deployment process:
# 1. Run health check to identify potential conflicts
# 2. Clean up orphaned CloudWatch log groups
# 3. Build all workspaces (packages, domains, apps, infrastructure)
# 4. Deploy 5 CDK stacks in correct order (Infrastructure → Lambda → API Gateway → Certificate → Web)
# 5. Output deployment URLs and status

# Infrastructure cleanup (if needed)
npm run destroy:clean:dev        # Destroy dev stacks + clean log groups
npm run destroy:clean:staging    # Destroy staging stacks + clean log groups
npm run destroy:clean:production # Destroy production stacks + clean log groups
```

**Prerequisites for Deployment:**
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed globally: `npm install -g aws-cdk`
- Target AWS account bootstrapped for CDK: `cd infrastructure && npm run bootstrap`

**Deployment Outputs:**
- **API Endpoint**: The deployed API Gateway URL for backend services
- **Stack ARN**: CloudFormation stack identifier for resource management
- **Region**: eu-central-1 (Frankfurt) for Swiss data residency compliance

**Infrastructure Components Deployed:**
- AWS Lambda functions for API endpoints (~30 functions)
- API Gateway with Lambda integrations
- CloudFront distribution with S3 origin and API Gateway reverse proxy
- Amazon RDS PostgreSQL with PostGIS extension
- AWS Cognito User Pool for authentication
- S3 bucket for web hosting
- CloudWatch log groups with proper retention policies
- SNS topics for monitoring and alerts
- IAM roles and security policies

### Testing

```bash
# Run tests for all workspaces
npm run test

# Integration tests against LocalStack (with sample data)
npm run test:integration

# E2E tests in local environment  
npm run test:e2e

# Validate sample data integrity
npm run db:validate
```

## Workspace Organization

### Domains (`domains/`)

Domain workspaces contain business logic and are organized by bounded contexts:

- **`travel-allowance/`**: Core domain for travel request processing and allowance calculations
- **`employee-management/`**: Employee data and profile management
- **`project-management/`**: Project and location data management

### Applications (`apps/`)

- **`web/`**: Angular frontend application providing user interfaces for employees and managers
- **`api/`**: Node.js Lambda functions providing REST API endpoints

### Shared Packages (`packages/`)

- **`shared/`**: Common types, interfaces, utilities, and constants used across all workspaces

### Infrastructure (`infrastructure/`)

AWS CDK project defining cloud infrastructure including:
- Lambda functions
- API Gateway
- RDS PostgreSQL with PostGIS
- Cognito User Pool
- S3 buckets for document storage
- IAM roles and policies

## Development Guidelines

### Code Quality

The project enforces code quality through:

- **ESLint**: Configured with TypeScript rules and Angular-specific rules
- **Prettier**: Standardized code formatting
- **Pre-commit hooks**: Automatic linting and formatting before commits
- **TypeScript strict mode**: Enabled across all workspaces

### Testing Standards

- **Coverage Target**: >80% test coverage across all workspaces
- **Frontend Testing**: Angular Testing Utilities with Jest
- **Backend Testing**: Vitest with Supertest for API testing
- **Test Location**: Each workspace maintains its own test files

### Naming Conventions

- **Components**: PascalCase (e.g., `TravelRequestForm`)
- **Services**: PascalCase with Service suffix (e.g., `TravelAllowanceService`)
- **Variables/Functions**: camelCase (e.g., `calculateAllowance`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_ENDPOINTS`)
- **Interfaces**: PascalCase with descriptive names (e.g., `TravelRequest`)

## Available Scripts

### Essential Commands
```bash
npm run dev               # Start complete development environment
npm run build             # Build entire project
npm run deploy            # Build + deploy to AWS
npm run deploy:safe       # Build + deploy with health checks (recommended)
npm run test              # Run all tests
npm run lint              # Lint and fix code
npm run format            # Format code with Prettier
npm run clean             # Clean build artifacts and cache
npm run clean:all         # Complete project cleanup and fresh start
```

### Development Environment
```bash
npm run dev:env           # Start infrastructure services (Docker)
npm run dev:api           # Start API server only
npm run dev:web           # Start Angular app only
npm run dev:setup         # Setup infrastructure + database only
npm run dev:logs          # View service logs
npm run dev:clean         # Stop and remove all containers
npm run dev:restart       # Clean restart with complete setup
```

### Build Components
```bash
npm run build:packages    # Build shared packages only
npm run build:apps        # Build API and web applications only
npm run build:infrastructure # Build AWS CDK infrastructure only
```

### Database Management
```bash
npm run db:setup          # Complete setup: migrations + sample data with dynamic Cognito users
npm run db:migrate        # Run incremental schema migrations (single source of truth)
npm run db:seed           # Load consolidated sample data with automatic user creation  
npm run db:status         # Check migration status and database health
npm run db:reset          # Reset database completely
npm run db:validate       # Validate sample data integrity
```

### Testing
```bash
npm run test:integration  # Integration tests against LocalStack
npm run test:e2e          # E2E tests
```

### Utilities
```bash
npm run localstack:init   # Initialize LocalStack services
npm run localstack:status # Check LocalStack health
```

### Project Cleanup Commands
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

### Workspace-Specific Scripts

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

## Environment Configuration

### Local Development

The development environment automatically configures AWS services to use LocalStack:

```typescript
// Automatically switches between local and production
const config = {
  NODE_ENV: 'development',
  AWS_ENDPOINT_URL: 'http://localhost:4566',  // LocalStack
  DATABASE_URL: 'postgresql://nissim:devpass123@localhost:5432/travel_manager_dev',
  REDIS_URL: 'redis://localhost:6379'
}
```

### AWS Infrastructure 

Infrastructure is managed through AWS CDK. The same code runs in both local and production:

- **Local**: Uses LocalStack endpoints with mock credentials
- **Production**: Uses real AWS services with IAM roles

See [DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md) for detailed configuration.

### Troubleshooting

Common issues and solutions:

```bash
# Services not starting
npm run dev:restart

# LocalStack connection issues  
npm run localstack:status
docker logs rtm-localstack

# Database connection errors
docker logs rtm-postgres

# Database schema issues (after consolidation)
npm run db:status          # Check migration status
npm run db:migrate         # Apply any pending migrations
npm run db:reset           # Complete database reset

# AWS deployment issues
npm run health:check       # Check deployment health before deploying
npm run cleanup:logs       # Clean problematic log groups
npm run destroy:clean      # Clean destroy with log group cleanup

# Reset everything
npm run dev:clean
npm run dev
```

**For detailed troubleshooting guidance, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**

## Contributing

1. **Branching**: Use feature branches with descriptive names
2. **Commits**: Follow conventional commit format
3. **Code Quality**: All code must pass linting and tests
4. **Testing**: Write tests for new features and bug fixes
5. **Documentation**: Update documentation for significant changes

## Project Structure Details

### Domain-Driven Design

The project follows DDD principles with clear separation of concerns:

- **Domain Layer**: Contains business logic and rules
- **Application Layer**: Orchestrates domain objects and external services
- **Infrastructure Layer**: Handles external concerns (database, API, etc.)

### TypeScript Configuration

- **Strict Mode**: Enabled for all workspaces
- **Path Mapping**: Configured for cross-workspace imports
- **Composite Projects**: Used for efficient building and type checking
- **References**: Proper dependency management between workspaces

### Monorepo Benefits

- **Shared Dependencies**: Common packages managed centrally
- **Type Safety**: Shared types ensure consistency across frontend and backend
- **Unified Tooling**: Consistent development experience across all workspaces
- **Atomic Changes**: Related changes across multiple packages in single commits

## Next Steps

After completing the project setup, the next development phases include:

1. **AWS Infrastructure**: Set up RDS PostgreSQL, Lambda, API Gateway, and Cognito
2. **Database Schema**: Design and implement data models with PostGIS
3. **Authentication**: Implement Cognito-based authentication system
4. **API Development**: Build REST API endpoints with Lambda functions
5. **Frontend Development**: Create Angular components and services

## License

This project is proprietary software. All rights reserved.

## Documentation

- **[DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md)** - Comprehensive local development guide
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Deployment issues, recovery procedures, and best practices
- **[ENVIRONMENTS.md](./ENVIRONMENTS.md)** - Detailed environment configuration guide
- **[Development Environment Parity Strategy](./docs/development-environment-parity-strategy.md)** - Technical architecture details
- **[Infrastructure README](./infrastructure/README.md)** - AWS deployment instructions

## Support

For questions or support, please contact the development team or create an issue in the project repository.

**For development environment issues:**
1. Check [DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md) troubleshooting section
2. Run `./test-setup.sh` to verify environment health  
3. Check service logs: `npm run dev:env:logs`