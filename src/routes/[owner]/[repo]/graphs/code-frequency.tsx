import { Title } from '@solidjs/meta';
import { createMemo, Show } from 'solid-js';
import { Blankslate } from '../../../../components/ui';
import { getCodeFrequency } from '../../../../features/insights/api';
import StatsPending from '../../../../features/insights/components/StatsPending';
import TimeChart from '../../../../features/insights/components/TimeChart';
import { useRepo } from '../../../../features/repo/context';
import { graphIcon } from '../../../../icons/octicons';
import { formatDate } from '../../../../lib/format';

/** /:owner/:repo/graphs/code-frequency — weekly additions (up) and deletions (down). */
export default function CodeFrequency() {
  const ctx = useRepo();
  const data = createMemo(() => getCodeFrequency(ctx.owner(), ctx.name()));
  return (
    <>
      <Title>{`Code frequency · ${ctx.fullName()}`}</Title>
      <div class="pb-2 mb-4 border-b border-line-muted">
        <h2 class="text-2xl font-semibold">Code frequency</h2>
        <p class="text-sm text-fg-muted">Additions and deletions per week to {ctx.repo().default_branch}</p>
      </div>
      <Show when={data()} fallback={<StatsPending queryKey="stats-code-frequency" />}>
        {(rows) => (
          <Show
            when={rows().length}
            fallback={
              <Blankslate icon={graphIcon} title="No code frequency data">
                Repositories with 10,000 or more commits don’t report code frequency.
              </Blankslate>
            }
          >
            <div class="Box p-4">
              <TimeChart
                label="Additions and deletions per week"
                dates={rows().map((r) => r[0] * 1000)}
                series={[
                  { label: 'Additions', color: 'var(--bgColor-success-emphasis)', values: rows().map((r) => r[1]) },
                  { label: 'Deletions', color: 'var(--bgColor-danger-emphasis)', values: rows().map((r) => r[2]) },
                ]}
                kind="area"
                height={320}
                formatDate={(ms) => `Week of ${formatDate(ms, { year: 'numeric' })}`}
              />
              <div class="flex gap-4 text-xs text-fg-muted mt-2">
                <span class="flex items-center gap-1">
                  <span class="inline-block w-2 h-2 rounded-sm bg-success-emphasis" /> Additions
                </span>
                <span class="flex items-center gap-1">
                  <span class="inline-block w-2 h-2 rounded-sm bg-danger-emphasis" /> Deletions
                </span>
              </div>
            </div>
          </Show>
        )}
      </Show>
    </>
  );
}
