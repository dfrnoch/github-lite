import { revalidate, useAction, useLocation, useNavigate, useParams } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, createSignal, For, isPending, Loading, onSettled, Show } from 'solid-js';
import { Title } from '@solidjs/meta';
import Octicon from '../../../components/Octicon';
import { Dropdown, PageSpinner, Spinner, toastError } from '../../../components/ui';
import {
  arrowLeftIcon,
  checkIcon,
  fileIcon,
  gitPullRequestIcon,
  homeIcon,
  kebabHorizontalIcon,
  syncIcon,
  trashIcon,
  triangleDownIcon,
  xIcon,
} from '../../../icons/octicons';
import { encodePath } from '../../../lib/github';
import { useHotkey } from '../../../lib/hotkeys';
import { useRepo } from '../../repo/context';
import { cancelRun, deleteRunLogs, getRun, getRunJobs, getWorkflows, rerunRun } from '../api';
import { RunContext, type RunContextValue } from '../context';
import { isDone, runState } from '../status';
import type { WorkflowRun } from '../types';
import '../actions.css';
import { workflowFile } from './ActionsShell';
import DeleteRunDialog from './DeleteRunDialog';
import RerunDialog from './RerunDialog';
import StatusIcon from './StatusIcon';

const POLL_MS = 5000;

/**
 * Frame of a workflow run (/actions/runs/:id and its job pages): header with
 * the run actions, jobs sidebar, and polling while the run is not finished.
 */
export default function RunLayout(props: { children: JSX.Element }) {
  const ctx = useRepo();
  const params = useParams<{ id: string }>();
  const location = useLocation();
  const attempt = createMemo(() => Number(/\/attempts\/(\d+)/.exec(location.pathname)?.[1] ?? 0));
  const jobId = createMemo(() => /\/job\/(\d+)/.exec(location.pathname)?.[1] ?? '');
  const latestRun = createMemo(() => getRun(ctx.owner(), ctx.name(), params.id, 0));
  const run = createMemo(() => (attempt() ? getRun(ctx.owner(), ctx.name(), params.id, attempt()) : latestRun()));
  const jobs = createMemo(() => getRunJobs(ctx.owner(), ctx.name(), params.id, attempt()));
  const href = () => `${ctx.base()}/actions/runs/${params.id}`;

  // Poll while the run is queued / in progress.
  let running = false;
  createEffect(
    () => run().status,
    (status) => {
      running = !isDone(status);
    },
  );
  onSettled(() => {
    const timer = setInterval(() => {
      if (!running || document.hidden) return;
      revalidate([
        getRun.keyFor(ctx.owner(), ctx.name(), params.id, 0),
        getRun.keyFor(ctx.owner(), ctx.name(), params.id, attempt()),
        getRunJobs.keyFor(ctx.owner(), ctx.name(), params.id, attempt()),
      ]);
    }, POLL_MS);
    return () => clearInterval(timer);
  });

  const value: RunContextValue = { id: () => params.id, attempt, run, jobs, href };

  return (
    <RunContext value={value}>
      <Title>{`${run().display_title} · ${ctx.fullName()}@${run().head_sha.slice(0, 7)}`}</Title>
      <RunHeader run={run()} attempt={attempt()} attempts={latestRun().run_attempt} />
      <div class="flex flex-col md:flex-row gap-6 px-4 md:px-6 lg:px-8 pb-8">
        <aside class="md:w-[288px] shrink-0">
          <nav aria-label="Workflow run">
            <ul class="NavList">
              <li>
                <a
                  class="NavList-item"
                  href={attempt() ? `${href()}/attempts/${attempt()}` : href()}
                  aria-current={!jobId() ? 'page' : undefined}
                >
                  <Octicon icon={homeIcon} />
                  Summary
                </a>
              </li>
            </ul>
            <div class="NavList-heading mt-2">All jobs</div>
            <hr class="NavList-divider mt-0!" />
            <Loading fallback={<div class="px-2 text-sm text-fg-muted">Loading jobs…</div>}>
              {/* Acknowledges the background refresh while the run is polled. */}
              <Show when={isPending(() => [run(), jobs()])}>
                <div class="flex items-center gap-2 px-2 pb-1 text-xs text-fg-muted">
                  <Spinner size={12} /> Updating…
                </div>
              </Show>
              <ul class="NavList">
                <For each={jobs()} keyed={(j) => j.id}>
                  {(job) => (
                    <li>
                      <a
                        class="NavList-item"
                        href={`${href()}/job/${job().id}`}
                        aria-current={jobId() === String(job().id) ? 'page' : undefined}
                        title={job().name}
                      >
                        <StatusIcon status={job().status} conclusion={job().conclusion} />
                        <span class="truncate">{job().name}</span>
                      </a>
                    </li>
                  )}
                </For>
              </ul>
            </Loading>
            <hr class="NavList-divider" />
            <div class="NavList-heading">Run details</div>
            <ul class="NavList">
              <li>
                <a class="NavList-item" href={`${ctx.base()}/blob/${run().head_sha}/${encodePath(run().path.replace(/@.*$/, ''))}`}>
                  <Octicon icon={fileIcon} />
                  Workflow file
                </a>
              </li>
            </ul>
          </nav>
        </aside>
        <div class="flex-1 min-w-0">
          <Loading fallback={<PageSpinner />}>{props.children}</Loading>
        </div>
      </div>
    </RunContext>
  );
}

function RunHeader(props: { run: WorkflowRun; attempt: number; attempts: number }) {
  const ctx = useRepo();
  const navigate = useNavigate();
  const canWrite = () => !!ctx.repo().permissions?.push;
  const state = () => runState(props.run.status, props.run.conclusion);
  const failed = () => ['failure', 'cancelled', 'timed_out', 'startup_failure'].includes(state());
  const latest = () => !props.attempt || props.attempt === props.attempts;
  const workflowHref = () =>
    props.run.path.startsWith('.github/')
      ? `${ctx.base()}/actions/workflows/${workflowFile(props.run.path.replace(/@.*$/, ''))}`
      : `${ctx.base()}/actions`;
  const [rerun, setRerun] = createSignal<'all' | 'failed' | null>(null);
  const [deleting, setDeleting] = createSignal(false);
  const rerunAction = useAction(rerunRun);
  const cancel = useAction(cancelRun);
  const deleteLogs = useAction(deleteRunLogs);
  const [cancelling, setCancelling] = createSignal(false);
  // `run.name` is the run-name when the workflow sets one; the back link names the workflow.
  const workflows = createMemo(() => getWorkflows(ctx.owner(), ctx.name()));
  const workflowName = () => workflows().find((w) => w.id === props.run.workflow_id)?.name ?? props.run.name;
  const location = useLocation();
  // The PR this run was opened from (?pr=), else the run's own PR.
  const pullNumber = () => Number(location.query.pr) || props.run.pull_requests[0]?.number || null;
  const canRerunFailed = () => canWrite() && latest() && isDone(props.run.status) && failed();
  useHotkey({
    keys: 'r f',
    description: 'Re-run failed jobs',
    group: 'Actions',
    when: canRerunFailed,
    handler: () => setRerun('failed'),
  });

  return (
    <div class="px-4 md:px-6 lg:px-8 pt-4 pb-6">
      <div class="flex flex-wrap items-center gap-x-3 mb-1 text-sm">
        <a class="link-muted inline-flex items-center gap-1" href={workflowHref()}>
          <Octicon icon={arrowLeftIcon} />
          <Loading fallback={props.run.name}>{workflowName()}</Loading>
        </a>
        <Show when={pullNumber()}>
          {(n) => (
            <a class="link-muted inline-flex items-center gap-1" href={`${ctx.base()}/pull/${n()}`} title="Pull request that ran this workflow">
              <Octicon icon={gitPullRequestIcon} />
              Pull request #{n()}
            </a>
          )}
        </Show>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="flex-1 min-w-0 flex items-center gap-2 text-xl md:text-2xl break-words">
          <StatusIcon state={state()} size={24} />
          <span class="min-w-0">
            <span class="font-semibold">{props.run.display_title}</span>{' '}
            <span class="text-fg-muted font-normal">#{props.run.run_number}</span>
          </span>
        </h1>
        <div class="flex flex-wrap items-center gap-2">
          <Show when={props.attempts > 1}>
            <AttemptPicker run={props.run} attempt={props.attempt} attempts={props.attempts} />
          </Show>
          <Show when={canWrite() && latest()}>
            <Show
              when={isDone(props.run.status)}
              fallback={
                <button
                  type="button"
                  class="btn btn-sm"
                  disabled={cancelling()}
                  onClick={async () => {
                    setCancelling(true);
                    try {
                      await cancel(ctx.owner(), ctx.name(), props.run.id, false);
                    } catch (e) {
                      toastError(e);
                    } finally {
                      setCancelling(false);
                    }
                  }}
                >
                  <Octicon icon={xIcon} />
                  {cancelling() ? 'Cancelling…' : 'Cancel workflow'}
                </button>
              }
            >
              <Show
                when={failed()}
                fallback={
                  <button type="button" class="btn btn-sm" onClick={() => setRerun('all')}>
                    <Octicon icon={syncIcon} />
                    Re-run all jobs
                  </button>
                }
              >
                <button type="button" class="btn btn-sm" onClick={() => setRerun('failed')} title="Re-run failed jobs (r f)">
                  <Octicon icon={syncIcon} />
                  Re-run failed jobs
                </button>
                <button type="button" class="btn btn-sm" onClick={() => setRerun('all')}>
                  Re-run all jobs
                </button>
              </Show>
            </Show>
          </Show>
          <Dropdown class="btn btn-sm px-2!" align="right" menuClass="w-[240px]" title="Show options" button={<Octicon icon={kebabHorizontalIcon} />}>
            {(close) => (
              <>
                <a class="SelectMenu-item" href={`${ctx.base()}/blob/${props.run.head_sha}/${encodePath(props.run.path.replace(/@.*$/, ''))}`} onClick={close}>
                  <Octicon icon={fileIcon} />
                  View workflow file
                </a>
                <Show when={canWrite() && isDone(props.run.status)}>
                  <hr class="SelectMenu-divider" />
                  <button
                    type="button"
                    class="SelectMenu-item danger"
                    onClick={async () => {
                      close();
                      if (!confirm('Are you sure you want to delete all logs of this workflow run?')) return;
                      try {
                        await deleteLogs(ctx.owner(), ctx.name(), props.run.id);
                      } catch (e) {
                        toastError(e);
                      }
                    }}
                  >
                    <Octicon icon={trashIcon} />
                    Delete all logs
                  </button>
                  <button type="button" class="SelectMenu-item danger" onClick={() => (close(), setDeleting(true))}>
                    <Octicon icon={trashIcon} />
                    Delete workflow run
                  </button>
                </Show>
              </>
            )}
          </Dropdown>
        </div>
      </div>
      <RerunDialog
        open={rerun() !== null}
        title={rerun() === 'failed' ? 'Re-run failed jobs' : 'Re-run all jobs'}
        description={
          rerun() === 'failed'
            ? 'A new attempt of this workflow will be started, including all failed jobs and their dependents.'
            : 'A new attempt of this workflow will be started, including all jobs.'
        }
        onClose={() => setRerun(null)}
        onConfirm={(debug) => rerunAction(ctx.owner(), ctx.name(), props.run.id, rerun() === 'failed', debug)}
      />
      <DeleteRunDialog
        owner={ctx.owner()}
        repo={ctx.name()}
        run={deleting() ? props.run : null}
        onClose={() => setDeleting(false)}
        onDeleted={() => navigate(workflowHref())}
      />
    </div>
  );
}

function AttemptPicker(props: { run: WorkflowRun; attempt: number; attempts: number }) {
  const ctx = useRepo();
  const current = () => props.attempt || props.attempts;
  const base = () => `${ctx.base()}/actions/runs/${props.run.id}`;
  const attempts = () => {
    const n = props.attempts;
    return Array.from({ length: n }, (_, i) => n - i);
  };
  return (
    <Dropdown
      class="btn btn-sm"
      align="right"
      menuClass="w-[200px]"
      header="Attempts"
      button={
        <>
          {current() === props.attempts ? 'Latest' : 'Attempt'} #{current()}
          <Octicon icon={triangleDownIcon} />
        </>
      }
    >
      {(close) => (
        <For each={attempts()}>
          {(n) => (
            <a class="SelectMenu-item" href={n === props.attempts ? base() : `${base()}/attempts/${n}`} onClick={close}>
              <span class="w-4">
                <Show when={n === current()}>
                  <Octicon icon={checkIcon} />
                </Show>
              </span>
              Attempt #{n}
              <Show when={n === props.attempts}>
                <span class="Label ml-auto">Latest</span>
              </Show>
            </a>
          )}
        </For>
      )}
    </Dropdown>
  );
}
