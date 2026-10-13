import { useLocation, useNavigate } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, For, Loading, Match, Show, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Blankslate, Dropdown, PageSpinner, Pagination, RelativeTime, pageHref } from '../../../components/ui';
import {
  calendarIcon,
  fileIcon,
  kebabHorizontalIcon,
  searchIcon,
  stopwatchIcon,
  trashIcon,
  workflowIcon,
} from '../../../icons/octicons';
import { encodePath } from '../../../lib/github';
import { formatNumber, shortSha } from '../../../lib/format';
import { getRefNames } from '../../repo/api';
import { useRepo } from '../../repo/context';
import { getRuns, getWorkflows, type RunFilters } from '../api';
import { buildRunQuery, duration, parseRunQuery, RUN_EVENTS, RUN_STATUSES, runState } from '../status';
import type { Workflow, WorkflowRun } from '../types';
import DeleteRunDialog from './DeleteRunDialog';
import FilterMenu from './FilterMenu';
import StatusIcon from './StatusIcon';

/**
 * The runs list of /actions and /actions/workflows/:file: search box, filter
 * menus (mapped to github.com's `?query=` syntax), rows and pagination.
 */
export default function RunsList(props: {
  /** Workflow id or file name for a single workflow's runs. */
  workflow?: string;
  heading: JSX.Element;
  actions?: JSX.Element;
  /** Notices between the heading and the list (dispatch bar, disabled workflow). */
  banner?: JSX.Element;
}) {
  const ctx = useRepo();
  const location = useLocation();
  const navigate = useNavigate();
  const filters = createMemo(() => parseRunQuery(String(location.query.query ?? '')));
  const page = createMemo(() => Math.max(1, Number(location.query.page) || 1));
  const workflows = createMemo(() => getWorkflows(ctx.owner(), ctx.name()));

  const setFilters = (next: Partial<RunFilters>) => {
    const f = { ...filters(), ...next };
    const q = buildRunQuery(f);
    navigate(`${location.pathname}${q ? `?query=${encodeURIComponent(q)}` : ''}`);
  };

  return (
    <>
      <div class="flex flex-wrap items-start gap-4 mb-4">
        <div class="flex-1 min-w-0">{props.heading}</div>
        <form
          class="relative w-full md:w-[300px]"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get('query');
            const q = String(value ?? '').trim();
            navigate(`${location.pathname}${q ? `?query=${encodeURIComponent(q)}` : ''}`);
          }}
        >
          <Octicon icon={searchIcon} class="absolute left-2 top-2 text-fg-muted" />
          <input
            name="query"
            class="form-control w-full pl-8!"
            placeholder="Filter workflow runs"
            aria-label="Filter workflow runs"
            value={String(location.query.query ?? '')}
          />
        </form>
        {props.actions}
      </div>
      {props.banner}

      <div class="Box">
        <Loading
          fallback={
            <>
              <div class="Box-header h-[56px]" />
              <PageSpinner />
            </>
          }
        >
          <RunsBox workflow={props.workflow} filters={filters()} page={page()} workflows={workflows()} onFilter={setFilters} />
        </Loading>
      </div>
    </>
  );
}

function RunsBox(props: {
  workflow?: string;
  workflows: Workflow[];
  filters: ReturnType<typeof parseRunQuery>;
  page: number;
  onFilter: (f: Partial<RunFilters>) => void;
}) {
  const ctx = useRepo();
  const location = useLocation();
  // `workflow:Name` on the all-workflows page narrows to that workflow.
  const workflowKey = createMemo(() => {
    if (props.workflow) return props.workflow;
    const name = props.filters.workflow;
    if (!name) return '';
    const w = props.workflows.find((x) => x.name.toLowerCase() === name.toLowerCase() || x.path.endsWith(`/${name}`));
    return w ? String(w.id) : '';
  });
  const runs = createMemo(() =>
    getRuns(
      ctx.owner(),
      ctx.name(),
      workflowKey(),
      { event: props.filters.event, status: props.filters.status, branch: props.filters.branch, actor: props.filters.actor },
      props.page,
    ),
  );
  const refs = createMemo(() => getRefNames(ctx.owner(), ctx.name()));
  const actors = createMemo(() => {
    const seen = new Set<string>();
    for (const r of runs().items) if (r.actor) seen.add(r.actor.login);
    return [...seen].sort().map((a) => ({ value: a, label: a }));
  });
  const [deleting, setDeleting] = createSignal<WorkflowRun | null>(null);
  const hasFilters = () =>
    !!(props.filters.event || props.filters.status || props.filters.branch || props.filters.actor || props.filters.workflow);

  return (
    <>
      <div class="Box-header flex flex-wrap items-center gap-2 py-2!">
        <h3 class="font-semibold flex-1 py-1">
          {formatNumber(runs().total ?? runs().items.length)} workflow run{runs().total === 1 ? '' : 's'}
        </h3>
        <div class="flex flex-wrap items-center">
          <Show when={!props.workflow}>
            <FilterMenu
              label="Workflow"
              title="Filter by workflow"
              filterable
              selected={props.filters.workflow}
              options={props.workflows.map((w) => ({ value: w.name, label: w.name }))}
              onSelect={(v) => props.onFilter({ workflow: v })}
            />
          </Show>
          <FilterMenu
            label="Event"
            title="Filter by event"
            filterable
            selected={props.filters.event}
            options={RUN_EVENTS.map((e) => ({ value: e, label: e }))}
            onSelect={(v) => props.onFilter({ event: v })}
          />
          <FilterMenu
            label="Status"
            title="Filter by status"
            selected={props.filters.status}
            options={RUN_STATUSES}
            onSelect={(v) => props.onFilter({ status: v })}
          />
          <Loading fallback={<button type="button" class="btn btn-sm btn-invisible text-fg-muted!" disabled>Branch</button>}>
            <FilterMenu
              label="Branch"
              title="Filter by branch"
              filterable
              allowCustom
              placeholder="Filter branches"
              selected={props.filters.branch}
              options={refs().branches.map((b: string) => ({ value: b, label: b }))}
              onSelect={(v) => props.onFilter({ branch: v })}
            />
          </Loading>
          <FilterMenu
            label="Actor"
            title="Filter by actor"
            filterable
            allowCustom
            placeholder="Filter actors"
            selected={props.filters.actor}
            options={actors()}
            onSelect={(v) => props.onFilter({ actor: v })}
          />
        </div>
      </div>
      <Show
        when={runs().items.length}
        fallback={
          <Blankslate icon={workflowIcon} title={hasFilters() ? 'No results matched your search.' : 'No workflow runs yet'}>
            {hasFilters()
              ? 'Try a different filter, or clear the filters to see all runs.'
              : 'Runs show up here once a workflow is triggered.'}
          </Blankslate>
        }
      >
        <ul>
          <For each={runs().items} keyed={(r) => r.id}>
            {(run) => (
              <RunRow
                run={run()}
                workflowName={props.workflows.find((w) => w.id === run().workflow_id)?.name ?? run().name ?? ''}
                onDelete={() => setDeleting(run())}
              />
            )}
          </For>
        </ul>
      </Show>
      <Show when={runs().pageInfo.hasNext || props.page > 1}>
        <div class="Box-footer flex justify-center py-2!">
          <Pagination pageInfo={runs().pageInfo} href={(p) => pageHref(location, p)} />
        </div>
      </Show>
      <DeleteRunDialog owner={ctx.owner()} repo={ctx.name()} run={deleting()} onClose={() => setDeleting(null)} />
    </>
  );
}

/** "Commit abc1234 pushed by octocat" — what triggered the run. */
export function RunTrigger(props: { run: WorkflowRun }) {
  const ctx = useRepo();
  const Actor = () => (
    <Show when={props.run.actor}>
      {(a) => (
        <>
          {' '}by{' '}
          <a class="link-muted underline" href={`/${a().login}`}>
            {a().login.replace(/\[bot\]$/, '')}
          </a>
          <Show when={a().type === 'Bot'}>
            {' '}
            <span class="Label py-0! leading-4! text-[11px]!">Bot</span>
          </Show>
        </>
      )}
    </Show>
  );
  return (
    <Switch
      fallback={
        <>
          {props.run.event.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}
          <Actor />
        </>
      }
    >
      <Match when={props.run.event === 'push'}>
        Commit{' '}
        <a class="link-muted underline" href={`${ctx.base()}/commit/${props.run.head_sha}`}>
          {shortSha(props.run.head_sha)}
        </a>{' '}
        pushed
        <Actor />
      </Match>
      <Match when={props.run.event.startsWith('pull_request')}>
        Pull request{' '}
        <Show when={props.run.pull_requests[0]}>
          {(pr) => (
            <a class="link-muted underline" href={`${ctx.base()}/pull/${pr().number}`}>
              #{pr().number}
            </a>
          )}
        </Show>{' '}
        <Show when={props.run.event === 'pull_request_target'}>(target) </Show>
        <Actor />
      </Match>
      <Match when={props.run.event === 'workflow_dispatch'}>
        Manually run
        <Actor />
      </Match>
      <Match when={props.run.event === 'schedule'}>Scheduled</Match>
    </Switch>
  );
}

function RunRow(props: { run: WorkflowRun; workflowName: string; onDelete: () => void }) {
  const ctx = useRepo();
  const href = () => `${ctx.base()}/actions/runs/${props.run.id}`;
  const state = () => runState(props.run.status, props.run.conclusion);
  const canWrite = () => !!ctx.repo().permissions?.push;
  return (
    <li class="Box-row Box-row--hover run-row">
      <div class="flex gap-2 min-w-0">
        <span class="mt-0.5">
          <StatusIcon state={state()} />
        </span>
        <div class="min-w-0">
          <a class="block font-semibold link-plain truncate text-base" href={href()} title={props.run.display_title}>
            {props.run.display_title}
          </a>
          <div class="text-xs text-fg-muted mt-0.5 truncate">
            <span class="font-semibold">{props.workflowName}</span> #{props.run.run_number}: <RunTrigger run={props.run} />
          </div>
        </div>
      </div>
      <div class="run-row-branch min-w-0">
        <Show when={props.run.head_branch}>
          {(b) => (
            <a class="branch-name max-w-full" href={`${ctx.base()}/tree/${encodePath(b())}`} title={b()}>
              {b()}
            </a>
          )}
        </Show>
      </div>
      <div class="run-row-meta text-xs text-fg-muted">
        <div class="flex items-center gap-1">
          <Octicon icon={calendarIcon} />
          <RelativeTime datetime={props.run.run_started_at ?? props.run.created_at} />
        </div>
        <div class="flex items-center gap-1 mt-1">
          <Octicon icon={stopwatchIcon} />
          <Switch fallback={<span>{duration(props.run.run_started_at ?? props.run.created_at, props.run.updated_at)}</span>}>
            <Match when={state() === 'action_required'}>
              <em>Action required</em>
            </Match>
            <Match when={state() === 'queued' || state() === 'waiting'}>
              <em>Queued</em>
            </Match>
            <Match when={state() === 'in_progress'}>
              <em>In progress</em>
            </Match>
          </Switch>
        </div>
      </div>
      <div>
        <Dropdown class="btn-octicon" align="right" menuClass="w-[220px]" title="Show options" button={<Octicon icon={kebabHorizontalIcon} />}>
          {(close) => (
            <>
              <a class="SelectMenu-item" href={`${ctx.base()}/blob/${props.run.head_sha}/${encodePath(props.run.path.replace(/@.*$/, ''))}`} onClick={close}>
                <Octicon icon={fileIcon} />
                View workflow file
              </a>
              <Show when={canWrite()}>
                <hr class="SelectMenu-divider" />
                <button
                  type="button"
                  class="SelectMenu-item danger"
                  onClick={() => {
                    close();
                    props.onDelete();
                  }}
                >
                  <Octicon icon={trashIcon} />
                  Delete workflow run
                </button>
              </Show>
            </>
          )}
        </Dropdown>
      </div>
    </li>
  );
}
