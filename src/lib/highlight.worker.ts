/**
 * Highlight worker: runs Shiki off the main thread. Request
 * `{ id, code, filename, lang? }`, response `{ id, lines }` (one HTML string
 * per line, or null for plain text). See highlight.ts for the pool.
 */
import { highlightCode } from './highlight-core';

export interface HighlightRequest {
  id: number;
  code: string;
  filename: string;
  lang?: string;
}
export interface HighlightResponse {
  id: number;
  lines: string[] | null;
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<HighlightRequest>) => void) | null;
  postMessage(message: HighlightResponse): void;
};

scope.onmessage = (e) => {
  const { id, code, filename, lang } = e.data;
  highlightCode(code, filename, lang).then(
    (lines) => scope.postMessage({ id, lines }),
    () => scope.postMessage({ id, lines: null }),
  );
};
