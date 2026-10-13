import { createEffect, createMemo } from 'solid-js';
import { encodePath, ghBlob } from '../../lib/github';
import { type RepoFileContext, resolveRepoUrls, rewriteHtmlLinks } from '../../lib/markdown';

/**
 * Renders HTML produced by GitHub (`body_html`, `bodyHTML`, rendered READMEs)
 * with GitHub's markdown styles. The HTML comes from api.github.com, which
 * sanitizes it; github.com links are rewritten to stay inside this app.
 *
 * Pass `file` for markdown files from a repository (READMEs, docs) so their
 * relative image and link URLs resolve against the file's location.
 */
export default function Markdown(props: { html: string | null | undefined; class?: string; file?: RepoFileContext }) {
  let el!: HTMLDivElement;
  const html = createMemo(() => {
    // Resolve repo-relative URLs first: rewriting github.com links produces
    // root-relative "/owner/repo" paths that must not be resolved again.
    const raw = props.html ?? '';
    return rewriteHtmlLinks(props.file ? resolveRepoUrls(raw, props.file) : raw);
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

  // oxlint-disable-next-line solid/no-innerhtml -- HTML is sanitized by GitHub's renderer
  return <div ref={el} class={['markdown-body', props.class]} innerHTML={html()} />;
}
