import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createMemo, For, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Avatar, Dropdown, RelativeTime } from '../../../../components/ui';
import { getPulse, type PulseItem } from '../../../../features/insights/api';
import InsightsLayout from '../../../../features/insights/components/InsightsLayout';
import { useRepo } from '../../../../features/repo/context';
import {
  checkIcon,
  gitMergeIcon,
  gitPullRequestIcon,
  issueClosedIcon,
  issueOpenedIcon,
  triangleDownIcon,
} from '../../../../icons/octicons';
import { formatDate, formatNumber, pluralize } from '../../../../lib/format';

const PERIODS: Record<string, { label: string; days: number }> = {
  daily: { label: '24 hours', days: 1 },
  halfweekly: { label: '3 days', days: 3 },
  weekly: { label: '1 week', days: 7 },
  monthly: { label: '1 month', days: 30 },
};

/** /:owner/:repo/pulse[/daily|halfweekly|weekly|monthly] */
export default function PulsePage() {
  const ctx = useRepo();
  const params = useParams<{ period?: string }>();
  const period = () => (params.period && PERIODS[params.period] ? params.period : 'weekly');
  // Rounded to the hour so the query key is stable between renders.
  const since = createMemo(() => {
    const d = new Date(Date.now() - PERIODS[period()]!.days * 86400000);
    d.setMinutes(0, 0, 0);
    return d.toISOString();
  });
  const pulse = createMemo(() => getPulse(ctx.owner(), ctx.name(), since(), ctx.repo().default_branch));

  return (
    <InsightsLayout>
      <Title>{`Pulse · ${ctx.fullName()}`}</Title>
      <div class="flex items-center gap-2 pb-2 mb-4 border-b border-line-muted">
        <h2 class="text-2xl font-normal flex-1">
          {formatDate(since(), { year: 'numeric' })} – {formatDate(Date.now(), { year: 'numeric' })}
        </h2>
        <Dropdown
          class="btn btn-sm"
          align="right"
          menuClass="w-40"
          button={
            <>
              Period: {PERIODS[period()]!.label} <Octicon icon={triangleDownIcon} />
            </>
          }
        >
          {() => (
            <For each={Object.entries(PERIODS)}>
              {([key, p]) => (
                <a class="SelectMenu-item" href={`${ctx.base()}/pulse/${key}`}>
                  <span class="w-4">
                    <Show when={period() === key}>
                      <Octicon icon={checkIcon} />
                    </Show>
                  </span>
                  {p.label}
                </a>
              )}
            </For>
          )}
        </Dropdown>
      </div>

      <div class="Box mb-6">
        <div class="Box-header font-semibold">Overview</div>
        <div class="grid grid-cols-2 md:grid-cols-4 text-center">
          <Stat icon={gitMergeIcon} color="text-fg-done" count={pulse().mergedPrs.count} label="Merged pull requests" />
          <Stat icon={gitPullRequestIcon} color="text-fg-open" count={pulse().openedPrs.count} label="Open pull requests" />
          <Stat icon={issueClosedIcon} color="text-fg-done" count={pulse().closedIssues.count} label="Closed issues" />
          <Stat icon={issueOpenedIcon} color="text-fg-open" count={pulse().openedIssues.count} label="New issues" />
        </div>
      </div>

      <div class="flex flex-col md:flex-row gap-6 pb-6 mb-6 border-b border-line-muted">
        <p class="text-base flex-1">
          Excluding merges, <strong>{pluralize(pulse().authors.length, 'author')}</strong> pushed{' '}
          <strong>{pluralize(pulse().commits, 'commit')}</strong> to {ctx.repo().default_branch}. On{' '}
          {ctx.repo().default_branch}, <strong>{pluralize(pulse().files, 'file')}</strong> changed and there have been{' '}
          <strong class="text-fg-success">{formatNumber(pulse().additions)} additions</strong> and{' '}
          <strong class="text-fg-danger">{formatNumber(pulse().deletions)} deletions</strong>.
        </p>
        <div class="md:w-[300px] flex flex-wrap gap-1 content-start">
          <For each={pulse().authors.slice(0, 30)}>
            {(a) => (
              <a href={`/${a.login}`} title={`${a.login}: ${pluralize(a.commits, 'commit')}`}>
                <Avatar src={a.avatarUrl} size={24} />
              </a>
            )}
          </For>
        </div>
      </div>

      <ItemList title="merged pull requests" icon={gitMergeIcon} color="text-fg-done" verb="merged" items={pulse().mergedPrs.items} total={pulse().mergedPrs.count} />
      <ItemList title="opened pull requests" icon={gitPullRequestIcon} color="text-fg-open" verb="opened" items={pulse().openedPrs.items} total={pulse().openedPrs.count} />
      <ItemList title="closed issues" icon={issueClosedIcon} color="text-fg-done" verb="closed" items={pulse().closedIssues.items} total={pulse().closedIssues.count} />
      <ItemList title="opened issues" icon={issueOpenedIcon} color="text-fg-open" verb="opened" items={pulse().openedIssues.items} total={pulse().openedIssues.count} />
    </InsightsLayout>
  );
}

function Stat(props: { icon: typeof gitMergeIcon; color: string; count: number; label: string }) {
  return (
    <div class="p-4 border-r border-line-muted last:border-r-0">
      <div class="flex items-center justify-center gap-1 text-2xl font-normal">
        <Octicon icon={props.icon} size={24} class={props.color} />
        {formatNumber(props.count)}
      </div>
      <div class="text-xs text-fg-muted mt-1">{props.label}</div>
    </div>
  );
}

function ItemList(props: { title: string; icon: typeof gitMergeIcon; color: string; verb: string; items: PulseItem[]; total: number }) {
  return (
    <Show when={props.total}>
      <section class="mb-6">
        <h3 class="text-base font-semibold mb-2 flex items-center gap-2">
          <Octicon icon={props.icon} class={props.color} />
          {formatNumber(props.total)} {props.title}
        </h3>
        <ul class="Box">
          <For each={props.items}>
            {(item) => (
              <li class="Box-row flex items-center gap-2 py-2! text-sm">
                <Show when={item.author}>
                  {(a) => <Avatar src={a().avatarUrl} size={20} />}
                </Show>
                <a class="link-plain font-semibold flex-1 min-w-0 truncate" href={new URL(item.url).pathname}>
                  {item.title}
                </a>
                <span class="text-fg-muted text-xs whitespace-nowrap">
                  #{item.number} {props.verb} <RelativeTime datetime={item.mergedAt ?? item.closedAt ?? item.createdAt} />
                </span>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  );
}
