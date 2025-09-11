# AWS Infrastructure Deployment Guide

This guide explains how to deploy the RegularTravelManager infrastructure using AWS CDK.

## 🚀 Current Deployment Status

**✅ Development Environment (Currently Deployed):**
- **Frontend URL**: https://dz57qvo83kxos.cloudfront.net
- **API Gateway URL**: https://1kkd1bbkmh.execute-api.eu-central-1.amazonaws.com/dev/
- **CloudFront Distribution**: dz57qvo83kxos.cloudfront.net
- **Database Endpoint**: rtm-dev-infrastructure-databaseb269d8bb-ynfofwwlfkkm.c18k2mga4rnh.eu-central-1.rds.amazonaws.com
- **Cognito User Pool**: eu-central-1_LFA9Rhk2y
- **Region**: eu-central-1 (Frankfurt)
- **Stack Names**: 
  - rtm-dev-infrastructure
  - rtm-dev-lambda
  - rtm-dev-api-gateway
  - rtm-dev-web

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

### 2. Sample Data (Already Loaded)

**✅ Sample data has been automatically loaded in the current deployment:**

**Test User Credentials (AWS Cognito):**

**Admin Users (Full System Access):**
- **admin1@company.ch** (Hans Zimmermann, CEO) - Password: `AdminPass123!Test`
- **admin2@company.ch** (Maria Weber, IT Admin) - Password: `AdminPass123!Test`

**Managers:**
- **manager1@company.ch** (Thomas Müller, Regional Manager) - Password: `ManagerPass123!`
- **manager2@company.ch** (Sophie Dubois, Regional Manager) - Password: `ManagerPass123!`

**Employees:**
- **employee1@company.ch** (Anna Schneider, Developer) - Password: `EmployeePass123!`
- **employee2@company.ch** (Marco Rossi, Project Coordinator) - Password: `EmployeePass123!`
- **employee3@company.ch** (Lisa Meier, Business Analyst) - Password: `EmployeePass123!`
- **employee4@company.ch** (Pierre Martin, Marketing Specialist) - Password: `EmployeePass123!`
- **employee5@company.ch** (Julia Fischer, Technical Consultant) - Password: `EmployeePass123!`
- **employee6@company.ch** (Michael Keller, Sales Representative) - Password: `EmployeePass123!`

**Sample Data Includes:**
- ✅ 10 Complete user profiles with proper Cognito integration
- ✅ 4 Business projects with varying cost rates (0.65-0.80 CHF/km)
- ✅ 8 Subprojects across major Swiss cities with precise coordinates
- ✅ 5 Travel requests covering complete lifecycle (pending, approved, rejected, withdrawn)
- ✅ Complete audit trails and status change history
- ✅ Realistic Swiss business scenarios

**Access the Live Application:**
Visit https://dz57qvo83kxos.cloudfront.net and log in with any of the credentials above.

### 3. AWS SES Domain Verification
If deploying with a domain name:
1. Check AWS SES Console for DNS records
2. Add DKIM, SPF, and DMARC records to your domain
3. Request production access (move out of sandbox)

### 4. API Testing
Test the deployed API endpoints:
```bash
# Health check
curl https://1kkd1bbkmh.execute-api.eu-central-1.amazonaws.com/dev/health

# Test authenticated endpoint (requires valid JWT token)
curl -H "Authorization: Bearer $JWT_TOKEN" \
     https://1kkd1bbkmh.execute-api.eu-central-1.amazonaws.com/dev/employees/profile
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
- `/rtm/{env}/api/gateway-url` (Current: https://1kkd1bbkmh.execute-api.eu-central-1.amazonaws.com/dev/)

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