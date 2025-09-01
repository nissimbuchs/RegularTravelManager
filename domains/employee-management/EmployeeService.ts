export interface Employee {
  id: string;
  cognito_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  employee_id: string;
  home_street: string;
  home_city: string;
  home_postal_code: string;
  home_country: string;
  home_location: { latitude: number; longitude: number };
  created_at: Date;
  updated_at: Date;
}

export interface CreateEmployeeCommand {
  cognito_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  employee_id: string;
}

export interface UpdateEmployeeAddressCommand {
  id: string;
  home_street: string;
  home_city: string;
  home_postal_code: string;
  home_country: string;
}

export interface EmployeeService {
  /**
   * Create a new employee profile
   */
  createEmployee(command: CreateEmployeeCommand): Promise<Employee>;

  /**
   * Update employee address with automatic geocoding
   */
  updateEmployeeAddress(command: UpdateEmployeeAddressCommand): Promise<Employee>;

  /**
   * Get employee by ID
   */
  getEmployee(id: string): Promise<Employee | null>;

  /**
   * Get employee by Cognito user ID
   */
  getEmployeeByCognitoId(cognitoUserId: string): Promise<Employee | null>;

  /**
   * Get employee by employee ID
   */
  getEmployeeByEmployeeId(employeeId: string): Promise<Employee | null>;

  /**
   * Search employees by name or employee ID
   */
  searchEmployees(searchTerm: string): Promise<Employee[]>;
}
