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

/** Where a rendered markdown file lives — needed to resolve its relative URLs. */
export interface RepoFileContext {
  owner: string;
  repo: string;
  /** Branch, tag or SHA the file was rendered at. */
  gitRef: string;
  /** Path of the markdown file itself (relative URLs resolve against its folder). */
  path: string;
  /** Private repos can't use raw.githubusercontent.com in <img>; images load via the API instead. */
  private?: boolean;
}

const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/** Resolve `rel` against `dir` like a browser would; a leading "/" means the repo root. */
export function resolveRepoPath(dir: string, rel: string) {
  const parts = rel.startsWith('/') ? [] : dir.split('/').filter(Boolean);
  for (const seg of rel.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

const encodeSegments = (path: string) =>
  path
    .split('/')
    .map((s) => encodeURIComponent(decodeURIComponent(s)))
    .join('/');

/**
 * GitHub's API leaves repo-relative URLs in rendered READMEs untouched
 * (github.com rewrites them client-side). Resolve them the same way:
 * images → raw file URLs (or a `data-repo-src` marker for private repos,
 * loaded through the API by <Markdown>), links → in-app blob/tree pages.
 */
export function resolveRepoUrls(html: string, ctx: RepoFileContext) {
  const dir = ctx.path.split('/').slice(0, -1).join('/');
  const ref = encodeSegments(ctx.gitRef);
  return html.replace(/\s(src|srcset|href)="([^"]*)"/g, (match, attr: string, value: string) => {
    if (!value || ABSOLUTE.test(value)) return match;
    const [, rawPath = '', suffix = ''] = value.match(/^([^?#]*)(.*)$/) ?? [];
    const path = resolveRepoPath(dir, rawPath.replace(/&amp;/g, '&'));
    if (attr === 'href') {
      // github.com answers /blob/ for folders too (redirecting to /tree/), and so does the blob page here.
      const raw = /[?&]raw=true/.test(suffix);
      return raw
        ? ` href="https://github.com/${ctx.owner}/${ctx.repo}/raw/${ref}/${encodeSegments(path)}"`
        : ` href="/${ctx.owner}/${ctx.repo}/blob/${ref}/${encodeSegments(path)}${suffix.replace(/^\?[^#]*/, '')}"`;
    }
    if (ctx.private) return ` data-repo-${attr}="${path}"`;
    return ` ${attr}="https://raw.githubusercontent.com/${ctx.owner}/${ctx.repo}/${ref}/${encodeSegments(path)}"`;
  });
}

/** The README's own path, from the wrapper GitHub's HTML README rendering includes. */
export function readmePathFromHtml(html: string) {
  return html.match(/data-path="([^"]+)"/)?.[1];
}
