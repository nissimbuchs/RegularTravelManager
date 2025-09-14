# Frequently Asked Questions

## Development Environment

### Why is there no `deploy:local` command?

**Answer**: Local development and AWS deployment use fundamentally different architectures:

- **Local development** runs code directly from source using Docker Compose for fast iteration
- **AWS deployment** uses CDK to provision Lambda functions, S3 buckets, and cloud infrastructure

**Local workflow** (no deployment needed):
```bash
npm run dev:setup    # Start Docker services
npm run dev          # Run from source code - instant changes
```

**AWS workflow** (requires deployment):
```bash
npm run build        # Create production artifacts
npm run deploy:dev   # Deploy to AWS infrastructure
```

This separation provides:
- ⚡ **Fast local development** - no build/deploy cycle needed
- 🏗️ **Production-like AWS testing** - real infrastructure deployment
- 🎯 **Clear separation** - development vs deployment concerns

If you need to test the deployment process locally, you can use `npm run build` to verify the build works, then deploy to the AWS dev environment for infrastructure testing.

### How do I switch between different users in development?

In the browser console (F12), use:
```javascript
// Switch to any user
localStorage.setItem('mockUser', 'admin1');     // Hans Zimmermann (CEO)
localStorage.setItem('mockUser', 'manager1');   // Thomas Müller
localStorage.setItem('mockUser', 'employee1');  // Anna Schneider
window.location.reload();
```

See [SAMPLE_DATA.md](./SAMPLE_DATA.md) for complete user list and details.

### Why do I need Docker for local development?

Docker provides **95% production parity** with AWS services:
- **PostgreSQL** (local) → AWS RDS (production)
- **Redis** (local) → AWS ElastiCache (production)
- **LocalStack** (local) → AWS Services (production)

Benefits:
- ✅ Identical behavior between local and production
- ✅ Zero code changes needed
- ✅ Full offline development capability
- ✅ Cost savings (~€200/month per developer)

### The setup seems complex. Is there a simple way to get started?

Yes! Just run:
```bash
npm install
npm run dev
./test-setup.sh
```

This handles everything automatically in under 15 minutes.

## Architecture & Deployment

### Why 5 stacks instead of 4?

The architecture evolved from 4-stack to 5-stack to support cross-region SSL certificates:

**5-Stack Architecture:**
```
InfrastructureStack (eu-central-1)
└── LambdaStack (eu-central-1)
    └── ApiGatewayStack (eu-central-1)
        └── CertificateStack (us-east-1) ← NEW
            └── WebStack (eu-central-1)
```

**Why CertificateStack is separate:**
- CloudFront requires SSL certificates in `us-east-1` region
- Cross-region dependencies need special handling
- Independent certificate management and renewal
- Better separation of concerns

### What's the difference between `deploy:dev` and `deploy:safe:dev`?

**`deploy:safe:dev` (recommended):**
1. Runs health check to identify conflicts
2. Cleans up problematic log groups
3. Builds all workspaces
4. Deploys with monitoring
5. Outputs status and URLs

**`deploy:dev`:**
- Direct deployment without health checks
- May fail if log groups conflict
- Requires manual troubleshooting if issues arise

**Always use `deploy:safe:*` commands** for reliable deployments.

### Why are there so many deployment commands?

Different deployment needs require different approaches:

**Full Stack Deployment:**
```bash
npm run deploy:safe:dev          # Everything with health checks
npm run deploy:dev               # Everything without health checks
```

**Frontend-Only Deployment (much faster):**
```bash
npm run deploy:frontend:dev      # UI changes only
```

**Individual Stack Deployment (from infrastructure/):**
```bash
npm run deploy:stack:web:dev     # Just the web stack
npm run deploy:stack:lambda:dev  # Just Lambda functions
```

This flexibility allows for:
- ⚡ **Fast UI deployments** (2-3 minutes vs 15+ minutes)
- 🔧 **Targeted fixes** (deploy only what changed)
- 🛠️ **Debugging** (deploy individual components)

## Authentication & Users

### How do I access the live AWS application?

**🌐 Production Application:** https://dz57qvo83kxos.cloudfront.net

**Login with these test accounts:**
- **Admin**: admin1@company.ch / `AdminPass123!Test`
- **Manager**: manager1@company.ch / `ManagerPass123!`
- **Employee**: employee1@company.ch / `EmployeePass123!`

See [SAMPLE_DATA.md](./SAMPLE_DATA.md) for all available test accounts.

### What's the difference between development and production authentication?

**Development (Mock Authentication):**
- No passwords required
- Switch users via browser console
- UUIDs used for consistency
- Fast development iteration

**Production (AWS Cognito):**
- Real password authentication
- User registration and management
- JWT tokens and session management
- Production security standards

Both use the same user data structure for consistency.

## Database & Data

### How do I reset my database if something goes wrong?

```bash
# Complete database reset (removes all data)
npm run db:reset

# Or restart everything from scratch
npm run dev:restart
```

### Where does the sample data come from?

Sample data is consolidated in a single location:
- **Schema**: `apps/api/src/database/migrations/` (incremental migrations)
- **Data**: `infrastructure/data/sample-data.sql` (Swiss business data)
- **Users**: Automatically created in Cognito during setup

This provides a single source of truth with Swiss business scenarios, real geographic data, and complete user workflows.

### How do I add more sample data?

1. Update `infrastructure/data/sample-data.sql`
2. Run `npm run db:seed` to reload data
3. Or run `npm run db:reset` for complete reset

## Testing & Quality

### How do I run specific types of tests?

```bash
npm run test                # All tests
npm run test:integration    # API + database integration tests
npm run test:e2e           # End-to-end user workflow tests
```

### What's the test coverage requirement?

- **Minimum 80% coverage** for new code
- **Integration tests** for all API endpoints
- **E2E tests** for critical user workflows
- **Component tests** for all Angular components

## Troubleshooting

### My deployment failed with log group conflicts. What do I do?

```bash
# Clean up problematic log groups
npm run cleanup:logs:dev

# Use safe deployment (recommended)
npm run deploy:safe:dev

# Or check health first
npm run health:check:dev
```

See [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) for detailed troubleshooting.

### Services won't start locally. How do I fix this?

```bash
# Quick fix - restart everything
npm run dev:restart

# Check what's wrong
npm run dev:logs
./test-setup.sh

# Nuclear option - complete reset
npm run clean:all
npm install
npm run dev
```

### I'm getting TypeScript errors after pulling changes. What should I do?

```bash
# Clean TypeScript cache and rebuild
npm run clean:build
npm run build

# If that doesn't work, nuclear option
npm run clean:all
npm install
npm run build
```

## Performance & Optimization

### How can I speed up development?

**For daily development:**
```bash
npm run dev           # Complete setup (once)
# Then just edit code - auto-reload is enabled
```

**For deployment:**
```bash
npm run deploy:frontend:dev    # UI changes only (2-3 minutes)
npm run deploy:safe:dev        # Full deployment (15+ minutes)
```

### How can I reduce Docker resource usage?

```bash
# Stop services when not needed
npm run dev:clean

# Monitor resource usage
docker stats
```

## Getting Help

### Where should I look for specific information?

- **Commands**: [COMMANDS_REFERENCE.md](./COMMANDS_REFERENCE.md)
- **Sample Data**: [SAMPLE_DATA.md](./SAMPLE_DATA.md)
- **Development Setup**: [DEVELOPMENT_SETUP.md](../DEVELOPMENT_SETUP.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- **Architecture**: [docs/architecture/](../architecture/)
- **Development Standards**: [docs/architecture/07-development-standards.md](../architecture/07-development-standards.md)

### I can't find the answer to my question. What now?

1. Run `./test-setup.sh` to verify your environment
2. Check service logs: `npm run dev:logs`
3. Try a clean restart: `npm run dev:restart`
4. Check the relevant documentation files above
5. Create an issue in the project repository with details about your problem

### How do I know if my environment is working correctly?

Run the health check script:
```bash
./test-setup.sh
```

This verifies:
- ✅ All services are running
- ✅ Database is accessible and has sample data
- ✅ LocalStack is initialized
- ✅ API endpoints are responding
- ✅ Frontend can load configuration

If everything passes, your environment is ready for development.