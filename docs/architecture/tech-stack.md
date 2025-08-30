# Tech Stack

This is the **definitive technology selection** for RegularTravelManager. All development must use these exact versions and technologies.

## Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| Frontend Language | TypeScript | 5.3+ | Type-safe frontend development | Essential for DDD value objects and domain models shared across layers |
| Frontend Framework | Angular | 17+ | Full-featured frontend framework | Enterprise-grade framework with built-in DI, forms, routing, and TypeScript-first approach ideal for business applications |
| UI Component Library | Angular Material | 17+ | Swiss-business appropriate UI components | Professional Material Design components with excellent form controls and accessibility for employee/manager interfaces |
| State Management | NgRx | 17+ | Enterprise state management | Redux-based pattern with excellent TypeScript support, perfect for DDD command/query separation and complex business workflows |
| Backend Language | TypeScript | 5.3+ | Unified language across stack | Shared domain models between frontend/backend, consistent DDD implementation |
| Backend Framework | AWS Lambda + Fastify | Lambda Runtime v20, Fastify 4.24+ | Serverless HTTP framework | Fast startup times for Lambda, excellent TypeScript support, minimal overhead |
| API Style | REST | OpenAPI 3.0 | HTTP API design | Clear contract definition, excellent tooling, aligns with AWS API Gateway |
| Database | Amazon RDS PostgreSQL | 15+ with PostGIS | Relational database with geographic functions | ACID compliance for business transactions, PostGIS for distance calculations, DDD aggregate persistence |
| Cache | Amazon ElastiCache Redis | 7.0+ | Session and query caching | Fast lookup for employee data and project information |
| File Storage | Amazon S3 | Current | Document storage for attachments | Reliable file storage for request documentation if needed |
| Authentication | Amazon Cognito | Current | User management and authentication | Managed service for employee/manager authentication, integrates with Lambda |
| Frontend Testing | Jest + Angular Testing Utilities | Jest 29+, Angular 17+ | Unit and integration testing | Angular's built-in testing framework with excellent component and service testing |
| Backend Testing | Vitest + Supertest | Vitest 1.0+, Supertest 6+ | API and domain logic testing | Unified test runner across stack, excellent for testing DDD command handlers |
| E2E Testing | Playwright | 1.40+ | End-to-end user workflows | Reliable browser automation for testing request-approval workflows |
| Build Tool | Angular CLI | 17+ | Angular development toolchain | Integrated build system with TypeScript, testing, and deployment tools optimized for Angular |
| Bundler | esbuild | 0.19+ | Fast JavaScript bundling | Used by Vite and AWS Lambda for optimal bundle sizes |
| IaC Tool | AWS CDK | 2.100+ | Infrastructure as code | TypeScript-based infrastructure matching application language |
| CI/CD | GitHub Actions | Current | Automated testing and deployment | Integrates well with AWS CDK, good monorepo support |
| Monitoring | AWS CloudWatch | Current | Application and infrastructure monitoring | Native AWS integration, custom metrics for business KPIs |
| Logging | AWS CloudWatch Logs | Current | Centralized logging | Structured logging with Lambda integration |
| CSS Framework | Tailwind CSS | 3.3+ | Utility-first styling | Rapid UI development, works well with Ant Design for custom styling |
