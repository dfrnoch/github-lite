import { Title } from '@solidjs/meta';
import { useLocation, useSearchParams } from '@solidjs/router';
import { createMemo, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Blankslate, RelativeTime } from '../../../components/ui';
import { getActivity, type RepoActivity } from '../../../features/insights/api';
import InsightsLayout from '../../../features/insights/components/InsightsLayout';
import { useRepo } from '../../../features/repo/context';
import { gitBranchIcon, gitMergeIcon, pulseIcon, repoPushIcon, trashIcon, alertIcon } from '../../../icons/octicons';
import { shortSha } from '../../../lib/format';

const TYPES: Record<RepoActivity['activity_type'], { label: string; icon: typeof pulseIcon }> = {
  push: { label: 'pushed', icon: repoPushIcon },
  force_push: { label: 'force pushed', icon: alertIcon },
  branch_creation: { label: 'created', icon: gitBranchIcon },
  branch_deletion: { label: 'deleted', icon: trashIcon },
  pr_merge: { label: 'merged a pull request into', icon: gitMergeIcon },
  merge_queue_merge: { label: 'merged (queue) into', icon: gitMergeIcon },
};

/** /:owner/:repo/activity — pushes, force pushes, branch creations/deletions (filters via query string). */
export default function ActivityPage() {
  const ctx = useRepo();
  const location = useLocation();
  const [search, setSearch] = useSearchParams<{
    ref?: string;
    actor?: string;
    activity_type?: string;
    time_period?: string;
    after?: string;
    before?: string;
  }>();
  const data = createMemo(() =>
    getActivity(ctx.owner(), ctx.name(), {
      ref: search.ref,
      actor: search.actor,
      type: search.activity_type,
      period: search.time_period,
      after: search.after,
      before: search.before,
    }),
  );
  const branch = (ref: string) => ref.replace(/^refs\/(heads|tags)\//, '');
  const pageLink = (key: 'after' | 'before', cursor: string) => {
    const p = new URLSearchParams(location.search);
    p.delete('after');
    p.delete('before');
    p.set(key, cursor);
    return `${location.pathname}?${p}`;
  };

  return (
    <InsightsLayout>
      <Title>{`Activity · ${ctx.fullName()}`}</Title>
      <div class="pb-2 mb-4 border-b border-line-muted">
        <h2 class="text-2xl font-normal">Activity</h2>
      </div>
      <div class="flex flex-wrap gap-2 mb-4">
        <input
          class="form-control form-control-sm w-48!"
          placeholder="Branch (e.g. main)"
          value={search.ref ?? ''}
          onChange={(e) => setSearch({ ref: e.currentTarget.value || undefined, after: undefined, before: undefined })}
        />
        <input
          class="form-control form-control-sm w-40!"
          placeholder="User"
          value={search.actor ?? ''}
          onChange={(e) => setSearch({ actor: e.currentTarget.value || undefined, after: undefined, before: undefined })}
        />
        <select
          class="form-select form-control-sm w-auto!"
          aria-label="Activity type"
          value={search.activity_type ?? ''}
          onChange={(e) => setSearch({ activity_type: e.currentTarget.value || undefined, after: undefined, before: undefined })}
        >
          <option value="">All activity</option>
          <option value="push">Pushes</option>
          <option value="force_push">Force pushes</option>
          <option value="branch_creation">Branch creations</option>
          <option value="branch_deletion">Branch deletions</option>
          <option value="pr_merge">Pull request merges</option>
          <option value="merge_queue_merge">Merge queue merges</option>
        </select>
        <select
          class="form-select form-control-sm w-auto!"
          aria-label="Time period"
          value={search.time_period ?? ''}
          onChange={(e) => setSearch({ time_period: e.currentTarget.value || undefined, after: undefined, before: undefined })}
        >
          <option value="">All time</option>
          <option value="day">Last 24 hours</option>
          <option value="week">Last week</option>
          <option value="month">Last month</option>
          <option value="quarter">Last quarter</option>
          <option value="year">Last year</option>
        </select>
      </div>
      <div class="Box">
        <For each={data().items} fallback={<Blankslate icon={pulseIcon} title="No activity matches these filters" />}>
          {(a) => (
            <div class="Box-row flex items-center gap-3">
              <Octicon icon={TYPES[a.activity_type]?.icon ?? pulseIcon} class="text-fg-muted" />
              <Avatar src={a.actor?.avatar_url} size={20} />
              <div class="flex-1 min-w-0 text-sm">
                <a class="font-semibold link-plain" href={a.actor ? `/${a.actor.login}` : undefined}>
                  {a.actor?.login ?? 'Someone'}
                </a>{' '}
                <span class="text-fg-muted">{TYPES[a.activity_type]?.label ?? a.activity_type}</span>{' '}
                <a class="font-mono text-xs bg-accent-muted rounded px-1" href={`${ctx.base()}/tree/${branch(a.ref)}`}>
                  {branch(a.ref)}
                </a>
              </div>
              <Show when={a.activity_type === 'push' || a.activity_type === 'force_push' || a.activity_type === 'pr_merge'}>
                <a class="font-mono text-xs link-muted" href={`${ctx.base()}/compare/${a.before}...${a.after}`}>
                  {shortSha(a.before)}…{shortSha(a.after)}
                </a>
              </Show>
              <span class="text-xs text-fg-muted w-28 text-right">
                <RelativeTime datetime={a.timestamp} />
              </span>
            </div>
          )}
        </For>
      </div>
      <Show when={data().next || data().prev}>
        <nav class="pagination" aria-label="Pagination">
          <Show when={data().prev} fallback={<span class="disabled">Newer</span>}>
            {(c) => <a href={pageLink('before', c())}>Newer</a>}
          </Show>
          <Show when={data().next} fallback={<span class="disabled">Older</span>}>
            {(c) => <a href={pageLink('after', c())}>Older</a>}
          </Show>
        </nav>
      </Show>
    </InsightsLayout>
  );
}
