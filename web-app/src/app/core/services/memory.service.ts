import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface Media {
  id: number;
  url: string;
  memory_id: number;
}

export interface Location {
  id: number;
  name: string;
  street: string | null;
  city: string | null;
  state: string;
  zipcode: string | null;
}

export interface Memory {
  id: number;
  journal_entry: string;
  time: string;
  location_id: number;
  user_id: number;
  location?: Location;
  media?: Media[];
}

export interface MemoryApiResponse {
  success: boolean;
  results: Memory | Memory[];
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class MemoryService {
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

  getMemories(): Observable<{ success: boolean; results: Memory[]; message: string }> {
    return this.http.get<{ success: boolean; results: Memory[]; message: string }>(
      `${this.apiUrl}memories`,
      { headers: this.getAuthHeaders() }
    );
  }

  getMemory(id: number): Observable<{ success: boolean; results: Memory; message: string }> {
    return this.http.get<{ success: boolean; results: Memory; message: string }>(
      `${this.apiUrl}memories/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  createMemory(data: Partial<Memory>): Observable<{ success: boolean; results: Memory; message: string }> {
    return this.http.post<{ success: boolean; results: Memory; message: string }>(
      `${this.apiUrl}memories`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

  updateMemory(id: number, data: Partial<Memory>): Observable<{ success: boolean; results: Memory; message: string }> {
    return this.http.put<{ success: boolean; results: Memory; message: string }>(
      `${this.apiUrl}memories/${id}`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

  deleteMemory(id: number): Observable<{ success: boolean; results: { id: number }; message: string }> {
    return this.http.delete<{ success: boolean; results: { id: number }; message: string }>(
      `${this.apiUrl}memories/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }
}
