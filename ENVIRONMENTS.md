# Environment Configuration Guide

## Overview

This project now uses a clear, typical environment naming convention that separates local development, AWS environments, and build configurations.

## Environment Files

| File | Purpose | When Used |
|------|---------|-----------|
| `environment.ts` | **Local Development** | Running locally with `ng serve` |
| `environment.dev.ts` | **AWS Dev Environment** | Deploying to AWS dev resources |
| `environment.staging.ts` | **AWS Staging Environment** | Future staging deployment |
| `environment.prod.ts` | **AWS Production Environment** | Future production deployment |

## Current Environment Settings

### Local (`environment.ts`)
- API URL: `http://localhost:3000`
- Mock Auth: `true`
- For: Development with LocalStack

### AWS Dev (`environment.dev.ts`)
- API URL: `https://a8xznik0n8.execute-api.eu-central-1.amazonaws.com/dev`
- Cognito Pool: `eu-central-1_hp5idXPch`
- Mock Auth: `true` (currently)
- For: AWS dev environment deployment

### AWS Staging (`environment.staging.ts`)
- API URL: Placeholder for future staging
- Mock Auth: `false` (real Cognito)
- For: Future staging environment

### AWS Production (`environment.prod.ts`)
- API URL: Placeholder for future production
- Mock Auth: `false` (real Cognito)
- For: Future production environment

## Build Commands

### Frontend Build Scripts
```bash
# Build for specific environments
npm run build:frontend:dev      # Uses environment.dev.ts
npm run build:frontend:staging  # Uses environment.staging.ts
npm run build:frontend:prod     # Uses environment.prod.ts

# Default build (dev)
npm run build:frontend          # Uses environment.dev.ts
```

### Angular Build Scripts (within apps/web)
```bash
ng build --configuration dev      # Uses environment.dev.ts
ng build --configuration staging  # Uses environment.staging.ts
ng build --configuration production # Uses environment.prod.ts
```

## Deployment Commands

### Frontend + Infrastructure Deployment
```bash
# Complete deployment (frontend + infrastructure)
npm run deploy:frontend:dev         # Build dev + deploy to AWS dev
npm run deploy:frontend:staging     # Build staging + deploy to AWS staging
npm run deploy:frontend:production  # Build prod + deploy to AWS production

# Default deployment (dev)
npm run deploy:frontend             # Build dev + deploy to AWS dev
```

### Infrastructure-Only Deployment
```bash
# CDK infrastructure deployment
npm run deploy:dev --workspace=infrastructure       # Deploy to dev environment
npm run deploy:staging --workspace=infrastructure   # Deploy to staging environment  
npm run deploy:production --workspace=infrastructure # Deploy to production environment
```

### API Deployment (SAM-based alternative)
```bash
# API deployment (if using SAM instead of CDK)
npm run deploy:dev --workspace=apps/api        # Deploy API to dev
npm run deploy:staging --workspace=apps/api    # Deploy API to staging
npm run deploy:production --workspace=apps/api # Deploy API to production
```

### S3 Frontend Setup (One-time)
```bash
# Create S3 buckets for frontend hosting
npm run deploy:setup:dev --workspace=apps/web        # Setup S3 for dev
npm run deploy:setup:staging --workspace=apps/web    # Setup S3 for staging
npm run deploy:setup:production --workspace=apps/web # Setup S3 for production
```

## Current AWS Resources

All current AWS resources are in the **dev** environment:
- User Pool: `rtm-dev-users`
- API Gateway: `rtm-dev-api`
- Lambda Functions: `rtm-dev-*`
- Database: `rtm-dev-infrastructure-database*`
- S3 Bucket: `rtm-frontend-prod` (name is misleading - actually dev)
- CloudFront: `d2upsy2u9gmj8c.cloudfront.net`

## Migration Notes

**Previous Setup (Confusing):**
- `environment.prod.ts` → AWS dev environment ❌

**New Setup (Clear):**
- `environment.dev.ts` → AWS dev environment ✅
- `environment.prod.ts` → Future AWS production ✅

## Next Steps for Production

When ready for production:
1. Deploy AWS infrastructure with "production" environment
2. Update `environment.prod.ts` with real production URLs
3. Set `useMockAuth: false` for real Cognito authentication
4. Create production deployment scripts

## Example Usage

```bash
# For current AWS deployment (dev environment)
npm run build:frontend:dev
npm run deploy:frontend:dev

# For local development
npm run dev

# For future production deployment
npm run build:frontend:prod
npm run deploy:frontend:prod
```

This setup provides clear separation between environments and eliminates naming confusion.