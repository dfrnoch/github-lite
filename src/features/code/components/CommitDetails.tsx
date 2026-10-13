import type { JSX } from '@solidjs/web';
import { For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { CopyButton, VerifiedBadge } from '../../../components/ui';
import { gitBranchIcon, gitPullRequestIcon } from '../../../icons/octicons';
import { formatNumber, pluralize } from '../../../lib/format';
import { encodePath } from '../../../lib/github';
import DiffView, { Diffstat } from '../../diff/DiffView';
import { feature } from '../../refined';
import { fetchRaw, type CommitDetails as CommitData } from '../api';
import { ChecksBadge, CommitAuthors } from './CommitList';

/**
 * A commit's message box, metadata and diff — the body of /commit/:sha and of
 * a PR's /pull/:n/commits/:sha page.
 */
export default function CommitDetails(props: {
  data: CommitData;
  owner: string;
  repo: string;
  defaultBranch: string;
  /** Right side of the title row (Browse files / previous-next buttons). */
  actions?: JSX.Element;
  /** Under the diff (previous-next-commit-buttons). */
  footer?: JSX.Element;
  /** Set on PR commit pages: link the SHA to the plain commit page (linkify-commit-sha), show diff stats (pr-commit-lines-changed). */
  inPull?: boolean;
}) {
  const base = () => `/${props.owner}/${props.repo}`;
  const sha = () => props.data.rest.sha;
  const stats = () => props.data.rest.stats ?? { additions: 0, deletions: 0, total: 0 };
  const info = () => props.data.info;
  const gitUrl = (ext: 'patch' | 'diff') => `https://github.com/${props.owner}/${props.repo}/commit/${sha()}.${ext}`;
  return (
    <>
      <div class="flex items-center gap-2 mb-2">
        <h1 class="text-2xl flex items-center gap-2 min-w-0">
          Commit <span class="font-mono text-xl px-1 rounded-md bg-canvas-muted">{sha().slice(0, 7)}</span>
        </h1>
        <div class="flex-1" />
        {props.actions}
      </div>
      <div class="flex items-center gap-2 text-sm text-fg-muted mb-4 flex-wrap">
        <CommitAuthors commit={info()} size={20} strong />
        <Show when={info().checks}>
          <span>·</span>
          <ChecksBadge checks={info().checks} owner={props.owner} repo={props.repo} sha={sha()} />
        </Show>
        <VerifiedBadge signature={info().signature} />
      </div>

      <div class="Box mb-6">
        <div class="Box-body">
          <h2 class="font-mono text-base whitespace-pre-wrap break-words">
            {info().messageHeadline}
          </h2>
          <Show when={info().messageBody}>
            <pre class="mt-2 font-mono text-xs whitespace-pre-wrap break-words">{info().messageBody}</pre>
          </Show>
        </div>
        <div class="Box-body py-2! flex flex-wrap items-center gap-2 text-xs">
          <Octicon icon={gitBranchIcon} class="text-fg-muted" />
          <Show when={props.data.onDefaultBranch}>
            <a class="Label Label--accent font-mono" href={`${base()}/tree/${encodePath(props.defaultBranch)}`}>
              {props.defaultBranch}
            </a>
          </Show>
          <For each={info().pulls}>
            {(pr) => (
              <a class="inline-flex items-center gap-1 text-fg-muted link-muted" href={`${base()}/pull/${pr.number}`} title={pr.title}>
                <Octicon icon={gitPullRequestIcon} />#{pr.number}
              </a>
            )}
          </For>
          <div class="flex-1" />
          <span class="text-fg-muted font-mono flex items-center gap-1 flex-wrap">
            <Show when={feature('patch-diff-links')}>
              <span class="rgh-patch-diff-links">
                <a class="text-fg underline" href={gitUrl('patch')} target="_blank" rel="noreferrer">
                  patch
                </a>{' '}
                <a class="text-fg underline" href={gitUrl('diff')} target="_blank" rel="noreferrer">
                  diff
                </a>
                <span class="px-2">·</span>
              </span>
            </Show>
            {pluralize(info().parents.length, 'parent')}
            <For each={info().parents}>
              {(p, i) => (
                <>
                  {i() > 0 ? ' + ' : ' '}
                  <a class="text-fg underline" href={`${base()}/commit/${p.oid}`}>
                    {p.abbreviatedOid}
                  </a>
                </>
              )}
            </For>
            <span class="ml-2">commit</span>
            <Show when={props.inPull && feature('linkify-commit-sha')} fallback={<span class="text-fg">{sha().slice(0, 7)}</span>}>
              <a class="text-fg underline rgh-linkify-commit-sha" href={`${base()}/commit/${sha()}`} title="View this commit outside the pull request">
                {sha().slice(0, 7)}
              </a>
            </Show>
            <CopyButton value={sha()} label="Copy full SHA" class="btn-octicon w-6 h-6" />
          </span>
        </div>
        <div class="Box-body py-2! flex items-center gap-2 text-sm">
          <strong>{pluralize(props.data.rest.files.length, 'file')} changed</strong>
          <Show when={props.data.rest.files.length >= 3000}>
            <span class="text-fg-muted text-xs">(GitHub's API lists at most 3,000 files)</span>
          </Show>
          <div class="flex-1" />
          <Show when={!props.inPull || feature('pr-commit-lines-changed')}>
            <span title={pluralize(stats().additions + stats().deletions, 'line') + ' changed'}>
              <Diffstat additions={stats().additions} deletions={stats().deletions} />
            </span>
          </Show>
        </div>
      </div>

      <DiffView
        files={props.data.rest.files}
        viewedKey={`${props.owner}/${props.repo}@${sha()}`}
        fileHref={(f) => (f.status === 'removed' ? undefined : `${base()}/blob/${sha()}/${encodePath(f.filename)}`)}
        loadContent={(f) => fetchRaw(props.owner, props.repo, sha(), f.filename)}
        summary={
          <span>
            <strong class="text-fg">{formatNumber(props.data.rest.files.length)}</strong> files changed
          </span>
        }
      />
      {props.footer}
    </>
  );
}
