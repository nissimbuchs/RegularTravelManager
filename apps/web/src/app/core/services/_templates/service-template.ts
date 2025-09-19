import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfigService } from '../config.service';

/**
 * TEMPLATE: Copy this file when creating new Angular services
 *
 * ⚠️  CRITICAL: Always expect {data: T} wrapped responses from API
 *
 * This template ensures:
 * - Consistent API response handling with formatResponse pattern
 * - Proper data extraction with map(response => response.data)
 * - Standard service structure
 */

// Define your data interfaces
interface ExampleData {
  id: string;
  name: string;
  email: string;
}

interface CreateRequest {
  name: string;
  email: string;
}

@Injectable({
  providedIn: 'root',
})
export class TemplateService {
  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {}

  private get baseUrl(): string {
    return `${this.configService.apiUrl}/template`;
  }

  /**
   * ✅ CORRECT: Expect {data: T} and extract with map()
   */
  getItem(id: string): Observable<ExampleData> {
    return this.http
      .get<{ data: ExampleData }>(`${this.baseUrl}/${id}`)
      .pipe(map(response => response.data));
  }

  /**
   * ✅ CORRECT: Expect {data: T[]} for collections
   */
  getItems(): Observable<ExampleData[]> {
    return this.http
      .get<{ data: ExampleData[] }>(`${this.baseUrl}`)
      .pipe(map(response => response.data));
  }

  /**
   * ✅ CORRECT: Expect {data: { items: T[], pagination: {...} }}
   */
  getItemsWithPagination(): Observable<{ items: ExampleData[]; pagination: any }> {
    return this.http
      .get<{ data: { items: ExampleData[]; pagination: any } }>(`${this.baseUrl}/paginated`)
      .pipe(map(response => response.data));
  }

  /**
   * ✅ CORRECT: Handle creation responses
   */
  createItem(item: CreateRequest): Observable<ExampleData> {
    return this.http
      .post<{ data: ExampleData }>(`${this.baseUrl}`, item)
      .pipe(map(response => response.data));
  }

  /**
   * ✅ CORRECT: Handle update responses
   */
  updateItem(id: string, item: Partial<ExampleData>): Observable<ExampleData> {
    return this.http
      .put<{ data: ExampleData }>(`${this.baseUrl}/${id}`, item)
      .pipe(map(response => response.data));
  }

  /**
   * ✅ CORRECT: Handle deletion (void response still wrapped)
   */
  deleteItem(id: string): Observable<void> {
    return this.http.delete<{ data: any }>(`${this.baseUrl}/${id}`).pipe(
      map(() => void 0) // Transform to void
    );
  }

  /**
   * ❌ NEVER DO THIS - Don't expect direct responses:
   *
   * this.http.get<ExampleData>(`${this.baseUrl}/${id}`)  // ❌ Wrong
   * this.http.get<ExampleData[]>(`${this.baseUrl}`)      // ❌ Wrong
   */
}
