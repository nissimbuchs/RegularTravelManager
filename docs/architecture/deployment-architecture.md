# Deployment Architecture

## Deployment Strategy

**Frontend Deployment:**
- Platform: AWS S3 + CloudFront
- Build Command: `ng build --configuration production`
- Output Directory: `apps/web/dist/web`

**Backend Deployment:**
- Platform: AWS Lambda + API Gateway
- Build Command: `npm run build:api`
- Deployment Method: AWS CDK

## Environments

| Environment | Frontend URL | Backend URL | Purpose |
|-------------|-------------|-------------|---------|
| Development | localhost:3000 | localhost:3001 | Local development |
| Staging | staging.travel.com | api-staging.travel.com | Pre-production testing |
| Production | travel.com | api.travel.com | Live environment |
