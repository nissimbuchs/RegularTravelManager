# LocalStack Pro Setup Guide

This guide helps you set up and configure LocalStack Pro for the RegularTravelManager project.

## Quick Setup

### 1. Set Your License Key
```bash
export LOCALSTACK_API_KEY=your_pro_license_key_here
```

### 2. Configure Pro Mode
```bash
npm run localstack:pro
```

### 3. Start Development Environment
```bash
npm run dev:env:restart
npm run localstack:init
```

### 4. Verify Pro Features
```bash
npm run localstack:status
```
You should see `"edition": "pro"` in the output.

## Features Enabled with Pro

### ✅ Real Cognito Authentication
- **Before**: Mock users with localStorage switching
- **After**: Real AWS Cognito with LocalStack Pro
- **Test Users** (password: `DevPass123!`):
  - `employee1@company.com` (John Employee, EMP001)
  - `employee2@company.com` (Jane Worker, EMP002)  
  - `manager1@company.com` (Bob Manager, MGR001)
  - `manager2@company.com` (Alice Director, MGR002)

### ✅ Real Location Services  
- **Before**: Swiss city coordinate lookup table
- **After**: Real AWS Location Service with Esri data
- **Capabilities**:
  - Accurate geocoding for any Swiss address
  - Place index: `rtm-place-index-dev`
  - Map resource: `rtm-map-dev`
  - Route calculator: `rtm-route-calculator-dev`

## Development Workflow

### Testing Real Authentication
1. **Frontend**: Login form will authenticate against real Cognito
2. **Backend**: JWT tokens will be validated by Cognito
3. **User Management**: Real user pools with custom attributes

### Testing Location Services
1. **Geocoding**: Real address → coordinates conversion
2. **Route Planning**: Future travel route optimization
3. **Map Visualization**: Real map tiles for address verification

## Switching Between Modes

### Switch to Pro Mode
```bash
npm run localstack:pro
npm run dev:env:restart
```

### Switch to Community Mode (Mock Services)
```bash
npm run localstack:community  
npm run dev:env:restart
```

## Environment Variables

### Pro Mode
```bash
LOCALSTACK_API_KEY=your_license_key
MOCK_AUTH_ENABLED=false
MOCK_LOCATION_ENABLED=false
```

### Community Mode  
```bash
MOCK_AUTH_ENABLED=true
MOCK_LOCATION_ENABLED=true
```

## Troubleshooting

### License Key Issues
```bash
# Check if license is recognized
curl -s http://localhost:4566/_localstack/health | grep edition

# Should show: "edition": "pro"
# If showing "community", check your LOCALSTACK_API_KEY
```

### Cognito Issues
```bash
# List user pools
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url=http://localhost:4566 cognito-idp list-user-pools --max-results 10 --region eu-central-1

# List users in pool
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url=http://localhost:4566 cognito-idp list-users --user-pool-id YOUR_POOL_ID --region eu-central-1
```

### Location Service Issues
```bash
# List place indexes
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url=http://localhost:4566 location list-place-indexes --region eu-central-1

# Test geocoding
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url=http://localhost:4566 location search-place-index-for-text --index-name rtm-place-index-dev --text "Bern, Switzerland" --region eu-central-1
```

### Service Logs
```bash
npm run logs:localstack     # LocalStack container logs
npm run dev:env:logs        # All service logs
```

## Benefits Summary

| Feature | Community | Pro |
|---------|-----------|-----|
| **Authentication** | Mock users via localStorage | Real Cognito with JWT |
| **Geocoding** | 13 hardcoded Swiss cities | Real Esri geocoding data |
| **Route Planning** | Not available | Real route calculation |
| **Map Visualization** | Not available | Real map tiles |
| **Production Parity** | ~60% | ~95% |
| **Cost** | Free | License cost vs. AWS dev costs |

## Next Steps

With LocalStack Pro enabled, you can now:

1. **Implement JWT Authentication Flow** - Replace mock auth completely
2. **Add Address Validation** - Use real geocoding for travel entries
3. **Route Optimization** - Calculate optimal travel routes
4. **Map Integration** - Visual address confirmation and route display
5. **Advanced Testing** - Test against real AWS service behaviors

## Scripts Reference

```bash
# Setup and management
npm run localstack:pro           # Configure Pro mode
npm run localstack:community     # Configure Community mode  
npm run localstack:status        # Check service health
npm run localstack:init          # Initialize all services

# Development environment
npm run dev:env                  # Start infrastructure
npm run dev:env:restart          # Clean restart all services
npm run dev:env:clean           # Stop and remove all containers

# Development
npm run dev:full                 # Start complete development stack
npm run dev:api:local           # API server only
npm run dev:web                 # Angular app only
```