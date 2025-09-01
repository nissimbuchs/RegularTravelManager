# RegularTravelManager

Employee travel allowance management system built with Angular, Node.js, and AWS CDK.

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
- **Database**: Amazon DynamoDB
- **Authentication**: AWS Cognito
- **Testing**: Vitest for backend, Jest for Angular frontend
- **Code Quality**: ESLint + Prettier with pre-commit hooks

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
# Start infrastructure services (PostgreSQL, Redis, LocalStack)
npm run dev:env

# Initialize AWS services (DynamoDB, S3)
npm run localstack:init

# Verify setup
./test-setup.sh
```

### 3. Start Development

```bash
# Option A: Start everything
npm run dev:full

# Option B: Start services individually  
npm run dev:api:local    # API server on :3000
npm run dev:web         # Angular app on :4200
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

### 5. Development Authentication

The development environment includes production-matching test users for authentication testing:

| User | Email | Name | Role | Employee ID |
|------|-------|------|------|-------------|
| **employee1** | employee1@company.com | John Employee | Employee | EMP001 |
| **employee2** | employee2@company.com | Jane Worker | Employee | EMP002 |
| **manager1** | manager1@company.com | Bob Manager | Manager | MGR001 |
| **manager2** | manager2@company.com | Alice Director | Manager | MGR002 |

**To switch users in development:**
```javascript
// In browser console (F12) - No passwords required in development
localStorage.setItem('mockUser', 'employee1');  // Default user
localStorage.setItem('mockUser', 'employee2');  // Jane Worker
localStorage.setItem('mockUser', 'manager1');   // Bob Manager  
localStorage.setItem('mockUser', 'manager2');   // Alice Director
window.location.reload();
```

**Note:** Development uses mock authentication - no passwords required. Production uses AWS Cognito with real authentication.

## Development Environment

### Local AWS Services (LocalStack)

Our development environment provides **95% production parity** using LocalStack:

| Service | Local Port | Production | Description |
|---------|------------|------------|-------------|
| PostgreSQL | :5432 | AWS RDS | Database with PostGIS |
| Redis | :6379 | ElastiCache | Caching layer |
| LocalStack | :4566 | AWS | DynamoDB, S3, Location Service |
| DynamoDB | via :4566 | AWS DynamoDB | Projects, subprojects data |
| S3 | via :4566 | AWS S3 | Document storage |

### Key Benefits

✅ **< 15 minute setup** for new developers  
✅ **Full offline development** - no internet required  
✅ **Cost savings** - ~€200/month per developer  
✅ **Zero code changes** between local and production  
✅ **Consistent behavior** across environments  

### Development Commands

```bash
# Environment management
npm run dev:env           # Start all Docker services
npm run dev:env:logs      # View service logs  
npm run dev:env:clean     # Stop & remove all containers
npm run dev:env:restart   # Clean restart

# Development servers
npm run dev:full          # Start everything
npm run dev:api:local     # API server only
npm run dev:web           # Angular app only

# Utilities
npm run localstack:status # Check LocalStack health
./test-setup.sh          # Verify environment
```

### Building the Project

```bash
# Build all workspaces
npm run build

# Build specific workspace
npm run build --workspace=apps/web
npm run build --workspace=apps/api
```

### Testing

```bash
# Run tests for all workspaces
npm run test

# Integration tests against LocalStack
npm run test:integration

# E2E tests in local environment  
npm run test:e2e:local
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
- DynamoDB tables
- Lambda functions
- API Gateway
- Cognito User Pool
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

### Root Level Scripts

```bash
npm run dev           # Start all development servers
npm run build         # Build all workspaces
npm run test          # Run tests in all workspaces
npm run lint          # Lint all code
npm run format        # Format all code with Prettier
npm run type-check    # Run TypeScript compiler checks
npm run clean         # Clean build artifacts and caches
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
npm run dev:env:restart

# LocalStack connection issues  
npm run localstack:status
docker logs rtm-localstack

# Database connection errors
docker logs rtm-postgres

# Reset everything
npm run dev:env:clean
npm run dev:env
npm run localstack:init
```

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

1. **AWS Infrastructure**: Set up DynamoDB, Lambda, API Gateway, and Cognito
2. **Database Schema**: Design and implement data models
3. **Authentication**: Implement Cognito-based authentication system
4. **API Development**: Build REST API endpoints with Lambda functions
5. **Frontend Development**: Create Angular components and services

## License

This project is proprietary software. All rights reserved.

## Documentation

- **[DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md)** - Comprehensive local development guide
- **[Development Environment Parity Strategy](./docs/development-environment-parity-strategy.md)** - Technical architecture details
- **[Infrastructure README](./infrastructure/README.md)** - AWS deployment instructions

## Support

For questions or support, please contact the development team or create an issue in the project repository.

**For development environment issues:**
1. Check [DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md) troubleshooting section
2. Run `./test-setup.sh` to verify environment health  
3. Check service logs: `npm run dev:env:logs`