# RegularTravelManager System Overview

## System Purpose & Scope

Swiss employee travel allowance management system designed for enterprise-grade scalability, security, and compliance. Supports employee travel request submission, manager approval workflows, and automated distance-based allowance calculations.

## Technical Architecture

**Core Platform:** AWS Serverless Architecture
- **Frontend:** Angular 17+ (TypeScript) hosted on S3/CloudFront
- **Backend:** Node.js Lambda functions with API Gateway
- **Database:** PostgreSQL with PostGIS extension for geographic calculations
- **Authentication:** AWS Cognito User Pools
- **Infrastructure:** AWS CDK (TypeScript) for infrastructure-as-code

**Geographic Focus:** Swiss business requirements with eu-central-1 (Frankfurt) deployment for data residency compliance.

## AWS CDK 4-Stack Architecture

**Architecture Philosophy:** Independent, linearly-dependent CDK stacks enabling isolated deployments and clear separation of concerns.

### Stack Design

1. **InfrastructureStack** - Foundation layer with core AWS services (VPC, RDS, Cognito, SES)
2. **LambdaStack** - Compute layer with ~30 Lambda functions for business logic
3. **ApiGatewayStack** - API layer with REST endpoints and Lambda integration
4. **WebStack** - Presentation layer with frontend hosting and dynamic configuration

### Dependency Flow
```
InfrastructureStack → LambdaStack → ApiGatewayStack → WebStack
```

**Key Architectural Benefits:**
- Independent deployments (frontend updates without backend changes)
- Linear dependency chain prevents circular dependencies
- Stack-specific CI/CD pipelines and rollback strategies
- Cost optimization through selective stack deployment

## Core System Capabilities

**Business Functions:**
- Employee travel request submission with distance-based allowance calculation
- Manager approval workflows with email notifications
- Geographic distance calculations using PostGIS
- Audit trails for all request status changes

**Technical Features:**
- Real-time reactive frontend with Angular/RxJS
- Serverless backend with auto-scaling Lambda functions
- Dynamic configuration management for environment-specific values
- Advanced subscription lifecycle management to prevent memory leaks

## Development Environment Strategy

**Local Development:** LocalStack + Docker providing 95% AWS production parity
**Benefits:** <15 minute setup, zero AWS costs, offline development capability

**Authentication Strategy:**
- **Production:** AWS Cognito with JWT tokens
- **Development:** Mock authentication with production-matching user data structure

## Current Enhancement: Epic 5 - User Management

Brownfield enhancement adding self-service user registration, profile management, and administrative user control while maintaining full backward compatibility with existing authentication flows.