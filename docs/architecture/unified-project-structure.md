# Unified Project Structure

DDD-based monorepo structure:

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
