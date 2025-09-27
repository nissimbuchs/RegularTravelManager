# Frontend Architecture & Patterns

## Component Architecture

Angular components organized by feature modules following domain-driven design principles:

```
apps/web/src/
├── assets/i18n/               # JSON translation files
│   ├── de.json                # German translations
│   ├── fr.json                # French translations
│   ├── it.json                # Italian translations
│   └── en.json                # English (fallback)
├── app/
│   ├── features/
│   │   ├── employee/
│   │   │   ├── components/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── new-request/
│   │   │   │   └── travel-request-form/
│   │   │   ├── services/
│   │   │   │   └── travel-request.service.ts
│   │   │   ├── employee.module.ts
│   │   │   └── employee-routing.module.ts
│   │   ├── manager/
│   │   │   ├── components/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── approvals/
│   │   │   │   └── pending-approvals-table/
│   │   │   ├── services/
│   │   │   │   └── manager-dashboard.service.ts
│   │   │   ├── manager.module.ts
│   │   │   └── manager-routing.module.ts
│   ├── shared/
│   │   ├── components/
│   │   │   ├── forms/
│   │   │   ├── tables/
│   │   │   └── language-switcher/     # Swiss flag-based language selector
│   │   ├── pipes/
│   │   │   └── translate.pipe.ts      # Translation pipe (optional - synchronous service preferred)
│   │   ├── directives/
│   │   │   └── translate.directive.ts # Translation directive for complex cases
│   │   └── services/
│   │       └── project.service.ts
│   ├── core/
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── employee.service.ts
│   │   │   ├── config.service.ts
│   │   │   ├── translation.service.ts       # Core JSON-based translation service
│   │   │   ├── translation-loader.service.ts # HTTP loader for translation files
│   │   │   ├── language.service.ts          # Language state management
│   │   │   ├── master-data-translation.service.ts # AWS Translate integration
│   │   │   └── pluralization.service.ts     # ICU-like pluralization
│   │   ├── guards/
│   │   └── interceptors/
│   │       ├── auth.interceptor.ts
│   │       ├── response.interceptor.ts
│   │       └── master-data-translation.interceptor.ts # Automatic master data translation
```

## State Management

RxJS service-based state management pattern with reactive data flow and multilingual state management:

```typescript
// Service-based State Management with BehaviorSubjects
@Injectable({ providedIn: 'root' })
export class TravelRequestService {
  private requestsSubject = new BehaviorSubject<TravelRequest[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  // Public observables for reactive state
  public requests$ = this.requestsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  async submitRequest(dto: CreateTravelRequestDto): Promise<TravelRequest> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    
    try {
      const request = await firstValueFrom(
        this.http.post<TravelRequest>('/api/travel-requests', dto)
      );
      
      // Update state reactively
      const currentRequests = this.requestsSubject.value;
      this.requestsSubject.next([...currentRequests, request]);
      
      return request;
    } catch (error) {
      this.errorSubject.next(error.message);
      throw error;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  loadRequests(): Observable<TravelRequest[]> {
    this.loadingSubject.next(true);
    
    return this.http.get<TravelRequest[]>('/api/travel-requests').pipe(
      tap(requests => {
        this.requestsSubject.next(requests);
        this.loadingSubject.next(false);
      }),
      catchError(error => {
        this.errorSubject.next(error.message);
        this.loadingSubject.next(false);
        return throwError(error);
      })
    );
  }
}

// Component Usage Pattern
@Component({...})
export class EmployeeDashboardComponent {
  requests$ = this.travelRequestService.requests$;
  loading$ = this.travelRequestService.loading$;
  error$ = this.travelRequestService.error$;

  constructor(private travelRequestService: TravelRequestService) {}

  ngOnInit() {
    this.travelRequestService.loadRequests().subscribe();
  }
}
```

## Translation Architecture Integration

### Synchronous JSON-Based Translation System

**Current Implementation: Synchronous Translation Service**
```typescript
// Template usage with synchronous translation service
<h1>{{ translationService.translateSync('employee.dashboard.title') }}</h1>
<button>{{ translationService.translateSync('common.buttons.save') }}</button>

// Template usage with parameters
<p>{{ translationService.translateSync('employee.confirmation.autoClose', { seconds: currentCountdown }) }}</p>

// Component usage with direct synchronous access
export class EmployeeDashboardComponent {
  constructor(public translationService: TranslationService) {}

  getPageTitle(): string {
    return this.translationService.translateSync('employee.dashboard.title');
  }

  getWelcomeMessage(): string {
    return this.translationService.translateSync('employee.dashboard.welcome',
      { name: this.currentUser?.name }
    );
  }
}
```

**Key Implementation Details:**
- **Synchronous Access**: `translateSync()` method provides immediate translation results
- **Public Service Injection**: Services injected as `public` for direct template access
- **Parameter Support**: String interpolation with object parameters
- **Fallback Strategy**: Returns original key if translation missing
- **Performance**: Pre-loaded JSON translations for instant access
- **Memory Efficient**: Single JSON file loaded per language

**Layer 2: Automatic Master Data Translation**
```typescript
// HTTP response automatically translated via interceptor
this.http.get<Project[]>('/api/projects').subscribe(projects => {
  // project.name automatically translated to current language
  console.log(projects[0].name); // "Projet Zurich" (if French selected)
});

// Manual translation service usage (optional)
this.masterDataTranslationService.translateContent(
  'Zurich Project', 'de', 'project'
).subscribe(result => {
  console.log(result.translatedText); // "Projekt Zürich"
});
```

**Translation Service Architecture:**
```typescript
// Core synchronous translation service implementation
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private currentLanguageSubject = new BehaviorSubject<SupportedLanguage>('en');
  public currentLanguage$ = this.currentLanguageSubject.asObservable();
  private translations: Record<string, any> = {};

  constructor(
    private translationLoader: TranslationLoaderService,
    private languageService: LanguageService
  ) {
    this.initializeTranslations();
  }

  /**
   * Synchronous translation method - core implementation
   * @param key - Translation key (e.g., 'employee.dashboard.title')
   * @param params - Optional parameters for string interpolation
   * @returns Translated string or fallback
   */
  translateSync(key: string, params?: Record<string, any>): string {
    const translation = this.getNestedTranslation(key);

    if (!translation) {
      console.warn(`Translation key not found: ${key}`);
      return key; // Fallback to key
    }

    return params ? this.interpolateParameters(translation, params) : translation;
  }

  /**
   * Language switching with immediate effect
   * @param language - Target language code
   */
  setLanguage(language: SupportedLanguage): void {
    this.currentLanguageSubject.next(language);
    this.loadTranslationsForLanguage(language);
  }

  private getNestedTranslation(key: string): string | null {
    return key.split('.').reduce((obj, k) => obj?.[k], this.translations);
  }

  private interpolateParameters(template: string, params: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, paramName) =>
      params[paramName]?.toString() ?? match
    );
  }
}
```

## Subscription Lifecycle Management

### Phase 1 & Phase 2 Implementation (Critical for Memory Management)

This system implements a two-phase subscription cleanup strategy to eliminate memory leaks and prevent unauthorized error messages during logout. **All new components and services MUST implement these patterns.**

### Phase 1: Application-Level Subscription Management

**Purpose:** Clean up business logic subscriptions (API calls, form watchers, timers)

**Implementation Pattern:**
```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({...})
export class YourComponent implements OnInit, OnDestroy {
  // Phase 1: Add destroy subject
  private destroy$ = new Subject<void>();

  constructor(private yourService: YourService) {}

  ngOnInit(): void {
    // Phase 1: All subscriptions must use takeUntil(this.destroy$)
    this.yourService.getData()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        // Handle data
      });

    // Form value changes
    this.formControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        // Handle form changes
      });
  }

  ngOnDestroy(): void {
    // Phase 1: Trigger cleanup for all subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

**Service Implementation Pattern:**
```typescript
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class YourService implements OnDestroy {
  // Phase 1: Global cleanup subject for service-level subscriptions
  private destroy$ = new Subject<void>();
  
  private dataSubject = new BehaviorSubject<DataType[]>([]);
  private autoRefreshSubscription?: any;

  constructor(private http: HttpClient) {}

  startAutoRefresh(): void {
    this.stopAutoRefresh();
    
    // Phase 1: Auto-refresh timer with cleanup
    this.autoRefreshSubscription = timer(60000, 60000)
      .pipe(
        switchMap(() => this.loadData()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: data => this.dataSubject.next(data),
        error: error => {
          // Phase 1: Ignore auth errors during logout
          if (error.status !== 401 && error.status !== 403) {
            console.error('Auto-refresh failed:', error);
          }
        }
      });
  }

  private refreshData(): void {
    // Phase 1: Refresh calls with proper cleanup
    this.loadData()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: error => {
          // Phase 1: Silent auth error handling during cleanup
          if (error.status !== 401 && error.status !== 403) {
            console.error('Failed to refresh data:', error);
          }
        }
      });
  }

  // Phase 1: Cleanup method for logout scenarios
  public cleanup(): void {
    this.destroy$.next();
    console.log('YourService: All subscriptions cleaned up');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

### Phase 2: Angular Framework-Level Cleanup

**Purpose:** Clean up Angular's internal subscriptions (296+ framework subscriptions)

**Core Service Implementation:**
```typescript
// apps/web/src/app/core/services/angular-cleanup.service.ts
import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AngularCleanupService {
  private ngZone = inject(NgZone);
  private router = inject(Router);
  private http = inject(HttpClient);
  private location = inject(Location);

  // Global cleanup trigger for Angular internals
  private cleanupTrigger$ = new Subject<void>();

  /**
   * Phase 2: Force cleanup of Angular's internal subscription management
   * Targets 296+ internal Angular subscriptions that survive logout
   */
  public forceCleanupAngularInternals(): void {
    console.log('🧹 Phase 2: Starting Angular framework cleanup...');

    // 1. Signal cleanup to all tracked subscriptions
    this.cleanupTrigger$.next();

    // 2. Clean NgZone pending tasks
    this.cleanupNgZoneTasks();

    // 3. Clean Router subscriptions
    this.cleanupRouterSubscriptions();

    // 4. Clean HTTP client internal state
    this.cleanupHttpClientInternals();

    // 5. Clean Location service subscriptions
    this.cleanupLocationSubscriptions();

    // 6. Force garbage collection of Angular forms
    this.cleanupAngularForms();

    // 7. Clean change detection subscriptions
    this.cleanupChangeDetection();

    console.log('✅ Phase 2: Angular framework cleanup completed');
  }

  private cleanupNgZoneTasks(): void {
    try {
      // Cancel pending NgZone tasks
      (this.ngZone as any)._inner?.cancelAnimationFrame?.();
      (this.ngZone as any)._inner?.clearTimeout?.();
      (this.ngZone as any)._inner?.clearInterval?.();
    } catch (error) {
      // Silent cleanup
    }
  }

  private cleanupRouterSubscriptions(): void {
    try {
      // Clean router internal subscriptions
      const routerInternal = (this.router as any);
      routerInternal.navigationTransitions?.complete?.();
      routerInternal.routerState?.complete?.();
    } catch (error) {
      // Silent cleanup
    }
  }

  private cleanupHttpClientInternals(): void {
    try {
      // Clean HTTP client internal state
      const httpInternal = (this.http as any);
      httpInternal.handler?.complete?.();
    } catch (error) {
      // Silent cleanup
    }
  }

  private cleanupLocationSubscriptions(): void {
    try {
      // Clean Location service subscriptions
      const locationInternal = (this.location as any);
      locationInternal.subject?.complete?.();
    } catch (error) {
      // Silent cleanup
    }
  }

  private cleanupAngularForms(): void {
    try {
      // Force cleanup of form controls and validators
      document.querySelectorAll('form').forEach(form => {
        const formInternal = (form as any);
        formInternal._ngModel?.complete?.();
      });
    } catch (error) {
      // Silent cleanup
    }
  }

  private cleanupChangeDetection(): void {
    try {
      // Clean change detection subscriptions
      const ngZoneInternal = (this.ngZone as any);
      ngZoneInternal.onStable?.complete?.();
      ngZoneInternal.onUnstable?.complete?.();
      ngZoneInternal.onError?.complete?.();
      ngZoneInternal.onMicrotaskEmpty?.complete?.();
    } catch (error) {
      // Silent cleanup
    }
  }
}
```

**Integration with AuthService:**
```typescript
// apps/web/src/app/core/services/auth.service.ts
export class AuthService {
  constructor(
    private angularCleanupService: AngularCleanupService
  ) {}

  logout(): Observable<void> {
    // Phase 1: Trigger application-level cleanup
    this.triggerServiceCleanup();
    
    // Phase 2: Force Angular framework cleanup
    this.angularCleanupService.forceCleanupAngularInternals();
    
    // Continue with normal logout process
    return this.performLogout();
  }

  private triggerServiceCleanup(): void {
    // Call cleanup() on all services that implement it
    this.projectService.cleanup();
    this.managerDashboardService.cleanup();
    this.employeeService.cleanup();
  }
}
```

### HTTP Request Cancellation Pattern

**Enhanced Auth Interceptor with Cleanup:**
```typescript
// apps/web/src/app/core/interceptors/auth.interceptor.ts
import { Subject, EMPTY, timeout, takeUntil } from 'rxjs';

// Global HTTP cleanup subject for request cancellation
let globalHttpCleanup$ = new Subject<void>();

export function triggerHttpCleanup(): void {
  globalHttpCleanup$.next();
  globalHttpCleanup$.complete();
  globalHttpCleanup$ = new Subject<void>();
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const user = authService.getCurrentUser();

  if (user?.accessToken) {
    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${user.accessToken}` }
    });
    
    return next(authReq).pipe(
      takeUntil(globalHttpCleanup$),
      timeout(30000)
    );
  } else {
    // Allow config file requests to proceed (needed for app initialization)
    if (req.url.includes('/assets/config/')) {
      return next(req).pipe(
        takeUntil(globalHttpCleanup$),
        timeout(30000)
      );
    }
    
    // Phase 2: Cancel unauthorized requests instead of allowing them
    return EMPTY;
  }
};
```

## Implementation Requirements

### 🚨 Mandatory Patterns for All Components

1. **Component Subscription Management (With Synchronous Translation):**
   ```typescript
   export class YourComponent implements OnInit, OnDestroy {
     private destroy$ = new Subject<void>();

     // Synchronous translation integration - no subscription needed
     constructor(public translationService: TranslationService) {}

     ngOnInit(): void {
       // ALL async subscriptions MUST use takeUntil(this.destroy$)
       this.service.data$.pipe(takeUntil(this.destroy$)).subscribe(/*...*/);

       // Language change subscriptions need cleanup (for reactive updates)
       this.translationService.currentLanguage$
         .pipe(takeUntil(this.destroy$))
         .subscribe(lang => {
           // Handle language changes - typically triggers UI refresh
           this.cdRef.detectChanges(); // If using OnPush change detection
         });
     }

     // Direct synchronous translation usage
     getPageTitle(): string {
       return this.translationService.translateSync('your.page.title');
     }

     ngOnDestroy(): void {
       this.destroy$.next();
       this.destroy$.complete();
     }
   }
   ```

2. **Service Subscription Management:**
   ```typescript
   @Injectable({ providedIn: 'root' })
   export class YourService implements OnDestroy {
     private destroy$ = new Subject<void>();
     
     // ALL internal subscriptions use takeUntil(this.destroy$)
     private loadData(): void {
       this.http.get('/api/data')
         .pipe(takeUntil(this.destroy$))
         .subscribe(/*...*/);
     }
     
     public cleanup(): void {
       this.destroy$.next();
     }
     
     ngOnDestroy(): void {
       this.destroy$.next();
       this.destroy$.complete();
     }
   }
   ```

3. **Auth Error Handling Pattern:**
   ```typescript
   // In all subscription error handlers
   .subscribe({
     error: error => {
       // Ignore auth errors silently during logout
       if (error.status !== 401 && error.status !== 403) {
         console.error('Operation failed:', error);
         // Show user-facing error
       }
     }
   });
   ```

### Integration Checklist for New Features

**Subscription Management:**
- [ ] All components implement `OnDestroy` with `destroy$` subject
- [ ] All subscriptions use `takeUntil(this.destroy$)`
- [ ] Services implement `cleanup()` method
- [ ] Auth error handling ignores 401/403 during logout
- [ ] Auto-refresh timers are properly cancelled
- [ ] Form value change subscriptions are cleaned up
- [ ] HTTP requests are cancellable via global cleanup subjects

**Synchronous Translation Integration:**
- [ ] All static text uses `translationService.translateSync()`: `{{ translationService.translateSync('key') }}`
- [ ] Translation services injected as `public` for direct template access
- [ ] Translation keys follow hierarchical structure: `feature.component.element`
- [ ] Parameter interpolation uses object syntax: `translateSync('key', { param: value })`
- [ ] Language change subscriptions use `takeUntil(this.destroy$)` for cleanup
- [ ] Master data fields automatically translated via HTTP interceptor
- [ ] New translation keys added to all language files (de.json, fr.json, it.json, en.json)
- [ ] Language switcher component included in main navigation
- [ ] Forms handle translated validation messages with synchronous access
- [ ] Error messages support multilingual display through sync translation
- [ ] Components implement proper fallback for missing translation keys

## Frontend Architecture Benefits

**Problem Solved:** After implementing authentication logout, users were seeing unauthorized error messages despite HTTP requests completing successfully. Investigation revealed:

1. **Phase 1 Issue:** Application subscriptions (timers, forms, API calls) continued running after logout
2. **Phase 2 Issue:** Angular's internal framework subscriptions (296+ active) were not being cleaned up, causing memory leaks and error propagation

**Benefits:** Zero unauthorized errors, memory leak prevention, improved performance, better user experience, scalable pattern for new features, and seamless multilingual support across all components.

**Requirements:** Phase 1 patterns are mandatory for all components/services, Phase 2 integration is automatic through AuthService, testing must verify subscription cleanup, and all new features must include multilingual support with proper translation key structure.

## Synchronous Translation Integration Benefits

**Complete Multilingual Coverage:**
- **Synchronous Static UI Translation:** All buttons, labels, forms, messages in user's preferred language with immediate access
- **Dynamic Master Data:** Project names, descriptions automatically translated via HTTP interceptor
- **Instant Language Switching:** Immediate UI updates through synchronous translation access
- **Simplified Integration:** Direct method calls instead of subscription management

**Developer Experience:**
- **Simple Template Syntax:** `{{ translationService.translateSync('key') }}` for all static text
- **Direct Method Access:** No observable subscriptions needed for static translations
- **Parameter Interpolation:** Built-in support for dynamic values: `translateSync('key', { count: 5 })`
- **Hierarchical Translation Keys:** Organized, maintainable JSON structure
- **Automatic Master Data:** HTTP interceptor handles all API response translation
- **Swiss Market Optimization:** Flag-based language switcher, regional preloading

**Performance & Reliability:**
- **Synchronous Access:** No async overhead for static UI translations
- **Memory Efficiency:** Pre-loaded JSON translations for instant access
- **Fallback Resilience:** Original key shown if translation missing
- **Multi-Level Caching:** Backend PostgreSQL + frontend memory cache for master data
- **Intelligent Preloading:** Browser language detection and regional optimization
- **Cost Optimization:** Caching reduces AWS Translate API usage

**Architecture Advantages:**
- **Reduced Complexity:** Eliminates async pipe chains for static text
- **Better Performance:** Direct object property access vs. observable streams
- **Simplified Testing:** Synchronous methods easier to unit test
- **Improved DX:** Less boilerplate code for translation integration

This synchronous translation architecture combined with subscription lifecycle management ensures application stability, user experience quality, and complete Swiss market multilingual support with simplified developer workflows.