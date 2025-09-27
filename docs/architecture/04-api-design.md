# API Design & Workflows

## API Design Principles

**REST API Architecture:** Clean resource-based endpoints with JWT authentication and standardized response patterns.

**Core Endpoints:**
- `POST /travel-requests` - Submit travel requests with distance/allowance calculations
- `GET /manager/requests` - Manager approval interface with status filtering
- `PUT /travel-requests/{id}/process` - Approval/rejection workflow
- `POST /api/translate-master-data` - Translation proxy for user-generated content

**Authentication:** AWS Cognito JWT tokens with cognito_user_id for security boundary enforcement.

**Response Format:** Consistent wrapped responses with automatic frontend unwrapping via interceptors and transparent translation of master data fields.

## Core System Components

### TravelRequestService
**Responsibility:** Core domain service managing complete travel request lifecycle with distance/allowance calculations and status management.

### DistanceCalculator
**Responsibility:** PostGIS-based geographic distance calculations between employee addresses and project locations.

### NotificationService
**Responsibility:** AWS SES email notifications for request submissions and status changes throughout approval workflow.

### TranslationService
**Responsibility:** AWS Translate integration for user-generated content translation with PostgreSQL caching and multi-language support.

## Core Workflows

### Request Submission Workflow
**Process:** Employee submits request → Distance calculation → Allowance calculation → Manager notification → Database persistence with audit trail.

### Manager Approval Workflow  
**Process:** Manager views pending requests → Reviews details → Approves/rejects with optional reason → Employee notification → Status update with audit trail.

**Key Patterns:**
- JWT-based authentication throughout workflow
- Automatic distance/allowance calculations using PostGIS
- Email notifications at each workflow transition
- Complete audit trail for compliance
- Transparent master data translation via HTTP interceptors
- Intelligent translation caching with 24-hour TTL

## API Response Handling

### Response Interceptor Pattern

**Backend Format:** Consistent wrapped responses with success, data, timestamp, and requestId fields.

**Frontend Handling:** Response interceptor automatically unwraps data field, enabling services to expect direct data types without manual unwrapping.

**Translation Interceptor:** HTTP response interceptor automatically translates configured master data fields (project names, descriptions) based on current user language.

**Benefits:** Simplified service implementations, consistent error handling, automatic response transformation throughout application, and transparent multilingual content without component changes.

## Request Processing Patterns

### Authentication & Authorization Flow
**Process:** JWT token validation → Extract cognito_user_id → Query employee context → Execute business logic with user context.

### Error Handling Patterns
**Standard Error Response:** Consistent success/error format with typed error codes (VALIDATION_ERROR, AUTHENTICATION_ERROR, AUTHORIZATION_ERROR, etc.).

### Data Validation Strategy
**Multi-layer Validation:** API Gateway schema validation, middleware request validation, and domain model validation using decorators.

### Translation API Integration

**Master Data Translation Endpoint:** `/api/translate-master-data`
```typescript
// Request Format
interface TranslationRequest {
  text: string;
  targetLanguage: 'de' | 'fr' | 'it' | 'en';
  context?: 'project' | 'subproject' | 'description';
}

// Response Format
interface TranslationResponse {
  translatedText: string;
  originalText: string;
  confidence: number;
  language: string;
  cached: boolean;
}
```

**HTTP Response Translation Interceptor Configuration:**
```typescript
// Automatic translation mapping per API endpoint
const TRANSLATION_CONFIG: Record<string, string[]> = {
  '/api/projects': ['name', 'description'],
  '/api/subprojects': ['name', 'description'],
  '/api/travel-requests': ['projectName', 'subprojectName'],
  '/api/employees/dashboard': ['projectName', 'subprojectName']
};
```

**Translation Cache Integration:**
- PostgreSQL cache lookup before AWS Translate API calls
- 24-hour TTL with automatic cleanup functions
- Context-aware translation for improved quality
- Graceful fallback to original text on translation failures

## Performance Considerations

**Caching Strategy:** Static data (1 hour), employee context (per request), distance calculations (24 hours), master data translations (24 hours PostgreSQL + 30 minutes frontend).

**Database Optimization:** Geographic GIST indexes, PostGIS optimized queries, Lambda connection pooling, translation cache indexes for multilingual lookups.

**API Gateway:** Request validation, rate limiting, CORS configuration for CloudFront origins, and translation endpoint authentication.

**Translation Performance:** Multi-level caching reduces AWS Translate costs, intelligent batching for bulk translations, and optimized response times for cached content.