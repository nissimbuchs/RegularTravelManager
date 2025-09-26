# Backend Architecture & Technology Stack

## Service Architecture

**AWS Lambda Functions:** Domain-driven organization with handlers for travel requests, manager operations, translation services, shared domain logic, and utility functions for Lambda wrapper and database connections.

## Component Architecture

Lambda components organized by feature modules following domain-driven design principles:
```
apps/api/src/
├── handlers/
│   ├── travel-requests/
│   │   ├── submit-request.ts
│   │   ├── get-requests.ts
│   │   └── withdraw-request.ts
│   ├── manager/
│   │   ├── get-pending.ts
│   │   ├── process-request.ts
│   │   └── batch-approve.ts
│   ├── translation/
│   │   └── translate-master-data.ts  # AWS Translate proxy with caching
├── domain/
│   ├── travel-allowance/
│   └── translation/
│       ├── translation-service.ts      # AWS Translate integration
│       └── translation-cache.service.ts # PostgreSQL cache management
└── utils/
    ├── lambda-wrapper.ts
    └── db-connection.ts
```

## Authentication

**Production:** AWS Cognito User Pools with JWT token validation and AWS Amplify integration.

**Development:** Mock authentication with production-matching user data structure, enabling role-based testing.

**Environment Parity:** Consistent employee/manager permissions across environments with LocalStack using mock mode for development.

## Technology Stack

**Core Technologies:**
- **Backend:** TypeScript 5.3+, AWS Lambda + Fastify, REST APIs with OpenAPI 3.0
- **Database:** PostgreSQL 15+ with PostGIS for geographic calculations and translation caching
- **Cache:** ElastiCache Redis for session and query caching + PostgreSQL translation cache
- **Authentication:** AWS Cognito for user management
- **Translation:** AWS Translate service for multilingual content

**Frontend Technologies:**
- **Framework:** Angular 17+ with TypeScript 5.3+
- **UI:** Angular Material with Tailwind CSS
- **State Management:** RxJS service-based pattern

**Development & Infrastructure:**
- **Build Tools:** Angular CLI, esbuild bundler
- **Infrastructure:** AWS CDK 2.100+, GitHub Actions CI/CD

**Testing & Monitoring:**
- **Testing:** Jest + Angular Testing Utilities, Vitest + Supertest, Playwright E2E
- **Monitoring:** AWS CloudWatch for application monitoring and logging

## Lambda Function Architecture

**Handler Pattern:** Standard Lambda handlers with middleware composition for authentication, CORS, logging, error handling, and translation services.

**Middleware Chain:** Request ID generation, CORS headers, authentication validation, request logging, error handling with proper response formatting, and translation context management.

**Database Connection Management:** PostgreSQL connection pooling optimized for Lambda execution model with limited connections, proper cleanup, and translation cache access.

### Translation Service Integration

**AWS Translate Lambda Function:**
```typescript
// Translation proxy handler with caching
export const translateMasterDataHandler = withMiddleware(async (event: APIGatewayProxyEvent) => {
  const { text, targetLanguage, context } = JSON.parse(event.body || '{}');

  // Check PostgreSQL cache first
  const cachedTranslation = await getCachedTranslation(text, targetLanguage, context);
  if (cachedTranslation) {
    return formatResponse(200, { ...cachedTranslation, cached: true });
  }

  // Call AWS Translate API
  const translateCommand = new TranslateTextCommand({
    Text: text,
    SourceLanguageCode: 'auto',
    TargetLanguageCode: targetLanguage,
    Settings: { Profanity: 'MASK' }
  });

  const result = await translateClient.send(translateCommand);

  // Cache result for 24 hours
  await cacheTranslation(text, result.TranslatedText, targetLanguage, context);

  return formatResponse(200, {
    translatedText: result.TranslatedText,
    originalText: text,
    confidence: 0.85,
    language: targetLanguage,
    cached: false
  });
});
```

**Translation Cache Service:**
```typescript
// PostgreSQL-based translation caching
export class TranslationCacheService {
  async getCachedTranslation(
    originalText: string,
    targetLang: string,
    context: string
  ): Promise<TranslationResult | null> {
    const query = `
      SELECT translated_text, confidence_score, created_at
      FROM master_data_translations
      WHERE original_text = $1 AND target_language = $2
        AND context = $3 AND expires_at > NOW()
    `;

    // Execute query and return cached result
  }

  async cacheTranslation(
    originalText: string,
    translatedText: string,
    targetLang: string,
    context: string,
    confidence: number
  ): Promise<void> {
    const query = `
      INSERT INTO master_data_translations (
        original_text, translated_text, target_language,
        context, confidence_score, expires_at
      ) VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '24 hours')
      ON CONFLICT (original_text, target_language, context)
      DO UPDATE SET
        translated_text = EXCLUDED.translated_text,
        confidence_score = EXCLUDED.confidence_score,
        expires_at = EXCLUDED.expires_at
    `;

    // Execute insert/update query
  }
}
```

## Domain-Driven Design Implementation

**Domain Services:**
- **TravelRequestService:** Business logic for request submission, validation, distance calculation, and allowance computation
- **TranslationService:** AWS Translate integration with intelligent caching and context-aware translation

**Repository Pattern:** Clean abstraction layer for data persistence with PostGIS queries, aggregate mapping, transaction management for domain objects, and translation cache management.

## Performance & Scaling Considerations

**Lambda Optimization:** Provisioned concurrency for critical functions, optimized memory allocation (256-512MB for translation functions, 128-256MB for others), proper timeout configuration (30s for translation, 15s for others), and esbuild optimization.

**Database Performance:** Limited connection pooling for Lambda, proper indexing for geographic queries, GIST indexes for PostGIS, translation cache indexes for multilingual lookups, and read replicas for analytics.

**Caching Strategy:** Multi-level caching with application-level service caching, database query result caching, CloudFront CDN caching, and intelligent translation caching (PostgreSQL 24h + frontend 30min).

### AWS Translate Integration Architecture

**Service Permissions:** Lambda execution role includes AWS Translate permissions:
```typescript
// Required IAM permissions for translation Lambda
const translatePermissions = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: [
    'translate:TranslateText',
    'translate:ListLanguages'
  ],
  resources: ['*']
});
```

**Regional Deployment:** AWS Translate deployed in eu-central-1 region for Swiss data residency compliance, matching other services.

**Cost Optimization:**
- Intelligent caching reduces AWS Translate API calls by ~80%
- Context-aware translation improves quality and reduces re-translation
- Batch processing capability for future optimization
- Automatic cleanup of expired translations

**Error Handling & Fallback:**
- Graceful degradation to original text on translation failures
- Retry logic for temporary AWS Translate service issues
- Silent fallback prevents user-facing translation errors
- Comprehensive logging for translation service monitoring

This backend architecture provides a scalable, maintainable foundation with strong domain modeling, AWS-native integration, and comprehensive multilingual support optimized for Swiss business requirements.