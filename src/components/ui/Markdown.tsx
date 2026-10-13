import { rewriteHtmlLinks } from '../../lib/markdown';

/**
 * Renders HTML produced by GitHub (`body_html`, `bodyHTML`, rendered READMEs)
 * with GitHub's markdown styles. The HTML comes from api.github.com, which
 * sanitizes it; github.com links are rewritten to stay inside this app.
 */
export default function Markdown(props: { html: string | null | undefined; class?: string }) {
  // oxlint-disable-next-line solid/no-innerhtml -- HTML is sanitized by GitHub's renderer
  return <div class={['markdown-body', props.class]} innerHTML={rewriteHtmlLinks(props.html ?? '')} />;
}
