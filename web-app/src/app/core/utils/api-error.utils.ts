import { HttpErrorResponse } from '@angular/common/http';

function firstValidationMessage(
  data: Record<string, string[] | string>
): string | null {
  for (const key of Object.keys(data)) {
    const v = data[key];
    const s = Array.isArray(v) ? v[0] : v;
    if (typeof s === 'string' && s.trim()) {
      return s;
    }
  }
  return null;
}

/**
 * Human-readable message from Angular HttpClient / Laravel-style JSON errors.
 */
export function getHttpErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as
      | {
          message?: string;
          data?: Record<string, string[] | string>;
        }
      | undefined;

    if (body?.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
      const first = firstValidationMessage(body.data);
      if (first) {
        return first;
      }
    }

    if (typeof body?.message === 'string' && body.message.trim()) {
      return body.message;
    }

    if (error.status === 0) {
      return 'Network error. Check your connection and try again.';
    }
    if (error.status === 401 || error.status === 403) {
      return 'You are not allowed to perform this action.';
    }
    if (error.status >= 500) {
      return 'Something went wrong on the server. Please try again later.';
    }
  }
  return fallback;
}
