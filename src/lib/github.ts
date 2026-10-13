import { createSignal } from 'solid-js';
import { getToken, handleUnauthorized } from './auth';

/**
 * Thin GitHub API client — REST (`gh`, `ghPage`, `ghAll`) and GraphQL (`gql`).
 *
 * Every request goes straight from the browser to api.github.com (the API is
 * CORS-enabled) with the user's token. GETs use `cache: 'no-cache'`, so the
 * browser revalidates its HTTP cache with the response's ETag: unchanged data
 * comes back as a 304, which GitHub does not count against the rate limit.
 *
 * Reads are wrapped in router `query()`s (see src/features/*\/api.ts) for
 * dedupe + revalidation; mutations go through router `action()`s, which
 * revalidate the page's queries when they settle.
 */

export const API_URL = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
  get notFound() {
    return this.status === 404;
  }
}

export interface RateLimit {
  limit: number;
  remaining: number;
  reset: number; // epoch seconds
  resource: string;
}

// Written from inside async computations (the fetch happens in a memo), so
// it opts into owned writes.
const [rateLimit, setRateLimit] = createSignal<RateLimit | null>(null, { ownedWrite: true });
export { rateLimit };

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Search params appended to the URL; nullish values are skipped. */
  query?: Record<string, QueryValue | QueryValue[]>;
  /** JSON body (serialized automatically) or a raw BodyInit. */
  body?: unknown;
  /**
   * Media type. Defaults to `application/vnd.github+json`. Useful ones:
   * - `application/vnd.github.html` — rendered HTML of a README / markdown file (returns text)
   * - `application/vnd.github.html+json` — JSON with rendered `body_html` (issues, comments)
   * - `application/vnd.github.full+json` — `body`, `body_text` and `body_html`
   * - `application/vnd.github.raw` — raw file contents (returns text)
   * - `application/vnd.github.diff` — unified diff for commits/PRs (returns text)
   */
  accept?: string;
  /** Return the response text instead of parsing JSON. */
  text?: boolean;
}

export function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(path.startsWith('http') ? path : API_URL + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value == null || value === '') continue;
      url.searchParams.set(key, Array.isArray(value) ? value.filter((v) => v != null).join(',') : String(value));
    }
  }
  return url.toString();
}

async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const { query, body, accept, text: _text, headers, ...init } = options;
  const token = getToken();
  const h = new Headers(headers);
  h.set('Accept', accept ?? 'application/vnd.github+json');
  h.set('X-GitHub-Api-Version', '2022-11-28');
  if (token) h.set('Authorization', `Bearer ${token}`);

  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (typeof body === 'string' || body instanceof Blob || body instanceof FormData || body instanceof ArrayBuffer) {
      payload = body as BodyInit;
    } else {
      payload = JSON.stringify(body);
      h.set('Content-Type', 'application/json');
    }
  }

  const method = (init.method ?? 'GET').toUpperCase();
  const res = await fetch(buildUrl(path, query), {
    ...init,
    method,
    headers: h,
    body: payload,
    // The HTTP cache keys on URL only, and the same URL answers differently
    // per Accept (JSON vs raw vs HTML), so only default-media GETs use it.
    cache: method === 'GET' && !accept ? 'no-cache' : 'no-store',
  });

  const remaining = res.headers.get('x-ratelimit-remaining');
  if (remaining != null) {
    setRateLimit({
      limit: Number(res.headers.get('x-ratelimit-limit')),
      remaining: Number(remaining),
      reset: Number(res.headers.get('x-ratelimit-reset')),
      resource: res.headers.get('x-ratelimit-resource') ?? 'core',
    });
  }

  if (!res.ok) {
    let data: any;
    try {
      data = await res.json();
    } catch {
      /* not JSON */
    }
    if (res.status === 401) handleUnauthorized();
    let message = data?.message ?? `${res.status} ${res.statusText}`;
    if (Array.isArray(data?.errors) && data.errors.length) {
      message += ': ' + data.errors.map((e: any) => (typeof e === 'string' ? e : (e.message ?? e.code))).join(', ');
    }
    throw new GitHubError(res.status, message, data);
  }
  return res;
}

/** REST request. Resolves to parsed JSON (or text with `text: true` / non-JSON accept). 204 → undefined. */
export async function gh<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await request(path, options);
  if (res.status === 204 || res.status === 205) return undefined as T;
  // Media types like `vnd.github.html+json` answer HTML on some endpoints
  // (README) and JSON on others (issues), so trust the response's type.
  // Non-JSON media types (raw, diff, html) are always text.
  const isJson =
    (!options.accept || options.accept.includes('json')) && (res.headers.get('content-type') ?? '').includes('json');
  return (options.text || !isJson ? await res.text() : await res.json()) as T;
}

export interface PageInfo {
  page: number;
  /** Last page number when GitHub reports one (via the Link header). */
  lastPage?: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Page<T> {
  items: T[];
  pageInfo: PageInfo;
}

function parseLink(header: string | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!header) return out;
  for (const part of header.split(',')) {
    const m = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (!m) continue;
    const page = new URL(m[1]!).searchParams.get('page');
    if (page) out[m[2]!] = Number(page);
  }
  return out;
}

/**
 * One page of a list endpoint, with pagination info from the Link header.
 * Endpoints that wrap their items (search: `items`, actions: `workflow_runs`…)
 * are unwrapped through `pick`.
 */
export async function ghPage<T = any>(
  path: string,
  options: RequestOptions & { page?: number; perPage?: number; pick?: (data: any) => T[] } = {},
): Promise<Page<T> & { total?: number }> {
  const { page = 1, perPage = 30, pick, query, ...rest } = options;
  const res = await request(path, { ...rest, query: { ...query, page, per_page: perPage } });
  const data = await res.json();
  const links = parseLink(res.headers.get('link'));
  const items: T[] = pick ? pick(data) : Array.isArray(data) ? data : (data.items ?? []);
  return {
    items,
    total: typeof data?.total_count === 'number' ? data.total_count : undefined,
    pageInfo: {
      page,
      lastPage: links.last ?? (links.next ? undefined : page),
      hasNext: links.next != null,
      hasPrev: links.prev != null,
    },
  };
}

/** Fetch every page of a list endpoint (capped by `max` items). */
export async function ghAll<T = any>(
  path: string,
  options: RequestOptions & { max?: number; pick?: (data: any) => T[] } = {},
): Promise<T[]> {
  const { max = 1000, ...rest } = options;
  const out: T[] = [];
  for (let page = 1; out.length < max; page++) {
    const res = await ghPage<T>(path, { ...rest, page, perPage: 100 });
    out.push(...res.items);
    if (!res.pageInfo.hasNext) break;
  }
  return out.slice(0, max);
}

/** GraphQL request. Throws on transport errors and on `errors` without `data`. */
export async function gql<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await request('/graphql', { method: 'POST', body: { query, variables } });
  const json = await res.json();
  if (json.errors?.length) {
    const notFound = json.errors.every((e: any) => e.type === 'NOT_FOUND');
    if (!json.data || notFound) {
      throw new GitHubError(notFound ? 404 : 422, json.errors.map((e: any) => e.message).join('; '), json.errors);
    }
    console.warn('GraphQL partial errors', json.errors);
  }
  return json.data as T;
}

/** Encode each segment of a repo-relative file path for use in a URL. */
export const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

/** UTF-8 safe base64 helpers for the contents API. */
export function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function fromBase64(b64: string) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
