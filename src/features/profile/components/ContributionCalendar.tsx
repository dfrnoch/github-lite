import type { JSX } from '@solidjs/web';
import { createMemo, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { gitCommitIcon, gitPullRequestIcon, issueOpenedIcon, repoIcon } from '../../../icons/octicons';
import { formatNumber, pluralize } from '../../../lib/format';
import type { ContributionLevel, Contributions } from '../api';

const LEVEL: Record<ContributionLevel, number> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

const CELL = 10;
const GAP = 3;
const STEP = CELL + GAP;
const LEFT = 30;
const TOP = 22;

const cellStyle = (level: number) => ({
  fill: `var(--contribution-default-bgColor-${level})`,
  stroke: `var(--contribution-default-borderColor-${level})`,
});

const dayLabel = (date: string, count: number) => {
  const d = new Date(`${date}T00:00:00`);
  const when = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const ord = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
  };
  const text = when.replace(/\d+$/, (n) => ord(Number(n)));
  return count ? `${pluralize(count, 'contribution')} on ${text}.` : `No contributions on ${text}.`;
};

/** GitHub's green contribution heatmap (one column per week, Sunday on top). */
export function ContributionGraph(props: { data: Contributions }) {
  const width = () => LEFT + props.data.weeks.length * STEP;
  const height = TOP + 7 * STEP;
  // Month labels sit over the first week that starts in that month; labels
  // closer than two weeks to the previous one are dropped (as on github.com).
  const monthLabels = createMemo(() => {
    const out: { x: number; name: string }[] = [];
    let lastIndex = -10;
    props.data.weeks.forEach((week, i) => {
      const first = week[0];
      if (!first) return;
      const d = new Date(`${first.date}T00:00:00`);
      const prev = props.data.weeks[i - 1]?.[0];
      const changed = !prev || new Date(`${prev.date}T00:00:00`).getMonth() !== d.getMonth();
      if (changed && i - lastIndex >= 3 && (i > 0 || d.getDate() <= 7)) {
        out.push({ x: LEFT + i * STEP, name: d.toLocaleDateString('en-US', { month: 'short' }) });
        lastIndex = i;
      }
    });
    return out;
  });

  return (
    // Narrow screens scroll; start at the most recent weeks like github.com.
    <div class="overflow-x-auto" ref={(el) => requestAnimationFrame(() => (el.scrollLeft = el.scrollWidth))}>
      <svg width={width()} height={height} class="block mx-auto text-xs" role="img" aria-label="Contribution graph">
        <For each={monthLabels()}>
          {(m) => (
            <text x={m.x} y={12} class="fill-fg">
              {m.name}
            </text>
          )}
        </For>
        <For each={[{ d: 1, n: 'Mon' }, { d: 3, n: 'Wed' }, { d: 5, n: 'Fri' }]}>
          {(l) => (
            <text x={0} y={TOP + l.d * STEP + CELL - 1} class="fill-fg">
              {l.n}
            </text>
          )}
        </For>
        <For each={props.data.weeks}>
          {(week, i) => (
            <g transform={`translate(${LEFT + i() * STEP}, ${TOP})`}>
              <For each={week}>
                {(day) => (
                  <rect
                    x={0}
                    y={day.weekday * STEP}
                    width={CELL}
                    height={CELL}
                    rx={2}
                    ry={2}
                    stroke-width={1}
                    style={cellStyle(LEVEL[day.level])}
                    data-date={day.date}
                    data-level={LEVEL[day.level]}
                  >
                    <title>{dayLabel(day.date, day.count)}</title>
                  </rect>
                )}
              </For>
            </g>
          )}
        </For>
      </svg>
    </div>
  );
}

function Legend() {
  return (
    <div class="flex items-center gap-1 text-xs text-fg-muted">
      <span class="mr-1">Less</span>
      <For each={[0, 1, 2, 3, 4]}>
        {(l) => (
          <svg width={CELL} height={CELL}>
            <rect width={CELL} height={CELL} rx={2} ry={2} style={cellStyle(l)} stroke-width={1} />
          </svg>
        )}
      </For>
      <span class="ml-1">More</span>
    </div>
  );
}

/** "1,620 contributions in the last year" + heatmap box + year picker. */
export default function ContributionCalendar(props: {
  data: Contributions;
  year?: number;
  /** Link for a year in the picker (`undefined` = last year). */
  yearHref: (year?: number) => string;
  /** Rendered under the calendar, left of the year picker (activity summary). */
  children?: JSX.Element;
}) {
  return (
    <div class="flex gap-6">
      <div class="flex-1 min-w-0">
        <h2 class="text-base font-normal mb-2">
          {formatNumber(props.data.total)} contributions in {props.year ? props.year : 'the last year'}
        </h2>
        <div class="Box px-4 pt-4 pb-3">
          <ContributionGraph data={props.data} />
          <div class="flex items-center justify-between mt-2 ml-8 flex-wrap gap-2">
            <a
              class="link-muted text-xs"
              href="https://docs.github.com/articles/why-are-my-contributions-not-showing-up-on-my-profile"
              target="_blank"
              rel="noreferrer"
            >
              Learn how we count contributions
            </a>
            <Legend />
          </div>
        </div>
        {props.children}
      </div>
      <Show when={props.data.years.length > 1}>
        <ul class="hidden lg:block w-[116px] shrink-0 mt-8 self-start sticky top-4">
          <For each={props.data.years}>
            {(y, i) => {
              const selected = () => (props.year ? props.year === y : i() === 0);
              return (
                <li>
                  <a
                    class={[
                      'block px-4 py-2 mb-1 rounded-md text-xs no-underline!',
                      selected() ? 'bg-accent-emphasis text-fg-on-emphasis font-semibold' : 'text-fg-muted hover:bg-canvas-muted',
                    ]}
                    href={props.yearHref(i() === 0 ? undefined : y)}
                  >
                    {y}
                  </a>
                </li>
              );
            }}
          </For>
        </ul>
      </Show>
    </div>
  );
}

/** Condensed "Contribution activity" summary for the selected period. */
export function ContributionActivity(props: { data: Contributions }) {
  const Section = (p: {
    icon: typeof repoIcon;
    title: string;
    rows: { repo: string; count: number }[];
    unit: (n: number) => string;
    href: (repo: string) => string;
  }) => {
    const max = () => Math.max(1, ...p.rows.map((r) => r.count));
    return (
      <div class="flex gap-3 py-4">
        <span class="w-8 h-8 shrink-0 rounded-full bg-canvas-muted border border-line-muted flex items-center justify-center text-fg-muted">
          <Octicon icon={p.icon} />
        </span>
        <div class="flex-1 min-w-0">
          <h4 class="text-base mt-1 mb-2">{p.title}</h4>
          <ul>
            <For each={p.rows}>
              {(r) => (
                <li class="flex items-center gap-2 py-1 text-sm">
                  <a class="truncate w-1/2" href={`/${r.repo}`}>
                    {r.repo}
                  </a>
                  <a class="link-muted text-xs whitespace-nowrap" href={p.href(r.repo)}>
                    {p.unit(r.count)}
                  </a>
                  <span class="flex-1">
                    <span
                      class="block h-2 rounded-md bg-success-emphasis"
                      style={{ width: `${Math.max(4, (r.count / max()) * 100)}%`, opacity: 0.85 }}
                    />
                  </span>
                </li>
              )}
            </For>
          </ul>
        </div>
      </div>
    );
  };
  const a = () => props.data.activity;
  const nothing = () => !a().totalCommits && !a().totalPulls && !a().totalIssues && !a().created.length;
  return (
    <div class="mt-6">
      <h2 class="text-base font-normal mb-2">Contribution activity</h2>
      <Show
        when={!nothing()}
        fallback={<p class="text-fg-muted text-sm py-4 border-t border-line-muted">No public activity in this period.</p>}
      >
        <div class="border-t border-line-muted divide-y divide-line-muted">
          <Show when={a().totalCommits}>
            <Section
              icon={gitCommitIcon}
              title={`Created ${pluralize(a().totalCommits, 'commit')} in ${pluralize(a().commits.length, 'repository', 'repositories')}`}
              rows={a().commits}
              unit={(n) => pluralize(n, 'commit')}
              href={(repo) => `/${repo}/commits`}
            />
          </Show>
          <Show when={a().created.length}>
            <div class="flex gap-3 py-4">
              <span class="w-8 h-8 shrink-0 rounded-full bg-canvas-muted border border-line-muted flex items-center justify-center text-fg-muted">
                <Octicon icon={repoIcon} />
              </span>
              <div class="flex-1 min-w-0">
                <h4 class="text-base mt-1 mb-2">Created {pluralize(a().created.length, 'repository', 'repositories')}</h4>
                <ul>
                  <For each={a().created}>
                    {(c) => (
                      <li class="py-1 text-sm">
                        <a href={`/${c.repo}`}>{c.repo}</a>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            </div>
          </Show>
          <Show when={a().totalPulls}>
            <Section
              icon={gitPullRequestIcon}
              title={`Opened ${pluralize(a().totalPulls, 'pull request')} in ${pluralize(a().pulls.length, 'repository', 'repositories')}`}
              rows={a().pulls}
              unit={(n) => pluralize(n, 'pull request')}
              href={(repo) => `/${repo}/pulls`}
            />
          </Show>
          <Show when={a().totalIssues}>
            <Section
              icon={issueOpenedIcon}
              title={`Opened ${pluralize(a().totalIssues, 'issue')} in ${pluralize(a().issues.length, 'repository', 'repositories')}`}
              rows={a().issues}
              unit={(n) => pluralize(n, 'issue')}
              href={(repo) => `/${repo}/issues`}
            />
          </Show>
          <Show when={a().reviews}>
            <div class="flex gap-3 py-4 text-sm">
              <span class="w-8 h-8 shrink-0 rounded-full bg-canvas-muted border border-line-muted flex items-center justify-center text-fg-muted">
                <Octicon icon={gitPullRequestIcon} />
              </span>
              <h4 class="text-base mt-1">Reviewed {pluralize(a().reviews, 'pull request')}</h4>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
