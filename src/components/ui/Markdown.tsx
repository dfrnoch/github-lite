import { createEffect, createMemo, onSettled, untrack } from 'solid-js';
import { feature } from '../../features/refined';
import { commitAt } from '../../features/issues/refined';
import { encodePath, gh, ghBlob } from '../../lib/github';
import { escapeLines, highlightLines } from '../../lib/highlight';
import { type RepoFileContext, resolveRepoUrls, rewriteHtmlLinks } from '../../lib/markdown';

/** Context for comment bodies (Refined GitHub reading features). */
export interface MarkdownComment {
  /** "owner/name" the comment belongs to. */
  repo: string;
  /** When the comment was written (comments-time-machine-links). */
  createdAt?: string;
}

/**
 * Renders HTML produced by GitHub (`body_html`, `bodyHTML`, rendered READMEs)
 * with GitHub's markdown styles. The HTML comes from api.github.com, which
 * sanitizes it; github.com links are rewritten to stay inside this app.
 *
 * Pass `file` for markdown files from a repository (READMEs, docs) so their
 * relative image and link URLs resolve against the file's location.
 * Pass `comment` for issue / PR comments (enables the comment-only features).
 */
export default function Markdown(props: { html: string | null | undefined; class?: string; file?: RepoFileContext; comment?: MarkdownComment }) {
  let el!: HTMLDivElement;
  const html = createMemo(() => {
    // Resolve repo-relative URLs first: rewriting github.com links produces
    // root-relative "/owner/repo" paths that must not be resolved again.
    const raw = props.html ?? '';
    let out = props.file ? resolveRepoUrls(raw, props.file) : raw;
    if (feature('shorten-links')) out = shortenLinks(out, props.comment?.repo ?? (props.file ? `${props.file.owner}/${props.file.repo}` : undefined));
    if (feature('small-user-avatars')) out = mentionAvatars(out);
    return rewriteHtmlLinks(out);
  });

  // Private repos: relative images can't be loaded by URL, so fetch them
  // through the API (with the token) and show them as blob URLs.
  createEffect(
    () => [html(), props.file] as const,
    ([, file]) => {
      if (!file?.private) return;
      const urls: string[] = [];
      for (const img of el.querySelectorAll<HTMLElement>('[data-repo-src], [data-repo-srcset]')) {
        const attr = img.hasAttribute('data-repo-src') ? 'src' : 'srcset';
        const path = img.getAttribute(`data-repo-${attr}`)!;
        ghBlob(`/repos/${file.owner}/${file.repo}/contents/${encodePath(path)}`, {
          query: { ref: file.gitRef },
          accept: 'application/vnd.github.raw',
        })
          .then((blob) => {
            // SVGs come back typed as octet-stream; images need the right type to render.
            const typed = path.endsWith('.svg') ? new Blob([blob], { type: 'image/svg+xml' }) : blob;
            const url = URL.createObjectURL(typed);
            urls.push(url);
            img.setAttribute(attr, url);
          })
          .catch(() => {});
      }
      return () => urls.forEach((u) => URL.revokeObjectURL(u));
    },
  );

  // embed-gist-inline: gist links alone on their line become the gist's code.
  createEffect(
    () => [html(), !!props.comment && feature('embed-gist-inline')] as const,
    ([, on]) => {
      if (!on) return;
      const added: Element[] = [];
      for (const link of el.querySelectorAll<HTMLAnchorElement>('p > a[href^="https://gist.github.com/"]')) {
        const id = link.href.match(/^https:\/\/gist\.github\.com\/(?:[\w-]+\/)?([\da-f]{20,})\/?(?:#.*)?$/i)?.[1];
        if (!id || link.textContent?.trim() !== link.parentElement?.textContent?.trim()) continue;
        const info = document.createElement('em');
        info.className = 'rgh-gist-info text-fg-muted';
        info.textContent = ' (loading)';
        link.after(info);
        added.push(info);
        void untrack(() => embedGist(id)).then(
          (result) => {
            if (typeof result === 'string') info.textContent = result;
            else {
              info.remove();
              link.parentElement!.after(result);
              added.push(result);
            }
          },
          () => info.remove(),
        );
      }
      return () => added.forEach((n) => n.remove());
    },
  );

  // comments-time-machine-links: links to branch files get a "view at the time of the comment" icon.
  createEffect(
    () => [html(), props.comment?.createdAt && feature('comments-time-machine-links') ? props.comment.createdAt : null] as const,
    ([, date]) => {
      if (!date) return;
      const added: Element[] = [];
      for (const link of el.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')) {
        const m = link.getAttribute('href')!.match(/^\/([^/]+)\/([^/]+)\/(blob|tree)\/([^/?#]+)(\/[^?#]*)?/);
        if (!m || /^[\da-f]{40}$/i.test(m[4]!) || link.closest('.rgh-time-machine')) continue;
        const a = document.createElement('a');
        a.className = 'rgh-time-machine';
        a.href = link.getAttribute('href')!;
        a.title = 'View this object as it appeared at the time of the comment';
        a.dataset.date = date;
        a.innerHTML =
          '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="m.427 1.927 1.215 1.215a8.002 8.002 0 1 1-1.6 5.685.75.75 0 1 1 1.493-.154 6.5 6.5 0 1 0 1.18-4.458l1.358 1.358A.25.25 0 0 1 3.896 6H.25A.25.25 0 0 1 0 5.75V2.104a.25.25 0 0 1 .427-.177ZM7.75 4a.75.75 0 0 1 .75.75v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5A.75.75 0 0 1 7.75 4Z"/></svg>';
        link.after(a);
        added.push(a);
      }
      return () => added.forEach((n) => n.remove());
    },
  );

  onSettled(() => {
    // reload-failed-proxied-images: camo sometimes fails under load; retry once.
    const onError = (e: Event) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !feature('reload-failed-proxied-images')) return;
      if (!/^https:\/\/(camo|private-user-images)\.githubusercontent\.com\//.test(img.src) || img.dataset.rghRetried) return;
      setTimeout(() => {
        const clone = img.cloneNode() as HTMLImageElement;
        clone.dataset.rghRetried = '1';
        clone
          .decode()
          .then(() => img.replaceWith(clone))
          .catch(() => {});
      }, 5000);
    };
    // A native listener on the element runs before the router's document-level link handling.
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // toggle-everything-with-alt: alt-click a <summary> toggles every <details> in this body.
      const summary = target.closest('summary');
      if (summary && e.altKey && feature('toggle-everything-with-alt')) {
        e.preventDefault();
        const open = !(summary.parentElement as HTMLDetailsElement).open;
        for (const d of el.querySelectorAll('details')) d.open = open;
        return;
      }
      // scrollable-areas: clicking a scrolled block expands it.
      const area = target.closest('.rgh-scrollable pre, .rgh-scrollable blockquote') as HTMLElement | null;
      if (area && area.scrollHeight > area.clientHeight && !window.getSelection()?.toString()) {
        window.scrollBy(0, area.scrollTop);
        area.classList.add('rgh-scrollable-expanded');
      }
      // comments-time-machine-links: resolve the commit at the comment's date, then follow the link.
      const tm = target.closest<HTMLAnchorElement>('a.rgh-time-machine');
      if (tm && !tm.dataset.resolved && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        const [, owner, repo, kind, ref, rest = ''] = tm.getAttribute('href')!.match(/^\/([^/]+)\/([^/]+)\/(blob|tree)\/([^/?#]+)(\/[^?#]*)?/)!;
        commitAt(owner!, repo!, tm.dataset.date!, decodeURIComponent(ref!))
          .then((sha) => {
            if (sha) tm.setAttribute('href', `/${owner}/${repo}/${kind}/${sha}${rest}`);
          })
          .catch(() => {})
          .finally(() => {
            tm.dataset.resolved = '1';
            tm.click();
          });
      }
    };
    el.addEventListener('error', onError, true);
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('error', onError, true);
      el.removeEventListener('click', onClick);
    };
  });

  return (
    <div
      ref={el}
      class={['markdown-body', props.class, { 'rgh-scrollable': !!props.comment && feature('scrollable-areas') }]}
      // oxlint-disable-next-line solid/no-innerhtml -- HTML is sanitized by GitHub's renderer
      innerHTML={html()}
    />
  );
}

// ---------------------------------------------------------------------------
// shorten-links
// ---------------------------------------------------------------------------

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unescapeHtml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** "https://github.com/o/r/blob/main/a.ts" → "o/r/a.ts@main" (repo-relative when `repo` matches). */
export function shortenUrl(href: string, repo?: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  const hash = url.hash && !/^#(issuecomment|discussion_r|pullrequestreview)/.test(url.hash) ? url.hash : '';
  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
    const s = `${url.hostname.replace(/^www\./, '')}${url.pathname === '/' ? '' : decodeURI(url.pathname)}${url.search}${url.hash}`;
    return s === href ? null : s;
  }
  const [owner, name, type, ...rest] = url.pathname.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  if (!owner) return 'github.com';
  if (!name) return `@${owner}`;
  const prefix = `${owner}/${name}` === repo ? '' : `${owner}/${name}`;
  const at = (ref: string) => (/^[\da-f]{40}$/i.test(ref) ? ref.slice(0, 7) : ref);
  switch (type) {
    case undefined:
      return `${owner}/${name}${url.search}${hash}`;
    case 'issues':
    case 'pull':
    case 'discussions':
      if (rest[0] && /^\d+$/.test(rest[0])) {
        const sub = rest[1] ? ` (${rest.slice(1).join('/')})` : '';
        const comment = /^#(issuecomment|discussion_r|pullrequestreview)-?/.test(url.hash) ? ' (comment)' : '';
        return `${prefix}#${rest[0]}${sub}${comment}`;
      }
      return null;
    case 'commit':
      return rest[0] ? `${prefix}@${at(rest[0])}${hash}` : null;
    case 'blob':
    case 'tree':
      if (!rest[0]) return null;
      return `${prefix ? `${prefix}/` : ''}${rest.slice(1).join('/') || ''}@${at(rest[0])}${hash}`.replace(/^\/@/, '@');
    case 'releases':
      return rest[0] === 'tag' && rest[1] ? `${prefix}@${rest.slice(1).join('/')} (release)` : null;
    case 'compare':
      return rest[0] ? `${prefix}@${rest.join('/')}` : null;
    case 'commits':
      return rest[0] ? `${prefix}@${at(rest[0])} (commits)` : null;
    default:
      return null;
  }
}

/** Shorten links whose text is their own URL (GitHub autolinks). */
function shortenLinks(html: string, repo?: string) {
  return html.replace(/<a href="([^"]+)"([^>]*)>([^<]+)<\/a>/g, (match, href: string, attrs: string, text: string) => {
    const url = unescapeHtml(href);
    const t = unescapeHtml(text).trim();
    if (t !== url && `${t}/` !== url && t !== `${url}/`) return match;
    const short = shortenUrl(url, repo);
    return short ? `<a href="${href}"${attrs} title="${escapeHtml(url)}">${escapeHtml(short)}</a>` : match;
  });
}

// ---------------------------------------------------------------------------
// small-user-avatars (mentions)
// ---------------------------------------------------------------------------

function mentionAvatars(html: string) {
  return html.replace(/(<a class="user-mention[^"]*"[^>]*href="https:\/\/github\.com\/([\w-]+)"[^>]*>)/g, (_, open: string, login: string) =>
    `${open}<img class="avatar avatar-user rgh-mention-avatar" src="https://avatars.githubusercontent.com/${login}?size=32" width="16" height="16" alt="" loading="lazy">`,
  );
}

// ---------------------------------------------------------------------------
// embed-gist-inline
// ---------------------------------------------------------------------------

interface Gist {
  files: Record<string, { filename: string; language: string | null; content?: string; size: number; truncated?: boolean }>;
}
const gists = new Map<string, Promise<Gist>>();

/** A gist as an element, or a note (" (3 files)") when it shouldn't be embedded. */
async function embedGist(id: string): Promise<HTMLElement | string> {
  if (!gists.has(id)) gists.set(id, gh<Gist>(`/gists/${id}`));
  const gist = await gists.get(id)!;
  const files = Object.values(gist.files);
  if (files.length !== 1) return ` (${files.length} files)`;
  const file = files[0]!;
  if (!file.content || file.truncated || file.content.length > 10_000) return ' (too large to embed)';
  const lines = (await highlightLines(file.content, file.filename).catch(() => null)) ?? escapeLines(file.content);
  const box = document.createElement('div');
  box.className = 'rgh-gist Box mb-4';
  box.innerHTML = `<div class="Box-header py-1! px-2! text-xs font-mono"></div><pre class="rgh-gist-code"><code>${lines.join('\n')}</code></pre>`;
  const header = box.firstElementChild as HTMLElement;
  const link = document.createElement('a');
  link.href = `https://gist.github.com/${id}`;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = file.filename;
  header.append(link);
  return box;
}
