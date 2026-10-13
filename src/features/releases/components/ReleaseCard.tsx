import { useAction } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Markdown, RelativeTime } from '../../../components/ui';
import { fileZipIcon, gitBranchIcon, packageIcon, pencilIcon, tagIcon, trashIcon } from '../../../icons/octicons';
import { formatBytes, formatNumber, pluralize } from '../../../lib/format';
import { ConfirmDialog } from '../../repo-settings/components/ui';
import type { Release } from '../api';
import { removeRelease } from '../api';

const REACTIONS: [key: string, emoji: string][] = [
  ['+1', '👍'],
  ['-1', '👎'],
  ['laugh', '😄'],
  ['hooray', '🎉'],
  ['confused', '😕'],
  ['heart', '❤️'],
  ['rocket', '🚀'],
  ['eyes', '👀'],
];

export const tagHref = (base: string, tag: string) => `${base}/releases/tag/${tag.split('/').map(encodeURIComponent).join('/')}`;

/** Label row: Draft / Pre-release / Latest. */
export function ReleaseBadges(props: { release: Release; latest: boolean }) {
  return (
    <>
      <Show when={props.release.draft}>
        <span class="Label Label--attention Label--large">Draft</span>
      </Show>
      <Show when={props.release.prerelease && !props.release.draft}>
        <span class="Label Label--attention Label--large">Pre-release</span>
      </Show>
      <Show when={props.latest}>
        <span class="Label Label--success Label--large">Latest</span>
      </Show>
    </>
  );
}

/**
 * One release as github.com draws it: title + badges, author/tag line,
 * rendered notes, collapsible assets (with sizes and download counts) and
 * read-only reactions.
 */
export default function ReleaseCard(props: {
  release: Release;
  base: string;
  owner: string;
  repo: string;
  latest: boolean;
  canEdit: boolean;
  /** Expanded assets list (single release page). */
  expandAssets?: boolean;
  /** Custom delete (single page navigates away); defaults to the list action. */
  onDelete?: () => Promise<unknown>;
}) {
  const remove = useAction(removeRelease);
  const [deleting, setDeleting] = createSignal(false);
  const r = () => props.release;
  const archive = (ext: 'zip' | 'tar.gz') => `https://github.com/${props.owner}/${props.repo}/archive/refs/tags/${r().tag_name}.${ext}`;
  const reactions = () => REACTIONS.filter(([k]) => (r().reactions as any)?.[k] > 0);

  return (
    <div class="Box">
      <div class="Box-body p-4! md:p-6!">
        <div class="flex flex-wrap items-start gap-2 mb-2">
          <h2 class="text-2xl md:text-[32px] font-semibold leading-tight break-all mr-1">
            <a class="link-plain" href={tagHref(props.base, r().tag_name)}>
              {r().name || r().tag_name}
            </a>
          </h2>
          <div class="flex gap-1 mt-1.5">
            <ReleaseBadges release={r()} latest={props.latest} />
          </div>
          <div class="flex-1" />
          <Show when={props.canEdit}>
            <div class="flex gap-1">
              <a class="btn-octicon" href={`${props.base}/releases/edit/${r().tag_name}`} aria-label="Edit release" title="Edit">
                <Octicon icon={pencilIcon} />
              </a>
              <button type="button" class="btn-octicon btn-octicon-danger" aria-label="Delete release" title="Delete" onClick={() => setDeleting(true)}>
                <Octicon icon={trashIcon} />
              </button>
            </div>
          </Show>
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-muted pb-4 mb-4 border-b border-line-muted">
          <span class="flex items-center gap-1">
            <Avatar src={r().author.avatar_url} size={20} />
            <a class="font-semibold link-plain" href={`/${r().author.login}`}>
              {r().author.login}
            </a>
            <Show when={r().published_at} fallback={<span>drafted this</span>}>
              released this <RelativeTime datetime={r().published_at} />
            </Show>
          </span>
          <a class="flex items-center gap-1 link-muted" href={`${props.base}/tree/${r().tag_name}`}>
            <Octicon icon={tagIcon} />
            <span class="truncate max-w-[220px]">{r().tag_name}</span>
          </a>
          <Show when={r().draft || r().target_commitish !== r().tag_name}>
            <span class="flex items-center gap-1">
              <Octicon icon={gitBranchIcon} />
              <span class="truncate max-w-[180px]">{r().target_commitish}</span>
            </span>
          </Show>
        </div>
        <Show when={r().body_html} fallback={<p class="text-fg-muted italic text-sm">No release notes.</p>}>
          <Markdown html={r().body_html} />
        </Show>

        <details class="mt-6" open={props.expandAssets || r().assets.length > 0}>
          <summary class="cursor-pointer select-none mb-2">
            <span class="text-xl font-semibold">Assets</span>{' '}
            <span class="Counter">{r().assets.length + (r().draft ? 0 : 2)}</span>
          </summary>
          <div class="Box">
            <For each={r().assets}>
              {(a) => (
                <div class="Box-row flex flex-wrap items-center gap-2 py-2!">
                  <Octicon icon={packageIcon} class="text-fg-muted" />
                  <a class="font-semibold text-sm flex-1 min-w-0 truncate" href={a.browser_download_url} title={a.label ?? a.name}>
                    {a.name}
                  </a>
                  <span class="text-xs text-fg-muted w-20 text-right">{formatBytes(a.size)}</span>
                  <span class="text-xs text-fg-muted w-32 text-right" title={`${formatNumber(a.download_count)} downloads`}>
                    {pluralize(a.download_count, 'download')}
                  </span>
                  <span class="text-xs text-fg-muted w-28 text-right">
                    <RelativeTime datetime={a.updated_at} />
                  </span>
                </div>
              )}
            </For>
            <Show when={!r().draft}>
              <div class="Box-row flex items-center gap-2 py-2!">
                <Octicon icon={fileZipIcon} class="text-fg-muted" />
                <a class="font-semibold text-sm flex-1" href={archive('zip')}>
                  Source code <span class="font-normal">(zip)</span>
                </a>
                <span class="text-xs text-fg-muted">
                  <RelativeTime datetime={r().published_at ?? r().created_at} />
                </span>
              </div>
              <div class="Box-row flex items-center gap-2 py-2!">
                <Octicon icon={fileZipIcon} class="text-fg-muted" />
                <a class="font-semibold text-sm flex-1" href={archive('tar.gz')}>
                  Source code <span class="font-normal">(tar.gz)</span>
                </a>
                <span class="text-xs text-fg-muted">
                  <RelativeTime datetime={r().published_at ?? r().created_at} />
                </span>
              </div>
            </Show>
          </div>
        </details>

        <Show when={reactions().length}>
          <div class="flex flex-wrap items-center gap-2 mt-4">
            <For each={reactions()}>
              {([key, emoji]) => (
                <span class="inline-flex items-center gap-1 px-2 h-6 rounded-full border border-line text-xs bg-canvas-muted">
                  <span>{emoji}</span>
                  <span class="font-semibold">{(r().reactions as any)[key]}</span>
                </span>
              )}
            </For>
            <span class="text-xs text-fg-muted">{pluralize(r().reactions?.total_count ?? 0, 'person', 'people')} reacted</span>
          </div>
        </Show>
      </div>
      <ConfirmDialog
        open={deleting()}
        onClose={() => setDeleting(false)}
        title="Delete this release?"
        button="Delete this release"
        onConfirm={() => (props.onDelete ? props.onDelete() : remove(props.owner, props.repo, r().id))}
      >
        <p>This will delete the information for the release <strong>{r().name || r().tag_name}</strong>. The tag is kept.</p>
      </ConfirmDialog>
    </div>
  );
}
