import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface Media {
  id: number;
  url: string;
  memory_id: number;
  /** True when created by server-side Gemini image generation. */
  is_ai_generated?: boolean;
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

export interface CreateMemoryPayload {
  journal_entry: string;
  time: string;
  location_id: number;
}

export interface MemoryApiResponse {
  success: boolean;
  results: Memory | Memory[];
  message: string;
}

/** Public GET /api/health — includes whether Gemini-backed AI image generation is configured. */
export interface BackendHealthResponse {
  status: string;
  service?: string;
  version?: string;
  timestamp?: string;
  ai_image_generation_available?: boolean;
}

@Injectable({
  providedIn: 'root',
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

  /** No auth — used to hide AI image prompts when the server has no GEMINI_API_KEY. */
  getBackendHealth(): Observable<BackendHealthResponse> {
    return this.http.get<BackendHealthResponse>(`${this.apiUrl}health`);
  }

  getMemories(): Observable<{
    success: boolean;
    results: Memory[];
    message: string;
  }> {
    return this.http.get<{
      success: boolean;
      results: Memory[];
      message: string;
    }>(`${this.apiUrl}memories`, { headers: this.getAuthHeaders() });
  }

  getMemory(
    id: number
  ): Observable<{ success: boolean; results: Memory; message: string }> {
    return this.http.get<{ success: boolean; results: Memory; message: string }>(
      `${this.apiUrl}memories/${id}`,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Multipart POST — optional primary `file` and extra `files[]` images.
   */
  createMemory(
    payload: CreateMemoryPayload,
    coverFile?: File | null,
    additionalFiles?: File[]
  ): Observable<{ success: boolean; results: Memory; message: string }> {
    const formData = new FormData();
    formData.append('journal_entry', payload.journal_entry);
    formData.append('time', payload.time);
    formData.append('location_id', String(payload.location_id));
    if (coverFile) {
      formData.append('file', coverFile, coverFile.name);
    }
    if (additionalFiles?.length) {
      for (const f of additionalFiles) {
        formData.append('files[]', f, f.name);
      }
    }

    return this.http.post<{ success: boolean; results: Memory; message: string }>(
      `${this.apiUrl}memories`,
      formData,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Append more images to an existing memory (multipart `files[]`).
   */
  addMemoryMedia(
    memoryId: number,
    files: File[]
  ): Observable<{ success: boolean; results: Memory; message: string }> {
    const formData = new FormData();
    for (const f of files) {
      formData.append('files[]', f, f.name);
    }
    return this.http.post<{ success: boolean; results: Memory; message: string }>(
      `${this.apiUrl}memories/${memoryId}/media`,
      formData,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Remove one media row and its storage object; returns updated memory.
   */
  deleteMediaItem(
    mediaId: number
  ): Observable<{ success: boolean; results: Memory; message: string }> {
    return this.http.delete<{
      success: boolean;
      results: Memory;
      message: string;
    }>(`${this.apiUrl}media/${mediaId}`, { headers: this.getAuthHeaders() });
  }

  /**
   * PUT when no new file; POST multipart when replacing cover (PHP does not populate files on PUT).
   */
  updateMemory(
    id: number,
    payload: {
      journal_entry: string;
      time: string;
      location_id: number;
    },
    coverFile?: File | null
  ): Observable<{ success: boolean; results: Memory; message: string }> {
    const headers = this.getAuthHeaders();

    if (coverFile) {
      const formData = new FormData();
      formData.append('journal_entry', payload.journal_entry);
      formData.append('time', payload.time);
      formData.append('location_id', String(payload.location_id));
      formData.append('file', coverFile, coverFile.name);

      return this.http.post<{ success: boolean; results: Memory; message: string }>(
        `${this.apiUrl}memories/${id}`,
        formData,
        { headers }
      );
    }

    return this.http.put<{ success: boolean; results: Memory; message: string }>(
      `${this.apiUrl}memories/${id}`,
      payload,
      { headers }
    );
  }

  deleteMemory(
    id: number
  ): Observable<{ success: boolean; results: { id: number }; message: string }> {
    return this.http.delete<{
      success: boolean;
      results: { id: number };
      message: string;
    }>(`${this.apiUrl}memories/${id}`, { headers: this.getAuthHeaders() });
  }

  /**
   * Optional AI-generated image from journal text (and optional avatar reference). Memory must have no media.
   */
  generateMemoryImage(
    memoryId: number,
    body?: {
      use_avatar_reference?: boolean;
      /** When true, server attaches up to 2 most recent photos from your other memories as Gemini context. */
      use_recent_memory_photos?: boolean;
    }
  ): Observable<{ success: boolean; results: Memory; message: string }> {
    return this.http.post<{ success: boolean; results: Memory; message: string }>(
      `${this.apiUrl}memories/${memoryId}/generate-image`,
      body ?? {},
      { headers: this.getAuthHeaders() }
    );
  }
}
