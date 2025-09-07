// Test users configuration for Cognito user creation
// These users match the documentation in README.md

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  groups: string[];
  role: 'admin' | 'manager' | 'employee';
}

export const TEST_USERS: TestUser[] = [
  // Admin Users (Full System Access)
  {
    email: 'admin1@company.ch',
    password: 'AdminPass123!Test',
    firstName: 'Hans',
    lastName: 'Zimmermann',
    employeeId: 'ADM-0001',
    groups: ['administrators', 'managers', 'employees'],
    role: 'admin',
  },
  {
    email: 'admin2@company.ch',
    password: 'AdminPass123!Test',
    firstName: 'Maria',
    lastName: 'Weber',
    employeeId: 'ADM-0002',
    groups: ['administrators', 'managers', 'employees'],
    role: 'admin',
  },

  // Managers
  {
    email: 'manager1@company.ch',
    password: 'ManagerPass123!',
    firstName: 'Thomas',
    lastName: 'Müller',
    employeeId: 'MGR-0001',
    groups: ['managers', 'employees'],
    role: 'manager',
  },
  {
    email: 'manager2@company.ch',
    password: 'ManagerPass123!',
    firstName: 'Sophie',
    lastName: 'Dubois',
    employeeId: 'MGR-0002',
    groups: ['managers', 'employees'],
    role: 'manager',
  },

  // Employees
  {
    email: 'employee1@company.ch',
    password: 'EmployeePass123!',
    firstName: 'Anna',
    lastName: 'Schneider',
    employeeId: 'EMP-0001',
    groups: ['employees'],
    role: 'employee',
  },
  {
    email: 'employee2@company.ch',
    password: 'EmployeePass123!',
    firstName: 'Marco',
    lastName: 'Rossi',
    employeeId: 'EMP-0002',
    groups: ['employees'],
    role: 'employee',
  },
  {
    email: 'employee3@company.ch',
    password: 'EmployeePass123!',
    firstName: 'Lisa',
    lastName: 'Meier',
    employeeId: 'EMP-0003',
    groups: ['employees'],
    role: 'employee',
  },
  {
    email: 'employee4@company.ch',
    password: 'EmployeePass123!',
    firstName: 'Pierre',
    lastName: 'Martin',
    employeeId: 'EMP-0004',
    groups: ['employees'],
    role: 'employee',
  },
  {
    email: 'employee5@company.ch',
    password: 'EmployeePass123!',
    firstName: 'Julia',
    lastName: 'Fischer',
    employeeId: 'EMP-0005',
    groups: ['employees'],
    role: 'employee',
  },
  {
    email: 'employee6@company.ch',
    password: 'EmployeePass123!',
    firstName: 'Michael',
    lastName: 'Keller',
    employeeId: 'EMP-0006',
    groups: ['employees'],
    role: 'employee',
  },
];

// Helper function to get users for a specific environment
export function getTestUsersForEnvironment(environment: string): TestUser[] {
  switch (environment) {
    case 'dev':
    case 'staging':
      return TEST_USERS; // All users for dev and staging
    case 'production':
      return []; // No test users in production
    default:
      return [];
  }
}
