import { useAction, useLocation } from '@solidjs/router';
import { createEffect, createMemo, createSignal, For, Loading, Match, Show, Switch } from 'solid-js';
import { Title } from '@solidjs/meta';
import Octicon from '../../../components/Octicon';
import { Dropdown, RelativeTime, Spinner } from '../../../components/ui';
import {
  checkIcon,
  chevronDownIcon,
  chevronRightIcon,
  downloadIcon,
  gearIcon,
  linkExternalIcon,
  searchIcon,
  syncIcon,
} from '../../../icons/octicons';
import { useRepo } from '../../repo/context';
import { escapeHtml } from '../ansi';
import { getJob, getJobLogs, type JobLogResult, rerunJob } from '../api';
import { useRun } from '../context';
import { type LogLine, splitLogBySteps, type StepLog } from '../logs';
import { duration, isDone, runState, stateVerb } from '../status';
import type { Job, JobStep } from '../types';
import RerunDialog from './RerunDialog';
import StatusIcon from './StatusIcon';

/** Lines rendered per step before "Show more" (very long logs would stall the page). */
const LINE_BATCH = 3000;

/** Wrap matches of `term` in <mark>, touching only text between tags. */
function highlight(html: string, term: string) {
  if (!term) return html;
  const needle = escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(needle, 'gi');
  return html
    .split(/(<[^>]+>)/)
    .map((part) => (part.startsWith('<') ? part : part.replace(re, (m) => `<mark>${m}</mark>`)))
    .join('');
}

/** /actions/runs/:id/job/:jobId — steps with their (folded, colored) logs. */
export default function JobLogs(props: { jobId: string }) {
  const ctx = useRepo();
  const rc = useRun();
  // The run layout already loads (and polls) the run's jobs; older attempts' jobs come from the job endpoint.
  const job = createMemo(() => rc.jobs().find((j) => String(j.id) === props.jobId) ?? getJob(ctx.owner(), ctx.name(), props.jobId));
  const done = () => isDone(job().status);
  const logs = createMemo<JobLogResult | null>(() =>
    isDone(job().status) ? getJobLogs(ctx.owner(), ctx.name(), props.jobId) : null,
  );
  const [search, setSearch] = createSignal('');
  const [timestamps, setTimestamps] = createSignal(false);
  const [rerunOpen, setRerunOpen] = createSignal(false);
  const rerun = useAction(rerunJob);
  const canWrite = () => !!ctx.repo().permissions?.push;
  const state = () => runState(job().status, job().conclusion);

  const rawUrl = (text: string) => URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const githubUrl = () => `https://github.com/${ctx.fullName()}/actions/runs/${rc.id()}/job/${props.jobId}`;

  return (
    <div class="job-log">
      <Title>{`${job().name} · ${rc.run().display_title} · ${ctx.fullName()}`}</Title>
      <div class="job-log-header flex flex-wrap items-center gap-3 px-4 py-3">
        <div class="flex-1 min-w-0">
          <h2 class="font-semibold text-base break-words">{job().name}</h2>
          <div class="text-xs" style={{ color: 'var(--log-fg-muted)' }}>
            {stateVerb(state())} <RelativeTime datetime={job().completed_at ?? job().started_at} />
            <Show when={job().started_at && state() !== 'queued'}> in {duration(job().started_at, job().completed_at)}</Show>
          </div>
        </div>
        <div class="relative">
          <Octicon icon={searchIcon} class="absolute left-2 top-[7px]" />
          <input
            class="job-log-search"
            type="search"
            placeholder="Search logs"
            aria-label="Search logs"
            value={search()}
            onInput={(e) => setSearch(e.currentTarget.value)}
          />
        </div>
        <Show when={canWrite() && done()}>
          <button type="button" class="btn-octicon" title="Re-run this job" aria-label="Re-run this job" onClick={() => setRerunOpen(true)}>
            <Octicon icon={syncIcon} />
          </button>
        </Show>
        <Dropdown class="btn-octicon" align="right" menuClass="w-[220px]" title="Log settings" button={<Octicon icon={gearIcon} />}>
          {(close) => (
            <>
              <button type="button" class="SelectMenu-item" onClick={() => (close(), setTimestamps((v) => !v))}>
                <span class="w-4">
                  <Show when={timestamps()}>
                    <Octicon icon={checkIcon} />
                  </Show>
                </span>
                Show timestamps
              </button>
              <hr class="SelectMenu-divider" />
              <Loading fallback={<span class="SelectMenu-item text-fg-muted">Loading log…</span>}>
                <Show when={logs()?.text}>
                  {(text) => (
                    <>
                      <a class="SelectMenu-item" href={rawUrl(text())} target="_blank" rel="noreferrer" onClick={close}>
                        <Octicon icon={linkExternalIcon} />
                        View raw logs
                      </a>
                      <a class="SelectMenu-item" href={rawUrl(text())} download={`${job().name}.txt`} onClick={close}>
                        <Octicon icon={downloadIcon} />
                        Download log
                      </a>
                    </>
                  )}
                </Show>
              </Loading>
              <a class="SelectMenu-item" href={githubUrl()} target="_blank" rel="noreferrer" onClick={close}>
                <Octicon icon={linkExternalIcon} />
                Open on github.com
              </a>
            </>
          )}
        </Dropdown>
      </div>
      <div class="p-2">
        <Show
          when={job().steps?.length}
          fallback={
            <div class="px-3 py-6 text-sm" style={{ color: 'var(--log-fg-muted)' }}>
              <Switch fallback="Waiting for a runner to pick up this job…">
                <Match when={done()}>This job has no steps.</Match>
                {/* Running: the API only lists steps once the runner reports them (github.com streams them live). */}
                <Match when={job().status === 'in_progress' || job().runner_name}>
                  <div class="flex items-center gap-2" style={{ color: 'var(--log-fg)' }}>
                    <StatusIcon status="in_progress" />
                    <span>
                      Running
                      <Show when={job().runner_name}>
                        {(runner) => (
                          <>
                            {' '}on <span class="font-semibold">{runner()}</span>
                          </>
                        )}
                      </Show>
                    </span>
                  </div>
                  <p class="mt-1 ml-6">
                    Steps appear here as the runner reports them.{' '}
                    <a href={githubUrl()} target="_blank" rel="noreferrer">
                      Follow the live log on github.com
                    </a>
                  </p>
                </Match>
              </Switch>
            </div>
          }
        >
          <Loading fallback={<div class="flex justify-center py-6"><Spinner size={24} /></div>}>
            <Steps job={job()} logs={logs()} search={search()} timestamps={timestamps()} githubUrl={githubUrl()} />
          </Loading>
        </Show>
      </div>
      <RerunDialog
        open={rerunOpen()}
        title="Re-run this job"
        description="A new attempt of this workflow will be started, re-running this job and the jobs that depend on it."
        onClose={() => setRerunOpen(false)}
        onConfirm={(debug) => rerun(ctx.owner(), ctx.name(), job().id, debug)}
      />
    </div>
  );
}

function Steps(props: { job: Job; logs: JobLogResult | null; search: string; timestamps: boolean; githubUrl: string }) {
  const location = useLocation();
  const parsed = createMemo(() => (props.logs?.text ? splitLogBySteps(props.logs.text, props.job.steps ?? []) : null));
  const hashStep = () => Number(/^#step:(\d+)/.exec(location.hash)?.[1] ?? 0);
  // Steps open by default: the failed ones and the one linked from the URL. `toggled` flips that default.
  const [toggled, setToggled] = createSignal<ReadonlySet<number>>(new Set());
  const auto = (s: JobStep) => s.conclusion === 'failure' || s.number === hashStep() || (!!props.search && !!matchCount(s.number));
  const matchCount = (n: number) => {
    const term = props.search.toLowerCase();
    if (!term) return 0;
    const log = parsed()?.get(n);
    return log ? log.lines.filter((l) => l.plain.toLowerCase().includes(term)).length : 0;
  };
  const toggle = (n: number) =>
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  // Scroll a linked line (#step:3:42) into view once its step is rendered.
  createEffect(
    () => (parsed() ? location.hash : ''),
    (hash) => {
      if (!hash.startsWith('#step:')) return;
      requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'center' }));
    },
  );

  return (
    <For each={props.job.steps ?? []} keyed={(s) => s.number}>
      {(step) => (
        <StepRow
          step={step()}
          open={auto(step()) !== toggled().has(step().number)}
          onToggle={() => toggle(step().number)}
          log={parsed()?.get(step().number) ?? null}
          logError={props.logs?.error ?? null}
          jobDone={isDone(props.job.status)}
          search={props.search}
          matches={matchCount(step().number)}
          timestamps={props.timestamps}
          githubUrl={props.githubUrl}
          selectedHash={location.hash}
        />
      )}
    </For>
  );
}

function StepRow(props: {
  step: JobStep;
  open: boolean;
  onToggle: () => void;
  log: StepLog | null;
  logError: string | null;
  jobDone: boolean;
  search: string;
  matches: number;
  timestamps: boolean;
  githubUrl: string;
  selectedHash: string;
}) {
  const [openGroups, setOpenGroups] = createSignal<ReadonlySet<number>>(new Set());
  const [limit, setLimit] = createSignal(LINE_BATCH);
  const term = () => props.search.toLowerCase();
  const isMatch = (l: LogLine) => !!term() && l.plain.toLowerCase().includes(term());
  // Groups holding a search hit or the linked line open automatically.
  const autoGroups = createMemo(() => {
    const set = new Set<number>();
    const lines = props.log?.lines ?? [];
    const linked = new RegExp(`^#step:${props.step.number}:(\\d+)$`).exec(props.selectedHash);
    for (const l of lines) {
      if (l.group == null) continue;
      if (isMatch(l) || (linked && Number(linked[1]) === l.n)) set.add(l.group);
    }
    return set;
  });
  const groupOpen = (n: number) => autoGroups().has(n) !== openGroups().has(n);
  const visible = createMemo(() => (props.log?.lines ?? []).filter((l) => l.group == null || groupOpen(l.group)));
  const shown = createMemo(() => visible().slice(0, limit()));
  const toggleGroup = (n: number) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  const state = () => runState(props.step.status, props.step.conclusion);

  return (
    <details class="job-step" open={props.open}>
      <summary
        class="job-step-summary list-none"
        onClick={(e) => {
          e.preventDefault();
          props.onToggle();
        }}
      >
        <Octicon icon={props.open ? chevronDownIcon : chevronRightIcon} class="shrink-0 opacity-70" />
        <StatusIcon state={state()} />
        <span class="flex-1 min-w-0 truncate">{props.step.name}</span>
        <Show when={props.matches}>
          <span class="Counter">{props.matches}</span>
        </Show>
        <span class="text-xs shrink-0" style={{ color: 'var(--log-fg-muted)' }}>
          <Show when={state() !== 'skipped' && props.step.started_at}>{duration(props.step.started_at, props.step.completed_at)}</Show>
        </span>
      </summary>
      <Show when={props.open}>
        <Switch>
          <Match when={props.log}>
            <div class="job-log-lines">
              <For each={shown()}>
                {(line) => (
                  <div
                    id={`step:${props.step.number}:${line.n}`}
                    class={[
                      'job-log-line',
                      `kind-${line.kind}`,
                      { highlighted: isMatch(line), selected: props.selectedHash === `#step:${props.step.number}:${line.n}` },
                    ]}
                  >
                    <a class="job-log-num" href={`#step:${props.step.number}:${line.n}`}>
                      {line.n}
                    </a>
                    <Show when={props.timestamps}>
                      <span class="job-log-time">{line.time}</span>
                    </Show>
                    <Show
                      when={line.kind === 'group'}
                      fallback={
                        // oxlint-disable-next-line solid/no-innerhtml -- ansiToHtml escapes the log text
                        <span class="job-log-text" innerHTML={highlight(line.html, props.search)} />
                      }
                    >
                      <span class="job-log-text flex gap-1" onClick={() => toggleGroup(line.n)}>
                        <Octicon icon={groupOpen(line.n) ? chevronDownIcon : chevronRightIcon} class="mt-0.5 shrink-0" />
                        {/* oxlint-disable-next-line solid/no-innerhtml -- ansiToHtml escapes the log text */}
                        <span innerHTML={highlight(line.html, props.search)} />
                      </span>
                    </Show>
                  </div>
                )}
              </For>
              <Show when={visible().length > limit()}>
                <div class="px-4 py-2">
                  <button type="button" class="btn btn-sm" onClick={() => setLimit((n) => n + LINE_BATCH * 2)}>
                    Show more ({visible().length - limit()} lines hidden)
                  </button>
                </div>
              </Show>
              <Show when={!props.log!.lines.length}>
                <div class="px-4 text-xs" style={{ color: 'var(--log-fg-muted)' }}>
                  This step produced no output.
                </div>
              </Show>
            </div>
          </Match>
          <Match when={state() === 'skipped'}>
            <div class="px-12 py-2 text-xs" style={{ color: 'var(--log-fg-muted)' }}>
              This step was skipped.
            </div>
          </Match>
          <Match when={!props.jobDone}>
            <div class="px-12 py-2 text-xs" style={{ color: 'var(--log-fg-muted)' }}>
              {state() === 'queued' ? 'This step has not started yet.' : 'This step is running.'} Logs become available here when the
              job finishes —{' '}
              <a href={props.githubUrl} target="_blank" rel="noreferrer" class="underline">
                follow the live log on github.com
              </a>
              .
            </div>
          </Match>
          <Match when={true}>
            <div class="px-12 py-2 text-xs" style={{ color: 'var(--log-fg-muted)' }}>
              {props.logError ?? 'No log output for this step.'}{' '}
              <Show when={props.logError}>
                <a href={props.githubUrl} target="_blank" rel="noreferrer" class="underline">
                  Open on github.com
                </a>
              </Show>
            </div>
          </Match>
        </Switch>
      </Show>
    </details>
  );
}
