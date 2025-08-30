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

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- AWS CLI configured (for infrastructure deployment)
- Angular CLI (will be installed as dev dependency)

## Getting Started

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd RegularTravelManager

# Install dependencies for all workspaces
npm install
```

### 2. Development Setup

```bash
# Start all development servers (Angular frontend + API)
npm run dev

# Or start services individually
npm run dev:web    # Angular frontend on http://localhost:4200
npm run dev:api    # API development server
```

### 3. Building the Project

```bash
# Build all workspaces
npm run build

# Build specific workspace
npm run build --workspace=apps/web
npm run build --workspace=apps/api
```

### 4. Testing

```bash
# Run tests for all workspaces
npm run test

# Run tests with watch mode
npm run test:watch --workspace=apps/web
npm run test:watch --workspace=apps/api
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

Environment variables are managed through `.env` files (not committed to version control):

```bash
# Create environment file
cp .env.example .env.local
```

### AWS Infrastructure

Infrastructure is managed through AWS CDK. See the [infrastructure README](./infrastructure/README.md) for deployment instructions.

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

## Support

For questions or support, please contact the development team or create an issue in the project repository.