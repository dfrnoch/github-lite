/** Formatting helpers matching GitHub's wording ("3 days ago", "1.2k", …). */

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "now", "5 minutes ago", "yesterday", "last month"… — past or future. */
export function timeAgo(date: string | number | Date, now = Date.now()) {
  const seconds = Math.round((new Date(date).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'now';
  for (const [unit, size] of UNITS) {
    if (abs >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(Math.round(seconds / 60), 'minute');
}

/** GitHub shows absolute dates for anything older than a month: "on Jan 8, 2025". */
export function formatDate(date: string | number | Date, opts: Intl.DateTimeFormatOptions = {}) {
  const d = new Date(date);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    ...opts,
  });
}

export function formatDateTime(date: string | number | Date) {
  return new Date(date).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** 36123 → "36.1k", 1100000 → "1.1m" */
export function compactNumber(n: number | null | undefined) {
  if (n == null) return '0';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${trim(n / 1000)}k`;
  return `${trim(n / 1_000_000)}m`;
}
const trim = (x: number) => (x >= 100 ? Math.round(x).toString() : x.toFixed(1).replace(/\.0$/, ''));

export const formatNumber = (n: number | null | undefined) => (n ?? 0).toLocaleString('en-US');

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Bytes`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 2).replace(/\.?0+$/, '')} ${units[i]}`;
}

export const pluralize = (n: number, one: string, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;

export const shortSha = (sha: string) => sha.slice(0, 7);

/** Seconds → "1m 23s" (Actions durations). */
export function formatDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m ${sec}s`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/** First line of a commit message. */
export const commitTitle = (message: string) => message.split('\n', 1)[0] ?? '';
export const commitBody = (message: string) => message.split('\n').slice(1).join('\n').trim();
