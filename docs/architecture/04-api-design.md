# API Design & Workflows

## API Design Principles

**REST API Architecture:** Clean resource-based endpoints with JWT authentication and standardized response patterns.

**Core Endpoints:**
- `POST /travel-requests` - Submit travel requests with distance/allowance calculations
- `GET /manager/requests` - Manager approval interface with status filtering  
- `PUT /travel-requests/{id}/process` - Approval/rejection workflow

**Authentication:** AWS Cognito JWT tokens with cognito_user_id for security boundary enforcement.

**Response Format:** Consistent wrapped responses with automatic frontend unwrapping via interceptors.

## Core System Components

### TravelRequestService
**Responsibility:** Core domain service managing complete travel request lifecycle with distance/allowance calculations and status management.

### DistanceCalculator
**Responsibility:** PostGIS-based geographic distance calculations between employee addresses and project locations.

### NotificationService
**Responsibility:** AWS SES email notifications for request submissions and status changes throughout approval workflow.

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

## API Response Handling

### Response Interceptor Pattern

**Backend Format:** Consistent wrapped responses with success, data, timestamp, and requestId fields.

**Frontend Handling:** Response interceptor automatically unwraps data field, enabling services to expect direct data types without manual unwrapping.

**Benefits:** Simplified service implementations, consistent error handling, and automatic response transformation throughout application.

## Request Processing Patterns

### Authentication & Authorization Flow
**Process:** JWT token validation → Extract cognito_user_id → Query employee context → Execute business logic with user context.

### Error Handling Patterns
**Standard Error Response:** Consistent success/error format with typed error codes (VALIDATION_ERROR, AUTHENTICATION_ERROR, AUTHORIZATION_ERROR, etc.).

### Data Validation Strategy
**Multi-layer Validation:** API Gateway schema validation, middleware request validation, and domain model validation using decorators.

## Performance Considerations

**Caching Strategy:** Static data (1 hour), employee context (per request), distance calculations (24 hours).

**Database Optimization:** Geographic GIST indexes, PostGIS optimized queries, Lambda connection pooling.

**API Gateway:** Request validation, rate limiting, CORS configuration for CloudFront origins.