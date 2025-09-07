# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RegularTravelManager is a Swiss employee travel allowance management system built with Angular 17+, Node.js Lambda functions, and AWS services. The project uses a **LocalStack development environment** providing 95% AWS production parity for local development.

## Development Commands

### Quick Start
```bash
# Complete development environment setup (< 15 minutes)
npm run run:local:setup   # Complete setup + start API & web apps
./test-setup.sh          # Verify environment health

# Alternative commands
npm run run:local         # Alias for run:local:setup
npm run dev               # Legacy alias (backward compatibility)
```

### Build Commands
```bash
npm run build             # Build entire project (packages → domains → apps → infrastructure)
npm run build:packages    # Build shared packages only
npm run build:apps        # Build API and web applications only
npm run build:infrastructure # Build AWS CDK infrastructure only
```

### Deploy Commands  
```bash
npm run deploy            # Build + deploy to default environment
npm run deploy:staging    # Build + deploy to staging environment
npm run deploy:production # Build + deploy to production environment
```

### Run Commands - Local Development
```bash
npm run run:local:setup   # Complete setup + start API & web apps
npm run run:local:api     # Start API server only
npm run run:local:web     # Start Angular app only
npm run run:local:env     # Start infrastructure services (Docker)
npm run run:local:env:logs      # View service logs
npm run run:local:env:restart   # Clean restart with complete setup
npm run run:local:env:clean     # Stop and remove all containers
```

### Run Commands - AWS/LocalStack
```bash
npm run run:aws:localstack        # Start LocalStack with initialization
npm run run:aws:localstack:status # Check LocalStack health
npm run run:aws:localstack:pro    # Switch to LocalStack Pro mode
npm run run:aws:localstack:community # Switch to LocalStack Community mode
npm run run:aws:sam               # Start SAM local API Gateway
```

### Database Commands
```bash
npm run db:setup          # Run migrations + load sample data
npm run db:migrate        # Run database migrations only
npm run db:seed           # Load comprehensive sample data only
npm run db:status         # Check migration status
npm run db:reset          # Reset database and reload (⚠️ Removes all data)
npm run db:validate       # Validate sample data integrity
```

### Test Commands
```bash
npm run test              # All tests
npm run test:integration  # Integration tests against LocalStack
npm run test:e2e          # E2E tests in local environment
```

### Utility Commands
```bash
npm run clean             # Clean build artifacts and cache
npm run lint              # Run ESLint with auto-fix
npm run format            # Format code with Prettier  
npm run type-check        # TypeScript type checking
npm run debug:api         # Start API in debug mode
```

## Architecture

### Local Development Stack
- **PostgreSQL** (port 5432) → AWS RDS in production
- **Redis** (port 6379) → AWS ElastiCache in production
- **LocalStack** (port 4566) → AWS Services in production
  - S3 (document storage)
  - Location Service (mocked)

### Technology Stack
- **Frontend**: Angular 17+ with TypeScript, Angular Material UI
- **Backend**: Node.js 20+ with TypeScript, Lambda functions
- **Database**: PostgreSQL 15 with PostGIS extension
- **Infrastructure**: AWS CDK 2.100+ in TypeScript
- **Development**: Docker Compose + LocalStack for AWS parity

### Key Service Configurations
```typescript
// Environment auto-detection
const isLocal = process.env.NODE_ENV === 'development';
const awsEndpoint = isLocal ? 'http://localhost:4566' : undefined;

// Database connection
DATABASE_URL: 'postgresql://nissim:devpass123@localhost:5432/travel_manager_dev'
```

## Development Guidelines

### Before Starting Development
1. **Always run environment health check**: `./test-setup.sh`
2. **Check service logs if issues arise**: `npm run dev:env:logs`
3. **Use LocalStack for all AWS operations in development**
4. **Code should work identically in local and production environments**

### When Adding New Features
- **Use existing AWS service factory** in `apps/api/src/services/aws-factory.ts`
- **Add tests that run against LocalStack services**
- **Update environment configuration if new services needed**
- **Verify changes work in both local and production modes**

### Troubleshooting
- **Services not starting**: `npm run dev:env:restart`
- **LocalStack issues**: `docker logs rtm-localstack`
- **Database issues**: `docker logs rtm-postgres`
- **Reset everything**: `npm run dev:env:clean && npm run dev:env && npm run localstack:init`

## File Structure

```
RegularTravelManager/
├── apps/
│   ├── api/                 # Node.js Lambda functions
│   └── web/                 # Angular frontend
├── docs/
│   ├── architecture.md      # Complete architecture documentation
│   └── DEVELOPMENT_SETUP.md # Detailed setup guide
├── localstack/
│   └── init/               # LocalStack initialization scripts
├── docker-compose.yml      # Development infrastructure
└── test-setup.sh          # Environment verification script
```

## Development Authentication & Sample Data

### Comprehensive Sample Data
The development environment includes complete Swiss business data with production-matching test users:

**Admin Users (Full System Access):**
| User | Email | Name | Role | Employee ID | City |
|------|-------|------|------|-------------|------|
| **admin1** | admin1@company.ch | Hans Zimmermann | CEO/System Admin | ADM-0001 | Zürich |
| **admin2** | admin2@company.ch | Maria Weber | IT Administrator | ADM-0002 | Basel |

**Managers:**
| User | Email | Name | Role | Employee ID | City |
|------|-------|------|------|-------------|------|
| **manager1** | manager1@company.ch | Thomas Müller | Regional Manager | MGR-0001 | Zürich |
| **manager2** | manager2@company.ch | Sophie Dubois | Regional Manager | MGR-0002 | Genève |

**Employees:**
| User | Email | Name | Role | Employee ID | City |
|------|-------|------|------|-------------|------|
| **employee1** | employee1@company.ch | Anna Schneider | Software Developer | EMP-0001 | Bern |
| **employee2** | employee2@company.ch | Marco Rossi | Project Coordinator | EMP-0002 | Lugano |
| **employee3** | employee3@company.ch | Lisa Meier | Business Analyst | EMP-0003 | St. Gallen |
| **employee4** | employee4@company.ch | Pierre Martin | Marketing Specialist | EMP-0004 | Lausanne |
| **employee5** | employee5@company.ch | Julia Fischer | Technical Consultant | EMP-0005 | Basel |
| **employee6** | employee6@company.ch | Michael Keller | Sales Representative | EMP-0006 | Winterthur |

**Sample Data Includes:**
- 4 Business Projects with varying cost rates (0.65-0.80 CHF/km)
- 8 Subprojects across major Swiss cities with precise coordinates
- 5 Travel Requests covering complete lifecycle (pending, approved, rejected, withdrawn)
- Complete audit trails for status changes and address history
- Realistic Swiss business scenarios and geographic coverage

### Switching Users in Development
In the browser console (F12), run:
```javascript
// Admin Users (Full system access)
localStorage.setItem('mockUser', 'admin1');     // Hans Zimmermann (CEO)
localStorage.setItem('mockUser', 'admin2');     // Maria Weber (IT Admin)

// Managers  
localStorage.setItem('mockUser', 'manager1');   // Thomas Müller
localStorage.setItem('mockUser', 'manager2');   // Sophie Dubois

// Employees (default: employee1)
localStorage.setItem('mockUser', 'employee1');  // Anna Schneider (Developer)
localStorage.setItem('mockUser', 'employee2');  // Marco Rossi (PM)
localStorage.setItem('mockUser', 'employee3');  // Lisa Meier (BA)
localStorage.setItem('mockUser', 'employee4');  // Pierre Martin (Marketing)
localStorage.setItem('mockUser', 'employee5');  // Julia Fischer (Consultant)
localStorage.setItem('mockUser', 'employee6');  // Michael Keller (Sales)

window.location.reload();
```

### Authentication Architecture
- **Development**: Mock authentication with production user data
- **Production**: AWS Cognito with real user management
- **LocalStack**: Cognito is Pro feature - uses mock authentication
- **User data**: Consistent across frontend auth service and backend API

## Notes

- **Environment parity**: Local development provides 95% AWS production parity
- **Sample Data**: Comprehensive Swiss business data with admin, manager, and employee users
- **Admin Interface**: Full user and project management capabilities
- **Geographic Coverage**: All major Swiss cities with accurate coordinates and realistic business scenarios
- **Cost savings**: ~€200/month per developer using LocalStack vs real AWS
- **Setup time**: < 15 minutes for new developers
- **Offline development**: Full development capability without internet
- **Documentation**: See DEVELOPMENT_SETUP.md for detailed troubleshooting
- **Data Validation**: Built-in integrity checks for geographic calculations, business constraints, and audit trails

## Important: Essential Development Files

**⚠️ NEVER REMOVE these directories - they are essential development infrastructure:**

- **`.bmad-core/`** - BMAD agent system files for proper development workflow
- **`.claude/commands/BMad/`** - Claude commands directory for development assistance
- **`web-bundles/`** - Essential files for correct development practices

These are **development tooling files**, not project artifacts. Removing them will break the development workflow.

- always update the readme.md when you update package.json, aws urls or other readme relevant files
