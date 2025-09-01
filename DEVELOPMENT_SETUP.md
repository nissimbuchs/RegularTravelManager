# RegularTravelManager - Development Environment Setup

## 🚀 Quick Start (< 15 minutes)

### Prerequisites
- **Docker Desktop** (with Docker Compose)
- **Node.js 20+** with npm
- **Git**
- **Optional**: AWS CLI (for manual LocalStack testing)

### 1. Start Development Environment

```bash
# Start all services (PostgreSQL, LocalStack, Redis)
npm run dev:env

# Check service health
npm run localstack:status
docker ps
```

### 2. Initialize LocalStack AWS Services

```bash
# Run initialization scripts
npm run localstack:init
```

This creates:
- ✅ Mock authentication with production-matching test users
- ✅ DynamoDB tables with sample data  
- ✅ S3 bucket for documents
- ✅ Location Service configuration (mocked)

### 3. Start Development

```bash
# Option A: Start everything at once
npm run dev:full

# Option B: Start services separately
npm run dev:api    # API server on :3000
npm run dev:web    # Angular app on :4200
```

### 4. Test Your Setup

Visit: http://localhost:3000/health
Expected response:
```json
{
  "status": "ok",
  "environment": "development",
  "services": {
    "database": "connected",
    "localstack": "ready",
    "redis": "connected"
  }
}
```

## 🔧 Architecture Overview

### Service Stack
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Angular App   │    │   Node.js API   │    │   PostgreSQL    │
│   :4200         │◄──►│   :3000         │◄──►│   :5432         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                ▲
                                │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   LocalStack    │    │     Redis       │
                       │   :4566         │    │     :6379       │
                       └─────────────────┘    └─────────────────┘
```

### LocalStack Services
- **Authentication**: Mock authentication with production user data (Cognito is Pro feature)
- **DynamoDB**: Project/subproject data storage
- **S3**: Document storage
- **Location Service**: Geocoding (mocked for development)
- **API Gateway**: REST API routing simulation

## 📋 Available Scripts

### Environment Management
```bash
npm run dev:env           # Start all Docker services
npm run dev:env:logs      # View all service logs
npm run dev:env:clean     # Stop & remove all containers + data
npm run dev:env:restart   # Clean restart of all services
```

### Development
```bash
npm run dev:full         # Start environment + API + web
npm run dev:api:local    # API only (without Docker)
npm run debug:api        # API with debugger on :9229
```

### LocalStack Management
```bash
npm run localstack:init   # Initialize AWS services
npm run localstack:status # Check LocalStack health
npm run logs:localstack   # View LocalStack logs
npm run logs:postgres     # View PostgreSQL logs
npm run logs:redis        # View Redis logs
```

### Testing
```bash
npm run test:integration  # Run integration tests
npm run test:e2e:local   # Run E2E tests against local env
```

## 🔐 Development Authentication

### Production-Matching Test Users

The development environment uses mock authentication with production user data:

| User | Email | Name | Role | Employee ID |
|------|-------|------|------|-------------|
| **employee1** | employee1@company.com | John Employee | Employee | EMP001 |
| **employee2** | employee2@company.com | Jane Worker | Employee | EMP002 |
| **manager1** | manager1@company.com | Bob Manager | Manager | MGR001 |
| **manager2** | manager2@company.com | Alice Director | Manager | MGR002 |

### Switching Users in Development

**Method 1: Browser Console (F12)**
```javascript
// Switch to any user (defaults to employee1)
localStorage.setItem('mockUser', 'employee1');   // John Employee
localStorage.setItem('mockUser', 'employee2');   // Jane Worker  
localStorage.setItem('mockUser', 'manager1');    // Bob Manager
localStorage.setItem('mockUser', 'manager2');    // Alice Director
window.location.reload();
```

**Method 2: URL Parameter**
- Visit: `http://localhost:4200?user=manager1`
- Or: `http://localhost:4200?user=employee2`

### Authentication Notes

- **No passwords required** in development - authentication is mocked
- **Production parity**: Same user data structure as production Cognito
- **Role-based access**: Managers can access employee data, employees cannot
- **LocalStack**: Cognito is Pro feature - using frontend mock authentication

## 🗄️ Sample Data

### DynamoDB Tables
- **Projects**: 2 sample projects (Digital Transformation, Office Relocation)
- **Subprojects**: 3 sample subprojects linked to main projects

### S3 Bucket
- Sample receipts and templates in `rtm-documents-dev` bucket

## 🐛 Debugging

### VSCode Debug Configuration

Add to `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API (Local)",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/apps/api/src/dev-server.ts",
      "runtimeArgs": ["--loader", "tsx/esm"],
      "env": {
        "NODE_ENV": "development",
        "AWS_ENDPOINT_URL": "http://localhost:4566"
      },
      "console": "integratedTerminal",
      "restart": true
    }
  ]
}
```

### Debug Steps
1. Set breakpoints in your API code
2. Run `npm run debug:api` 
3. Attach debugger to port `:9229`
4. Make API calls to trigger breakpoints

## 🔧 Configuration

### Environment Variables

| Variable | Development | Production | Description |
|----------|-------------|------------|-------------|
| `NODE_ENV` | `development` | `production` | Environment mode |
| `AWS_ENDPOINT_URL` | `http://localhost:4566` | _undefined_ | LocalStack endpoint |
| `DATABASE_URL` | `postgresql://nissim@postgres:5432/...` | RDS endpoint | Database connection |
| `COGNITO_USER_POOL_ID` | Auto-generated | Real pool ID | Cognito configuration |

### Service Configuration

Services automatically detect local vs production:
- **Local**: Uses LocalStack endpoints with mock credentials
- **Production**: Uses real AWS services with IAM roles

## 📊 Monitoring

### Health Checks
```bash
# Overall system health
curl http://localhost:3000/health

# LocalStack health
curl http://localhost:4566/_localstack/health

# Service-specific health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Logs
```bash
# All services
npm run dev:env:logs

# Individual services
npm run logs:localstack
npm run logs:postgres  
npm run logs:redis
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Find process using port
lsof -i :4566  # or :3000, :5432, etc.

# Stop conflicting services
npm run dev:env:clean
```

#### 2. LocalStack Not Ready
```bash
# Check LocalStack status
npm run localstack:status

# View initialization logs
npm run logs:localstack

# Restart LocalStack
docker restart rtm-localstack
```

#### 3. Database Connection Failed
```bash
# Check PostgreSQL status
npm run logs:postgres

# Verify database
docker exec -it rtm-postgres psql -U nissim -d travel_manager_dev -c "\\dt"
```

#### 4. AWS Service Errors
```bash
# Reinitialize LocalStack services
npm run localstack:init

# Check service health
curl http://localhost:4566/_localstack/health | jq .
```

#### 5. Permission Denied (Docker)
```bash
# Fix Docker permissions (macOS/Linux)
sudo chmod 666 /var/run/docker.sock

# Or add user to docker group
sudo usermod -aG docker $USER
# Then logout/login
```

### Reset Everything
```bash
# Nuclear option - clean slate
npm run dev:env:clean
docker system prune -f
npm run dev:env
npm run localstack:init
```

## 🔄 Development Workflow

### Typical Development Day

1. **Morning Setup** (first time):
   ```bash
   npm run dev:env        # Start infrastructure
   npm run localstack:init # Initialize AWS services
   ```

2. **Daily Development**:
   ```bash
   npm run dev:full       # Start everything
   # Code, test, debug...
   ```

3. **End of Day**:
   ```bash
   # Optional: Keep running for next day
   # Or clean up:
   npm run dev:env:clean
   ```

### Testing New Features

1. **Unit Tests**: Run continuously during development
2. **Integration Tests**: Test against LocalStack services
3. **E2E Tests**: Full application testing
4. **Cloud Validation**: Deploy to dev environment weekly

### Database Changes

1. Update migration scripts in `/init-db.sql`
2. Restart PostgreSQL: `docker restart rtm-postgres`
3. Or full reset: `npm run dev:env:restart`

### AWS Service Updates

1. Modify LocalStack init scripts in `/localstack/init/`
2. Restart LocalStack: `docker restart rtm-localstack`
3. Re-run initialization: `npm run localstack:init`

## 🚀 Production Deployment

### Environment Differences

| Aspect | Development | Production |
|--------|-------------|------------|
| **Database** | PostgreSQL Docker | AWS RDS PostgreSQL |
| **Authentication** | Mock authentication (frontend) | AWS Cognito User Pools |
| **Storage** | LocalStack S3/DynamoDB | AWS S3/DynamoDB |
| **Location** | Mock geocoding service | AWS Location Service |
| **Networking** | Docker Compose | VPC + Security Groups |

### Deployment Process

1. **Code remains identical** - no environment-specific changes
2. **Environment variables** switch to production values
3. **AWS services** use real endpoints instead of LocalStack
4. **IAM roles** replace mock credentials

## 📚 Additional Resources

- [LocalStack Documentation](https://docs.localstack.cloud/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Angular Documentation](https://angular.io/docs)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## 🆘 Getting Help

1. **Check this README** - Most issues covered here
2. **Check service logs** - `npm run dev:env:logs`  
3. **Reset environment** - `npm run dev:env:restart`
4. **Team Slack** - #dev-regular-travel-manager
5. **Architecture Documentation** - `/docs/development-environment-parity-strategy.md`

---

**🎉 Happy Coding!** You now have full AWS service parity in local development.