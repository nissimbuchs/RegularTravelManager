# Sample Data Reference

This document contains detailed information about the sample data included in the RegularTravelManager development environment.

## Development Authentication & Sample Data

The development environment includes comprehensive sample data with production-matching test users covering all major Swiss business locations and scenarios.

### Admin Users (Full System Access)

| User | Email | Name | Role | Employee ID |
|------|-------|------|------|-------------|
| **admin1** | admin1@company.ch | Hans Zimmermann | CEO/Admin | ADM-0001 |
| **admin2** | admin2@company.ch | Maria Weber | IT Admin | ADM-0002 |

### Managers

| User | Email | Name | Role | Employee ID |
|------|-------|------|------|-------------|
| **manager1** | manager1@company.ch | Thomas Müller | Regional Manager | MGR-0001 |
| **manager2** | manager2@company.ch | Sophie Dubois | Regional Manager | MGR-0002 |

### Employees

| User | Email | Name | Role | Employee ID | City |
|------|-------|------|------|-------------|------|
| **employee1** | employee1@company.ch | Anna Schneider | Developer | EMP-0001 | Bern |
| **employee2** | employee2@company.ch | Marco Rossi | Project Coordinator | EMP-0002 | Lugano |
| **employee3** | employee3@company.ch | Lisa Meier | Business Analyst | EMP-0003 | St. Gallen |
| **employee4** | employee4@company.ch | Pierre Martin | Marketing Specialist | EMP-0004 | Lausanne |
| **employee5** | employee5@company.ch | Julia Fischer | Technical Consultant | EMP-0005 | Basel |
| **employee6** | employee6@company.ch | Michael Keller | Sales Representative | EMP-0006 | Winterthur |

## Sample Data Contents

### Business Projects
- **4 Projects**: Digital Transformation, Infrastructure Modernization, Customer Experience, Sustainability
- **Varying Cost Rates**: 0.65-0.80 CHF/km based on project type and client requirements

### Geographic Coverage
- **8 Subprojects**: Precise Swiss locations with accurate coordinates
- **Major Swiss Cities**: Complete coverage including Zürich, Basel, Bern, Geneva, Lausanne, Lugano, St. Gallen, Winterthur
- **Real Coordinates**: Actual Swiss business locations for realistic distance calculations

### Travel Requests
- **5 Travel Requests**: Complete lifecycle examples covering all possible states
  - Pending requests (awaiting manager approval)
  - Approved requests (ready for travel)
  - Rejected requests (with rejection reasons)
  - Withdrawn requests (employee-cancelled)
- **Audit Trails**: Complete history of status changes and address modifications
- **Realistic Scenarios**: Swiss business travel patterns and justifications

## Development Environment Authentication

### Local Development (Mock Authentication)

**To switch users in development environment:**
```javascript
// In browser console (F12) - No passwords required in development

// Admin Users (full system access)
localStorage.setItem('mockUser', 'admin1');     // Hans Zimmermann (CEO)
localStorage.setItem('mockUser', 'admin2');     // Maria Weber (IT Admin)

// Managers
localStorage.setItem('mockUser', 'manager1');   // Thomas Müller
localStorage.setItem('mockUser', 'manager2');   // Sophie Dubois

// Employees (default: employee1)
localStorage.setItem('mockUser', 'employee1');  // Anna Schneider (Bern)
localStorage.setItem('mockUser', 'employee2');  // Marco Rossi (Lugano)
localStorage.setItem('mockUser', 'employee3');  // Lisa Meier (St. Gallen)
localStorage.setItem('mockUser', 'employee4');  // Pierre Martin (Lausanne)
localStorage.setItem('mockUser', 'employee5');  // Julia Fischer (Basel)
localStorage.setItem('mockUser', 'employee6');  // Michael Keller (Winterthur)

window.location.reload();
```

**Mock User ID Mapping (UUID format for consistency):**
- admin1@company.ch → `11111111-1111-1111-1111-111111111111`
- admin2@company.ch → `22222222-2222-2222-2222-222222222222`
- manager1@company.ch → `33333333-3333-3333-3333-333333333333`
- manager2@company.ch → `44444444-4444-4444-4444-444444444444`
- employee1@company.ch → `55555555-5555-5555-5555-555555555555`
- employee2@company.ch → `66666666-6666-6666-6666-666666666666`
- employee3@company.ch → `77777777-7777-7777-7777-777777777777`
- employee4@company.ch → `88888888-8888-8888-8888-888888888888`
- employee5@company.ch → `99999999-9999-9999-9999-999999999999`
- employee6@company.ch → `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`

**Note:** Development uses mock authentication - no passwords required. Production uses AWS Cognito with real authentication.

## AWS Production Environment Access

### AWS Cognito Test Users & Passwords

**Admin Users (Full System Access):**
- **admin1@company.ch** (Hans Zimmermann, CEO) - Password: `AdminPass123!Test`
- **admin2@company.ch** (Maria Weber, IT Admin) - Password: `AdminPass123!Test`

**Managers:**
- **manager1@company.ch** (Thomas Müller, Regional Manager) - Password: `ManagerPass123!`
- **manager2@company.ch** (Sophie Dubois, Regional Manager) - Password: `ManagerPass123!`

**Employees:**
- **employee1@company.ch** (Anna Schneider, Developer) - Password: `EmployeePass123!`
- **employee2@company.ch** (Marco Rossi, Project Coordinator) - Password: `EmployeePass123!`
- **employee3@company.ch** (Lisa Meier, Business Analyst) - Password: `EmployeePass123!`
- **employee4@company.ch** (Pierre Martin, Marketing Specialist) - Password: `EmployeePass123!`
- **employee5@company.ch** (Julia Fischer, Technical Consultant) - Password: `EmployeePass123!`
- **employee6@company.ch** (Michael Keller, Sales Representative) - Password: `EmployeePass123!`

## Data Validation Commands

```bash
# Validate sample data integrity
npm run db:validate

# Check migration status
npm run db:status

# Reload sample data (resets all data)
npm run db:reset
```

## Sample Data Architecture

The sample data is designed to provide:

- **Production Parity**: Same user structure as production Cognito setup
- **Complete Business Scenarios**: All possible travel request states and workflows
- **Swiss Geographic Accuracy**: Real locations and distances for realistic calculations
- **Role-Based Access**: Admin, manager, and employee permissions properly configured
- **Audit Trail Examples**: Complete history tracking for compliance testing

This comprehensive sample data enables full testing of all system features without requiring production access or real user data.