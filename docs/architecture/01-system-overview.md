# RegularTravelManager System Overview

## System Purpose & Scope

Swiss employee travel allowance management system designed for enterprise-grade scalability, security, and compliance. Supports employee travel request submission, manager approval workflows, automated distance-based allowance calculations, and comprehensive multilingual support for the Swiss market (German, French, Italian, English).

## Technical Architecture

**Core Platform:** AWS Serverless Architecture
- **Frontend:** Angular 17+ (TypeScript) hosted on S3/CloudFront with JSON-based i18n
- **Backend:** Node.js Lambda functions with API Gateway and AWS Translate integration
- **Database:** PostgreSQL with PostGIS extension for geographic calculations and translation caching
- **Authentication:** AWS Cognito User Pools
- **Translation:** Dual-layer architecture (Static UI + Dynamic master data translation)
- **Infrastructure:** AWS CDK (TypeScript) for infrastructure-as-code

**Geographic Focus:** Swiss business requirements with eu-central-1 (Frankfurt) deployment for data residency compliance.

## AWS CDK 5-Stack Architecture

**Architecture Philosophy:** Independent, linearly-dependent CDK stacks enabling isolated deployments and clear separation of concerns.

### Stack Design

1. **InfrastructureStack** - Foundation layer with core AWS services (VPC, RDS, Cognito, SES, AWS Translate)
2. **LambdaStack** - Compute layer with ~30+ Lambda functions for business logic and translation services
3. **ApiGatewayStack** - API layer with REST endpoints, Lambda integration, and translation proxy endpoints
4. **CertificateStack** - SSL certificates for CloudFront (us-east-1 region)
5. **WebStack** - Presentation layer with frontend hosting, dynamic configuration, and JSON translation assets

### Dependency Flow
```
InfrastructureStack → LambdaStack → ApiGatewayStack → CertificateStack → WebStack
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
- Complete multilingual user experience with instant language switching
- Automatic translation of user-generated content (project names, descriptions)

**Technical Features:**
- Real-time reactive frontend with Angular/RxJS and synchronous JSON-based translation system
- Serverless backend with auto-scaling Lambda functions and AWS Translate integration
- Dynamic configuration management for environment-specific values
- Advanced subscription lifecycle management to prevent memory leaks
- Synchronous translation service with immediate access to pre-loaded JSON translations
- Multi-level translation caching (PostgreSQL backend + frontend memory cache)
- HTTP response interceptor for transparent master data translation

## Development Environment Strategy

**Local Development:** LocalStack + Docker providing 95% AWS production parity
**Benefits:** <15 minute setup, zero AWS costs, offline development capability

**Authentication Strategy:**
- **Production:** AWS Cognito with JWT tokens
- **Development:** Mock authentication with production-matching user data structure

## Multilingual Architecture: Epic 7 - Swiss Market i18n

**Comprehensive Translation System:** Dual-layer architecture providing complete multilingual coverage for Swiss business requirements.

### Layer 1: Synchronous Static UI Translation (JSON-based)
- **Translation Files:** Hierarchical JSON files in `/assets/i18n/` (de.json, fr.json, it.json, en.json)
- **Synchronous Access:** Direct method calls via `translateSync()` for immediate translation results
- **Runtime Translation:** Single application bundle with dynamic language switching and pre-loaded translations
- **Translation Service:** Angular service with synchronous key-based translation and parameter interpolation
- **Template Integration:** Direct service calls: `{{ translationService.translateSync('key') }}`
- **Language Switcher:** Visual component with Swiss flag icons and instant switching

### Layer 2: Dynamic Master Data Translation (AWS Translate)
- **Translation Proxy API:** Lambda function with AWS Translate integration
- **HTTP Response Interceptor:** Automatic translation of API response fields (project names, descriptions)
- **Multi-Level Caching:** PostgreSQL (24h TTL) + frontend memory cache (30min TTL)
- **Configuration-Driven:** Field mapping for automatic translation per API endpoint

**Swiss Market Optimization:**
- **Complete Language Support:** German, French, Italian, English
- **Regional Intelligence:** Smart preloading based on Swiss regions
- **Business Compliance:** EU-central-1 deployment for Swiss data residency
- **Cultural Appropriateness:** Profanity filtering for business content

**Performance Features:**
- **Synchronous UI Translation:** Immediate access to static translations without async overhead
- **Instant Language Switching:** No page reloads for UI or master data
- **Memory Efficient:** Pre-loaded JSON translations for optimal performance
- **Intelligent Caching:** Reduces AWS Translate costs and improves response times
- **Transparent Integration:** Existing components work unchanged with translation interceptor
- **Fallback Resilience:** Original translation key shown if translation fails
- **Simplified Testing:** Synchronous methods easier to unit test than observable streams

## Current Enhancement: Epic 5 - User Management

Brownfield enhancement adding self-service user registration, profile management, and administrative user control while maintaining full backward compatibility with existing authentication flows.