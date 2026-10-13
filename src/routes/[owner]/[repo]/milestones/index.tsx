import { Title } from '@solidjs/meta';
import { useSearchParams } from '@solidjs/router';
import { createMemo, For, Loading, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Blankslate, Dropdown, PageSpinner, RelativeTime } from '../../../../components/ui';
import { getMilestones } from '../../../../features/issues/api';
import { quote } from '../../../../features/issues/query';
import IssuesSubnav from '../../../../features/issues/components/IssuesSubnav';
import { DueDate, MilestoneActions, percentComplete, ProgressBar } from '../../../../features/issues/components/Milestones';
import { useRepo } from '../../../../features/repo/context';
import { checkIcon, milestoneIcon, triangleDownIcon } from '../../../../icons/octicons';
import { formatNumber } from '../../../../lib/format';
import type { Milestone } from '../../../../lib/types';

const SORTS: { value: string; label: string; sort: (a: Milestone, b: Milestone) => number }[] = [
  { value: 'due_date', label: 'Closest due date', sort: (a, b) => (a.due_on ? Date.parse(a.due_on) : Infinity) - (b.due_on ? Date.parse(b.due_on) : Infinity) },
  { value: 'furthest_due_date', label: 'Furthest due date', sort: (a, b) => (b.due_on ? Date.parse(b.due_on) : -Infinity) - (a.due_on ? Date.parse(a.due_on) : -Infinity) },
  { value: 'recently_updated', label: 'Recently updated', sort: (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) },
  { value: 'least_complete', label: 'Least complete', sort: (a, b) => percentComplete(a) - percentComplete(b) },
  { value: 'most_complete', label: 'Most complete', sort: (a, b) => percentComplete(b) - percentComplete(a) },
  { value: 'alpha', label: 'Alphabetically', sort: (a, b) => a.title.localeCompare(b.title) },
  { value: 'reverse_alpha', label: 'Reverse alphabetically', sort: (a, b) => b.title.localeCompare(a.title) },
  { value: 'most_issues', label: 'Most issues', sort: (a, b) => b.open_issues + b.closed_issues - (a.open_issues + a.closed_issues) },
  { value: 'least_issues', label: 'Least issues', sort: (a, b) => a.open_issues + a.closed_issues - (b.open_issues + b.closed_issues) },
];

/** /:owner/:repo/milestones */
export default function MilestonesPage() {
  const ctx = useRepo();
  const [params, setParams] = useSearchParams<{ state?: string; sort?: string }>();
  const state = () => (params.state === 'closed' ? 'closed' : 'open');
  const open = createMemo(() => getMilestones(ctx.owner(), ctx.name(), 'open'));
  const closed = createMemo(() => getMilestones(ctx.owner(), ctx.name(), 'closed'));
  const sorter = () => SORTS.find((s) => s.value === params.sort) ?? SORTS[0]!;
  const list = createMemo(() => [...(state() === 'open' ? open() : closed())].sort(sorter().sort));
  const canEdit = () => !!ctx.repo().permissions?.push || !!ctx.repo().permissions?.triage;

  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`Milestones · ${ctx.fullName()}`}</Title>
      <IssuesSubnav base={ctx.base()} active="milestones">
        <div class="flex-1" />
        <Show when={canEdit()}>
          <a class="btn btn-primary" href={`${ctx.base()}/milestones/new`}>
            New milestone
          </a>
        </Show>
      </IssuesSubnav>
      <div class="Box">
        <div class="Box-header flex items-center gap-4 py-2!">
          <Loading fallback={<span class="text-fg-muted text-sm">Loading…</span>}>
            <a class={['text-sm flex items-center gap-1.5', state() === 'open' ? 'link-plain font-semibold' : 'link-muted']} href={`${ctx.base()}/milestones?state=open`}>
              <Octicon icon={milestoneIcon} /> Open <span class="Counter">{formatNumber(open().length)}</span>
            </a>
            <a class={['text-sm flex items-center gap-1.5', state() === 'closed' ? 'link-plain font-semibold' : 'link-muted']} href={`${ctx.base()}/milestones?state=closed`}>
              <Octicon icon={checkIcon} /> Closed <span class="Counter">{formatNumber(closed().length)}</span>
            </a>
          </Loading>
          <div class="flex-1" />
          <Dropdown
            class="btn-invisible btn-sm text-fg-muted!"
            align="right"
            button={
              <>
                Sort <Octicon icon={triangleDownIcon} />
              </>
            }
          >
            {(close) => (
              <For each={SORTS}>
                {(s) => (
                  <button
                    type="button"
                    class="SelectMenu-item"
                    onClick={() => {
                      close();
                      setParams({ sort: s.value === 'due_date' ? undefined : s.value });
                    }}
                  >
                    <span class="w-4">
                      <Show when={sorter().value === s.value}>
                        <Octicon icon={checkIcon} />
                      </Show>
                    </span>
                    {s.label}
                  </button>
                )}
              </For>
            )}
          </Dropdown>
        </div>
        <Loading fallback={<PageSpinner />}>
          <For
            each={list()}
            fallback={
              <Blankslate icon={milestoneIcon} title={state() === 'open' ? 'You haven’t created any milestones.' : 'There are no closed milestones.'}>
                Use milestones to create collections of issues and pull requests for a particular release or project.
              </Blankslate>
            }
          >
            {(m) => (
              <div class="Box-row flex flex-col md:flex-row gap-4">
                <div class="flex-1 min-w-0">
                  <a class="link-plain text-xl font-normal" href={`${ctx.base()}/milestone/${m.number}`}>
                    {m.title}
                  </a>
                  <div class="text-sm text-fg-muted mt-1 flex flex-wrap gap-x-4">
                    <DueDate milestone={m} />
                    <span>
                      Last updated <RelativeTime datetime={m.updated_at} />
                    </span>
                  </div>
                  <Show when={m.description}>
                    <p class="mt-2 text-fg-muted whitespace-pre-line break-words">{m.description}</p>
                  </Show>
                </div>
                <div class="w-full md:w-[420px] shrink-0">
                  <ProgressBar percent={percentComplete(m)} class="mb-2" />
                  <div class="flex flex-wrap gap-4 text-sm text-fg-muted">
                    <span>
                      <strong class="text-fg">{percentComplete(m)}%</strong> complete
                    </span>
                    <a class="link-muted" href={`${ctx.base()}/milestone/${m.number}`}>
                      <strong class="text-fg">{m.open_issues}</strong> open
                    </a>
                    <a class="link-muted" href={`${ctx.base()}/milestone/${m.number}?q=${encodeURIComponent(`state:closed milestone:${quote(m.title)}`)}`}>
                      <strong class="text-fg">{m.closed_issues}</strong> closed
                    </a>
                  </div>
                  <Show when={canEdit()}>
                    <div class="mt-2">
                      <MilestoneActions owner={ctx.owner()} repo={ctx.name()} milestone={m} />
                    </div>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </Loading>
      </div>
    </div>
  );
}
