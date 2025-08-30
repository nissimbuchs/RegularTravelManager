# RegularTravelManager Infrastructure

AWS CDK Infrastructure as Code for the RegularTravelManager application.

## Overview

This CDK project provisions the complete AWS infrastructure for RegularTravelManager, a Swiss-compliant travel request management system. The infrastructure is deployed to EU-Central-1 region for data residency compliance.

## Architecture Components

- **API Gateway**: RESTful API with Cognito authentication
- **AWS Lambda**: Serverless compute with Fastify framework
- **RDS PostgreSQL**: Database with PostGIS extension for geographic queries
- **Amazon Cognito**: User authentication and authorization
- **AWS Location Service**: Geocoding for Swiss and European addresses
- **Amazon SES**: Email notifications for travel requests
- **VPC**: Network isolation with public/private/isolated subnets
- **CloudWatch**: Monitoring and logging

## Quick Start

### Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **Node.js** 18+ and npm
3. **AWS CDK** 2.100+

### Setup

```bash
# Install dependencies
npm install

# Bootstrap CDK (one-time setup)
npm run bootstrap

# Build the project
npm run build
```

### Deployment

```bash
# Deploy development environment
npm run deploy

# Deploy specific environment
npm run cdk -- deploy --context environment=staging

# Deploy production with domain
npm run cdk -- deploy --context environment=production --context domainName=yourdomain.com
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run watch` | Watch mode compilation |
| `npm run test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run deploy` | Deploy infrastructure |
| `npm run destroy` | Destroy infrastructure |
| `npm run synth` | Synthesize CloudFormation template |
| `npm run diff` | Show deployment diff |
| `npm run bootstrap` | Bootstrap CDK |
| `npm run lint` | Run ESLint |

## Environment Configuration

The stack supports three environments:

- **dev**: Development with minimal resources
- **staging**: Staging with production-like configuration
- **production**: Production with high availability and security

### Environment-Specific Features

| Feature | Dev | Staging | Production |
|---------|-----|---------|------------|
| RDS Instance | t3.micro | t3.small | t3.small |
| Backup Retention | 1 day | 7 days | 7 days |
| Deletion Protection | L | L |  |
| Performance Insights | L | L |  |
| CORS Origins | All | All | Domain-specific |
| API Logging | Full | Full | Errors only |

## Configuration Parameters

All configuration is stored in AWS Systems Manager Parameter Store under `/rtm/{environment}/`:

### Database
- `database/endpoint` - RDS endpoint
- `database/port` - RDS port (5432)

### Authentication
- `cognito/user-pool-id` - Cognito User Pool ID
- `cognito/client-id` - Cognito Client ID

### API
- `api/gateway-id` - API Gateway ID
- `api/base-url` - API Gateway URL

### Location Service
- `location/place-index-name` - Place index for geocoding

### Email
- `ses/domain` - SES verified domain
- `ses/from-email` - From email address

## Post-Deployment Setup

### 1. Enable PostGIS Extension

Connect to RDS and run:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

### 2. Configure SES (Production Only)

1. Verify domain identity in AWS SES Console
2. Add required DNS records (DKIM, SPF, DMARC)
3. Request production access to exit SES sandbox

### 3. Test Location Service

```bash
aws location search-place-index-for-text \
  --index-name rtm-dev-places \
  --text "Bahnhofstrasse 1, Zurich, Switzerland"
```

## Security Features

- **VPC Isolation**: Database in private subnets
- **IAM Least Privilege**: Minimal permissions for Lambda functions
- **Encryption**: TLS/HTTPS for all data transmission
- **Secrets Management**: Database credentials in Secrets Manager
- **Regional Compliance**: EU-Central-1 for Swiss data residency

## User Groups

The Cognito User Pool includes two groups:

- **employees**: Submit travel requests
- **managers**: Approve travel requests

## Monitoring

- **CloudWatch Logs**: All Lambda function logs
- **API Gateway Logging**: Request/response logging (configurable)
- **X-Ray Tracing**: Distributed tracing enabled
- **Performance Insights**: RDS performance monitoring (production)

## Development

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

### Useful Commands

```bash
# Preview changes
npm run cdk -- diff --context environment=dev

# View synthesized template
npm run cdk -- synth --context environment=dev

# List all stacks
npm run cdk -- list
```

## Troubleshooting

### Common Issues

1. **Bootstrap Required**: Run `npm run bootstrap` before first deployment
2. **Region Mismatch**: Must use `eu-central-1` for Swiss compliance
3. **Permissions**: Ensure AWS credentials have CDK permissions
4. **VPC Limits**: Check VPC and subnet limits in your account

### Cleanup

  **Warning**: This will delete all data and resources

```bash
npm run destroy
```

## Support

For deployment issues, check:
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Detailed deployment guide
- AWS CloudFormation events in the AWS Console
- CDK context and configuration files

## Tags

All resources are tagged with:
- `Project`: RegularTravelManager
- `Environment`: {environment}
- `ManagedBy`: CDK
- `CostCenter`: IT-Operations