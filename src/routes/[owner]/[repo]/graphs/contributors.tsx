import { Title } from '@solidjs/meta';
import { createMemo, createSignal, For, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Avatar, Blankslate, Dropdown } from '../../../../components/ui';
import { getContributorStats } from '../../../../features/insights/api';
import StatsPending from '../../../../features/insights/components/StatsPending';
import TimeChart from '../../../../features/insights/components/TimeChart';
import { useRepo } from '../../../../features/repo/context';
import { checkIcon, peopleIcon, triangleDownIcon } from '../../../../icons/octicons';
import { formatDate, formatNumber, pluralize } from '../../../../lib/format';

const PERIODS = [
  { months: 0, label: 'All' },
  { months: 1, label: 'Last month' },
  { months: 3, label: 'Last 3 months' },
  { months: 6, label: 'Last 6 months' },
  { months: 12, label: 'Last 12 months' },
  { months: 24, label: 'Last 24 months' },
];
const METRICS = [
  { key: 'c', label: 'Commits' },
  { key: 'a', label: 'Additions' },
  { key: 'd', label: 'Deletions' },
] as const;
type Metric = (typeof METRICS)[number]['key'];

const ACCENT = 'var(--bgColor-accent-emphasis)';
const WEEK = 7 * 24 * 3600 * 1000;

/** /:owner/:repo/graphs/contributors */
export default function ContributorsGraph() {
  const ctx = useRepo();
  const stats = createMemo(() => getContributorStats(ctx.owner(), ctx.name()));
  const [months, setMonths] = createSignal(0);
  const [metric, setMetric] = createSignal<Metric>('c');

  /** Week timestamps (ms) within the selected period. */
  const weeks = createMemo(() => {
    const all = stats()?.[0]?.weeks.map((w) => w.w * 1000) ?? [];
    if (!months()) return all;
    const from = new Date();
    from.setMonth(from.getMonth() - months());
    return all.filter((w) => w >= from.getTime() - WEEK);
  });
  const offset = () => (stats()?.[0]?.weeks.length ?? 0) - weeks().length;
  const ranked = createMemo(() => {
    const m = metric();
    const off = offset();
    return (stats() ?? [])
      .map((c) => {
        const ws = c.weeks.slice(off);
        return {
          c,
          commits: ws.reduce((s, w) => s + w.c, 0),
          additions: ws.reduce((s, w) => s + w.a, 0),
          deletions: ws.reduce((s, w) => s + w.d, 0),
          values: ws.map((w) => w[m]),
        };
      })
      .filter((r) => r.commits > 0)
      .sort((a, b) => (m === 'c' ? b.commits - a.commits : m === 'a' ? b.additions - a.additions : b.deletions - a.deletions));
  });
  const totals = createMemo(() => {
    const m = metric();
    const off = offset();
    const all = stats() ?? [];
    return weeks().map((_, i) => all.reduce((s, c) => s + (c.weeks[i + off]?.[m] ?? 0), 0));
  });
  const sharedMax = createMemo(() => Math.max(1, ...ranked().flatMap((r) => r.values)));
  const metricLabel = () => METRICS.find((m) => m.key === metric())!.label;

  return (
    <>
      <Title>{`Contributors to ${ctx.fullName()}`}</Title>
      <div class="flex flex-wrap items-start gap-2 mb-4">
        <div class="flex-1 min-w-0">
          <h2 class="text-2xl font-semibold">Contributors</h2>
          <p class="text-sm text-fg-muted">
            Contributions per week to {ctx.repo().default_branch}, excluding merge commits
          </p>
        </div>
        <Dropdown
          class="btn"
          align="right"
          menuClass="w-48"
          button={
            <>
              Period: {PERIODS.find((p) => p.months === months())!.label} <Octicon icon={triangleDownIcon} />
            </>
          }
        >
          {(close) => (
            <For each={PERIODS}>
              {(p) => (
                <button type="button" class="SelectMenu-item" onClick={() => (setMonths(p.months), close())}>
                  <span class="w-4">
                    <Show when={months() === p.months}>
                      <Octicon icon={checkIcon} />
                    </Show>
                  </span>
                  {p.label}
                </button>
              )}
            </For>
          )}
        </Dropdown>
        <Dropdown
          class="btn"
          align="right"
          menuClass="w-48"
          button={
            <>
              Contributions: {metricLabel()} <Octicon icon={triangleDownIcon} />
            </>
          }
        >
          {(close) => (
            <For each={METRICS}>
              {(m) => (
                <button type="button" class="SelectMenu-item" onClick={() => (setMetric(m.key), close())}>
                  <span class="w-4">
                    <Show when={metric() === m.key}>
                      <Octicon icon={checkIcon} />
                    </Show>
                  </span>
                  {m.label}
                </button>
              )}
            </For>
          )}
        </Dropdown>
      </div>

      <Show when={stats()} fallback={<StatsPending queryKey="stats-contributors" />}>
        <Show when={ranked().length} fallback={<Blankslate icon={peopleIcon} title="No contributions in this period" />}>
          <div class="Box p-4 mb-4">
            <h3 class="font-semibold">{metricLabel()} over time</h3>
            <p class="text-xs text-fg-muted mb-2">
              Weekly from {formatDate(weeks()[0]!, { year: 'numeric' })} to {formatDate(weeks()[weeks().length - 1]!, { year: 'numeric' })}
            </p>
            <TimeChart
              label={`${metricLabel()} per week`}
              dates={weeks()}
              series={[{ label: metricLabel(), color: ACCENT, values: totals() }]}
              kind="area"
              height={220}
              formatDate={(ms) => `Week of ${formatDate(ms, { year: 'numeric' })}`}
            />
          </div>
          <ol class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <For each={ranked()}>
              {(r, i) => (
                <li class="Box p-4">
                  <div class="flex items-start gap-3 mb-2">
                    <Avatar src={r.c.author?.avatar_url} size={38} />
                    <div class="flex-1 min-w-0">
                      <a class="font-semibold text-base" href={r.c.author ? `/${r.c.author.login}` : undefined}>
                        {r.c.author?.login ?? 'Unknown'}
                      </a>
                      <p class="text-xs text-fg-muted">
                        <a class="link-muted" href={`${ctx.base()}/commits?author=${r.c.author?.login ?? ''}`}>
                          {pluralize(r.commits, 'commit')}
                        </a>{' '}
                        <span class="text-fg-success">{formatNumber(r.additions)} ++</span>{' '}
                        <span class="text-fg-danger">{formatNumber(r.deletions)} --</span>
                      </p>
                    </div>
                    <span class="Counter">#{i() + 1}</span>
                  </div>
                  <TimeChart
                    label={`${metricLabel()} per week by ${r.c.author?.login ?? 'unknown'}`}
                    dates={weeks()}
                    series={[{ label: metricLabel(), color: ACCENT, values: r.values }]}
                    kind="area"
                    height={110}
                    yMax={sharedMax()}
                    compact
                    formatDate={(ms) => `Week of ${formatDate(ms, { year: 'numeric' })}`}
                  />
                </li>
              )}
            </For>
          </ol>
        </Show>
      </Show>
    </>
  );
}
