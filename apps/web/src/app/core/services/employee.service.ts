import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  EmployeeDto,
  UpdateEmployeeAddressRequest,
} from '../../../../../../packages/shared/src/types/api';

interface Manager {
  id: string;
  name: string;
  employeeId: string;
}

@Injectable({
  providedIn: 'root',
})
export class EmployeeService {
  private readonly baseUrl = `${environment.apiUrl}/employees`;

  constructor(private http: HttpClient) {}

  // Get employee profile by ID
  getEmployeeProfile(id: string): Observable<EmployeeDto> {
    const url = `${this.baseUrl}/${id}`;
    console.log('Making API call to:', url); // Debug log
    return this.http.get<EmployeeDto>(url);
  }

  // Update employee address
  updateEmployeeAddress(
    id: string,
    addressData: UpdateEmployeeAddressRequest
  ): Observable<EmployeeDto> {
    return this.http.put<EmployeeDto>(`${this.baseUrl}/${id}/address`, addressData);
  }

  // Validation helper for Swiss postal codes
  validateSwissPostalCode(postalCode: string): boolean {
    const swissPostalCodeRegex = /^[0-9]{4}$/;
    return swissPostalCodeRegex.test(postalCode);
  }

  // Format address for display
  formatAddress(employee: EmployeeDto): string {
    if (!employee.home_street) return 'No address set';

    return `${employee.home_street}, ${employee.home_postal_code} ${employee.home_city}, ${employee.home_country}`;
  }

  // Get supported countries
  getSupportedCountries(): string[] {
    return ['Switzerland', 'Germany', 'France', 'Italy', 'Austria'];
  }

  // Get all managers for dropdown selection
  getManagers(): Observable<Manager[]> {
    return this.http
      .get<{ managers: Manager[] }>(`${environment.apiUrl}/managers`)
      .pipe(map(response => response.managers));
  }
}
