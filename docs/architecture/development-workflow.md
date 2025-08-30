# Development Workflow

## Local Development Setup

```bash
# Prerequisites
node --version  # v20+
npm --version   # v9+

# Initial setup
npm install
npm run setup

# Development commands
npm run dev        # Start all services
ng serve          # Angular frontend
npm run dev:web    # Alternative frontend start
npm run dev:api    # Backend only
npm run test       # Run all tests
```

## Environment Configuration

```bash
# Frontend (environment.ts)
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3001/v1',
  cognitoUserPoolId: 'eu-central-1_xxxxx',
  cognitoClientId: 'xxxxx'
};

# Backend (.env)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=travel_manager
COGNITO_USER_POOL_ID=eu-central-1_xxxxx
AWS_REGION=eu-central-1
```
