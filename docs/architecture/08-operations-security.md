# Operations, Security & System Enhancements

## Security Requirements & Implementation

### Frontend Security

**Content Security Policy:**
```typescript
// Strict CSP with nonce-based script execution
const csp = {
  'default-src': "'self'",
  'script-src': "'self' 'nonce-{random}'",
  'style-src': "'self' 'unsafe-inline'",
  'img-src': "'self' data: https:",
  'connect-src': "'self' https://api.example.com",
  'font-src': "'self' https://fonts.gstatic.com"
};
```

**XSS Prevention:**
- Content sanitization using DOMPurify
- Angular's built-in XSS protection
- Secure HTTP headers (X-Content-Type-Options, X-Frame-Options)
- Input validation at component level

**Secure Token Storage:**
```typescript
// JWT tokens stored in httpOnly cookies (not localStorage)
@Injectable()
export class SecureTokenService {
  storeToken(token: string): void {
    // Token stored server-side in httpOnly cookie
    document.cookie = `auth-token=${token}; HttpOnly; Secure; SameSite=Strict`;
  }
  
  getToken(): string | null {
    // Tokens accessed via secure API call
    return this.cookieService.get('auth-token');
  }
}
```

### Backend Security

**Input Validation:**
```typescript
// OpenAPI schema validation at API Gateway level
const travelRequestSchema = {
  type: 'object',
  required: ['projectId', 'subprojectId', 'daysPerWeek', 'justification'],
  properties: {
    projectId: { type: 'string', format: 'uuid' },
    subprojectId: { type: 'string', format: 'uuid' },
    daysPerWeek: { type: 'integer', minimum: 1, maximum: 7 },
    justification: { type: 'string', minLength: 10, maxLength: 500 }
  },
  additionalProperties: false
};
```

**Rate Limiting:**
```yaml
# API Gateway throttling configuration
throttle:
  rate_limit: 100  # requests per second
  burst_limit: 200 # burst capacity
  
# Per-user rate limits
per_user_throttle:
  rate_limit: 10   # requests per second per user
  burst_limit: 20  # burst capacity per user
```

**CORS Policy:**
```typescript
// Restricted CORS configuration
const corsOptions = {
  origin: [
    'https://dz57qvo83kxos.cloudfront.net',      // Production frontend
    'http://localhost:4200'                      // Development frontend
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
};
```

### Authentication Security

**Token Management:**
- JWT tokens use HS256 algorithm with rotating secrets
- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- Automatic token refresh with sliding window

**Session Security:**
```typescript
// Cognito session management with security headers
export const authMiddleware = async (event: APIGatewayProxyEvent) => {
  const token = extractTokenFromHeader(event.headers.Authorization);
  
  try {
    const payload = await verifyJwtToken(token);
    
    // Check token expiration with 5-minute buffer
    if (payload.exp < (Date.now() / 1000) + 300) {
      throw new Error('Token near expiration - refresh required');
    }
    
    return {
      cognitoUserId: payload.sub,
      email: payload.email,
      roles: payload['cognito:groups'] || []
    };
  } catch (error) {
    throw new AuthenticationError('Invalid or expired token');
  }
};
```

## Performance Optimization

### Frontend Performance

**Bundle Optimization:**
```typescript
// Angular build configuration for performance
export const buildConfig = {
  optimization: true,
  budgets: [
    {
      type: 'initial',
      maximumWarning: '200kb',
      maximumError: '250kb'
    },
    {
      type: 'anyComponentStyle',
      maximumWarning: '6kb'
    }
  ],
  // Code splitting by routes
  vendorChunk: true,
  namedChunks: true
};
```

**Loading Strategy:**
```typescript
// Lazy loading for feature modules
const routes: Routes = [
  {
    path: 'employee',
    loadChildren: () => import('./features/employee/employee.module').then(m => m.EmployeeModule)
  },
  {
    path: 'manager',
    loadChildren: () => import('./features/manager/manager.module').then(m => m.ManagerModule)
  }
];
```

**Caching Strategy:**
```typescript
// Service worker for static asset caching
@Injectable()
export class CacheService {
  private cacheConfig = {
    static: { strategy: 'CacheFirst', maxAge: '1d' },
    api: { strategy: 'NetworkFirst', maxAge: '5m' },
    images: { strategy: 'CacheFirst', maxAge: '30d' }
  };
  
  cacheApiResponse(url: string, response: any): void {
    if (this.shouldCache(url)) {
      this.cache.put(url, response, { maxAge: this.cacheConfig.api.maxAge });
    }
  }
}
```

### Backend Performance

**Response Time Optimization:**
```typescript
// Lambda optimization patterns
export const performanceMiddleware = async (handler: LambdaHandler) => {
  const startTime = Date.now();
  
  try {
    // Connection pooling for database
    const db = getDbConnection(); // Reuses existing connection
    
    // Parallel processing where possible
    const [userData, projectData] = await Promise.all([
      getUserData(userId),
      getProjectData(projectId)
    ]);
    
    const result = await handler(userData, projectData);
    
    // Performance monitoring
    const duration = Date.now() - startTime;
    if (duration > 500) {
      console.warn(`Slow request: ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    console.error('Performance middleware error:', error);
    throw error;
  }
};
```

**Database Optimization:**
```sql
-- Optimized queries with proper indexing
CREATE INDEX CONCURRENTLY idx_travel_requests_employee_status 
ON travel_requests(employee_id, status);

CREATE INDEX CONCURRENTLY idx_travel_requests_manager_pending
ON travel_requests(manager_id, status) 
WHERE status = 'pending';

-- Query optimization with PostGIS
CREATE INDEX CONCURRENTLY idx_employees_location_gist
ON employees USING GIST(home_location);
```

**Caching Strategy:**
```typescript
// Multi-level caching implementation
@Injectable()
export class CacheManager {
  async getData(key: string): Promise<any> {
    // L1: Application memory cache (30 seconds)
    let data = this.memoryCache.get(key);
    if (data) return data;
    
    // L2: Redis distributed cache (5 minutes)
    data = await this.redis.get(key);
    if (data) {
      this.memoryCache.set(key, data, 30000);
      return JSON.parse(data);
    }
    
    // L3: Database fetch
    data = await this.database.query(key);
    if (data) {
      await this.redis.setex(key, 300, JSON.stringify(data));
      this.memoryCache.set(key, data, 30000);
    }
    
    return data;
  }
}
```

## Monitoring & Observability

### Monitoring Stack

**Frontend Monitoring:**
```typescript
// Sentry integration for error tracking
import * as Sentry from '@sentry/angular';

Sentry.init({
  dsn: environment.sentryDsn,
  environment: environment.production ? 'production' : 'development',
  tracesSampleRate: environment.production ? 0.1 : 1.0,
  integrations: [
    new Sentry.BrowserTracing({
      routingInstrumentation: Sentry.routingInstrumentation
    })
  ]
});

// Web Vitals monitoring
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(({ name, delta, value }) => {
  gtag('event', name, { event_category: 'Web Vitals', value: Math.round(value * 1000) });
});
```

**Backend Monitoring:**
```typescript
// CloudWatch custom metrics
import { CloudWatch } from 'aws-sdk';

export class MetricsCollector {
  private cloudwatch = new CloudWatch();
  
  async recordBusinessMetric(metricName: string, value: number, unit: string = 'Count'): Promise<void> {
    await this.cloudwatch.putMetricData({
      Namespace: 'RegularTravelManager/Business',
      MetricData: [{
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: new Date(),
        Dimensions: [
          { Name: 'Environment', Value: process.env.NODE_ENV || 'development' }
        ]
      }]
    }).promise();
  }
  
  async recordTravelRequestSubmission(): Promise<void> {
    await this.recordBusinessMetric('TravelRequestsSubmitted', 1);
  }
  
  async recordApprovalTime(durationMinutes: number): Promise<void> {
    await this.recordBusinessMetric('ApprovalDurationMinutes', durationMinutes, 'None');
  }
}
```

### Key Metrics

**Frontend Metrics:**
- Core Web Vitals: LCP (<2.5s), FID (<100ms), CLS (<0.1)
- JavaScript errors with stack traces and user context
- API response times from client perspective
- User interaction analytics (form submissions, navigation patterns)

**Backend Metrics:**
- Lambda invocation rate, duration, and error rate
- API Gateway 4xx/5xx error rates by endpoint
- Database query performance and connection pool utilization
- Business KPIs: requests submitted, approval rates, distance calculations

**Alerting Configuration:**
```yaml
# CloudWatch Alarms
alarms:
  high_error_rate:
    metric: AWS/ApiGateway/4XXError
    threshold: 10
    period: 300
    evaluation_periods: 2
    
  slow_lambda_response:
    metric: AWS/Lambda/Duration
    threshold: 5000  # 5 seconds
    period: 60
    evaluation_periods: 3
    
  database_connection_errors:
    metric: Custom/Database/ConnectionErrors
    threshold: 5
    period: 60
    evaluation_periods: 1
```

## Project Structure & Organization

### DDD-Based Monorepo Structure

```
RegularTravelManager/
├── domains/                           # Domain Layer (Business Logic)
│   ├── travel-allowance/             # Core Domain
│   │   ├── src/
│   │   │   ├── domain/               # Pure business logic
│   │   │   │   ├── entities/
│   │   │   │   │   ├── TravelRequest.ts
│   │   │   │   │   └── Allowance.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── DistanceCalculator.ts
│   │   │   │   │   └── AllowanceCalculator.ts
│   │   │   │   └── repositories/
│   │   │   │       └── ITravelRequestRepository.ts
│   │   │   ├── application/          # Use cases
│   │   │   │   ├── commands/
│   │   │   │   └── queries/
│   │   │   └── infrastructure/       # Infrastructure adapters
├── apps/                             # Application Layer
│   ├── web/                         # Angular Frontend
│   └── api/                         # Lambda Functions
├── packages/                        # Shared packages
│   ├── shared/                      # Shared types
│   └── ui/                          # UI components
├── infrastructure/                   # AWS CDK
└── docs/
    ├── prd.md
    └── architecture.md
```

### File Organization Principles

**Domain Separation:**
- Each domain has clear boundaries and interfaces
- Shared types defined in packages/shared
- Cross-domain communication via well-defined APIs

**Infrastructure Isolation:**
- AWS CDK code separated from application code
- Environment-specific configurations externalized
- Infrastructure as code with version control

## Epic 5: User Management - Brownfield Enhancement

### Overview

Epic 5 extends the existing Cognito authentication system with comprehensive user lifecycle management capabilities, enabling self-service registration, profile management, and administrative user control while maintaining full backward compatibility with existing authentication flows.

### Integration Points

**Existing Systems Enhanced:**
- **AWS Cognito User Pool** (`eu-central-1_LFA9Rhk2y`): Extended with registration APIs and user management operations
- **Employee Database Schema**: Enhanced with additional profile fields and audit tracking
- **Angular Authentication Service**: Extended with registration and profile management methods
- **Lambda Authorizer**: Enhanced to support new user management operations with proper role-based access

### API Extensions

**New Lambda Functions:**
```typescript
// User Registration & Profile Management
POST /api/auth/register           // User registration with email verification
PUT  /api/auth/profile            // Profile updates with geocoding
POST /api/auth/change-password    // Password change with validation
POST /api/auth/verify-email       // Email verification process

// Admin User Management  
GET  /api/admin/users             // List all users with pagination
PUT  /api/admin/users/{id}/role   // Role assignment (employee/manager/admin)
PUT  /api/admin/users/{id}/manager // Manager assignment
DELETE /api/admin/users/{id}      // User deletion with cleanup

// Manager Team Management
GET  /api/manager/team            // Team member listing
PUT  /api/manager/employees/{id}  // Limited employee profile updates
```

**Authentication Extensions:**
- Registration flow integrates with existing JWT token validation
- Profile updates trigger address geocoding using existing PostGIS functions
- Admin operations respect existing role-based authorization patterns
- Manager team access follows existing employee-manager relationship model

### Database Schema Extensions

**Employee Table Enhancement:**
```sql
-- Add columns to existing employees table (backward compatible)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true}';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMP;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;

-- Audit trail for profile changes
CREATE TABLE employee_profile_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    changed_fields JSONB,
    old_values JSONB,
    new_values JSONB,
    changed_by UUID,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**User Registration Tracking:**
```sql
-- Track registration process and verification
CREATE TABLE user_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    verification_token VARCHAR(255),
    verified_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Frontend Architecture Extensions

**New Angular Components:**
- `UserRegistrationComponent`: Self-service registration with form validation
- `ProfileManagementComponent`: User profile editing with address geocoding
- `AdminUserManagementComponent`: Admin dashboard for user operations
- `ManagerTeamComponent`: Manager team management interface

**Service Extensions:**
```typescript
// AuthService extensions (maintains existing functionality)
class AuthService {
  // Existing methods preserved...
  
  // New registration methods
  register(userData: RegisterRequest): Observable<RegisterResponse>
  verifyEmail(token: string): Observable<void>
  updateProfile(updates: ProfileUpdate): Observable<UserProfile>
  changePassword(passwordChange: PasswordChange): Observable<void>
}

// New admin service
class AdminService {
  getUsers(filters: UserFilters): Observable<UserList>
  updateUserRole(userId: string, role: UserRole): Observable<void>
  assignManager(userId: string, managerId: string): Observable<void>
  deleteUser(userId: string): Observable<void>
}
```

### Security & Compatibility Considerations

**Backward Compatibility Guarantees:**
- All existing API endpoints remain unchanged
- Current user sessions continue working without interruption  
- Existing authentication flow (login/logout/token refresh) preserved
- Database schema changes are purely additive

**Security Enhancements:**
- Registration requires email verification before account activation
- Password complexity requirements align with existing Cognito policies
- Admin operations require elevated permissions with audit logging
- Manager authority limited to assigned employees only

### Implementation Sequence

**Story 5.1 - User Registration:**
- Extend Cognito with registration APIs
- Add email verification workflow  
- Create registration UI components

**Story 5.2 - Profile Management:**
- Extend AuthService with profile methods
- Add profile management UI
- Implement address geocoding integration

**Story 5.3 - Admin User Management:**
- Create admin Lambda functions
- Build admin dashboard UI
- Implement role assignment workflows

**Story 5.4 - Manager Team Management:**
- Extend manager permissions
- Create team management UI
- Add employee profile editing for managers

## Maintenance Procedures

### Database Maintenance

```sql
-- Weekly maintenance procedures
VACUUM ANALYZE travel_requests;
VACUUM ANALYZE employees;
REINDEX INDEX CONCURRENTLY idx_travel_requests_status;

-- Monthly PostGIS optimization
SELECT UpdateGeometrySRID('employees', 'home_location', 4326);
SELECT UpdateGeometrySRID('subprojects', 'location', 4326);
```

### Performance Monitoring

```bash
# Daily performance checks
aws cloudwatch get-metric-statistics --namespace AWS/Lambda \
  --metric-name Duration --dimensions Name=FunctionName,Value=rtm-dev-submit-request \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) --period 3600 --statistics Average

# Weekly cost analysis
aws ce get-cost-and-usage --time-period Start=$(date -u -d '7 days ago' +%Y-%m-%d),End=$(date -u +%Y-%m-%d) \
  --granularity DAILY --metrics BlendedCost --group-by Type=DIMENSION,Key=SERVICE
```

This comprehensive operations and security documentation ensures the RegularTravelManager system maintains high availability, security, and performance while supporting the ongoing Epic 5 user management enhancements.