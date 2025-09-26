# Infrastructure & Deployment Architecture

## Infrastructure Strategy

**Deployment Platforms:**
- **Frontend:** AWS S3 + CloudFront with Angular build artifacts
- **Backend:** AWS Lambda + API Gateway with TypeScript/Node.js
- **Infrastructure:** AWS CDK for declarative infrastructure-as-code

## Environment Architecture

| Environment | Frontend | Backend | Database | AWS Services | Purpose |
|-------------|----------|---------|----------|--------------|---------|
| **Development** | localhost:4200 | localhost:3000 | PostgreSQL:5432 | LocalStack:4566 | Local development with AWS parity |
| **AWS Dev** | https://dz57qvo83kxos.cloudfront.net | https://1kkd1bbkmh.execute-api.eu-central-1.amazonaws.com/dev/ | rtm-dev-infrastructure-databaseb269d8bb-ynfofwwlfkkm.c18k2mga4rnh.eu-central-1.rds.amazonaws.com | AWS eu-central-1 | Live AWS deployment for testing |
| **Staging** ✅ | https://rtm-staging.buchs.be | https://api-staging.buchs.be | RDS Staging | AWS eu-central-1 | Pre-production testing with custom domains |
| **Production** | company.com | api.company.com | RDS Production | AWS Production | Live environment |

**Key Architectural Principle:** Same codebase deploys across all environments with environment-specific configuration injection.

## Dynamic Configuration Architecture

### Critical Design Pattern: Runtime Configuration Generation

**🚨 ARCHITECTURAL PRINCIPLE:** Frontend configuration is dynamically generated at deployment time, not build time.

**Why This Pattern:**
- Environment-specific values (API URLs, Cognito pools) only exist after AWS infrastructure deployment
- Security: No hardcoded AWS resource identifiers in source code
- Flexibility: Configuration updates without frontend rebuilds
- CloudFront integration: Configurations served as static assets

### Configuration Flow Architecture
```
Infrastructure Deployment → Config Generation → S3 Upload → CloudFront Delivery → Frontend Bootstrap
```

**Components:**
1. **Config Generator Lambda:** Fetches values from SSM Parameter Store and generates environment-specific JSON
2. **CloudFormation Custom Resource:** Triggers configuration generation during stack deployment
3. **Frontend ConfigService:** Loads and validates configuration during app initialization

**CloudFront Reverse Proxy Pattern:**
- Frontend served from CloudFront root (`/`)
- API calls proxied through CloudFront (`/api/*`)
- Benefits: Same-origin requests, simplified CORS, unified domain

## API Gateway & Lambda Integration Pattern

### Critical Integration Requirement

**🚨 MANDATORY:** New frontend service calls require infrastructure updates. Missing this causes 403/404 errors.

### 5-Stack Integration Architecture

**Dependency Chain:** `InfrastructureStack → LambdaStack → ApiGatewayStack → CertificateStack → WebStack`

**i18n Integration:** AWS Translate service permissions in InfrastructureStack, TranslateMasterData Lambda function in LambdaStack, translation API endpoint in ApiGatewayStack, and JSON translation assets in WebStack.

**CloudFormation Export/Import Pattern:**
- LambdaStack exports Lambda ARNs
- ApiGatewayStack imports ARNs and creates integrations
- CertificateStack exports SSL certificate ARNs (us-east-1 region)
- WebStack imports API URL and certificate ARNs for configuration generation

### Mandatory Integration Process

**For every new frontend HTTP service call:**

1. **Create Handler Function** - Business logic implementation with middleware
2. **Add Lambda Function to LambdaStack** - Function declaration and ARN export
3. **Import Function in ApiGatewayStack** - CloudFormation import with permissions
4. **Configure API Gateway Route** - HTTP method, path, and Lambda integration

**Translation Service Integration Example:**
- **Handler:** `translate-master-data.ts` with AWS Translate client integration
- **LambdaStack:** `translateMasterDataFunction` with AWS Translate IAM permissions
- **ApiGatewayStack:** `/api/translate-master-data` POST endpoint with Cognito auth
- **Permissions:** `translate:TranslateText` and `translate:ListLanguages` actions

**Integration Checklist Critical Points:**
- Handler function uses standardized middleware
- Lambda function ARN properly exported from LambdaStack
- API Gateway import uses `sameEnvironment: true` for permissions
- Route path exactly matches frontend service call path
- Lambda integration includes proper authorization and permissions
- AWS service permissions (Translate, RDS) configured in Lambda execution role
- Translation cache table access permissions included for master data translation

### Architecture Enforcement

This 4-step integration process is **non-negotiable** for system stability. Code reviews must verify all steps are completed, and testing must include direct API endpoint verification.

**Historical Issues Prevented:**
- Missing API Gateway routes causing 403/404 errors
- Lambda functions not connected to API Gateway methods
- Path mismatches between frontend calls and infrastructure configuration

## Deployment Strategy Benefits

- **Independent Stack Deployment:** Update frontend without touching backend infrastructure
- **Environment Parity:** LocalStack provides 95% AWS production behavior for development
- **Configuration Security:** Dynamic generation prevents hardcoded credentials and includes JSON translation assets served via CloudFront
- **Integration Reliability:** Systematic 4-step process prevents common infrastructure issues

## SSL Certificate Management and Cross-Region Deployment

**AWS CloudFront Certificate Requirements:**
CloudFront distributions require SSL certificates to be deployed in the `us-east-1` region, regardless of where your other resources are located. This is a hard AWS requirement that cannot be circumvented.

**Certificate Architecture:**
```typescript
// ❌ Incorrect: Certificate in eu-central-1 (fails with CloudFront)
this.certificate = new acm.Certificate(this, 'WebCertificate', {
  domainName: domainName,
  validation: acm.CertificateValidation.fromDns(this.hostedZone),
  // No region specified = uses stack region (eu-central-1)
});

// ✅ Correct: Cross-region certificate for CloudFront
this.certificate = new acm.DnsValidatedCertificate(this, 'WebCertificate', {
  domainName: domainName,
  hostedZone: this.hostedZone,
  region: 'us-east-1', // Required for CloudFront
});
```

**Deployment Process:**
1. **Route 53 Hosted Zone**: Created in primary region (eu-central-1)
2. **SSL Certificate**: Created in us-east-1 with DNS validation
3. **DNS Validation**: CNAME records added to external DNS provider (Hostpoint)
4. **CloudFront Distribution**: Uses cross-region certificate
5. **Route 53 A Record**: Points custom domain to CloudFront

**Staging Environment Setup Completed ✅:**
- **Custom Domains**: rtm-staging.buchs.be, api-staging.buchs.be
- **SSL Certificates**: Valid TLS certificates in us-east-1
- **DNS Validation**: CNAME records configured via Hostpoint
- **CloudFront**: Distribution with custom domain and SSL
- **Route 53**: A record pointing to CloudFront distribution

**Key Lessons:**
- Always use `DnsValidatedCertificate` for CloudFront deployments
- Certificate region must be `us-east-1` for CloudFront compatibility
- DNS validation requires external DNS provider coordination
- Cross-region certificate deployment works seamlessly with proper CDK constructs
- AWS Translate must be deployed in same region as other services (eu-central-1)
- Translation cache requires PostgreSQL table with proper TTL and cleanup functions
