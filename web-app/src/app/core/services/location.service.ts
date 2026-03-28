import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
    return this.http.get<{
      success: boolean;
      results: Location[];
      message: string;
    }>(`${this.apiUrl}locations`, { headers: this.getAuthHeaders() });
  }

  createLocation(
    payload: CreateLocationPayload
  ): Observable<{ success: boolean; results: Location; message: string }> {
    return this.http.post<{ success: boolean; results: Location; message: string }>(
      `${this.apiUrl}locations`,
      payload,
      { headers: this.getAuthHeaders() }
    );
  }
}
