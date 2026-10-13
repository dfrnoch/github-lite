import { describe, expect, test } from 'vitest';
import { compactNumber, formatBytes, formatDuration, timeAgo } from './format';

describe('format', () => {
  test('compactNumber matches GitHub counters', () => {
    expect(compactNumber(999)).toBe('999');
    expect(compactNumber(1100)).toBe('1.1k');
    expect(compactNumber(36123)).toBe('36.1k');
    expect(compactNumber(123456)).toBe('123k');
    expect(compactNumber(1_000_000)).toBe('1m');
  });

  test('timeAgo', () => {
    const now = Date.parse('2026-10-13T12:00:00Z');
    expect(timeAgo('2026-10-13T11:59:30Z', now)).toBe('now');
    expect(timeAgo('2026-10-13T09:00:00Z', now)).toBe('3 hours ago');
    expect(timeAgo('2026-10-12T12:00:00Z', now)).toBe('yesterday');
    expect(timeAgo('2023-10-13T12:00:00Z', now)).toBe('3 years ago');
  });

  test('formatBytes / formatDuration', () => {
    expect(formatBytes(512)).toBe('512 Bytes');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatDuration(83_000)).toBe('1m 23s');
    expect(formatDuration(3_723_000)).toBe('1h 2m 3s');
  });
});
