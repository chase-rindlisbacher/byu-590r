import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface UserPreferences {
  generate_images: boolean;
  use_extra_memory_context: boolean;
  dismiss_memory_image_prompt: boolean;
}

export type UserPreferencesUpdate = Partial<UserPreferences>;

@Injectable({
  providedIn: 'root',
})
export class UserPreferenceService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = environment.apiUrl;

  private getAuthHeaders(): { [key: string]: string } {
    const user = this.authService.getStoredUser();
    if (user?.token) {
      return { Authorization: `Bearer ${user.token}` };
    }
    return {};
  }

  getPreferences(): Observable<{
    success: boolean;
    results: UserPreferences;
    message: string;
  }> {
    return this.http.get<{
      success: boolean;
      results: UserPreferences;
      message: string;
    }>(`${this.apiUrl}user/preferences`, { headers: this.getAuthHeaders() });
  }

  updatePreferences(
    body: UserPreferencesUpdate
  ): Observable<{
    success: boolean;
    results: UserPreferences;
    message: string;
  }> {
    return this.http.patch<{
      success: boolean;
      results: UserPreferences;
      message: string;
    }>(`${this.apiUrl}user/preferences`, body, {
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
  }
}
