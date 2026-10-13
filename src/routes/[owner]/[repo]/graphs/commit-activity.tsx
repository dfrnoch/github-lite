import { Title } from '@solidjs/meta';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { getCommitActivity } from '../../../../features/insights/api';
import StatsPending from '../../../../features/insights/components/StatsPending';
import TimeChart from '../../../../features/insights/components/TimeChart';
import { useRepo } from '../../../../features/repo/context';
import { formatDate, formatNumber } from '../../../../lib/format';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ACCENT = 'var(--bgColor-accent-emphasis)';

/** /:owner/:repo/graphs/commit-activity — last year of weekly commits + per-day breakdown. */
export default function CommitActivity() {
  const ctx = useRepo();
  const data = createMemo(() => getCommitActivity(ctx.owner(), ctx.name()));
  const [week, setWeek] = createSignal<number | null>(null);
  const weeks = () => data() ?? [];
  // Default to the most recent week that had commits.
  const lastActive = () => {
    for (let i = weeks().length - 1; i >= 0; i--) if (weeks()[i]!.total) return i;
    return weeks().length - 1;
  };
  const selected = () => weeks()[week() ?? lastActive()];
  const total = () => weeks().reduce((s, w) => s + w.total, 0);

  return (
    <>
      <Title>{`Commit activity · ${ctx.fullName()}`}</Title>
      <div class="pb-2 mb-4 border-b border-line-muted">
        <h2 class="text-2xl font-semibold">Commits</h2>
        <p class="text-sm text-fg-muted">
          Commits to {ctx.repo().default_branch}, excluding merge commits · {formatNumber(total())} in the last year
        </p>
      </div>
      <Show when={data()} fallback={<StatsPending queryKey="stats-commit-activity" />}>
        <div class="Box p-4 mb-4">
          <TimeChart
            label="Commits per week over the last year"
            dates={weeks().map((w) => w.week * 1000)}
            series={[{ label: 'Commits', color: ACCENT, values: weeks().map((w) => w.total) }]}
            kind="bar"
            height={220}
            formatDate={(ms) => `Week of ${formatDate(ms, { year: 'numeric' })}`}
          />
          <label class="flex items-center gap-2 text-sm mt-3">
            <span class="text-fg-muted">Week</span>
            <select
              class="form-select form-control-sm w-auto!"
              value={String(week() ?? lastActive())}
              onChange={(e) => setWeek(Number(e.currentTarget.value))}
            >
              <For each={weeks()}>
                {(w, i) => (
                  <option value={i()}>
                    {formatDate(w.week * 1000, { year: 'numeric' })} ({w.total})
                  </option>
                )}
              </For>
            </select>
          </label>
        </div>
        <Show when={selected()}>
          {(w) => (
            <div class="Box p-4">
              <h3 class="font-semibold mb-2">Week of {formatDate(w().week * 1000, { year: 'numeric' })}</h3>
              <TimeChart
                label="Commits per day in the selected week"
                dates={w().days.map((_, i) => w().week * 1000 + i * 86400000)}
                series={[{ label: 'Commits', color: ACCENT, values: w().days }]}
                kind="bar"
                height={180}
                formatDate={(ms) => DAYS[new Date(ms).getUTCDay()]!}
              />
            </div>
          )}
        </Show>
      </Show>
    </>
  );
}
