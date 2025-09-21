# Development Standards & Workflow

## Local Development Setup

### Prerequisites & Installation

```bash
# Prerequisites
node --version  # v20+
npm --version   # v9+

# Initial setup
npm install
npm run setup

# Development environment setup (LocalStack + Docker)
npm run dev:env           # Start infrastructure (PostgreSQL, Redis, LocalStack)
npm run localstack:init   # Initialize AWS services (DynamoDB, S3)
./test-setup.sh          # Verify environment health

# Development commands
npm run dev:full          # Start infrastructure + API + web app
npm run dev:api:local     # API server against local infrastructure  
npm run dev:web           # Angular frontend
npm run dev:env:logs      # View all service logs
npm run dev:env:restart   # Clean restart all services

# Deployment commands (4-stack architecture)
npm run deploy            # Deploy all stacks to dev environment
npm run deploy:staging    # Deploy all stacks to staging
npm run deploy:production # Deploy all stacks to production

# Stack-specific deployment (from infrastructure workspace)
cd infrastructure
npm run deploy:infrastructure:dev  # Core services only
npm run deploy:lambda:dev         # Lambda functions only
npm run deploy:api:dev           # API Gateway only  
npm run deploy:web:dev           # Frontend only

# Frontend-only deployment (faster for UI changes)
npm run deploy:frontend:dev      # Build + deploy frontend to dev
npm run deploy:frontend:staging  # Build + deploy frontend to staging
npm run deploy:frontend:production # Build + deploy frontend to production
```

### Development Environment Configuration

**Local Development with LocalStack (95% Production Parity):**

```typescript
// apps/api/src/config/environment.ts - Auto-detects local vs production
export const environment = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  AWS_ENDPOINT_URL: isLocal ? 'http://localhost:4566' : undefined,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://nissim:devpass123@localhost:5432/travel_manager_dev',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  AWS_REGION: 'eu-central-1',
  
  // AWS Service Configuration (auto-switches local/prod)
  COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || 'local-pool-id',
  S3_BUCKET_NAME: isLocal ? 'rtm-documents-dev' : 'rtm-documents-prod',
  DYNAMODB_TABLES: {
    projects: `rtm-projects-${isLocal ? 'dev' : 'prod'}`,
    subprojects: `rtm-subprojects-${isLocal ? 'dev' : 'prod'}`
  }
};
```

**Docker Compose Services:**
```yaml
services:
  postgres:    # PostgreSQL 15 + PostGIS → AWS RDS
  redis:       # Redis 7.2 → AWS ElastiCache  
  localstack:  # LocalStack 3.0 → AWS Services
    # - DynamoDB (projects, subprojects)
    # - S3 (document storage)
    # - Location Service (mocked for development)
```

## Coding Standards

### Critical Fullstack Rules

- **Type Sharing:** Always define types in packages/shared and import from there
- **API Calls:** Never make direct HTTP calls - use the service layer
- **Response Handling:** Always expect unwrapped data types in services - the response interceptor handles unwrapping automatically
- **Environment Variables:** Access only through config objects, never process.env directly
- **Error Handling:** All API routes must use the standard error handler
- **State Updates:** Never mutate state directly - use immutable updates with BehaviorSubject.next()
- **State Management:** Use RxJS services with BehaviorSubjects for reactive state management
- **Service Observables:** Always expose state as observables (requests$, loading$, error$)

### State Management Patterns

#### Service-Based State Management

**Core Pattern**: Each domain feature has a dedicated service that manages state using RxJS BehaviorSubjects.

```typescript
@Injectable({ providedIn: 'root' })
export class FeatureStateService {
  // Private state subjects
  private dataSubject = new BehaviorSubject<DataType[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  // Public observables (read-only)
  public data$ = this.dataSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable(); 
  public error$ = this.errorSubject.asObservable();

  // State update methods
  updateData(newData: DataType[]): void {
    this.dataSubject.next(newData);
  }
}
```

**Key Principles:**
- Use BehaviorSubjects for state that has a current value
- Expose only observables publicly, keep subjects private
- Follow immutable update patterns
- Include loading and error state management
- Use async/await for API calls, tap operator for state updates

#### Component Integration Pattern

```typescript
@Component({...})
export class FeatureComponent implements OnInit, OnDestroy {
  // Subscribe to state observables
  data$ = this.stateService.data$;
  loading$ = this.stateService.loading$;
  error$ = this.stateService.error$;
  
  private destroy$ = new Subject<void>();

  constructor(private stateService: FeatureStateService) {}

  ngOnInit(): void {
    // Load initial data
    this.stateService.loadData()
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

#### Template Usage Pattern

```html
<!-- Use async pipe for automatic subscription management -->
<div *ngIf="loading$ | async" class="loading-spinner">Loading...</div>

<div *ngIf="error$ | async as error" class="error-message">
  {{ error }}
</div>

<div *ngFor="let item of data$ | async">
  {{ item.name }}
</div>
```

### Naming Conventions1

**Frontend:** PascalCase components/services, camelCase directives
**Backend:** kebab-case API routes, snake_case database tables/columns
**API Fields:** camelCase for all request/response bodies (frontend consistency)
**Database Conversion:** Backend converts camelCase ↔ snake_case internally

**Critical Rule:** All API request/response bodies use camelCase for consistency across frontend and backend layers.

## Error Handling Strategy

### Error Response Format

```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
}
```

### Frontend Error Handling

```typescript
// Angular Error Interceptor
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.authService.logout();
          this.router.navigate(['/login']);
        } else if (error.status >= 500) {
          this.snackBar.open('Server error. Please try again later.', 'Close');
        }
        return throwError(error);
      })
    );
  }
}
```

### Backend Error Handling

```typescript
// Lambda Error Handler
export const withErrorHandler = (handler: LambdaHandler) => {
  return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    try {
      return await handler(event, context);
    } catch (error) {
      console.error('Lambda execution error:', error);
      
      // Business logic errors
      if (error instanceof DomainError) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: {
              code: 'BUSINESS_RULE_ERROR',
              message: error.message,
              timestamp: new Date().toISOString(),
              requestId: context.awsRequestId
            }
          })
        };
      }
      
      // Validation errors
      if (error.name === 'ValidationError') {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input data',
              details: error.details,
              timestamp: new Date().toISOString(),
              requestId: context.awsRequestId
            }
          })
        };
      }
      
      // System errors
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: {
            code: 'SYSTEM_ERROR',
            message: 'Internal server error',
            timestamp: new Date().toISOString(),
            requestId: context.awsRequestId
          }
        })
      };
    }
  };
};
```

## Testing Strategy

### Testing Pyramid

```
        E2E Tests (Playwright)
       /                    \
    Integration Tests (API + DB)
   /                            \
Frontend Unit (Jest + Angular)  Backend Unit (Vitest)
```

### Test Organization

**Frontend Tests:**
- Component tests with Angular Testing Utilities
- Service tests with Angular TestBed
- Integration tests for complete user workflows
- E2E tests for critical business processes

**Backend Tests:**
- Unit tests for domain logic and services
- Integration tests for API endpoints
- Database tests for repository implementations

### Frontend Testing Patterns

```typescript
// Component Testing
describe('TravelRequestFormComponent', () => {
  let component: TravelRequestFormComponent;
  let fixture: ComponentFixture<TravelRequestFormComponent>;
  let mockService: jasmine.SpyObj<TravelRequestService>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('TravelRequestService', ['submitRequest']);
    
    TestBed.configureTestingModule({
      declarations: [TravelRequestFormComponent],
      providers: [{ provide: TravelRequestService, useValue: spy }],
      imports: [ReactiveFormsModule, NoopAnimationsModule]
    });
    
    fixture = TestBed.createComponent(TravelRequestFormComponent);
    component = fixture.componentInstance;
    mockService = TestBed.inject(TravelRequestService) as jasmine.SpyObj<TravelRequestService>;
  });

  it('should submit valid travel request', async () => {
    // Arrange
    const requestData = { projectId: '123', daysPerWeek: 3, justification: 'Business need' };
    mockService.submitRequest.and.returnValue(Promise.resolve(mockTravelRequest));
    
    // Act
    component.requestForm.patchValue(requestData);
    await component.onSubmit();
    
    // Assert
    expect(mockService.submitRequest).toHaveBeenCalledWith(requestData);
  });
});

// Service Testing
describe('TravelRequestService', () => {
  let service: TravelRequestService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TravelRequestService]
    });
    
    service = TestBed.inject(TravelRequestService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should load travel requests', () => {
    const mockRequests = [mockTravelRequest1, mockTravelRequest2];
    
    service.loadRequests().subscribe(requests => {
      expect(requests).toEqual(mockRequests);
    });
    
    const req = httpMock.expectOne('/api/travel-requests');
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockRequests });
  });
});
```

### Backend Testing Patterns

```typescript
// Domain Service Testing
describe('TravelRequestService', () => {
  let service: TravelRequestService;
  let mockRepository: jest.Mocked<TravelRequestRepository>;
  let mockDistanceCalculator: jest.Mocked<DistanceCalculator>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockDistanceCalculator = createMockDistanceCalculator();
    service = new TravelRequestService(mockRepository, mockDistanceCalculator);
  });

  describe('submitRequest', () => {
    it('should create travel request with calculated distance and allowance', async () => {
      // Arrange
      const requestDto = createMockRequestDto();
      const expectedDistance = 25.5;
      const expectedAllowance = 76.5; // 25.5km * 0.75 CHF/km * 4 days
      
      mockDistanceCalculator.calculate.mockResolvedValue(expectedDistance);
      mockRepository.save.mockResolvedValue();
      
      // Act
      const result = await service.submitRequest(requestDto, 'employee-id');
      
      // Assert
      expect(result.calculatedDistance).toBe(expectedDistance);
      expect(result.calculatedAllowance).toBe(expectedAllowance);
      expect(mockRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        calculatedDistance: expectedDistance,
        calculatedAllowance: expectedAllowance
      }));
    });
  });
});

// API Integration Testing
describe('POST /api/travel-requests', () => {
  it('should create travel request successfully', async () => {
    const requestData = {
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      subProjectId: '987fcdeb-51d9-12d3-a456-426614174000',
      managerId: 'manager1-cognito-id',
      daysPerWeek: 4,
      justification: 'Need to attend weekly project meetings on-site'
    };

    const response = await request(app)
      .post('/api/travel-requests')
      .set('Authorization', `Bearer ${validJwtToken}`)
      .send(requestData)
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      data: expect.objectContaining({
        projectId: requestData.projectId,
        status: 'pending',
        calculatedDistance: expect.any(Number),
        calculatedAllowance: expect.any(Number)
      })
    });
  });
});
```

### E2E Testing Patterns

```typescript
// Playwright E2E Tests
test.describe('Travel Request Submission Workflow', () => {
  test('employee can submit and manager can approve travel request', async ({ page }) => {
    // Login as employee
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'employee1@company.ch');
    await page.fill('[data-testid=password]', 'EmployeePass123!');
    await page.click('[data-testid=login-button]');
    
    // Navigate to new request form
    await page.click('[data-testid=new-request-button]');
    
    // Fill travel request form
    await page.selectOption('[data-testid=project-select]', 'Project Alpha');
    await page.selectOption('[data-testid=subproject-select]', 'Zurich Office');
    await page.fill('[data-testid=days-per-week]', '3');
    await page.fill('[data-testid=justification]', 'Weekly team meetings and client presentations');
    
    // Submit request
    await page.click('[data-testid=submit-button]');
    await expect(page.locator('[data-testid=success-message]')).toBeVisible();
    
    // Logout and login as manager
    await page.click('[data-testid=logout-button]');
    await page.fill('[data-testid=email]', 'manager1@company.ch');
    await page.fill('[data-testid=password]', 'ManagerPass123!');
    await page.click('[data-testid=login-button]');
    
    // Approve the request
    await page.click('[data-testid=pending-requests-tab]');
    await page.click('[data-testid=approve-button]');
    await expect(page.locator('[data-testid=approved-status]')).toBeVisible();
  });
});
```

## Code Review Requirements

### Pre-Review Checklist

**🚨 Mandatory Checks:**
- [ ] All subscriptions use `takeUntil(this.destroy$)` pattern
- [ ] Components implement `OnDestroy` with proper cleanup
- [ ] Services implement `cleanup()` method for logout scenarios
- [ ] API field names use camelCase consistently
- [ ] Error handling follows established patterns
- [ ] Tests cover new functionality (minimum 80% coverage)
- [ ] No direct environment variable access (use config services)
- [ ] State mutations are immutable

### Review Process

1. **Automated Checks**: ESLint, TypeScript compiler, unit tests must pass
2. **Manual Review**: Code structure, patterns, and business logic
3. **Testing Verification**: All new code has appropriate test coverage
4. **Integration Testing**: Changes work with existing system
5. **Documentation Update**: Architecture docs updated if needed

### Quality Gates

- **Unit Test Coverage**: Minimum 80% for new code
- **Integration Tests**: All API endpoints have integration tests
- **E2E Coverage**: Critical user workflows have E2E tests
- **Performance**: No regression in core metrics
- **Security**: No hardcoded secrets or credentials
- **Accessibility**: UI changes meet WCAG 2.1 AA standards

This development standards document ensures consistent, high-quality code across the RegularTravelManager system while maintaining the established architectural patterns and developer productivity.