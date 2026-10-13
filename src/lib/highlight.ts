import type { HighlightRequest, HighlightResponse } from './highlight.worker';

/**
 * Syntax highlighting with Shiki, off the main thread: requests go to a small
 * pool of module workers (highlight.worker.ts) created on first use, so
 * tokenizing big files and diffs never blocks scrolling or input. Results are
 * cached (LRU by language + content), and identical in-flight requests are
 * shared. Where workers are unavailable (tests, old browsers) the same code
 * runs on the main thread (highlight-core.ts, loaded lazily).
 */

/** Files bigger than this render as plain text. */
const MAX_HIGHLIGHT = 400_000;

// ---------------------------------------------------------------------------
// Worker pool

interface PoolWorker {
  worker: Worker;
  pending: Map<number, { req: HighlightRequest; resolve: (lines: string[] | null) => void }>;
}

let pool: PoolWorker[] | null | undefined;
let nextId = 1;

function createPool(): PoolWorker[] | null {
  if (typeof Worker === 'undefined') return null;
  const size = Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1));
  try {
    return Array.from({ length: size }, () => {
      const pw: PoolWorker = {
        worker: new Worker(new URL('./highlight.worker.ts', import.meta.url), { type: 'module', name: 'highlight' }),
        pending: new Map(),
      };
      pw.worker.onmessage = (e: MessageEvent<HighlightResponse>) => {
        const job = pw.pending.get(e.data.id);
        pw.pending.delete(e.data.id);
        job?.resolve(e.data.lines);
      };
      // A worker that fails to load disables the pool; its queue reruns on the main thread.
      pw.worker.onerror = () => {
        const jobs = [...pw.pending.values()];
        pw.pending.clear();
        disablePool();
        for (const job of jobs) void mainThread(job.req).then(job.resolve);
      };
      return pw;
    });
  } catch {
    return null;
  }
}

function disablePool() {
  for (const pw of pool ?? []) pw.worker.terminate();
  pool = null;
}

async function mainThread(req: HighlightRequest) {
  const { highlightCode } = await import('./highlight-core');
  return highlightCode(req.code, req.filename, req.lang).catch(() => null);
}

function run(req: HighlightRequest): Promise<string[] | null> {
  if (pool === undefined) pool = createPool();
  if (!pool) return mainThread(req);
  // Least busy worker first.
  const pw = pool.reduce((a, b) => (b.pending.size < a.pending.size ? b : a));
  return new Promise((resolve) => {
    pw.pending.set(req.id, { req, resolve });
    pw.worker.postMessage(req);
  });
}

// ---------------------------------------------------------------------------
// Cache: same file content (e.g. revisiting a diff, toggling split view) is
// highlighted once. Keyed by language hint + content; bounded by total size.

const CACHE_CHARS = 8_000_000;
const cache = new Map<string, Promise<string[] | null>>();
let cachedChars = 0;

function remember(key: string, value: Promise<string[] | null>) {
  cache.set(key, value);
  cachedChars += key.length;
  for (const k of cache.keys()) {
    if (cachedChars <= CACHE_CHARS || k === key) break;
    cache.delete(k);
    cachedChars -= k.length;
  }
}

/**
 * Highlight `code` and return one HTML string per line, or null when the
 * language is unknown / the file is too large (callers render plain text).
 */
export function highlightLines(code: string, filename: string, lang?: string): Promise<string[] | null> {
  if (code.length > MAX_HIGHLIGHT) return Promise.resolve(null);
  const base = filename.split('/').pop()!.toLowerCase();
  const key = `${lang ?? base}\0${code}`;
  const hit = cache.get(key);
  if (hit) {
    // LRU: move to the end.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const result = run({ id: nextId++, code, filename, lang });
  remember(key, result);
  return result;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function escapeLines(code: string) {
  return code.split('\n').map(escapeHtml);
}
