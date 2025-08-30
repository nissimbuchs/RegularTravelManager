# AWS Infrastructure Deployment Guide

This guide explains how to deploy the RegularTravelManager infrastructure using AWS CDK.

## Prerequisites

1. **AWS CLI Configuration**
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, and region (eu-central-1)
   ```

2. **CDK Bootstrap** (one-time setup per AWS account/region)
   ```bash
   npm run bootstrap
   ```

## Environment Deployment

### Development Environment
```bash
# Deploy to development
npm run deploy

# Or explicitly specify environment
npm run cdk -- deploy --context environment=dev
```

### Staging Environment
```bash
npm run cdk -- deploy --context environment=staging
```

### Production Environment
```bash
npm run cdk -- deploy --context environment=production --context domainName=yourdomain.com
```

## Post-Deployment Setup

### 1. Database PostGIS Extension
After deployment, connect to the RDS instance and enable PostGIS:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

### 2. AWS SES Domain Verification
If deploying with a domain name:
1. Check AWS SES Console for DNS records
2. Add DKIM, SPF, and DMARC records to your domain
3. Request production access (move out of sandbox)

### 3. Location Service Testing
Test geocoding with sample Swiss addresses:
```bash
aws location search-place-index-for-text \
  --index-name rtm-dev-places \
  --text "Bahnhofstrasse 1, Zurich, Switzerland"
```

## Environment Variables

The infrastructure creates these SSM parameters for application configuration:

### Database
- `/rtm/{env}/database/endpoint`
- `/rtm/{env}/database/port`

### Authentication
- `/rtm/{env}/cognito/user-pool-id`
- `/rtm/{env}/cognito/client-id`

### API Gateway
- `/rtm/{env}/api/gateway-id`
- `/rtm/{env}/api/base-url`

### Location Service
- `/rtm/{env}/location/place-index-name`

### Email
- `/rtm/{env}/ses/domain`
- `/rtm/{env}/ses/from-email`

### Performance Configuration
- `/rtm/{env}/config/lambdaTimeout`
- `/rtm/{env}/config/lambdaMemory`
- `/rtm/{env}/config/dbConnections`

## Security Considerations

1. **VPC Security**: Database is isolated in private subnets
2. **IAM Roles**: Lambda functions have least-privilege access
3. **Encryption**: All data transmission uses HTTPS/TLS
4. **Secrets**: Database credentials stored in AWS Secrets Manager
5. **Region**: EU-Central-1 for Swiss data residency compliance

## Monitoring and Logging

- **CloudWatch Logs**: All Lambda functions log to CloudWatch
- **API Gateway**: Request/response logging enabled (non-production)
- **Performance Insights**: Enabled for production RDS
- **X-Ray Tracing**: Enabled for API Gateway

## Cleanup

To destroy infrastructure (⚠️ **DANGER - THIS WILL DELETE ALL DATA**):
```bash
npm run destroy
# Or
npm run cdk -- destroy --context environment=dev
```

## Troubleshooting

### Common Issues

1. **Bootstrap Required**: Run `npm run bootstrap` first
2. **Credentials**: Ensure AWS CLI is configured
3. **Region**: Must use eu-central-1 for Swiss compliance
4. **Permissions**: Deploying user needs CDK and service permissions

### Useful Commands

```bash
# View what will be deployed
npm run cdk -- diff --context environment=dev

# View synthesized CloudFormation template
npm run cdk -- synth --context environment=dev

# List all stacks
npm run cdk -- list
```