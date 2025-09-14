import { Injectable, inject, NgZone, ApplicationRef } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Phase 2: Angular Internal Cleanup Service
 *
 * Targets Angular's internal subscription management that persists after logout.
 * Based on debug analysis showing 296 active subscriptions from Angular internals:
 * - Forms and FormControl observables
 * - Router navigation and route change subscriptions
 * - HTTP client internal subscriptions
 * - Change detection and NgZone tasks
 * - Location service subscriptions
 */
@Injectable({
  providedIn: 'root',
})
export class AngularCleanupService {
  private ngZone = inject(NgZone);
  private router = inject(Router);
  private appRef = inject(ApplicationRef);
  private httpClient = inject(HttpClient);
  private location = inject(Location);

  private cleanupTrigger$ = new Subject<void>();
  private originalHttpMethods: { [key: string]: Function } = {};
  private routerSubscriptions: any[] = [];
  private trackedFormSubscriptions = new Set<any>();

  constructor() {
    this.setupInternalSubscriptionTracking();
  }

  /**
   * Force cleanup all Angular internal subscriptions and tasks
   * Called during logout to prevent persistent HTTP requests
   */
  public forceCleanupAngularInternals(): void {
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
  }

  /**
   * Setup tracking of Angular internal subscriptions
   */
  private setupInternalSubscriptionTracking(): void {
    this.patchRouterForTracking();
    this.patchHttpClientForTracking();
    this.patchFormControlForTracking();
  }

  /**
   * Clean NgZone pending macro and microtasks
   */
  private cleanupNgZoneTasks(): void {
    console.log('🔄 Cleaning NgZone pending tasks...');

    try {
      // Access NgZone internals to clear pending tasks
      const zone = this.ngZone as any;

      // Clear pending macrotasks
      if (zone._inner?._properties?.macroTaskQueue) {
        zone._inner._properties.macroTaskQueue.length = 0;
        console.log('✅ Cleared NgZone macrotask queue');
      }

      // Clear pending microtasks
      if (zone._inner?._properties?.microtaskQueue) {
        zone._inner._properties.microtaskQueue.length = 0;
        console.log('✅ Cleared NgZone microtask queue');
      }

      // Force stability check
      if (zone._inner && typeof zone._inner.checkStability === 'function') {
        zone._inner.checkStability();
      }
    } catch (error) {
      console.warn('⚠️ Could not access NgZone internals for cleanup:', error);
    }
  }

  /**
   * Clean Router subscriptions and navigation state
   */
  private cleanupRouterSubscriptions(): void {
    console.log('🛣️ Cleaning Router subscriptions...');

    try {
      // Unsubscribe tracked router subscriptions
      this.routerSubscriptions.forEach(sub => {
        if (sub && typeof sub.unsubscribe === 'function') {
          sub.unsubscribe();
        }
      });
      this.routerSubscriptions.length = 0;

      // Access router internals for cleanup
      const router = this.router as any;

      // Clear navigation history if accessible
      if (router.routerState?.root?.children) {
        router.routerState.root.children.length = 0;
      }

      // Clear route reuse strategy cache
      if (router.routeReuseStrategy?.handlers) {
        router.routeReuseStrategy.handlers.clear();
      }

      console.log('✅ Router subscriptions cleaned');
    } catch (error) {
      console.warn('⚠️ Could not access Router internals for cleanup:', error);
    }
  }

  /**
   * Clean HTTP client internal subscriptions and request cache
   */
  private cleanupHttpClientInternals(): void {
    console.log('🌐 Cleaning HTTP client internals...');

    try {
      const httpClient = this.httpClient as any;

      // Clear any internal HTTP client caches
      if (httpClient.handler?.backend?.connections) {
        httpClient.handler.backend.connections.clear();
        console.log('✅ Cleared HTTP client connections');
      }

      // Cancel any pending HTTP requests by accessing XHR backend
      if (httpClient.handler?.backend?.pendingRequests) {
        const pendingRequests = httpClient.handler.backend.pendingRequests;
        pendingRequests.forEach((req: any) => {
          if (req && typeof req.abort === 'function') {
            req.abort();
          }
        });
        pendingRequests.clear();
        console.log('✅ Cancelled pending HTTP requests');
      }
    } catch (error) {
      console.warn('⚠️ Could not access HTTP client internals for cleanup:', error);
    }
  }

  /**
   * Clean Location service subscriptions
   */
  private cleanupLocationSubscriptions(): void {
    console.log('📍 Cleaning Location service subscriptions...');

    try {
      const location = this.location as any;

      // Clear location change listeners
      if (location._platformLocation?._listeners) {
        location._platformLocation._listeners.clear();
        console.log('✅ Cleared Location service listeners');
      }
    } catch (error) {
      console.warn('⚠️ Could not access Location service internals for cleanup:', error);
    }
  }

  /**
   * Clean Angular forms and FormControl subscriptions
   */
  private cleanupAngularForms(): void {
    console.log('📝 Cleaning Angular forms...');

    try {
      // Clean tracked form subscriptions
      this.trackedFormSubscriptions.forEach(sub => {
        if (sub && typeof sub.unsubscribe === 'function') {
          sub.unsubscribe();
        }
      });
      this.trackedFormSubscriptions.clear();

      // Force garbage collection hint
      if (typeof window !== 'undefined' && (window as any).gc) {
        (window as any).gc();
        console.log('✅ Forced garbage collection');
      }

      console.log('✅ Angular forms cleaned');
    } catch (error) {
      console.warn('⚠️ Could not clean Angular forms:', error);
    }
  }

  /**
   * Clean change detection subscriptions
   */
  private cleanupChangeDetection(): void {
    console.log('🔄 Cleaning change detection subscriptions...');

    try {
      // Force change detection cycle to clean up stale subscriptions
      this.ngZone.run(() => {
        console.log('✅ Forced change detection cycle for cleanup');
      });
    } catch (error) {
      console.warn('⚠️ Could not reset change detection:', error);
    }
  }

  /**
   * Patch Router to track subscriptions
   */
  private patchRouterForTracking(): void {
    const router = this.router as any;

    if (router.events && typeof router.events.pipe === 'function') {
      const originalPipe = router.events.pipe.bind(router.events);

      router.events.pipe = (...operators: any[]) => {
        const subscription = originalPipe(...operators, takeUntil(this.cleanupTrigger$));
        this.routerSubscriptions.push(subscription);
        return subscription;
      };
    }
  }

  /**
   * Patch HTTP client to track internal subscriptions
   */
  private patchHttpClientForTracking(): void {
    const httpClient = this.httpClient as any;

    // Store original methods
    this.originalHttpMethods['get'] = httpClient.get?.bind(httpClient);
    this.originalHttpMethods['post'] = httpClient.post?.bind(httpClient);
    this.originalHttpMethods['put'] = httpClient.put?.bind(httpClient);
    this.originalHttpMethods['delete'] = httpClient.delete?.bind(httpClient);
    this.originalHttpMethods['patch'] = httpClient.patch?.bind(httpClient);

    // Patch methods to add takeUntil
    ['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
      if (httpClient[method]) {
        httpClient[method] = (...args: any[]) => {
          const observable = this.originalHttpMethods[method]!(...args);
          return observable.pipe(takeUntil(this.cleanupTrigger$));
        };
      }
    });
  }

  /**
   * Patch FormControl to track value change subscriptions
   */
  private patchFormControlForTracking(): void {
    try {
      // This requires access to Angular Forms internals
      // We'll track subscriptions when they're created
      const originalSubscribe = Observable.prototype.subscribe;

      Observable.prototype.subscribe = function (this: Observable<any>, ...args: any[]) {
        const subscription = originalSubscribe.call(this, args[0], args[1], args[2]);

        // Check if this is a form-related subscription
        const stack = new Error().stack || '';
        if (stack.includes('FormControl') || stack.includes('forms')) {
          // Track this subscription for cleanup
          const service = (window as any).angularCleanupService;
          if (service && service.trackedFormSubscriptions) {
            service.trackedFormSubscriptions.add(subscription);
          }
        }

        return subscription;
      };

      // Store reference to this service globally for the patch
      (window as any).angularCleanupService = this;
    } catch (error) {
      console.warn('⚠️ Could not patch FormControl tracking:', error);
    }
  }

  /**
   * Restore original HTTP client methods
   */
  private restoreHttpClientMethods(): void {
    const httpClient = this.httpClient as any;

    Object.keys(this.originalHttpMethods).forEach(method => {
      if (this.originalHttpMethods[method]) {
        httpClient[method] = this.originalHttpMethods[method];
      }
    });
  }

  /**
   * Complete cleanup and restore original state
   */
  public destroy(): void {
    console.log('🧹 Destroying Angular Cleanup Service...');

    this.forceCleanupAngularInternals();
    this.restoreHttpClientMethods();

    // Complete the cleanup trigger
    this.cleanupTrigger$.complete();

    // Remove global reference
    delete (window as any).angularCleanupService;

    console.log('✅ Angular Cleanup Service destroyed');
  }
}
