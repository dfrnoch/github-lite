import type { SearchType } from './api';

export const SEARCH_TYPES: SearchType[] = [
  'code',
  'repositories',
  'issues',
  'pullrequests',
  'discussions',
  'users',
  'commits',
  'topics',
];

/** github.com accepts `type=Repositories`, `type=pull_requests`… — normalize to our ids. */
export function normalizeType(raw: string | undefined): SearchType {
  const t = (raw ?? '').toLowerCase().replace(/[_-]/g, '');
  if (t === 'prs' || t === 'pulls') return 'pullrequests';
  if (t === 'repos') return 'repositories';
  return (SEARCH_TYPES as string[]).includes(t) ? (t as SearchType) : 'repositories';
}

export interface SearchState {
  q: string;
  type: SearchType;
  sort?: string;
  order?: string;
  page?: number;
}

/** `/search?q=…&type=…&s=…&o=…&p=…` — github.com's search URL shape. */
export function searchHref(s: SearchState) {
  const params = new URLSearchParams();
  params.set('q', s.q);
  params.set('type', s.type);
  if (s.sort) params.set('s', s.sort);
  if (s.sort && s.order) params.set('o', s.order);
  if (s.page && s.page > 1) params.set('p', String(s.page));
  return `/search?${params.toString().replace(/%3A/gi, ':').replace(/%2F/gi, '/')}`;
}

/** First value of a search param (the router types them as string | string[]). */
export const param = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
