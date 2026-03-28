import {
  apiDateTimeToDatetimeLocal,
  datetimeLocalToApiUtc,
  formatMemoryDateForDisplay,
} from './memory-datetime.utils';

describe('memory-datetime.utils', () => {
  it('round-trips UTC ISO through datetime-local without calendar shift', () => {
    const api = '2026-03-16T00:00:00.000000Z';
    const local = apiDateTimeToDatetimeLocal(api);
    expect(local).toBe('2026-03-16T00:00');
    expect(datetimeLocalToApiUtc(local)).toBe('2026-03-16T00:00:00.000000Z');
  });

  it('formatMemoryDateForDisplay matches the calendar date in the API string (time ignored)', () => {
    const a = '2026-03-16T12:00:00.000000Z';
    const b = '2026-03-16T23:59:00.000000Z';
    expect(formatMemoryDateForDisplay(a)).toBe(formatMemoryDateForDisplay(b));
  });
});
