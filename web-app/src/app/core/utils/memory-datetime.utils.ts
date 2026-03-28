/**
 * Memory `time` values are stored in UTC (Laravel JSON: ...Z). The list view
 * displays the calendar date from the ISO string without shifting timezones.
 * Edit/create must use the same rules: read and write the same Y-M-D and H:m
 * digits as appear in the API string (UTC), not `new Date(iso)` in the local
 * timezone (which shifts calendar dates near UTC midnight).
 */

/** First YYYY-MM-DD segment from an API datetime string. */
export function parseIsoDatePart(iso: string): string | null {
  const m = iso?.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** `datetime-local` value (YYYY-MM-DDTHH:mm) from an API ISO string (UTC). */
export function apiDateTimeToDatetimeLocal(iso: string): string {
  if (!iso?.trim()) {
    return '';
  }
  const m = iso
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/);
  if (m) {
    return `${m[1]}T${m[2]}:${m[3]}`;
  }
  const d = parseIsoDatePart(iso);
  return d ? `${d}T00:00` : '';
}

/** API payload for Laravel `time` — UTC instant matching the picker digits. */
export function datetimeLocalToApiUtc(local: string): string {
  if (!local?.trim()) {
    return '';
  }
  const m = local
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) {
    return local.trim();
  }
  return `${m[1]}T${m[2]}:${m[3]}:00.000000Z`;
}

// Please create a new function that will return the current date and time
// in the format of YYYY-MM-DDTHH:MM:SS.000000Z
export function nowDateTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Current instant as `datetime-local` UTC digits (matches API round-trip rules). */
export function nowUtcAsDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Same calendar date as `formatDate` / list cards: Y-M-D from API, then locale. */
export function formatMemoryDateForDisplay(iso: string): string {
  const datePart = parseIsoDatePart(iso);
  if (!datePart) {
    return '';
  }
  const [year, month, day] = datePart.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
