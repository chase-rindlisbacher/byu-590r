import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { Location } from './memory.service';

export interface CreateLocationPayload {
  name: string;
  state: string;
  street?: string | null;
  city?: string | null;
  zipcode?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = environment.apiUrl;

  /** In-memory cache for the session (cleared on logout). */
  private locationsCache: Location[] | null = null;

  private getAuthHeaders(): { [key: string]: string } {
    const user = this.authService.getStoredUser();
    if (user && user.token) {
      return { Authorization: `Bearer ${user.token}` };
    }
    return {};
  }

  listLocations(): Observable<{
    success: boolean;
    results: Location[];
    message: string;
  }> {
    if (this.locationsCache !== null) {
      return of({
        success: true,
        results: this.locationsCache,
        message: '',
      });
    }
    return this.http
      .get<{
        success: boolean;
        results: Location[];
        message: string;
      }>(`${this.apiUrl}locations`, { headers: this.getAuthHeaders() })
      .pipe(
        tap((res) => {
          if (res.success && Array.isArray(res.results)) {
            this.locationsCache = res.results;
          }
        })
      );
  }

  createLocation(
    payload: CreateLocationPayload
  ): Observable<{ success: boolean; results: Location; message: string }> {
    return this.http
      .post<{ success: boolean; results: Location; message: string }>(
        `${this.apiUrl}locations`,
        payload,
        { headers: this.getAuthHeaders() }
      )
      .pipe(
        tap((res) => {
          if (!res.success || !res.results) {
            return;
          }
          if (this.locationsCache === null) {
            this.locationsCache = [res.results];
          } else {
            this.locationsCache = [...this.locationsCache, res.results].sort(
              (a, b) => a.name.localeCompare(b.name)
            );
          }
        })
      );
  }

  clearCache(): void {
    this.locationsCache = null;
  }
}
