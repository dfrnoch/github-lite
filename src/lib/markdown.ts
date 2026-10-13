import { gh } from './github';

/**
 * github.com links that should stay on github.com (downloads, attachments,
 * raw files) — everything else is rewritten to this app's same path.
 */
const KEEP_EXTERNAL = /^\/(user-attachments|assets|[^/]+\/[^/]+\/(raw|archive|releases\/download|files)\/)|\.(patch|diff)$/;

/** Map a https://github.com/... URL onto this app; other URLs pass through. */
export function toAppUrl(url: string) {
  const m = url.match(/^https?:\/\/(?:www\.)?github\.com(\/[^#?]*)?([?#].*)?$/);
  if (!m) return url;
  const path = m[1] || '/';
  if (KEEP_EXTERNAL.test(path)) return url;
  return path + (m[2] ?? '');
}

/** Rewrite github.com hrefs inside API-rendered HTML so links navigate in-app. */
export function rewriteHtmlLinks(html: string) {
  return html.replace(/href="(https?:\/\/(?:www\.)?github\.com[^"]*)"/g, (_, url) => `href="${toAppUrl(url)}"`);
}

/** Render GitHub-flavored markdown via the API (exactly what github.com renders). */
export async function renderMarkdown(text: string, context?: string) {
  if (!text.trim()) return '';
  const html = await gh<string>('/markdown', {
    method: 'POST',
    body: { text, mode: context ? 'gfm' : 'markdown', context },
    accept: 'text/html',
  });
  return rewriteHtmlLinks(html);
}
