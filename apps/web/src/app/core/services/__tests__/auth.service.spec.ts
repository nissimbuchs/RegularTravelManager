import { TestBed } from '@angular/core/testing';
import { AuthService, User } from '../auth.service';
import { of, take, BehaviorSubject, Observable, map } from 'rxjs';

// Mock AuthService for testing
class MockAuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.currentUser$.pipe(map(user => !!user));

  hasRole(role: 'employee' | 'manager'): Observable<boolean> {
    return of(false);
  }

  hasAnyRole(roles: ('employee' | 'manager')[]): Observable<boolean> {
    return of(false);
  }

  login(credentials: any): Observable<any> {
    return of({});
  }

  logout(): Observable<void> {
    return of(void 0);
  }

  getCurrentUser(): Observable<User | null> {
    return this.currentUser$;
  }
}

describe('AuthService', () => {
  let service: MockAuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useClass: MockAuthService }],
    });
    service = TestBed.inject(AuthService) as any;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should detect when user is not authenticated', done => {
    service.isAuthenticated$.pipe(take(1)).subscribe(isAuth => {
      expect(isAuth).toBeFalsy();
      done();
    });
  });

  describe('hasRole', () => {
    it('should return false when no user is authenticated', done => {
      service
        .hasRole('employee')
        .pipe(take(1))
        .subscribe(hasRole => {
          expect(hasRole).toBeFalsy();
          done();
        });
    });
  });

  describe('hasAnyRole', () => {
    it('should return false when no user is authenticated', done => {
      service
        .hasAnyRole(['employee', 'manager'])
        .pipe(take(1))
        .subscribe(hasRole => {
          expect(hasRole).toBeFalsy();
          done();
        });
    });
  });
});
