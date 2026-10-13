import { Title } from '@solidjs/meta';
import { createMemo, For, Show } from 'solid-js';
import { Blankslate } from '../../../../components/ui';
import { getTraffic, type TrafficSeries } from '../../../../features/insights/api';
import TimeChart from '../../../../features/insights/components/TimeChart';
import { useRepo } from '../../../../features/repo/context';
import { lockIcon } from '../../../../icons/octicons';
import { formatNumber } from '../../../../lib/format';

/** /:owner/:repo/graphs/traffic — views, clones, referrers, popular content (push access). */
export default function Traffic() {
  const ctx = useRepo();
  return (
    <>
      <Title>{`Traffic · ${ctx.fullName()}`}</Title>
      <div class="pb-2 mb-4 border-b border-line-muted">
        <h2 class="text-2xl font-semibold">Traffic</h2>
        <p class="text-sm text-fg-muted">Last 14 days</p>
      </div>
      <Show
        when={ctx.repo().permissions?.push}
        fallback={<Blankslate icon={lockIcon} title="Traffic is only visible to people with push access" />}
      >
        <TrafficBody />
      </Show>
    </>
  );
}

function TrafficBody() {
  const ctx = useRepo();
  const data = createMemo(() => getTraffic(ctx.owner(), ctx.name()));
  const Chart = (p: { title: string; data: TrafficSeries; unit: string }) => (
    <div class="Box p-4 mb-4">
      <div class="flex flex-wrap items-baseline gap-4 mb-2">
        <h3 class="font-semibold flex-1">{p.title}</h3>
        <span class="text-sm flex items-center gap-1">
          <span class="inline-block w-2 h-2 rounded-sm bg-success-emphasis" />
          <strong>{formatNumber(p.data.count)}</strong> <span class="text-fg-muted">{p.unit}</span>
        </span>
        <span class="text-sm flex items-center gap-1">
          <span class="inline-block w-2 h-2 rounded-sm bg-accent-emphasis" />
          <strong>{formatNumber(p.data.uniques)}</strong> <span class="text-fg-muted">Unique {p.unit.toLowerCase()}</span>
        </span>
      </div>
      <Show when={p.data.points.length} fallback={<p class="text-sm text-fg-muted">No data in the last 14 days.</p>}>
        <TimeChart
          label={`${p.title} per day`}
          dates={p.data.points.map((x) => new Date(x.timestamp).getTime())}
          series={[
            { label: p.unit, color: 'var(--bgColor-success-emphasis)', values: p.data.points.map((x) => x.count) },
            { label: `Unique ${p.unit.toLowerCase()}`, color: 'var(--bgColor-accent-emphasis)', values: p.data.points.map((x) => x.uniques) },
          ]}
          kind="line"
          height={200}
        />
      </Show>
    </div>
  );
  return (
    <>
      <Chart title="Git clones" data={data().clones} unit="Clones" />
      <Chart title="Visitors" data={data().views} unit="Views" />
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="Box">
          <div class="Box-header font-semibold">Referring sites</div>
          <For each={data().referrers} fallback={<div class="Box-row text-sm text-fg-muted">No referrers yet.</div>}>
            {(r) => (
              <div class="Box-row flex text-sm py-2!">
                <span class="flex-1 truncate">{r.referrer}</span>
                <span class="w-16 text-right">{formatNumber(r.count)}</span>
                <span class="w-16 text-right text-fg-muted">{formatNumber(r.uniques)}</span>
              </div>
            )}
          </For>
        </div>
        <div class="Box">
          <div class="Box-header font-semibold">Popular content</div>
          <For each={data().paths} fallback={<div class="Box-row text-sm text-fg-muted">No content views yet.</div>}>
            {(r) => (
              <div class="Box-row flex text-sm py-2!">
                <a class="flex-1 truncate" href={r.path} title={r.title}>
                  {r.path.split('/').slice(3).join('/') || r.title}
                </a>
                <span class="w-16 text-right">{formatNumber(r.count)}</span>
                <span class="w-16 text-right text-fg-muted">{formatNumber(r.uniques)}</span>
              </div>
            )}
          </For>
        </div>
      </div>
    </>
  );
}
