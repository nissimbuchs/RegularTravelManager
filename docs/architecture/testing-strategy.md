# Testing Strategy

## Testing Pyramid with LocalStack

```
           E2E Tests (Playwright)
          /                      \
    Integration Tests (LocalStack)
   /                                \
Frontend Unit (Jest + Angular)   Backend Unit (Vitest)
```

## Test Organization

**Frontend Tests:**
- Component tests with Angular Testing Utilities
- Service tests with Angular TestBed
- Integration tests for complete user workflows
- E2E tests against local environment with LocalStack

**Backend Tests:**
- Unit tests for domain logic and services
- Integration tests for API endpoints against LocalStack
- Database tests for repository implementations
- AWS service tests using LocalStack (DynamoDB, S3)

## LocalStack Testing Environment

### Test Infrastructure
```typescript
// Test setup with LocalStack integration
export class TestEnvironment {
  static async setup(): Promise<void> {
    // Start LocalStack container for integration tests
    const container = await new GenericContainer('localstack/localstack:3.0')
      .withEnvironment({
        SERVICES: 'cognito-idp,dynamodb,s3',
        DEBUG: '1'
      })
      .withExposedPorts(4566)
      .start();
      
    // Configure test environment
    process.env.AWS_ENDPOINT_URL = `http://localhost:${container.getMappedPort(4566)}`;
    process.env.NODE_ENV = 'test';
    
    // Initialize test data
    await this.initializeTestData();
  }
}
```

### Test Commands
```bash
# Run all tests
npm run test

# Integration tests against LocalStack
npm run test:integration

# E2E tests in local environment  
npm run test:e2e:local

# Test with specific LocalStack services
npm run test:integration:dynamo
npm run test:integration:s3
```

### Test Data Management
- **Test fixtures** for DynamoDB tables
- **Mock S3 buckets** for document testing  
- **Sample location data** for geocoding tests
- **Test user pool** for authentication tests

### Testing Benefits with LocalStack
✅ **Fast test execution** - no network latency to real AWS  
✅ **Consistent test environment** - isolated from production data  
✅ **Cost-free testing** - unlimited test runs without AWS charges  
✅ **Offline testing** - run tests without internet connection  
✅ **Production parity** - same AWS APIs as production

### Test Coverage Requirements
- **Unit Tests**: >90% coverage for business logic
- **Integration Tests**: >80% coverage for API endpoints
- **E2E Tests**: 100% coverage for critical user workflows
- **AWS Service Tests**: 100% coverage for all AWS integrations
