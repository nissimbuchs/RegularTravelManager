import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfigService } from './config.service';
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
  private configService = inject(ConfigService);

  constructor(private http: HttpClient) {}

  private get baseUrl(): string {
    return `${this.configService.apiUrl}/employees`;
  }

  // Get employee profile by ID (expects cognitoUserId, which is the email)
  getEmployeeProfile(cognitoUserId: string): Observable<EmployeeDto> {
    const url = `${this.baseUrl}/${cognitoUserId}`;
    console.log('🔍 EmployeeService.getEmployeeProfile() called with:', {
      cognitoUserId,
      url,
      isEmail: cognitoUserId.includes('@'),
      isUuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cognitoUserId),
      stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
    });
    
    if (!cognitoUserId.includes('@')) {
      console.warn('⚠️  WARNING: getEmployeeProfile() called with non-email ID. Expected cognitoUserId (email), got:', cognitoUserId);
    }
    
    return this.http.get<EmployeeDto>(url);
  }

  // Update employee address (expects cognitoUserId, which is the email)
  updateEmployeeAddress(
    cognitoUserId: string,
    addressData: UpdateEmployeeAddressRequest
  ): Observable<EmployeeDto> {
    console.log('🔍 EmployeeService.updateEmployeeAddress() called with:', {
      cognitoUserId,
      isEmail: cognitoUserId.includes('@'),
      addressData
    });
    
    if (!cognitoUserId.includes('@')) {
      console.warn('⚠️  WARNING: updateEmployeeAddress() called with non-email ID. Expected cognitoUserId (email), got:', cognitoUserId);
    }
    
    return this.http.put<EmployeeDto>(`${this.baseUrl}/${cognitoUserId}/address`, addressData);
  }

  // Validation helper for Swiss postal codes
  validateSwissPostalCode(postalCode: string): boolean {
    const swissPostalCodeRegex = /^[0-9]{4}$/;
    return swissPostalCodeRegex.test(postalCode);
  }

  // Format address for display
  formatAddress(employee: EmployeeDto): string {
    if (!employee.homeStreet) return 'No address set'; // ✅ Fixed: Use camelCase per API field naming conventions

    return `${employee.homeStreet}, ${employee.homePostalCode} ${employee.homeCity}, ${employee.homeCountry}`; // ✅ Fixed: Use camelCase per API field naming conventions
  }

  // Get supported countries
  getSupportedCountries(): string[] {
    return ['Switzerland', 'Germany', 'France', 'Italy', 'Austria'];
  }

  // Get all managers for dropdown selection
  getManagers(): Observable<Manager[]> {
    return this.http
      .get<{ managers: Manager[] }>(`${this.configService.apiUrl}/managers`)
      .pipe(map(response => response.managers));
  }
}
