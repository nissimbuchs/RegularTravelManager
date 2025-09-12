# RegularTravelManager Fullstack Architecture Document

**Session Date:** 2025-08-30
**Facilitator:** Business Analyst Mary
**Participant:** RegularTravelManager Developer

## 🚀 Current Deployment Status

**✅ Production Environment (AWS Dev Stack):**
- **Frontend Application**: https://dz57qvo83kxos.cloudfront.net
- **API Gateway**: https://1kkd1bbkmh.execute-api.eu-central-1.amazonaws.com/dev/
- **Database**: rtm-dev-infrastructure-databaseb269d8bb-ynfofwwlfkkm.c18k2mga4rnh.eu-central-1.rds.amazonaws.com
- **Cognito User Pool**: eu-central-1_LFA9Rhk2y
- **Region**: eu-central-1 (Frankfurt)
- **Architecture**: 4-stack CDK deployment with complete sample data

**Available Features:**
- ✅ Real-time travel request submission and management
- ✅ Manager approval workflows 
- ✅ Distance calculations with PostGIS
- ✅ Swiss business sample data (10 employees, 4 projects, 8 subprojects)
- ✅ AWS Cognito authentication with test users
- ✅ Complete audit trails and status tracking
- 🚧 **Epic 5 - User Management:** Self-service registration, profile management, admin user control (in development)

## Introduction

This document outlines the complete fullstack architecture for **RegularTravelManager**, including backend systems, frontend implementation, and their integration. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack.

This unified approach combines what would traditionally be separate backend and frontend architecture documents, streamlining the development process for modern fullstack applications where these concerns are increasingly intertwined.

### Starter Template Analysis

**Decision:** N/A - Greenfield project

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-09-12 | 2.1 | **Brownfield Enhancement:** Added Epic 5 - User Management architecture with Cognito user registration, profile management, and admin user control capabilities. Enhanced authentication system with dynamic user onboarding while maintaining backward compatibility. | Product Owner Sarah |
| 2025-09-12 | 2.0 | **Major Update:** Added comprehensive Frontend Subscription Lifecycle Management, Dynamic Configuration Management, and API Gateway & Lambda Integration Management sections. Enhanced with Phase 1 & Phase 2 subscription patterns, S3/CloudFront config generation, and complete development workflow documentation. | Architect Winston |
| 2025-09-08 | 1.3 | Implemented 4-stack CDK architecture with improved separation of concerns | Architect Winston |
| 2025-09-01 | 1.2 | Added LocalStack development environment with 95% AWS parity | Architect Winston |
| 2025-08-30 | 1.1 | Updated to use Angular instead of React | Architect Winston |
| 2025-08-30 | 1.0 | Initial architecture document | Architect Winston |

## High Level Architecture

### Technical Summary

RegularTravelManager will use **AWS serverless architecture** with an Angular-based frontend hosted on S3/CloudFront and a Node.js serverless backend using Lambda + API Gateway. **Amazon Cognito** handles authentication for employees and managers, while **RDS PostgreSQL** with PostGIS extension manages relational data and geographic calculations. **AWS SES** provides email notifications for the request-approval workflow. The architecture leverages **AWS CDK** for infrastructure-as-code, ensuring enterprise-grade security, scalability, and compliance suitable for Swiss business requirements.

### Platform and Infrastructure Choice

**Platform:** AWS Full Stack
**Key Services:** 
- Frontend: S3 + CloudFront + Route 53
- Backend: Lambda + API Gateway + RDS PostgreSQL
- Auth: Amazon Cognito User Pools
- Notifications: SES (Simple Email Service)  
- Infrastructure: AWS CDK for deployment automation

**Deployment Host and Regions:** 
- Primary: eu-central-1 (Frankfurt) for Swiss data residency
- CloudFront global edge locations for performance

### AWS CDK Architecture (4-Stack Design)

**Architecture Philosophy:** The infrastructure is organized into **4 independent CDK stacks** for better separation of concerns, deployment flexibility, and maintainability.

#### Stack Overview

1. **InfrastructureStack** (`rtm-{env}-infrastructure`)
   - **Purpose:** Core backend services foundation
   - **Resources:** VPC, RDS PostgreSQL, Cognito User Pool, Location Service, SES, SNS
   - **Dependencies:** None (foundation layer)
   - **Exports:** User Pool ID, Database endpoints, SNS Topic ARN, VPC configuration

2. **LambdaStack** (`rtm-{env}-lambda`)
   - **Purpose:** All serverless compute functions
   - **Resources:** ~30 Lambda functions for business logic, API handlers, utilities
   - **Dependencies:** InfrastructureStack (imports VPC, database, Cognito)
   - **Exports:** Lambda function ARNs for API Gateway integration

3. **ApiGatewayStack** (`rtm-{env}-api-gateway`)
   - **Purpose:** REST API routing and Lambda integration
   - **Resources:** API Gateway, routes, method configurations, authorizer
   - **Dependencies:** LambdaStack (imports Lambda ARNs via CloudFormation exports)
   - **Exports:** API Gateway URL

4. **WebStack** (`rtm-{env}-web`)
   - **Purpose:** Frontend hosting and distribution
   - **Resources:** S3 bucket, CloudFront distribution, web deployment, config generation
   - **Dependencies:** ApiGatewayStack + InfrastructureStack (imports API URL, Cognito config)
   - **Exports:** CloudFront domain URL

#### Deployment Flow

```
InfrastructureStack (foundation) 
    ↓
LambdaStack (compute layer)
    ↓  
ApiGatewayStack (API layer)
    ↓
WebStack (presentation layer)
```

#### Architecture Benefits

- ✅ **Independent Deployments:** Update frontend without touching backend infrastructure
- ✅ **No Circular Dependencies:** Clean linear dependency chain using CloudFormation exports
- ✅ **Better CI/CD:** Each stack can have its own deployment pipeline and rollback strategy
- ✅ **Cost Optimization:** Destroy/recreate individual stacks for testing without affecting others
- ✅ **Faster Deployments:** Deploy only what changed (e.g., frontend-only updates)
- ✅ **Clear Boundaries:** Each stack has a single, well-defined responsibility
- ✅ **Easier Debugging:** Stack-specific issues are isolated and easier to troubleshoot

## API Gateway & Lambda Integration Management

### Critical Infrastructure Requirement

**🚨 MANDATORY:** When adding new frontend service calls, infrastructure updates are **REQUIRED** in addition to frontend code. Missing this step causes 403/404 errors and broken functionality.

### Historical Integration Problems

**Common Issues Identified from Commit History:**
- **Missing GET /api/projects endpoint** (commit 0db68d1) - Lambda function existed but wasn't connected to API Gateway method
- **Missing /api/manager/dashboard route** (commit 58f7381) - API only had `/api/manager` configured, causing 403 for `/api/manager/dashboard`
- **Missing Lambda functions** (commit d05e677) - API Gateway referenced functions that didn't exist in LambdaStack
- **Path mismatches** - Frontend called different paths than what was configured in infrastructure

### 4-Stack Integration Pattern

The RegularTravelManager uses a **4-stack architecture** where each component depends on exports from the previous stack:

```
InfrastructureStack → LambdaStack → ApiGatewayStack → WebStack
```

**CloudFormation Export/Import Pattern:**
```typescript
// LambdaStack: Export Lambda function ARN
new cdk.CfnOutput(this, 'YourFunctionArnOutput', {
  value: this.yourFunction.functionArn,
  exportName: `rtm-${environment}-your-function-arn`,
});

// ApiGatewayStack: Import Lambda function
const yourFunction = lambda.Function.fromFunctionAttributes(this, 'ImportedYourFunction', {
  functionArn: cdk.Fn.importValue(`rtm-${environment}-your-function-arn`),
  sameEnvironment: true, // Critical for permission grants
});
```

### Frontend-Backend Integration Workflow

#### 🚨 Mandatory 4-Step Process for New Service Calls

**When adding ANY new frontend HTTP service call, you MUST complete all 4 steps:**

#### Step 1: Create Handler Function
```typescript
// Location: apps/api/src/handlers/your-domain/your-handler.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withMiddleware } from '../middleware';
import { corsHeaders, successResponse } from '../utils/api-response';

export const handler = withMiddleware(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Your business logic here
    const result = await yourBusinessLogic(event);
    
    return successResponse(result);
  } catch (error) {
    throw error; // Middleware handles error formatting
  }
});
```

#### Step 2: Add Lambda Function to LambdaStack
```typescript
// Location: infrastructure/lib/lambda-stack.ts

// 1. Declare function property
public yourFunction!: lambda.Function;

// 2. Create function in constructor
this.yourFunction = new lambda.Function(this, 'YourFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'handlers/your-domain/your-handler.handler',
  code: lambda.Code.fromAsset('apps/api/dist'),
  environment: baseEnv,
  timeout: cdk.Duration.seconds(30),
  memorySize: 256,
  logRetention: logs.RetentionDays.ONE_WEEK,
});

// 3. Export function ARN
new cdk.CfnOutput(this, 'YourFunctionArnOutput', {
  value: this.yourFunction.functionArn,
  exportName: `rtm-${environment}-your-function-arn`,
});
```

#### Step 3: Import Function in ApiGatewayStack
```typescript
// Location: infrastructure/lib/api-gateway-stack.ts

// 1. Import function at top of configureRoutes method
const yourFunction = lambda.Function.fromFunctionAttributes(this, 'ImportedYourFunction', {
  functionArn: cdk.Fn.importValue(`rtm-${environment}-your-function-arn`),
  sameEnvironment: true, // CRITICAL: Allows permission grants
});

// 2. Add to configureRoutes method parameters
private configureRoutes(
  // ... existing parameters
  yourFunction: lambda.IFunction
) {
  // Route configuration code
}

// 3. Pass to configureRoutes call
this.configureRoutes(
  // ... existing arguments
  yourFunction
);
```

#### Step 4: Configure API Gateway Route
```typescript
// Location: infrastructure/lib/api-gateway-stack.ts (inside configureRoutes method)

// 1. Create resource (if needed)
const yourDomainResource = apiResource.addResource('your-domain');

// 2. Create integration
const yourIntegration = new apigateway.LambdaIntegration(yourFunction);

// 3. Add method with authorization
yourDomainResource.addMethod('GET', yourIntegration, defaultMethodOptions);

// 4. Grant permissions (CRITICAL)
yourFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
```

### Common Integration Pitfalls & Solutions

#### 🔴 Pitfall 1: Missing HTTP Method Configuration
**Problem:** Lambda function exists, but HTTP method not added to API Gateway
```typescript
// ❌ Wrong: Function created but no method added
const integration = new apigateway.LambdaIntegration(yourFunction);
// Missing: resource.addMethod(...)

// ✅ Correct: Always add method
const integration = new apigateway.LambdaIntegration(yourFunction);
resource.addMethod('GET', integration, defaultMethodOptions);
```

#### 🔴 Pitfall 2: API Path Mismatch  
**Problem:** Frontend calls `/api/manager/dashboard` but API only configured `/api/manager`
```typescript
// ❌ Wrong: Incomplete path structure
const managerResource = apiResource.addResource('manager');
managerResource.addMethod('GET', integration, defaultMethodOptions);
// Missing: dashboard subresource

// ✅ Correct: Complete path structure
const managerResource = apiResource.addResource('manager');
const dashboardResource = managerResource.addResource('dashboard');
dashboardResource.addMethod('GET', integration, defaultMethodOptions);
```

#### 🔴 Pitfall 3: Missing Function Export
**Problem:** Lambda function created but ARN not exported
```typescript
// ❌ Wrong: Function created but not exported
this.yourFunction = new lambda.Function(this, 'YourFunction', { /* config */ });

// ✅ Correct: Always export function ARN
this.yourFunction = new lambda.Function(this, 'YourFunction', { /* config */ });
new cdk.CfnOutput(this, 'YourFunctionArnOutput', {
  value: this.yourFunction.functionArn,
  exportName: `rtm-${environment}-your-function-arn`,
});
```

#### 🔴 Pitfall 4: Missing API Gateway Permissions
**Problem:** API Gateway can't invoke Lambda function
```typescript
// ❌ Wrong: No permission grant
const integration = new apigateway.LambdaIntegration(yourFunction);

// ✅ Correct: Always grant permissions  
const integration = new apigateway.LambdaIntegration(yourFunction);
yourFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
```

### Integration Verification & Troubleshooting

#### Testing New Routes
```bash
# 1. Deploy infrastructure
npm run deploy

# 2. Test API endpoint directly
curl -H "Authorization: Bearer YOUR_JWT" \
  https://YOUR_API_GATEWAY_URL/dev/api/your-domain

# 3. Check CloudWatch logs for Lambda execution
aws logs tail /aws/lambda/rtm-dev-your-function --follow

# 4. Verify API Gateway configuration
aws apigateway get-resources --rest-api-id YOUR_API_ID
```

#### Common Error Patterns
```bash
# 403 Forbidden → Missing route or authorization issues
# 404 Not Found → Path mismatch between frontend and API Gateway
# 502 Bad Gateway → Lambda function error or timeout
# "Missing Authentication Token" → Route not configured in API Gateway
```

#### Debugging Commands
```bash
# List all API Gateway resources
aws apigateway get-resources --rest-api-id $(aws ssm get-parameter --name /rtm/dev/api/gateway-id --query 'Parameter.Value' --output text)

# Check Lambda function exports
aws cloudformation describe-stacks --stack-name rtm-dev-lambda --query 'Stacks[0].Outputs'

# View API Gateway logs  
aws logs tail /aws/apigateway/rtm-dev-access-logs --follow
```

### Integration Checklist for New Features

**Before implementing any new frontend service call, verify:**

- [ ] **Handler Function**
  - [ ] Created in `apps/api/src/handlers/` with proper middleware
  - [ ] Implements error handling and response formatting
  - [ ] Uses authentication middleware if protected

- [ ] **Lambda Function (LambdaStack)**
  - [ ] Function property declared in class
  - [ ] Function created with correct handler path
  - [ ] Environment variables configured
  - [ ] CloudWatch log retention set
  - [ ] **Function ARN exported via `cdk.CfnOutput`**

- [ ] **API Gateway Import (ApiGatewayStack)**  
  - [ ] Function imported with `sameEnvironment: true`
  - [ ] Added to `configureRoutes` method parameters
  - [ ] Passed to `configureRoutes` call

- [ ] **API Gateway Route (ApiGatewayStack)**
  - [ ] Resource structure matches frontend call path exactly
  - [ ] HTTP method matches frontend request (GET/POST/PUT/DELETE)
  - [ ] Lambda integration created correctly
  - [ ] Method added with proper authorization
  - [ ] **Permission granted: `grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'))`**

- [ ] **Deployment & Verification**
  - [ ] Infrastructure deployed: `npm run deploy`
  - [ ] Route accessible via direct API call
  - [ ] Frontend service call works end-to-end
  - [ ] CloudWatch logs show successful execution

### Why This Process is Critical

**Historical Impact of Missing Steps:**
- Multiple 403 Forbidden errors during development
- Features appearing to work in development but failing in deployment
- Hours of debugging time spent on infrastructure issues
- Broken user experience with non-functional frontend features

**Architecture Enforcement:**
- This 4-step process is **non-negotiable** for system stability
- **Code reviews must verify** all 4 steps are completed  
- **Testing must include** direct API endpoint verification
- **Documentation must be updated** when new service patterns are established

This integration management ensures that the 4-stack CDK architecture functions correctly and prevents the recurring infrastructure issues that have impacted development velocity.

## Dynamic Configuration Management

### Critical Frontend Configuration Architecture

**🚨 IMPORTANT:** The frontend does **NOT** use static configuration files. Configuration is **dynamically generated** by the backend during deployment and published to S3 as assets.

### Dynamic Configuration Generation Process

#### Overview of the Configuration Flow

```
Infrastructure Deployment → Config Generation → S3 Upload → CloudFront Delivery → Frontend Consumption
```

**Why Dynamic Configuration:**
- **Environment-specific values** (API URLs, Cognito pools) are only available after AWS infrastructure is deployed
- **Security** - No hardcoded AWS resource identifiers in source code
- **Flexibility** - Configuration can be updated without rebuilding the frontend application
- **CloudFront integration** - Configs are served as static assets through the same CDN

### Configuration Generation Components

#### 1. Config Generator Lambda Function
**Location:** `infrastructure/lib/lambda/generate-web-config.ts`

```typescript
// Fetches configuration from SSM Parameter Store
const apiUrl = await getSSMParameter(`/rtm/${environment}/api/gateway-url`);
const userPoolId = await getSSMParameter(`/rtm/${environment}/cognito/user-pool-id`);
const clientId = await getSSMParameter(`/rtm/${environment}/cognito/client-id`);

// Generates configuration object
const config = {
  apiUrl: '/api', // Relative path for CloudFront reverse proxy
  cognito: {
    userPoolId: userPoolId,
    userPoolClientId: clientId,
    region: region,
    useMockAuth: environment === 'dev',
  },
  environment: environment,
  _originalApiUrl: apiUrl, // Stored for debugging
};

// Uploads to S3 bucket
await s3Client.send(new PutObjectCommand({
  Bucket: bucketName,
  Key: 'assets/config/config.json',
  Body: JSON.stringify(config, null, 2),
  ContentType: 'application/json',
  CacheControl: 'no-cache',
}));
```

#### 2. CloudFormation Custom Resource Integration
**Location:** `infrastructure/lib/web-stack.ts`

```typescript
// Custom Resource triggers config generation during deployment
const configGeneratorResource = new cdk.CustomResource(this, 'WebConfigGeneratorResource', {
  serviceToken: configGeneratorProvider.serviceToken,
  properties: {
    Environment: environment,
    WebBucketName: this.webBucket.bucketName,
    Region: this.region,
    Timestamp: Date.now().toString(), // Forces updates
  },
});
```

#### 3. Manual Config Generation Script
**Location:** `scripts/generate-web-config.sh`

```bash
# Script for manual config updates after infrastructure changes
./scripts/generate-web-config.sh dev
# - Fetches values from SSM Parameter Store
# - Generates config JSON
# - Uploads to S3 bucket
# - Provides CloudFront invalidation commands
```

### Frontend Config Consumption

#### ConfigService Implementation
**Location:** `apps/web/src/app/core/services/config.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class ConfigService {
  async loadConfig(): Promise<void> {
    try {
      // Loads config from S3 via CloudFront
      const config = await firstValueFrom(
        this.http.get<AppConfig>('/assets/config/config.json')
      );
      
      // Validates required fields
      if (!config.cognito?.userPoolId || !config.cognito?.userPoolClientId) {
        throw new Error('Invalid configuration');
      }
      
      this._config = config;
    } catch (error) {
      // Falls back to local development config
      console.warn('Using fallback configuration for local development');
    }
  }
}
```

#### App Initialization
**Location:** `apps/web/src/app/app.config.ts`

```typescript
// Config loaded during app bootstrap
export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: (configService: ConfigService) => () => configService.loadConfig(),
      deps: [ConfigService],
      multi: true,
    },
    // ... other providers
  ],
};
```

### Configuration File Structure

#### Generated Config Format
```json
{
  "apiUrl": "/api",
  "cognito": {
    "userPoolId": "eu-central-1_LFA9Rhk2y",
    "userPoolClientId": "7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y",
    "region": "eu-central-1",
    "useMockAuth": false
  },
  "environment": "dev",
  "_originalApiUrl": "https://1kkd1bbkmh.execute-api.eu-central-1.amazonaws.com/dev/"
}
```

#### Key Configuration Properties

| Property | Purpose | Example Value |
|----------|---------|---------------|
| `apiUrl` | Frontend API base URL | `/api` (relative for CloudFront) |
| `cognito.userPoolId` | AWS Cognito User Pool ID | `eu-central-1_LFA9Rhk2y` |
| `cognito.userPoolClientId` | Cognito App Client ID | `7j8k9l0m...` |
| `cognito.region` | AWS Region | `eu-central-1` |
| `cognito.useMockAuth` | Enable mock auth (dev only) | `false` |
| `environment` | Deployment environment | `dev`/`staging`/`production` |
| `_originalApiUrl` | Full API Gateway URL (debug) | `https://api.example.com/dev/` |

### CloudFront Configuration Integration

#### Reverse Proxy Pattern
```typescript
// CloudFront serves both frontend assets and proxies API calls
additionalBehaviors: {
  '/api/*': {
    origin: new origins.HttpOrigin(apiGatewayDomain),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
  },
},
```

**Benefits:**
- **Same-origin requests** - No CORS configuration needed
- **Simplified config** - Frontend uses relative `/api` URLs
- **Performance** - Single domain for all resources

### Configuration Update Workflow

#### When Config Updates Are Needed

1. **After infrastructure changes** that modify API Gateway URLs or Cognito resources
2. **When SSM Parameter values change** 
3. **During environment promotion** (dev → staging → production)
4. **When Cognito User Pool settings are updated**

#### Manual Configuration Update Process

```bash
# 1. Update infrastructure if needed
npm run deploy

# 2. Generate new config
./scripts/generate-web-config.sh dev

# 3. Invalidate CloudFront cache (if needed)
aws cloudfront create-invalidation \
  --distribution-id XXXXXXXXXX \
  --paths '/assets/config/*'

# 4. Verify config is updated
curl https://your-cloudfront-domain.com/assets/config/config.json
```

#### Automated Configuration Updates

**During CDK Deployment:**
- Custom Resource automatically generates config after stack deployment
- Config is uploaded to S3 with `no-cache` headers
- No manual intervention required for standard deployments

### Configuration Troubleshooting

#### Common Configuration Issues

**🔴 Config Loading Failures:**
```javascript
// Check browser network tab for failed requests
// Verify S3 bucket contains config files
aws s3 ls s3://rtm-dev-web-bucket/assets/config/

// Manual config verification
curl https://your-domain.com/assets/config/config.json
```

**🔴 Invalid Cognito Configuration:**
```bash
# Verify SSM parameters exist
aws ssm get-parameters-by-path --path "/rtm/dev/" --recursive

# Check parameter values
aws ssm get-parameter --name "/rtm/dev/cognito/user-pool-id"
```

**🔴 CloudFront Caching Issues:**
```bash
# Create cache invalidation for config files
aws cloudfront create-invalidation \
  --distribution-id $(aws ssm get-parameter --name /rtm/dev/web/distribution-id --query 'Parameter.Value' --output text) \
  --paths '/assets/config/*'
```

#### Configuration Debugging Commands

```bash
# View current deployed config
aws s3 cp s3://$(aws ssm get-parameter --name /rtm/dev/web/bucket-name --query 'Parameter.Value' --output text)/assets/config/config.json -

# Check config generation logs
aws logs tail /aws/lambda/rtm-dev-web-config-generator --follow

# Verify SSM parameters
aws ssm describe-parameters --parameter-filters "Key=Name,Option=BeginsWith,Values=/rtm/dev/"

# Test config endpoint
curl -I https://$(aws ssm get-parameter --name /rtm/dev/web/domain-name --query 'Parameter.Value' --output text)/assets/config/config.json
```

### Integration with Development Workflow

#### Updated 4-Step Process for Infrastructure Changes

When modifying infrastructure that affects frontend configuration:

1. **Step 1-4**: Complete standard Lambda/API Gateway integration
2. **Step 5**: **Verify config generation** (NEW STEP)
   - Check that SSM parameters are updated
   - Verify config generation Custom Resource triggers
   - Confirm S3 config files are updated
   - Test config loading in frontend

#### Config-Related Deployment Checklist

- [ ] **SSM Parameters Updated**
  - [ ] API Gateway URL parameter exists
  - [ ] Cognito User Pool ID parameter exists  
  - [ ] Cognito Client ID parameter exists
  
- [ ] **Config Generation Working**
  - [ ] Custom Resource executes successfully
  - [ ] Config files uploaded to S3 bucket
  - [ ] Config contains correct values
  - [ ] No-cache headers applied

- [ ] **Frontend Config Loading**
  - [ ] Config service loads without errors
  - [ ] Cognito authentication initializes correctly
  - [ ] API calls use correct base URL
  - [ ] Environment detection works properly

- [ ] **CloudFront Integration**
  - [ ] Config files accessible via CDN
  - [ ] Cache invalidation works when needed
  - [ ] API reverse proxy functioning

### Why Dynamic Configuration is Critical

**Historical Context:**
- Static config files caused deployment failures when AWS resources changed
- Hardcoded URLs led to environment mismatches
- Manual config updates were error-prone and time-consuming

**Architecture Benefits:**
- ✅ **Environment consistency** - Config always matches deployed infrastructure
- ✅ **Security** - No sensitive values in source code or build artifacts  
- ✅ **Deployment automation** - Config generation happens automatically
- ✅ **Debugging capability** - Original values preserved for troubleshooting
- ✅ **Cache management** - No-cache headers ensure config freshness

**Developer Requirements:**
- **Never hardcode** AWS resource identifiers in frontend code
- **Always verify** config generation after infrastructure changes
- **Use ConfigService** for all environment-specific values
- **Test config loading** during development and deployment

This dynamic configuration architecture ensures that the frontend always receives correct, up-to-date configuration values that match the actual deployed AWS infrastructure, eliminating a major source of deployment issues and environment mismatches.

### Repository Structure

**Structure:** Monorepo with Domain-Driven Design organization
**Monorepo Tool:** npm workspaces
**Package Organization:**

**Domain-Centric Structure:**
- `domains/` - Core business domains and bounded contexts
  - `travel-allowance/` - Main travel allowance domain
  - `employee-management/` - Employee data and profiles domain
  - `project-management/` - Project and location data domain
- `apps/` - Application entry points  
- `shared-kernel/` - Cross-domain shared concepts
- `infrastructure/` - External concerns (AWS, databases, etc.)

### High Level Architecture Diagram

```mermaid
graph TB
    User[👤 Employee/Manager] --> CF[☁️ CloudFront CDN]
    CF --> S3[📦 S3 Static Hosting<br/>Angular App]
    
    S3 --> API[🚀 API Gateway<br/>REST API]
    API --> Lambda[⚡ Lambda Functions<br/>Node.js/TypeScript]
    
    Lambda --> RDS[(🗄️ RDS PostgreSQL<br/>PostGIS Extension)]
    Lambda --> Cognito[🔐 Amazon Cognito<br/>User Management]
    Lambda --> SES[📧 Simple Email Service<br/>Notifications]
    
    subgraph "AWS Services"
        CF
        S3
        API
        Lambda
        RDS
        Cognito
        SES
    end
    
    subgraph "Infrastructure as Code"
        CDK[📋 AWS CDK<br/>TypeScript]
    end
    
    CDK -.-> API
    CDK -.-> Lambda
    CDK -.-> RDS
    CDK -.-> Cognito
```

### Architectural Patterns

- **Serverless Architecture:** Lambda functions with API Gateway for backend logic - _Rationale:_ Auto-scaling, pay-per-request, minimal infrastructure management for business applications
- **Component-Based UI:** Reusable Angular components with TypeScript - _Rationale:_ Superior form handling and enterprise features for forms-heavy travel management interface
- **Infrastructure as Code:** AWS CDK for all resource provisioning - _Rationale:_ Version-controlled infrastructure, consistent deployments, easy environment replication
- **Event-Driven Notifications:** Lambda triggers for email notifications on request status changes - _Rationale:_ Decoupled notification system, reliable delivery via SES
- **Geographic Database Functions:** PostGIS extension in RDS for distance calculations - _Rationale:_ Server-side geographic calculations ensure accuracy and consistency

## Tech Stack

This is the **definitive technology selection** for RegularTravelManager. All development must use these exact versions and technologies.

### Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| Frontend Language | TypeScript | 5.3+ | Type-safe frontend development | Essential for DDD value objects and domain models shared across layers |
| Frontend Framework | Angular | 17+ | Full-featured frontend framework | Enterprise-grade framework with built-in DI, forms, routing, and TypeScript-first approach ideal for business applications |
| UI Component Library | Angular Material | 17+ | Swiss-business appropriate UI components | Professional Material Design components with excellent form controls and accessibility for employee/manager interfaces |
| State Management | RxJS Services | - | Reactive state management | Service-based pattern with BehaviorSubjects and observables for reactive data flow and state management |
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

## Employee Identification Strategy

The system uses a three-ID pattern to handle different contexts of employee identification across authentication, business operations, and database management.

### Three ID Types

| ID Type | Purpose | Format | Usage Context | Example |
|---------|---------|--------|---------------|---------|
| **id** (UUID) | Database primary key | UUID v4 | Internal database operations, foreign keys | `550e8400-e29b-41d4-a716-446655440001` |
| **employee_id** | Human-readable business identifier | `EMP-####` or `MGR-####` | User interfaces, reports, business communications | `EMP-0001`, `MGR-0001` |
| **cognito_user_id** | AWS Cognito authentication identifier | String | API authentication, JWT token `sub` claim | `employee1-cognito-id` |

### Frontend ID Usage Rules

**For API Calls:**
- Always use `cognito_user_id` when calling API endpoints
- The JWT token's `sub` claim contains the `cognito_user_id`
- Backend handlers query by `cognito_user_id` for security

```typescript
// ✅ Correct: Use cognito_user_id for API calls
const userContext = this.authService.getCurrentUser();
this.http.get(`/api/employees/${userContext.sub}`); // sub = cognito_user_id
// Example: GET /api/employees/93b46802-90c1-7066-8b6c-ae1fe5cd1fb6

// ❌ Incorrect: Never use UUID id or employee_id for API calls
this.http.get(`/api/employees/550e8400-e29b-41d4-a716-446655440001`);
this.http.get(`/api/employees/EMP-0001`);
```

**For Display Purposes:**
- Use `employee_id` for user-friendly identification in UI components
- Display `firstName lastName (employee_id)` for employee selection

```typescript
// ✅ Correct: Display employee_id in UI
<mat-option [value]="employee.cognito_user_id">
  {{ employee.firstName }} {{ employee.lastName }} ({{ employee.employee_id }})
</mat-option>
```

### Authentication Flow with ID Mapping

```mermaid
sequenceDiagram
    participant Frontend
    participant API
    participant Cognito
    participant Database
    
    Frontend->>Cognito: Login with email/password
    Cognito->>Frontend: JWT token (sub = cognito_user_id)
    Frontend->>API: Request with JWT token
    API->>API: Extract cognito_user_id from token.sub
    API->>Database: Query WHERE cognito_user_id = $1
    Database->>API: Return employee record with all IDs
    API->>Frontend: Response with employee data
```

### Database Query Patterns

**Employee Profile Handler:**
```typescript
// ✅ Correct: Query by cognito_user_id for security
async getEmployeeByCognitoId(cognitoUserId: string) {
  const result = await db.query(
    'SELECT * FROM employees WHERE cognito_user_id = $1', 
    [cognitoUserId]
  );
  return result.rows[0];
}

// ❌ Incorrect: Never query by UUID from frontend
async getEmployee(id: string) {
  const result = await db.query('SELECT * FROM employees WHERE id = $1', [id]);
  return result.rows[0];
}
```

### Security Rationale

- **Cognito ID for API calls** ensures users can only access their own data
- **UUID for database** provides efficient primary keys and foreign key relationships  
- **Employee ID for display** offers human-readable identification for business users
- **Token validation** automatically maps JWT `sub` claim to database records

## Data Models

Based on our brainstorming session and DDD approach, here are the core domain models that will be shared between frontend and backend:

### TravelRequest

**Purpose:** Core aggregate root representing an employee's request for regular travel allowance

**Key Attributes:**
- id: string - Unique identifier for the request
- employeeId: string - Reference to the requesting employee
- managerId: string - Reference to the approving manager
- projectId: string - Reference to the project
- subProjectId: string - Reference to the specific subproject
- daysPerWeek: number - Number of travel days requested per week
- justification: string - Employee's reason for the travel request
- status: RequestStatus - Current approval status
- calculatedDistance: number - Straight-line distance in kilometers
- calculatedAllowance: number - Daily allowance amount in CHF
- submittedAt: Date - When the request was submitted
- processedAt: Date | null - When approved/rejected
- processedBy: string | null - Manager who processed the request
- rejectionReason: string | null - Reason if rejected

#### TypeScript Interface
```typescript
interface TravelRequest {
  id: string;
  employeeId: string;
  managerId: string;
  projectId: string;
  subProjectId: string;
  daysPerWeek: number;
  justification: string;
  status: RequestStatus;
  calculatedDistance: number;
  calculatedAllowance: number;
  submittedAt: Date;
  processedAt: Date | null;
  processedBy: string | null;
  rejectionReason: string | null;
}
```

#### Relationships
- Belongs to one Employee (employeeId)
- Managed by one Manager (managerId)
- References one Project and SubProject
- Can have multiple StatusHistory entries

### Employee

**Purpose:** Represents an employee who can submit travel requests

**Key Attributes:**
- id: string - Unique employee identifier
- email: string - Employee email address
- firstName: string - Employee first name
- lastName: string - Employee last name
- homeAddress: Address - Employee's home location for distance calculation
- managerId: string - Default manager for requests
- isActive: boolean - Whether employee can submit requests

#### TypeScript Interface
```typescript
interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  homeAddress: Address;
  managerId: string;
  isActive: boolean;
}
```

#### Relationships
- Has many TravelRequests
- Reports to one Manager
- Has one Address

### Project

**Purpose:** Represents a project with specific locations where employees travel

**Key Attributes:**
- id: string - Unique project identifier
- name: string - Project display name
- description: string - Project description
- isActive: boolean - Whether project accepts new requests
- defaultCostPerKm: number - Default CHF rate per kilometer

#### TypeScript Interface
```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  defaultCostPerKm: number;
}
```

#### Relationships
- Has many SubProjects
- Referenced by many TravelRequests

### SubProject

**Purpose:** Specific work location within a project with precise geographic coordinates

**Key Attributes:**
- id: string - Unique subproject identifier
- projectId: string - Parent project reference
- name: string - Subproject display name
- location: Location - Geographic coordinates and address
- costPerKm: number - Specific CHF rate per kilometer (can override project default)
- isActive: boolean - Whether subproject accepts new requests

#### TypeScript Interface
```typescript
interface SubProject {
  id: string;
  projectId: string;
  name: string;
  location: Location;
  costPerKm: number;
  isActive: boolean;
}
```

#### Relationships
- Belongs to one Project
- Referenced by many TravelRequests
- Has one Location

### Address (Value Object)

**Purpose:** Immutable address representation for distance calculations

#### TypeScript Interface
```typescript
interface Address {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
}
```

### Location (Value Object)

**Purpose:** Geographic location with coordinates for project sites

#### TypeScript Interface
```typescript
interface Location {
  address: Address;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}
```

### RequestStatus (Enum)

**Purpose:** Defines valid states for travel requests

#### TypeScript Interface
```typescript
enum RequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn'
}
```

## API Specification

Based on the REST API style from our tech stack and the core workflows identified in brainstorming, here's the complete OpenAPI specification for RegularTravelManager:

```yaml
openapi: 3.0.0
info:
  title: RegularTravelManager API
  version: 1.0.0
  description: REST API for managing employee travel allowance requests and approvals
servers:
  - url: https://1kkd1bbkmh.execute-api.eu-central-1.amazonaws.com/dev
    description: Production API (Development Environment)
  - url: https://dz57qvo83kxos.cloudfront.net/api
    description: Production API via CloudFront proxy
    
components:
  securitySchemes:
    CognitoAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      
  schemas:
    TravelRequest:
      type: object
      required: [employeeId, managerId, projectId, subProjectId, daysPerWeek, justification]
      properties:
        id:
          type: string
          format: uuid
        employeeId:
          type: string
          description: Cognito user ID for authentication
        managerId:
          type: string
          description: Manager's Cognito user ID
        projectId:
          type: string
          format: uuid
        subProjectId:
          type: string
          format: uuid
        daysPerWeek:
          type: integer
          minimum: 1
          maximum: 7
        justification:
          type: string
          minLength: 10
          maxLength: 500
        status:
          type: string
          enum: [pending, approved, rejected, withdrawn]
        calculatedDistance:
          type: number
          format: float
        calculatedAllowance:
          type: number
          format: float
        submittedAt:
          type: string
          format: date-time
        processedAt:
          type: string
          format: date-time
          nullable: true
        processedBy:
          type: string
          description: Processing manager's Cognito user ID
          nullable: true
        rejectionReason:
          type: string
          nullable: true

security:
  - CognitoAuth: []

paths:
  /travel-requests:
    post:
      summary: Submit a new travel request
      tags: [Travel Requests]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [managerId, projectId, subProjectId, daysPerWeek, justification]
              properties:
                managerId:
                  type: string
                  description: Manager's Cognito user ID
                projectId:
                  type: string
                  format: uuid
                subProjectId:
                  type: string
                  format: uuid
                daysPerWeek:
                  type: integer
                  minimum: 1
                  maximum: 7
                justification:
                  type: string
                  minLength: 10
                  maxLength: 500
      responses:
        '201':
          description: Travel request created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TravelRequest'
                
  /manager/requests:
    get:
      summary: Get requests for manager approval
      tags: [Manager]
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, approved, rejected]
            default: pending
      responses:
        '200':
          description: List of requests for approval
          content:
            application/json:
              schema:
                type: object
                properties:
                  requests:
                    type: array
                    items:
                      $ref: '#/components/schemas/TravelRequest'
```

## Components

Based on our DDD architecture, AWS serverless platform, and identified workflows, here are the major logical components across the fullstack:

### TravelRequestService

**Responsibility:** Core domain service managing the complete travel request lifecycle including submission, processing, and status management

**Key Interfaces:**
- `submitRequest(dto: CreateTravelRequestDto): Promise<TravelRequest>`
- `processRequest(requestId: string, action: ProcessAction): Promise<TravelRequest>`
- `getRequestsByEmployee(employeeId: string): Promise<TravelRequest[]>`
- `getRequestsForManager(managerId: string): Promise<TravelRequest[]>`

**Dependencies:** TravelRequestRepository, DistanceCalculator, AllowanceCalculator, NotificationService

**Technology Stack:** Lambda functions with Fastify, TypeScript domain models, PostgreSQL with repository pattern

### DistanceCalculator

**Responsibility:** Calculates straight-line distance between employee home address and project subproject location

**Key Interfaces:**
- `calculateDistance(from: Address, to: Address): Promise<number>`
- `validateCoordinates(address: Address): boolean`

**Dependencies:** PostGIS geometric functions, Address value objects

**Technology Stack:** PostgreSQL PostGIS ST_Distance function, TypeScript geometric calculations as fallback

### NotificationService

**Responsibility:** Handles email notifications for request status changes and new submissions

**Key Interfaces:**
- `notifyRequestSubmitted(request: TravelRequest, manager: Employee): Promise<void>`
- `notifyRequestApproved(request: TravelRequest, employee: Employee): Promise<void>`
- `notifyRequestRejected(request: TravelRequest, employee: Employee, reason: string): Promise<void>`

**Dependencies:** AWS SES, Employee data for email addresses, email templates

**Technology Stack:** AWS SES SDK, TypeScript template engine, Lambda event triggers

## Core Workflows

### Primary Workflow: Request Submission → Manager Approval

```mermaid
sequenceDiagram
    participant E as Employee
    participant UI as TravelRequestUI
    participant API as API Gateway
    participant TC as TravelRequestController
    participant TS as TravelRequestService
    participant DC as DistanceCalculator
    participant TR as TravelRequestRepository
    participant NS as NotificationService
    participant DB as PostgreSQL
    participant M as Manager

    E->>UI: Fill request form
    UI->>API: POST /travel-requests
    API->>TC: Route request with JWT token
    TC->>TS: submitRequest(createRequestDto)
    
    TS->>DC: calculateDistance(employeeAddress, projectLocation)
    DC->>DB: PostGIS ST_Distance query
    DB-->>DC: Distance in kilometers
    DC-->>TS: Calculated distance
    
    TS->>TR: save(travelRequestAggregate)
    TR->>DB: INSERT travel request with calculated values
    
    TS->>NS: notifyRequestSubmitted(request, manager)
    NS->>M: Email notification
    
    TS-->>TC: Created travel request
    TC-->>UI: Request created successfully
    UI-->>E: Show success with calculated allowance
```

## Database Schema

PostgreSQL schema with PostGIS for geographic calculations:

```sql
-- Enable PostGIS extension for geographic functions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Employees table with home address and coordinates
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    home_street VARCHAR(255) NOT NULL,
    home_city VARCHAR(100) NOT NULL,
    home_postal_code VARCHAR(20) NOT NULL,
    home_country VARCHAR(100) NOT NULL DEFAULT 'Switzerland',
    home_location GEOMETRY(POINT, 4326) NOT NULL,
    manager_id UUID REFERENCES employees(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Projects table for organizing work locations
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_cost_per_km DECIMAL(10,2) NOT NULL CHECK (default_cost_per_km > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Subprojects table for specific work locations  
CREATE TABLE subprojects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    street_address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'Switzerland',
    location GEOMETRY(POINT, 4326) NOT NULL,
    cost_per_km DECIMAL(10,2) NOT NULL CHECK (cost_per_km > 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Travel requests table (main aggregate)
CREATE TABLE travel_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    manager_id UUID NOT NULL REFERENCES employees(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    subproject_id UUID NOT NULL REFERENCES subprojects(id),
    days_per_week INTEGER NOT NULL CHECK (days_per_week >= 1 AND days_per_week <= 7),
    justification TEXT NOT NULL CHECK (LENGTH(justification) >= 10),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    calculated_distance_km DECIMAL(10,3) NOT NULL CHECK (calculated_distance_km >= 0),
    calculated_allowance_chf DECIMAL(10,2) NOT NULL CHECK (calculated_allowance_chf >= 0),
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE NULL,
    processed_by UUID NULL REFERENCES employees(id),
    rejection_reason TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Employee address history for audit trail
CREATE TABLE employee_address_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    previous_street VARCHAR(255) NOT NULL,
    previous_city VARCHAR(100) NOT NULL,
    previous_postal_code VARCHAR(20) NOT NULL,
    previous_country VARCHAR(100) NOT NULL,
    previous_location GEOMETRY(POINT, 4326) NOT NULL,
    new_street VARCHAR(255) NOT NULL,
    new_city VARCHAR(100) NOT NULL,
    new_postal_code VARCHAR(20) NOT NULL,
    new_country VARCHAR(100) NOT NULL,
    new_location GEOMETRY(POINT, 4326) NOT NULL,
    change_reason TEXT,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by UUID NOT NULL REFERENCES employees(id)
);

-- Request status history for audit trail  
CREATE TABLE request_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    travel_request_id UUID NOT NULL REFERENCES travel_requests(id),
    previous_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    comment TEXT,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by UUID NOT NULL REFERENCES employees(id)
);

-- Database indexes for performance
CREATE INDEX idx_employees_manager_id ON employees(manager_id);
CREATE INDEX idx_employees_location ON employees USING GIST (home_location);
CREATE INDEX idx_projects_is_active ON projects(is_active);
CREATE INDEX idx_subprojects_project_id ON subprojects(project_id);
CREATE INDEX idx_subprojects_location ON subprojects USING GIST (location);
CREATE INDEX idx_subprojects_is_active ON subprojects(is_active);
CREATE INDEX idx_travel_requests_employee_id ON travel_requests(employee_id);
CREATE INDEX idx_travel_requests_manager_id ON travel_requests(manager_id);
CREATE INDEX idx_travel_requests_status ON travel_requests(status);
CREATE INDEX idx_travel_requests_submitted_at ON travel_requests(submitted_at);
CREATE INDEX idx_employee_address_history_employee_id ON employee_address_history(employee_id);
CREATE INDEX idx_request_status_history_travel_request_id ON request_status_history(travel_request_id);

-- Function to calculate distance using PostGIS
CREATE OR REPLACE FUNCTION calculate_travel_distance(
    employee_location GEOMETRY,
    project_location GEOMETRY
) RETURNS DECIMAL(10,3) AS $$
BEGIN
    RETURN ST_Distance(
        employee_location::geography, 
        project_location::geography
    ) / 1000.0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

## Frontend Architecture

### Component Architecture

Angular components organized by feature modules following DDD principles:

```
apps/web/src/
├── app/
│   ├── features/
│   │   ├── employee/
│   │   │   ├── components/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── new-request/
│   │   │   │   └── travel-request-form/
│   │   │   ├── services/
│   │   │   │   └── travel-request.service.ts
│   │   │   ├── employee.module.ts
│   │   │   └── employee-routing.module.ts
│   │   ├── manager/
│   │   │   ├── components/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── approvals/
│   │   │   │   └── pending-approvals-table/
│   │   │   ├── services/
│   │   │   │   └── manager-dashboard.service.ts
│   │   │   ├── manager.module.ts
│   │   │   └── manager-routing.module.ts
│   ├── shared/
│   │   ├── components/
│   │   │   ├── forms/
│   │   │   └── tables/
│   │   └── services/
│   │       └── project.service.ts
│   ├── core/
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── employee.service.ts
│   │   │   └── config.service.ts
│   │   ├── guards/
│   │   └── interceptors/
│   │       ├── auth.interceptor.ts
│   │       └── response.interceptor.ts
```

### State Management

RxJS service-based state management pattern with reactive data flow:

```typescript
// Service-based State Management with BehaviorSubjects
@Injectable({ providedIn: 'root' })
export class TravelRequestService {
  private requestsSubject = new BehaviorSubject<TravelRequest[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  // Public observables for reactive state
  public requests$ = this.requestsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  async submitRequest(dto: CreateTravelRequestDto): Promise<TravelRequest> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    
    try {
      const request = await firstValueFrom(
        this.http.post<TravelRequest>('/api/travel-requests', dto)
      );
      
      // Update state reactively
      const currentRequests = this.requestsSubject.value;
      this.requestsSubject.next([...currentRequests, request]);
      
      return request;
    } catch (error) {
      this.errorSubject.next(error.message);
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  loadRequests(): Observable<TravelRequest[]> {
    this.loadingSubject.next(true);
    
    return this.http.get<TravelRequest[]>('/api/travel-requests').pipe(
      tap(requests => {
        this.requestsSubject.next(requests);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.errorSubject.next(error.message);
        this.loadingSubject.next(false);
        return throwError(error);
      })
    );
  }
}

// Component Usage Pattern
@Component({...})
export class EmployeeDashboardComponent {
  requests$ = this.travelRequestService.requests$;
  loading$ = this.travelRequestService.loading$;
  error$ = this.travelRequestService.error$;

  constructor(private travelRequestService: TravelRequestService) {}

  ngOnInit() {
    this.travelRequestService.loadRequests().subscribe();
  }
}
```

## Backend Architecture

### Service Architecture

AWS Lambda functions organized by domain:

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

### Authentication

#### Production Authentication (AWS Cognito)

AWS Cognito integration with JWT validation for production:

```typescript
// Production Auth Service using AWS Amplify + Cognito
@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.currentUser$.pipe(map(user => !!user));

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const result = await signIn({
      username: credentials.email,
      password: credentials.password
    });
    
    const user = await getCurrentUser();
    const session = await fetchAuthSession();
    
    return {
      user: this.mapAuthUserToUser(user, session.tokens),
      accessToken: session.tokens.accessToken.toString()
    };
  }
}
```

#### Development Authentication (Mock Mode)

For development environment, mock authentication with production-matching users:

```typescript
// Development Mock Users (matching production data)
const MOCK_USERS = {
  employee1: {
    id: 'employee1-cognito-id',
    email: 'employee1@company.com',
    name: 'John Employee',
    role: 'employee' as const,
    groups: ['employees']
  },
  employee2: {
    id: 'employee2-cognito-id', 
    email: 'employee2@company.com',
    name: 'Jane Worker',
    role: 'employee' as const,
    groups: ['employees']
  },
  manager1: {
    id: 'manager1-cognito-id',
    email: 'manager1@company.com', 
    name: 'Bob Manager',
    role: 'manager' as const,
    groups: ['managers', 'employees']
  },
  manager2: {
    id: 'manager2-cognito-id',
    email: 'manager2@company.com',
    name: 'Alice Director', 
    role: 'manager' as const,
    groups: ['managers', 'employees']
  }
};

// User switching in development (browser console):
// localStorage.setItem('mockUser', 'employee1|employee2|manager1|manager2');
// window.location.reload();
```

#### Authentication Environment Parity

- **Production**: AWS Cognito User Pools with JWT tokens
- **Development**: Mock authentication with same user data structure
- **LocalStack**: Cognito is Pro feature - uses mock mode
- **User roles**: Consistent employee/manager permissions across environments

## Unified Project Structure

DDD-based monorepo structure:

```
RegularTravelManager/
├── domains/                           # Domain Layer (Business Logic)
│   ├── travel-allowance/             # Core Domain
│   │   ├── src/
│   │   │   ├── domain/               # Pure business logic
│   │   │   │   ├── entities/
│   │   │   │   │   ├── TravelRequest.ts
│   │   │   │   │   └── Allowance.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── DistanceCalculator.ts
│   │   │   │   │   └── AllowanceCalculator.ts
│   │   │   │   └── repositories/
│   │   │   │       └── ITravelRequestRepository.ts
│   │   │   ├── application/          # Use cases
│   │   │   │   ├── commands/
│   │   │   │   └── queries/
│   │   │   └── infrastructure/       # Infrastructure adapters
├── apps/                             # Application Layer
│   ├── web/                         # Angular Frontend
│   └── api/                         # Lambda Functions
├── packages/                        # Shared packages
│   ├── shared/                      # Shared types
│   └── ui/                          # UI components
├── infrastructure/                   # AWS CDK
└── docs/
    ├── prd.md
    └── architecture.md
```

## Development Workflow

### Local Development Setup

```bash
# Prerequisites
node --version  # v20+
npm --version   # v9+

# Initial setup
npm install
npm run setup

# Development environment setup (LocalStack + Docker)
npm run dev:env           # Start infrastructure (PostgreSQL, Redis, LocalStack)
npm run localstack:init   # Initialize AWS services (DynamoDB, S3)
./test-setup.sh          # Verify environment health

# Development commands
npm run dev:full          # Start infrastructure + API + web app
npm run dev:api:local     # API server against local infrastructure  
npm run dev:web           # Angular frontend
npm run dev:env:logs      # View all service logs
npm run dev:env:restart   # Clean restart all services

# Deployment commands (4-stack architecture)
npm run deploy            # Deploy all stacks to dev environment
npm run deploy:staging    # Deploy all stacks to staging
npm run deploy:production # Deploy all stacks to production

# Stack-specific deployment (from infrastructure workspace)
cd infrastructure
npm run deploy:infrastructure:dev  # Core services only
npm run deploy:lambda:dev         # Lambda functions only
npm run deploy:api:dev           # API Gateway only  
npm run deploy:web:dev           # Frontend only

# Frontend-only deployment (faster for UI changes)
npm run deploy:frontend:dev      # Build + deploy frontend to dev
npm run deploy:frontend:staging  # Build + deploy frontend to staging
npm run deploy:frontend:production # Build + deploy frontend to production
```

### Development Environment Configuration

**Local Development with LocalStack (95% Production Parity):**

```typescript
// apps/api/src/config/environment.ts - Auto-detects local vs production
export const environment = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  AWS_ENDPOINT_URL: isLocal ? 'http://localhost:4566' : undefined,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://nissim:devpass123@localhost:5432/travel_manager_dev',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  AWS_REGION: 'eu-central-1',
  
  // AWS Service Configuration (auto-switches local/prod)
  COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || 'local-pool-id',
  S3_BUCKET_NAME: isLocal ? 'rtm-documents-dev' : 'rtm-documents-prod',
  DYNAMODB_TABLES: {
    projects: `rtm-projects-${isLocal ? 'dev' : 'prod'}`,
    subprojects: `rtm-subprojects-${isLocal ? 'dev' : 'prod'}`
  }
};
```

**Docker Compose Services:**
```yaml
services:
  postgres:    # PostgreSQL 15 + PostGIS → AWS RDS
  redis:       # Redis 7.2 → AWS ElastiCache  
  localstack:  # LocalStack 3.0 → AWS Services
    # - DynamoDB (projects, subprojects)
    # - S3 (document storage)
    # - Location Service (mocked for development)
```

## Deployment Architecture

### Deployment Strategy

**Frontend Deployment:**
- Platform: AWS S3 + CloudFront
- Build Command: `ng build --configuration production`
- Output Directory: `apps/web/dist/web`

**Backend Deployment:**
- Platform: AWS Lambda + API Gateway
- Build Command: `npm run build:api`
- Deployment Method: AWS CDK

### Environments

| Environment | Frontend | Backend | Database | AWS Services | Purpose |
|-------------|----------|---------|----------|--------------|---------|
| **Development** | localhost:4200 | localhost:3000 | PostgreSQL:5432 | LocalStack:4566 | Local development with AWS parity |
| **AWS Dev** (Current) | https://dz57qvo83kxos.cloudfront.net | https://1kkd1bbkmh.execute-api.eu-central-1.amazonaws.com/dev/ | rtm-dev-infrastructure-databaseb269d8bb-ynfofwwlfkkm.c18k2mga4rnh.eu-central-1.rds.amazonaws.com | AWS eu-central-1 | Live AWS deployment for testing |
| **Staging** | staging.travel.com | api-staging.travel.com | RDS Staging | AWS Staging | Pre-production testing |
| **Production** | travel.com | api.travel.com | RDS Production | AWS Production | Live environment |

**Development Environment Benefits:**
- ✅ **< 15 minute setup** for new developers
- ✅ **95% production parity** with real AWS behavior  
- ✅ **Zero cost** for AWS services during development
- ✅ **Offline development** capability
- ✅ **Same codebase** deploys to all environments

## Security and Performance

### Security Requirements

**Frontend Security:**
- CSP Headers: strict-dynamic with nonce
- XSS Prevention: Content sanitization, secure headers
- Secure Storage: JWT tokens in httpOnly cookies

**Backend Security:**
- Input Validation: OpenAPI schema validation
- Rate Limiting: API Gateway throttling
- CORS Policy: Restricted origins only

**Authentication Security:**
- Token Storage: Secure httpOnly cookies
- Session Management: Cognito refresh tokens
- Password Policy: AWS Cognito managed

### Performance Optimization

**Frontend Performance:**
- Bundle Size Target: <200KB initial load
- Loading Strategy: Code splitting, lazy loading
- Caching Strategy: Service worker for static assets

**Backend Performance:**
- Response Time Target: <500ms for API calls
- Database Optimization: Connection pooling, indexed queries
- Caching Strategy: ElastiCache for frequent lookups

## Testing Strategy

### Testing Pyramid

```
        E2E Tests (Playwright)
       /                    \
    Integration Tests (API + DB)
   /                            \
Frontend Unit (Jest + Angular)  Backend Unit (Vitest)
```

### Test Organization

**Frontend Tests:**
- Component tests with Angular Testing Utilities
- Service tests with Angular TestBed
- Integration tests for complete user workflows
- E2E tests for critical business processes

**Backend Tests:**
- Unit tests for domain logic and services
- Integration tests for API endpoints
- Database tests for repository implementations

## API Response Handling

### Response Interceptor Pattern

The backend consistently returns wrapped API responses in this format:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  requestId: string;
}
```

**Frontend Response Handling Rule:** All HTTP services should expect unwrapped data types directly, as the response interceptor automatically extracts the `data` field from wrapped responses.

### Implementation

**Response Interceptor (`apps/web/src/app/core/interceptors/response.interceptor.ts`):**

```typescript
export const responseInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    map(event => {
      if (event.type === HttpEventType.Response) {
        const response = event as HttpResponse<any>;
        
        // Check if response has the wrapped format
        if (response.body && 
            typeof response.body === 'object' && 
            'success' in response.body && 
            'data' in response.body) {
          
          // Clone the response and replace body with unwrapped data
          return response.clone({
            body: response.body.data
          });
        }
      }
      
      return event;
    })
  );
};
```

**Service Implementation Pattern:**

```typescript
// ✅ Correct: Expect unwrapped data types directly
getEmployee(cognitoUserId: string): Observable<EmployeeDto> {
  return this.http.get<EmployeeDto>(`${this.baseUrl}/employees/${cognitoUserId}`);
}

// ❌ Incorrect: Manual unwrapping (interceptor handles this)
getEmployee(cognitoUserId: string): Observable<EmployeeDto> {
  return this.http.get<{data: EmployeeDto}>(`${this.baseUrl}/employees/${cognitoUserId}`)
    .pipe(map(response => response.data));
}
```

### Configuration

The interceptor is registered in `app.config.ts`:

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor, responseInterceptor])),
    // ... other providers
  ]
};
```

## Coding Standards

### Critical Fullstack Rules

- **Type Sharing:** Always define types in packages/shared and import from there
- **API Calls:** Never make direct HTTP calls - use the service layer
- **Response Handling:** Always expect unwrapped data types in services - the response interceptor handles unwrapping automatically
- **Environment Variables:** Access only through config objects, never process.env directly
- **Error Handling:** All API routes must use the standard error handler
- **State Updates:** Never mutate state directly - use immutable updates with BehaviorSubject.next()
- **State Management:** Use RxJS services with BehaviorSubjects for reactive state management
- **Service Observables:** Always expose state as observables (requests$, loading$, error$)

### State Management Patterns

#### Service-Based State Management

**Core Pattern**: Each domain feature has a dedicated service that manages state using RxJS BehaviorSubjects.

```typescript
@Injectable({ providedIn: 'root' })
export class FeatureStateService {
  // Private state subjects
  private dataSubject = new BehaviorSubject<DataType[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  // Public observables (read-only)
  public data$ = this.dataSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable(); 
  public error$ = this.errorSubject.asObservable();

  // State update methods
  updateData(newData: DataType[]): void {
    this.dataSubject.next(newData);
  }
}
```

**Key Principles:**
- Use BehaviorSubjects for state that has a current value
- Expose only observables publicly, keep subjects private
- Follow immutable update patterns
- Include loading and error state management
- Use async/await for API calls, tap operator for state updates

#### Component Integration Pattern

```typescript
@Component({...})
export class FeatureComponent implements OnInit, OnDestroy {
  // Subscribe to state observables
  data$ = this.stateService.data$;
  loading$ = this.stateService.loading$;
  error$ = this.stateService.error$;
  
  private destroy$ = new Subject<void>();

  constructor(private stateService: FeatureStateService) {}

  ngOnInit(): void {
    // Load initial data
    this.stateService.loadData()
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

#### Template Usage Pattern

```html
<!-- Use async pipe for automatic subscription management -->
<div *ngIf="loading$ | async" class="loading-spinner">Loading...</div>

<div *ngIf="error$ | async as error" class="error-message">
  {{ error }}
</div>

<div *ngFor="let item of data$ | async">
  {{ item.name }}
</div>
```

### Naming Conventions

| Element | Frontend | Backend | Example |
|---------|----------|---------|---------|
| Components | PascalCase | - | `UserProfileComponent` |
| Services | PascalCase + 'Service' | - | `AuthService` |
| Directives | camelCase | - | `appHighlight` |
| API Routes | - | kebab-case | `/api/user-profile` |
| **API Request/Response Fields** | **camelCase** | **camelCase** | `defaultCostPerKm`, `isActive` |
| Database Tables | - | snake_case | `user_profiles` |
| Database Columns | - | snake_case | `default_cost_per_km`, `is_active` |

### API Field Naming Rules

**CRITICAL**: All API request/response bodies MUST use camelCase field names for consistency across frontend and backend.

#### Frontend to Backend Communication
- **Frontend models**: Use camelCase (e.g., `defaultCostPerKm`, `isActive`)
- **API requests**: Send camelCase fields to backend
- **API responses**: Receive camelCase fields from backend
- **Database queries**: Backend converts camelCase ↔ snake_case internally

#### Implementation Pattern
```typescript
// ✅ Correct: Frontend sends camelCase
const projectData = {
  name: "Project Name",
  defaultCostPerKm: 0.75,
  isActive: true
};

// ✅ Correct: Backend receives camelCase, converts to snake_case for DB
const dbFields = {
  name: projectData.name,
  default_cost_per_km: projectData.defaultCostPerKm,  // Convert for DB
  is_active: projectData.isActive
};

// ✅ Correct: Backend returns camelCase to frontend
return {
  id: row.id,
  name: row.name,
  defaultCostPerKm: parseFloat(row.default_cost_per_km),  // Convert from DB
  isActive: row.is_active
};
```

#### Rationale
- **Frontend consistency**: TypeScript/Angular standards use camelCase
- **API consistency**: Single naming convention across all endpoints
- **Database separation**: Internal DB schema uses snake_case as per SQL standards
- **Developer experience**: No field name confusion between layers

## Error Handling Strategy

### Error Response Format

```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
}
```

### Frontend Error Handling

```typescript
// Angular Error Interceptor
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.authService.logout();
          this.router.navigate(['/login']);
        } else if (error.status >= 500) {
          this.snackBar.open('Server error. Please try again later.', 'Close');
        }
        return throwError(error);
      })
    );
  }
}
```

## Frontend Subscription Lifecycle Management

### Phase 1 & Phase 2 Implementation (Critical for Memory Management)

This system implements a two-phase subscription cleanup strategy to eliminate memory leaks and prevent unauthorized error messages during logout. **All new components and services MUST implement these patterns.**

#### Phase 1: Application-Level Subscription Management

**Purpose:** Clean up business logic subscriptions (API calls, form watchers, timers)

**Implementation Pattern:**
```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({...})
export class YourComponent implements OnInit, OnDestroy {
  // Phase 1: Add destroy subject
  private destroy$ = new Subject<void>();

  constructor(private yourService: YourService) {}

  ngOnInit(): void {
    // Phase 1: All subscriptions must use takeUntil(this.destroy$)
    this.yourService.getData()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        // Handle data
      });

    // Form value changes
    this.formControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        // Handle form changes
      });
  }

  ngOnDestroy(): void {
    // Phase 1: Trigger cleanup for all subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

**Service Implementation Pattern:**
```typescript
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class YourService implements OnDestroy {
  // Phase 1: Global cleanup subject for service-level subscriptions
  private destroy$ = new Subject<void>();
  
  private dataSubject = new BehaviorSubject<DataType[]>([]);
  private autoRefreshSubscription?: any;

  constructor(private http: HttpClient) {}

  startAutoRefresh(): void {
    this.stopAutoRefresh();
    
    // Phase 1: Auto-refresh timer with cleanup
    this.autoRefreshSubscription = timer(60000, 60000)
      .pipe(
        switchMap(() => this.loadData()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: data => this.dataSubject.next(data),
        error: error => {
          // Phase 1: Ignore auth errors during logout
          if (error.status !== 401 && error.status !== 403) {
            console.error('Auto-refresh failed:', error);
          }
        }
      });
  }

  private refreshData(): void {
    // Phase 1: Refresh calls with proper cleanup
    this.loadData()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: error => {
          // Phase 1: Silent auth error handling during cleanup
          if (error.status !== 401 && error.status !== 403) {
            console.error('Failed to refresh data:', error);
          }
        }
      });
  }

  // Phase 1: Cleanup method for logout scenarios
  public cleanup(): void {
    this.destroy$.next();
    console.log('YourService: All subscriptions cleaned up');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

#### Phase 2: Angular Framework-Level Cleanup

**Purpose:** Clean up Angular's internal subscriptions (296+ framework subscriptions)

**Core Service Implementation:**
```typescript
// apps/web/src/app/core/services/angular-cleanup.service.ts
import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AngularCleanupService {
  private ngZone = inject(NgZone);
  private router = inject(Router);
  private http = inject(HttpClient);
  private location = inject(Location);

  // Global cleanup trigger for Angular internals
  private cleanupTrigger$ = new Subject<void>();

  /**
   * Phase 2: Force cleanup of Angular's internal subscription management
   * Targets 296+ internal Angular subscriptions that survive logout
   */
  public forceCleanupAngularInternals(): void {
    console.log('🧹 Phase 2: Starting Angular framework cleanup...');

    // 1. Signal cleanup to all tracked subscriptions
    this.cleanupTrigger$.next();

    // 2. Clean NgZone pending tasks
    this.cleanupNgZoneTasks();

    // 3. Clean Router subscriptions
    this.cleanupRouterSubscriptions();

    // 4. Clean HTTP client internal state
    this.cleanupHttpClientInternals();

    // 5. Clean Location service subscriptions
    this.cleanupLocationSubscriptions();

    // 6. Force garbage collection of Angular forms
    this.cleanupAngularForms();

    // 7. Clean change detection subscriptions
    this.cleanupChangeDetection();

    console.log('✅ Phase 2: Angular framework cleanup completed');
  }

  private cleanupNgZoneTasks(): void {
    try {
      // Cancel pending NgZone tasks
      (this.ngZone as any)._inner?.cancelAnimationFrame?.();
      (this.ngZone as any)._inner?.clearTimeout?.();
      (this.ngZone as any)._inner?.clearInterval?.();
    } catch (error) {
      // Silent cleanup
    }
  }

  private cleanupRouterSubscriptions(): void {
    try {
      // Clean router internal subscriptions
      const routerInternal = (this.router as any);
      routerInternal.navigationTransitions?.complete?.();
      routerInternal.routerState?.complete?.();
    } catch (error) {
      // Silent cleanup
    }
  }

  private cleanupHttpClientInternals(): void {
    try {
      // Clean HTTP client internal state
      const httpInternal = (this.http as any);
      httpInternal.handler?.complete?.();
    } catch (error) {
      // Silent cleanup
    }
  }

  private cleanupLocationSubscriptions(): void {
    try {
      // Clean Location service subscriptions
      const locationInternal = (this.location as any);
      locationInternal.subject?.complete?.();
    } catch (error) {
      // Silent cleanup
    }
  }

  private cleanupAngularForms(): void {
    try {
      // Force cleanup of form controls and validators
      document.querySelectorAll('form').forEach(form => {
        const formInternal = (form as any);
        formInternal._ngModel?.complete?.();
      });
    } catch (error) {
      // Silent cleanup
    }
  }

  private cleanupChangeDetection(): void {
    try {
      // Clean change detection subscriptions
      const ngZoneInternal = (this.ngZone as any);
      ngZoneInternal.onStable?.complete?.();
      ngZoneInternal.onUnstable?.complete?.();
      ngZoneInternal.onError?.complete?.();
      ngZoneInternal.onMicrotaskEmpty?.complete?.();
    } catch (error) {
      // Silent cleanup
    }
  }
}
```

**Integration with AuthService:**
```typescript
// apps/web/src/app/core/services/auth.service.ts
export class AuthService {
  constructor(
    private angularCleanupService: AngularCleanupService
  ) {}

  logout(): Observable<void> {
    // Phase 1: Trigger application-level cleanup
    this.triggerServiceCleanup();
    
    // Phase 2: Force Angular framework cleanup
    this.angularCleanupService.forceCleanupAngularInternals();
    
    // Continue with normal logout process
    return this.performLogout();
  }

  private triggerServiceCleanup(): void {
    // Call cleanup() on all services that implement it
    this.projectService.cleanup();
    this.managerDashboardService.cleanup();
    this.employeeService.cleanup();
  }
}
```

#### HTTP Request Cancellation Pattern

**Enhanced Auth Interceptor with Cleanup:**
```typescript
// apps/web/src/app/core/interceptors/auth.interceptor.ts
import { Subject, EMPTY, timeout, takeUntil } from 'rxjs';

// Global HTTP cleanup subject for request cancellation
let globalHttpCleanup$ = new Subject<void>();

export function triggerHttpCleanup(): void {
  globalHttpCleanup$.next();
  globalHttpCleanup$.complete();
  globalHttpCleanup$ = new Subject<void>();
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const user = authService.getCurrentUser();

  if (user?.accessToken) {
    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${user.accessToken}` }
    });
    
    return next(authReq).pipe(
      takeUntil(globalHttpCleanup$),
      timeout(30000)
    );
  } else {
    // Allow config file requests to proceed (needed for app initialization)
    if (req.url.includes('/assets/config/')) {
      return next(req).pipe(
        takeUntil(globalHttpCleanup$),
        timeout(30000)
      );
    }
    
    // Phase 2: Cancel unauthorized requests instead of allowing them
    return EMPTY;
  }
};
```

#### Enhanced Error Interceptor:
```typescript
// apps/web/src/app/core/interceptors/error.interceptor.ts
import { Subject } from 'rxjs';

// Global error cleanup subject
let globalErrorCleanup$ = new Subject<void>();

export function triggerErrorCleanup(): void {
  globalErrorCleanup$.next();
  globalErrorCleanup$.complete();
  globalErrorCleanup$ = new Subject<void>();
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    takeUntil(globalErrorCleanup$),
    catchError((error: HttpErrorResponse) => {
      const isUserAuthenticated = !!authService.getCurrentUser();
      
      // Only show errors if user is actually authenticated
      if (isUserAuthenticated && error.status === 401) {
        // Handle unauthorized error
      } else if (!isUserAuthenticated) {
        // Suppress errors during logout/unauthenticated state
        return EMPTY;
      }
      
      return throwError(() => error);
    })
  );
};
```

### Implementation Requirements for New Code

#### 🚨 Mandatory Patterns for All Components

1. **Component Subscription Management:**
   ```typescript
   export class YourComponent implements OnInit, OnDestroy {
     private destroy$ = new Subject<void>();
     
     ngOnInit(): void {
       // ALL subscriptions MUST use takeUntil(this.destroy$)
       this.service.data$.pipe(takeUntil(this.destroy$)).subscribe(/*...*/);
     }
     
     ngOnDestroy(): void {
       this.destroy$.next();
       this.destroy$.complete();
     }
   }
   ```

2. **Service Subscription Management:**
   ```typescript
   @Injectable({ providedIn: 'root' })
   export class YourService implements OnDestroy {
     private destroy$ = new Subject<void>();
     
     // ALL internal subscriptions use takeUntil(this.destroy$)
     private loadData(): void {
       this.http.get('/api/data')
         .pipe(takeUntil(this.destroy$))
         .subscribe(/*...*/);
     }
     
     public cleanup(): void {
       this.destroy$.next();
     }
     
     ngOnDestroy(): void {
       this.destroy$.next();
       this.destroy$.complete();
     }
   }
   ```

3. **Auth Error Handling Pattern:**
   ```typescript
   // In all subscription error handlers
   .subscribe({
     error: error => {
       // Ignore auth errors silently during logout
       if (error.status !== 401 && error.status !== 403) {
         console.error('Operation failed:', error);
         // Show user-facing error
       }
     }
   });
   ```

#### Integration Checklist for New Features

- [ ] All components implement `OnDestroy` with `destroy$` subject
- [ ] All subscriptions use `takeUntil(this.destroy$)`
- [ ] Services implement `cleanup()` method 
- [ ] Auth error handling ignores 401/403 during logout
- [ ] Auto-refresh timers are properly cancelled
- [ ] Form value change subscriptions are cleaned up
- [ ] HTTP requests are cancellable via global cleanup subjects

### Why This Architecture is Critical

**Problem Solved:** After implementing authentication logout, users were seeing unauthorized error messages despite HTTP requests completing successfully. Investigation revealed:

1. **Phase 1 Issue:** Application subscriptions (timers, forms, API calls) continued running after logout
2. **Phase 2 Issue:** Angular's internal framework subscriptions (296+ active) were not being cleaned up, causing memory leaks and error propagation

**Benefits of Implementation:**
- ✅ **Zero unauthorized errors** after logout
- ✅ **Memory leak prevention** for long-running applications  
- ✅ **Improved performance** through proper resource cleanup
- ✅ **Better user experience** with clean logout process
- ✅ **Scalable pattern** that prevents subscription management issues in new features

**Developer Requirements:**
- **Phase 1 patterns are MANDATORY** for all new components and services
- **Phase 2 integration is automatic** through AuthService logout process
- **Testing must verify** that no subscriptions survive component destruction
- **Code reviews must check** for proper takeUntil usage

This subscription lifecycle management is **non-negotiable architecture** that ensures application stability and user experience quality.

## Monitoring and Observability

### Monitoring Stack

- **Frontend Monitoring:** Sentry for error tracking, Web Vitals
- **Backend Monitoring:** AWS CloudWatch for Lambda metrics
- **Error Tracking:** CloudWatch Logs with structured logging
- **Performance Monitoring:** X-Ray for request tracing

### Key Metrics

**Frontend Metrics:**
- Core Web Vitals (LCP, FID, CLS)
- JavaScript errors and stack traces
- API response times from client perspective
- User interaction analytics

**Backend Metrics:**
- Lambda invocation rate and duration
- API Gateway 4xx/5xx error rates
- Database query performance
- Business KPIs (requests submitted, approval rates)

## Epic 5: User Management - Brownfield Enhancement Architecture

### Overview

Epic 5 extends the existing Cognito authentication system with comprehensive user lifecycle management capabilities, enabling self-service registration, profile management, and administrative user control while maintaining full backward compatibility with existing authentication flows.

### Integration Points

**Existing Systems Enhanced:**
- **AWS Cognito User Pool** (`eu-central-1_LFA9Rhk2y`): Extended with registration APIs and user management operations
- **Employee Database Schema**: Enhanced with additional profile fields and audit tracking
- **Angular Authentication Service**: Extended with registration and profile management methods
- **Lambda Authorizer**: Enhanced to support new user management operations with proper role-based access

### API Extensions

**New Lambda Functions:**
```typescript
// User Registration & Profile Management
POST /api/auth/register           // User registration with email verification
PUT  /api/auth/profile            // Profile updates with geocoding
POST /api/auth/change-password    // Password change with validation
POST /api/auth/verify-email       // Email verification process

// Admin User Management  
GET  /api/admin/users             // List all users with pagination
PUT  /api/admin/users/{id}/role   // Role assignment (employee/manager/admin)
PUT  /api/admin/users/{id}/manager // Manager assignment
DELETE /api/admin/users/{id}      // User deletion with cleanup

// Manager Team Management
GET  /api/manager/team            // Team member listing
PUT  /api/manager/employees/{id}  // Limited employee profile updates
```

**Authentication Extensions:**
- Registration flow integrates with existing JWT token validation
- Profile updates trigger address geocoding using existing PostGIS functions
- Admin operations respect existing role-based authorization patterns
- Manager team access follows existing employee-manager relationship model

### Database Schema Extensions

**Employee Table Enhancement:**
```sql
-- Add columns to existing employees table (backward compatible)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true}';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMP;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;

-- Audit trail for profile changes
CREATE TABLE employee_profile_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    changed_fields JSONB,
    old_values JSONB,
    new_values JSONB,
    changed_by UUID,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**User Registration Tracking:**
```sql
-- Track registration process and verification
CREATE TABLE user_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    verification_token VARCHAR(255),
    verified_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Frontend Architecture Extensions

**New Angular Components:**
- `UserRegistrationComponent`: Self-service registration with form validation
- `ProfileManagementComponent`: User profile editing with address geocoding
- `AdminUserManagementComponent`: Admin dashboard for user operations
- `ManagerTeamComponent`: Manager team management interface

**Service Extensions:**
```typescript
// AuthService extensions (maintains existing functionality)
class AuthService {
  // Existing methods preserved...
  
  // New registration methods
  register(userData: RegisterRequest): Observable<RegisterResponse>
  verifyEmail(token: string): Observable<void>
  updateProfile(updates: ProfileUpdate): Observable<UserProfile>
  changePassword(passwordChange: PasswordChange): Observable<void>
}

// New admin service
class AdminService {
  getUsers(filters: UserFilters): Observable<UserList>
  updateUserRole(userId: string, role: UserRole): Observable<void>
  assignManager(userId: string, managerId: string): Observable<void>
  deleteUser(userId: string): Observable<void>
}
```

**Route Extensions:**
```typescript
// Add to existing route configuration
const routes: Routes = [
  // Existing routes preserved...
  
  // Public registration routes
  { path: 'register', component: UserRegistrationComponent },
  { path: 'verify-email', component: EmailVerificationComponent },
  
  // Protected user routes  
  { path: 'profile', component: ProfileManagementComponent, canActivate: [AuthGuard] },
  
  // Admin-only routes
  { path: 'admin/users', component: AdminUserManagementComponent, canActivate: [AdminGuard] },
  
  // Manager routes
  { path: 'manager/team', component: ManagerTeamComponent, canActivate: [ManagerGuard] }
];
```

### Security & Compatibility Considerations

**Backward Compatibility Guarantees:**
- All existing API endpoints remain unchanged
- Current user sessions continue working without interruption  
- Existing authentication flow (login/logout/token refresh) preserved
- Database schema changes are purely additive

**Security Enhancements:**
- Registration requires email verification before account activation
- Password complexity requirements align with existing Cognito policies
- Admin operations require elevated permissions with audit logging
- Manager authority limited to assigned employees only

**Migration Strategy:**
- Existing test users remain functional in Cognito User Pool
- New registration creates both Cognito user and employee database record
- Profile updates for existing users are optional (default values provided)
- Feature flags enable gradual rollout with safe rollback capability

### Implementation Sequence

**Story 5.1 - User Registration:**
- Extend Cognito with registration APIs
- Add email verification workflow  
- Create registration UI components

**Story 5.2 - Profile Management:**
- Extend AuthService with profile methods
- Add profile management UI
- Implement address geocoding integration

**Story 5.3 - Admin User Management:**
- Create admin Lambda functions
- Build admin dashboard UI
- Implement role assignment workflows

**Story 5.4 - Manager Team Management:**
- Extend manager permissions
- Create team management UI
- Add employee profile editing for managers

This architecture maintains the system's existing reliability while adding comprehensive user management capabilities that transform the static test user system into a dynamic, production-ready user management platform.

---

*Architecture document generated using the BMAD-METHOD™ framework*