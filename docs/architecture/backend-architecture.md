# Backend Architecture

## Service Architecture

AWS Lambda functions organized by domain:

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
├── domain/
│   └── travel-allowance/
└── utils/
    ├── lambda-wrapper.ts
    └── db-connection.ts
```

## Authentication

AWS Cognito integration with JWT validation:

```typescript
// Angular Auth Guard
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    return this.authService.isAuthenticated$.pipe(
      tap(isAuth => {
        if (!isAuth) {
          this.router.navigate(['/login']);
        }
      })
    );
  }
}

// Angular Auth Service
@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.currentUser$.pipe(map(user => !!user));

  constructor(private http: HttpClient) {
    const token = localStorage.getItem('token');
    if (token) {
      this.validateToken(token);
    }
  }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', credentials).pipe(
      tap(response => {
        localStorage.setItem('token', response.token);
        this.currentUserSubject.next(response.user);
      })
    );
  }
}
```
