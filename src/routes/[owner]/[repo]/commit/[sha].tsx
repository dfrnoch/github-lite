import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createMemo, For, Loading, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { CopyButton, PageSpinner } from '../../../../components/ui';
import { fetchRaw, getCommit } from '../../../../features/code/api';
import { ChecksBadge, CommitAuthors, VerifiedBadge } from '../../../../features/code/components/CommitList';
import DiffView, { Diffstat } from '../../../../features/diff/DiffView';
import { useRepo } from '../../../../features/repo/context';
import { fileCodeIcon, gitBranchIcon, gitPullRequestIcon } from '../../../../icons/octicons';
import { formatNumber, pluralize } from '../../../../lib/format';
import { encodePath } from '../../../../lib/github';

/** /:owner/:repo/commit/:sha — commit message, metadata and diff. */
export default function CommitPage() {
  const ctx = useRepo();
  const params = useParams<{ sha: string }>();
  const data = createMemo(() => getCommit(ctx.owner(), ctx.name(), params.sha));
  const sha = () => data().rest.sha;
  const stats = () => data().rest.stats ?? { additions: 0, deletions: 0, total: 0 };

  return (
    <div class="px-4 md:px-6 lg:px-8 py-6 max-w-[1800px] mx-auto">
      <Loading fallback={<PageSpinner />}>
        <Title>{`${data().info.messageHeadline} · ${ctx.fullName()}@${sha().slice(0, 7)}`}</Title>
        <div class="flex items-center gap-2 mb-2">
          <h1 class="text-2xl flex items-center gap-2 min-w-0">
            Commit <span class="font-mono text-xl px-1 rounded-md bg-canvas-muted">{sha().slice(0, 7)}</span>
          </h1>
          <div class="flex-1" />
          <a class="btn btn-sm" href={`${ctx.base()}/tree/${sha()}`} title="Browse the repository at this point in the history">
            <Octicon icon={fileCodeIcon} /> Browse files
          </a>
        </div>
        <div class="flex items-center gap-2 text-sm text-fg-muted mb-4 flex-wrap">
          <CommitAuthors commit={data().info} size={20} strong />
          <Show when={data().info.checks}>
            <span>·</span>
            <ChecksBadge checks={data().info.checks} />
          </Show>
          <Show when={data().info.verified}>
            <VerifiedBadge />
          </Show>
        </div>

        <div class="Box mb-6">
          <div class="Box-body">
            <h2 class="font-mono text-base whitespace-pre-wrap break-words">{data().info.messageHeadline}</h2>
            <Show when={data().info.messageBody}>
              <pre class="mt-2 font-mono text-xs whitespace-pre-wrap break-words">{data().info.messageBody}</pre>
            </Show>
          </div>
          <div class="Box-body py-2! flex flex-wrap items-center gap-2 text-xs">
            <Octicon icon={gitBranchIcon} class="text-fg-muted" />
            <Show when={data().onDefaultBranch}>
              <a class="Label Label--accent font-mono" href={`${ctx.base()}/tree/${encodePath(ctx.repo().default_branch)}`}>
                {ctx.repo().default_branch}
              </a>
            </Show>
            <For each={data().info.pulls}>
              {(pr) => (
                <a class="inline-flex items-center gap-1 text-fg-muted link-muted" href={`${ctx.base()}/pull/${pr.number}`} title={pr.title}>
                  <Octicon icon={gitPullRequestIcon} />#{pr.number}
                </a>
              )}
            </For>
            <div class="flex-1" />
            <span class="text-fg-muted font-mono flex items-center gap-1 flex-wrap">
              {pluralize(data().info.parents.length, 'parent')}
              <For each={data().info.parents}>
                {(p, i) => (
                  <>
                    {i() > 0 ? ' + ' : ' '}
                    <a class="text-fg underline" href={`${ctx.base()}/commit/${p.oid}`}>
                      {p.abbreviatedOid}
                    </a>
                  </>
                )}
              </For>
              <span class="ml-2">commit</span>
              <span class="text-fg">{sha().slice(0, 7)}</span>
              <CopyButton value={sha()} label="Copy full SHA" class="btn-octicon w-6 h-6" />
            </span>
          </div>
          <div class="Box-body py-2! flex items-center gap-2 text-sm">
            <strong>{pluralize(data().rest.files.length, 'file')} changed</strong>
            <Show when={data().rest.files.length >= 3000}>
              <span class="text-fg-muted text-xs">(GitHub's API lists at most 3,000 files)</span>
            </Show>
            <div class="flex-1" />
            <Diffstat additions={stats().additions} deletions={stats().deletions} />
          </div>
        </div>

        <DiffView
          files={data().rest.files}
          viewedKey={`${ctx.fullName()}@${sha()}`}
          fileHref={(f) => (f.status === 'removed' ? undefined : `${ctx.base()}/blob/${sha()}/${encodePath(f.filename)}`)}
          loadContent={(f) => fetchRaw(ctx.owner(), ctx.name(), sha(), f.filename)}
          summary={
            <span>
              <strong class="text-fg">{formatNumber(data().rest.files.length)}</strong> files changed
            </span>
          }
        />
      </Loading>
    </div>
  );
}
