# HTTP Interceptors

## Response Interceptor

**Purpose**: Automatically unwraps API responses from the backend.

### Problem Solved
The backend consistently returns wrapped responses in this format:
```json
{
  "success": true,
  "data": { ...actual_data... },
  "timestamp": "2025-09-03T16:15:46.974Z",
  "requestId": "dev-1756916146878"
}
```

Without this interceptor, frontend services would need to manually extract the `data` field from every API response, leading to:
- Inconsistent response handling across services
- Repeated boilerplate code
- Easy-to-miss bugs where wrapped objects are used directly

### How It Works
The `responseInterceptor` automatically detects wrapped responses and extracts the `data` field, so services can work with clean, typed data directly.

### Service Implementation
With this interceptor, services can be written simply:

```typescript
// ✅ Correct - interceptor handles unwrapping
getEmployeeProfile(id: string): Observable<EmployeeDto> {
  return this.http.get<EmployeeDto>(`${this.baseUrl}/${id}`);
}

// ❌ Wrong - manual unwrapping not needed
getEmployeeProfile(id: string): Observable<EmployeeDto> {
  return this.http.get<ApiResponse<EmployeeDto>>(`${this.baseUrl}/${id}`)
    .pipe(map(response => response.data!));
}
```

### Interceptor Order
The response interceptor is placed early in the chain:
```
loadingInterceptor → responseInterceptor → authInterceptor → errorInterceptor
```

This ensures responses are unwrapped before error handling.

## Guidelines for New Services

1. **Always expect the unwrapped data type** (e.g., `EmployeeDto`, not `ApiResponse<EmployeeDto>`)
2. **No manual response unwrapping** - let the interceptor handle it
3. **Consistent typing** - use the actual data interfaces from `packages/shared`

This prevents the recurring "wrapped response object error" that occurred multiple times during development.