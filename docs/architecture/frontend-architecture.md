# Frontend Architecture

## Component Architecture

Angular components organized by feature modules following DDD principles:

```
apps/web/src/
├── app/
│   ├── features/
│   │   ├── employee/
│   │   │   ├── components/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── new-request/
│   │   │   │   └── travel-request-form/
│   │   │   ├── employee.module.ts
│   │   │   └── employee-routing.module.ts
│   │   ├── manager/
│   │   │   ├── components/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── approvals/
│   │   │   │   └── pending-approvals-table/
│   │   │   ├── manager.module.ts
│   │   │   └── manager-routing.module.ts
│   ├── shared/
│   │   ├── components/
│   │   │   ├── forms/
│   │   │   └── tables/
│   │   └── services/
│   │       ├── travel-request.service.ts
│   │       └── project.service.ts
│   ├── core/
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   └── notification.service.ts
│   │   └── guards/
│   └── store/
│       ├── travel-request/
│       └── auth/
```

## State Management

NgRx stores following domain separation and feature-based organization:

```typescript
// Travel Request State
export interface TravelRequestState {
  requests: TravelRequest[];
  selectedRequest: TravelRequest | null;
  loading: boolean;
  error: string | null;
}

// Travel Request Actions
export const TravelRequestActions = createActionGroup({
  source: 'Travel Request',
  events: {
    'Submit Request': props<{ dto: CreateTravelRequestDto }>(),
    'Submit Request Success': props<{ request: TravelRequest }>(),
    'Submit Request Failure': props<{ error: string }>(),
    'Approve Request': props<{ requestId: string }>(),
    'Load Requests': emptyProps(),
  },
});

// Travel Request Effects
@Injectable()
export class TravelRequestEffects {
  submitRequest$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TravelRequestActions.submitRequest),
      switchMap(({ dto }) =>
        this.travelRequestService.submitRequest(dto).pipe(
          map(request => TravelRequestActions.submitRequestSuccess({ request })),
          catchError(error => of(TravelRequestActions.submitRequestFailure({ error })))
        )
      )
    )
  );
}
```
