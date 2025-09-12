# Backend Architecture & Technology Stack

## Service Architecture

**AWS Lambda Functions:** Domain-driven organization with handlers for travel requests and manager operations, shared domain logic, and utility functions for Lambda wrapper and database connections.

## Component Architecture

Lambda components organized by feature modules following domain-driven design principles:
```
apps/api/src/
├── handlers/
│   ├── travel-requests/
│   │   ├── submit-request.ts
│   │   ├── get-requests.ts
│   │   └── withdraw-request.ts
│   ├── manager/
│   │   ├── get-pending.ts
│   │   ├── process-request.ts
│   │   └── batch-approve.ts
├── domain/
│   └── travel-allowance/
└── utils/
    ├── lambda-wrapper.ts
    └── db-connection.ts
```

## Authentication

**Production:** AWS Cognito User Pools with JWT token validation and AWS Amplify integration.

**Development:** Mock authentication with production-matching user data structure, enabling role-based testing.

**Environment Parity:** Consistent employee/manager permissions across environments with LocalStack using mock mode for development.

## Technology Stack

**Core Technologies:**
- **Backend:** TypeScript 5.3+, AWS Lambda + Fastify, REST APIs with OpenAPI 3.0
- **Database:** PostgreSQL 15+ with PostGIS for geographic calculations
- **Cache:** ElastiCache Redis for session and query caching
- **Authentication:** AWS Cognito for user management

**Frontend Technologies:**
- **Framework:** Angular 17+ with TypeScript 5.3+
- **UI:** Angular Material with Tailwind CSS
- **State Management:** RxJS service-based pattern

**Development & Infrastructure:**
- **Build Tools:** Angular CLI, esbuild bundler
- **Infrastructure:** AWS CDK 2.100+, GitHub Actions CI/CD

**Testing & Monitoring:**
- **Testing:** Jest + Angular Testing Utilities, Vitest + Supertest, Playwright E2E
- **Monitoring:** AWS CloudWatch for application monitoring and logging

## Lambda Function Architecture

**Handler Pattern:** Standard Lambda handlers with middleware composition for authentication, CORS, logging, and error handling.

**Middleware Chain:** Request ID generation, CORS headers, authentication validation, request logging, and error handling with proper response formatting.

**Database Connection Management:** PostgreSQL connection pooling optimized for Lambda execution model with limited connections and proper cleanup.

## Domain-Driven Design Implementation

**Domain Services:** TravelRequestService encapsulates business logic for request submission, validation, distance calculation, and allowance computation with proper domain error handling.

**Repository Pattern:** Clean abstraction layer for data persistence with PostGIS queries, aggregate mapping, and transaction management for domain objects.

## Performance & Scaling Considerations

**Lambda Optimization:** Provisioned concurrency for critical functions, optimized memory allocation (256-512MB), proper timeout configuration, and esbuild optimization.

**Database Performance:** Limited connection pooling for Lambda, proper indexing for geographic queries, GIST indexes for PostGIS, and read replicas for analytics.

**Caching Strategy:** Multi-level caching with application-level service caching, database query result caching, and CloudFront CDN caching.

This backend architecture provides a scalable, maintainable foundation with strong domain modeling and AWS-native integration.