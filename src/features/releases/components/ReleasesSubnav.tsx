import type { JSX } from '@solidjs/web';

/** "Releases | Tags" switch above both lists, with optional right-side actions. */
export default function ReleasesSubnav(props: { base: string; active: 'releases' | 'tags'; children?: JSX.Element }) {
  return (
    <div class="flex flex-wrap items-center gap-2 pb-4 mb-4 border-b border-line-muted">
      <nav class="flex" aria-label="Releases and Tags">
        <a class="subnav-item" href={`${props.base}/releases`} aria-current={props.active === 'releases' ? 'page' : undefined}>
          Releases
        </a>
        <a class="subnav-item" href={`${props.base}/tags`} aria-current={props.active === 'tags' ? 'page' : undefined}>
          Tags
        </a>
      </nav>
      <div class="flex-1" />
      {props.children}
    </div>
  );
}
