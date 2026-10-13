import { useAction } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, For, Loading, onSettled, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Markdown, RelativeTime } from '../../../components/ui';
import {
  checkCircleIcon,
  codeIcon,
  downloadIcon,
  fileZipIcon,
  gitBranchIcon,
  gitCommitIcon,
  lockIcon,
  packageIcon,
  pencilIcon,
  trashIcon,
} from '../../../icons/octicons';
import { compactNumber, formatBytes, formatNumber, pluralize } from '../../../lib/format';
import { ConfirmDialog } from '../../repo-settings/components/ui';
import type { Release, ReleaseCommit } from '../api';
import { removeRelease } from '../api';
import CompareTagMenu from './CompareTagMenu';
import { TagChangesLink } from './RefinedReleases';

/**
 * GitHub's 10-step heat scale (1 = hottest) over a list of values
 * (the most downloaded assets are colored).
 */
export function heatIndex(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (value: number) => {
    const t = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
    return Math.max(1, 10 - Math.floor(t * 10));
  };
}
/** Heat 1 → full "severe" orange, 10 → muted text. */
export const heatColor = (heat: number) => `color-mix(in srgb, var(--fgColor-severe) ${Math.round(((10 - heat) / 9) * 100)}%, var(--fgColor-muted))`;

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

import { tagHref } from '../versions';

export { tagHref };

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
 * One release as github.com draws it: title + badges with Compare / edit /
 * delete on the right, the meta row (author, tag, commit), rendered notes,
 * then collapsible assets (sizes and download counts) and reactions.
 */
export default function ReleaseCard(props: {
  release: Release;
  base: string;
  owner: string;
  repo: string;
  latest: boolean;
  canEdit: boolean;
  /** The tag's commit (short SHA + signature check); omitted while unknown. */
  commit?: ReleaseCommit | null;
  /** The previous tag when the page already looks it up (else the link fetches it). */
  previousTag?: string | null;
  /** Extra meta entries after the author (e.g. "N commits to main since this release"). */
  extraMeta?: JSX.Element;
  /** Extra header buttons before edit / delete (e.g. convert to draft). */
  actions?: JSX.Element;
  /** Cut long notes short with a "Read more" link (list page). */
  clampNotes?: boolean;
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
  const heat = createMemo(() => heatIndex(r().assets.map((a) => a.download_count)));
  const isBot = () => r().author.type === 'Bot';
  const authorName = () => (isBot() ? r().author.login.replace(/\[bot\]$/, '') : r().author.login);

  return (
    <div class="Box">
      <div class="Box-body p-4!">
        <div class="flex flex-col md:flex-row gap-x-2">
          <div class="flex-1 min-w-0 mb-3 break-words">
            <span class="text-2xl md:text-[32px] leading-[1.5] font-semibold mr-3">
              <a class="link-plain" href={tagHref(props.base, r().tag_name)}>
                {r().name || r().tag_name}
              </a>
            </span>
            <span class="inline-flex gap-1 align-text-bottom relative -top-1.5">
              <ReleaseBadges release={r()} latest={props.latest} />
            </span>
          </div>
          <div class="flex items-start gap-1 mb-3 shrink-0">
            <Show when={!r().draft}>
              <CompareTagMenu owner={props.owner} repo={props.repo} tag={r().tag_name} />
            </Show>
            {props.actions}
            <Show when={props.canEdit}>
              <a class="btn-octicon w-7! h-7!" href={`${props.base}/releases/edit/${r().tag_name}`} aria-label="Edit release" title="Edit">
                <Octicon icon={pencilIcon} />
              </a>
              <button
                type="button"
                class="btn-octicon w-7! h-7! text-fg-danger! hover:bg-danger-muted!"
                aria-label="Delete release"
                title="Delete"
                onClick={() => setDeleting(true)}
              >
                <Octicon icon={trashIcon} />
              </button>
            </Show>
          </div>
        </div>
        <div class="mb-3 md:pb-4 md:border-b border-line-muted">
          <div class="flex flex-wrap items-end text-sm text-fg-muted">
            <div class="mr-4 mb-2 flex items-center gap-1 min-w-0">
              <Avatar src={r().author.avatar_url} login={r().author.login} size={20} square={isBot()} />
              <a
                class="font-semibold text-fg-muted! hover:text-fg-accent! ml-0.5"
                href={isBot() ? `/apps/${authorName()}` : `/${r().author.login}`}
                data-hovercard-user={isBot() ? undefined : r().author.login}
              >
                {authorName()}
              </a>
              <Show when={r().published_at} fallback={<span>drafted this</span>}>
                <span>
                  released this <RelativeTime datetime={r().published_at} />
                </span>
              </Show>
            </div>
            {props.extraMeta}
            <Show when={r().immutable}>
              <div class="mr-4 mb-2 flex items-center gap-1" title="This release is immutable: its tag and assets can't be changed">
                <Octicon icon={lockIcon} /> Immutable
              </div>
            </Show>
            <div class="mr-4 mb-2">
              <a class="flex items-center gap-1 link-muted" href={`${props.base}/tree/${r().tag_name}`} title={r().tag_name}>
                {/* This link opens the code, so say so. */}
                <Octicon icon={codeIcon} />
                <span class="ml-1 truncate max-w-[125px]">{r().tag_name}</span>
              </a>
            </div>
            <Loading fallback={null}>
              <Show when={!r().draft && props.commit}>
                {(c) => (
                  <div class="mr-4 mb-2 flex items-center gap-1">
                    <a class="flex items-center gap-1 link-muted" href={`${props.base}/commit/${c().oid}`} title={c().oid}>
                      <Octicon icon={gitCommitIcon} /> <code class="text-sm ml-1">{c().abbreviatedOid}</code>
                    </a>
                    <Show when={c().verified}>
                      <span class="text-fg-success inline-flex ml-1" title="This commit was signed with a verified signature">
                        <Octicon icon={checkCircleIcon} />
                      </span>
                    </Show>
                  </div>
                )}
              </Show>
            </Loading>
            <Show when={!r().draft}>
              <TagChangesLink owner={props.owner} repo={props.repo} tag={r().tag_name} previous={props.previousTag} class="mr-4 mb-2" />
            </Show>
            <Show when={r().draft}>
              <div class="mr-4 mb-2 flex items-center gap-1">
                <Octicon icon={gitBranchIcon} />
                <span class="truncate max-w-[180px]">{r().target_commitish}</span>
              </div>
            </Show>
          </div>
        </div>
        <Show when={r().body_html} fallback={<p class="text-fg-muted italic">No release notes.</p>}>
          <Show when={props.clampNotes} fallback={<Markdown html={r().body_html} class="release-notes my-4" />}>
            <ClampedNotes html={r().body_html} href={tagHref(props.base, r().tag_name)} />
          </Show>
        </Show>
      </div>
      <div class="px-4 py-4 border-t border-line-muted">
        <details open={props.expandAssets || r().assets.length > 0}>
          <summary class="cursor-pointer select-none mb-2">
            <span class="text-xl font-semibold ml-1">Assets</span>{' '}
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
                  {/* Heat-colored count; kept invisible at 0 so the columns stay aligned. */}
                  <span
                    class={['text-xs w-20 text-right inline-flex items-center justify-end gap-1', { invisible: !a.download_count }]}
                    title={`${formatNumber(a.download_count)} downloads`}
                    style={{ color: heatColor(heat()(a.download_count)) }}
                  >
                    {compactNumber(a.download_count)} <Octicon icon={downloadIcon} />
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

/** Long release notes on the list page stop at a fixed height with "Read more" (github.com truncates them too). */
function ClampedNotes(props: { html: string | undefined; href: string }) {
  let el!: HTMLDivElement;
  const [clamped, setClamped] = createSignal(false);
  onSettled(() => {
    setClamped(el.scrollHeight > el.clientHeight + 1);
  });
  return (
    <>
      <div ref={el} class="max-h-[2000px] overflow-hidden">
        <Markdown html={props.html} class="release-notes my-4" />
      </div>
      <Show when={clamped()}>
        <a class="inline-block mt-2" href={props.href}>
          Read more
        </a>
      </Show>
    </>
  );
}
