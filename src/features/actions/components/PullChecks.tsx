import { query, useLocation } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Blankslate, Markdown, RelativeTime, Spinner } from '../../../components/ui';
import {
  alertIcon,
  checklistIcon,
  chevronDownIcon,
  chevronRightIcon,
  infoIcon,
  linkExternalIcon,
  reportIcon,
  xCircleFillIcon,
} from '../../../icons/octicons';
import { shortSha } from '../../../lib/format';
import { renderMarkdown, toAppUrl } from '../../../lib/markdown';
import { feature } from '../../refined';
import { useRepo } from '../../repo/context';
import { getAnnotations, getCommitChecks, getPullHead } from '../api';
import { duration, type RunState, runState, stateVerb } from '../status';
import type { CheckRun, CommitStatus, WorkflowRun } from '../types';
import '../actions.css';
import StatusIcon from './StatusIcon';

const renderSummary = query((text: string, repo: string) => renderMarkdown(text, repo), 'actions-check-summary');

interface CheckGroup {
  key: string;
  name: string;
  event?: string;
  run?: WorkflowRun;
  checks: CheckRun[];
}

/** Check runs grouped like github.com: one group per workflow run (Actions) or per app. */
function groupChecks(checks: CheckRun[], runsBySuite: Record<number, WorkflowRun>): CheckGroup[] {
  const groups = new Map<string, CheckGroup>();
  for (const c of checks) {
    const run = c.check_suite ? runsBySuite[c.check_suite.id] : undefined;
    const key = run ? `run-${run.id}` : `app-${c.app?.slug ?? 'unknown'}-${c.check_suite?.id ?? ''}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, name: run?.name ?? c.app?.name ?? 'Checks', event: run?.event, run, checks: [] };
      groups.set(key, g);
    }
    g.checks.push(c);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Link for a check's details: Actions jobs stay in-app, other apps open their page. */
function detailsHref(c: CheckRun) {
  const url = c.details_url ?? c.html_url;
  return url ? toAppUrl(url) : null;
}

/** /pull/:n/checks — every check run and commit status reported on the PR head. */
export default function PullChecks(props: { number: string }) {
  const ctx = useRepo();
  const pull = createMemo(() => getPullHead(ctx.owner(), ctx.name(), props.number));
  const checks = createMemo(() => getCommitChecks(ctx.owner(), ctx.name(), pull().head.sha));
  const groups = createMemo(() => groupChecks(checks().checkRuns, checks().runsBySuite));
  const location = useLocation();
  const selectedId = () => Number(location.query.check_run_id) || 0;
  const selected = createMemo(() => checks().checkRuns.find((c) => c.id === selectedId()) ?? null);
  const headline = createMemo(() => {
    const run = Object.values(checks().runsBySuite)[0];
    return run?.head_commit?.message.split('\n')[0] ?? '';
  });
  const overall = createMemo((): RunState => {
    const all = checks().checkRuns.map((c) => runState(c.status, c.conclusion));
    const statuses = checks().statuses.map((s) => s.state);
    if (all.includes('failure') || all.includes('timed_out') || statuses.includes('failure') || statuses.includes('error')) return 'failure';
    if (all.some((s) => s === 'in_progress' || s === 'queued' || s === 'waiting') || statuses.includes('pending')) return 'in_progress';
    return all.length || statuses.length ? 'success' : 'neutral';
  });

  return (
    <Loading fallback={<div class="flex justify-center py-16 text-fg-muted"><Spinner /></div>}>
      <div class="flex items-center gap-2 py-3 px-2 border-b border-line-muted text-sm">
        <StatusIcon state={overall()} />
        <span class="font-semibold truncate">{headline()}</span>
        <a class="font-mono text-xs link-muted" href={`${ctx.base()}/commit/${pull().head.sha}`}>
          {shortSha(pull().head.sha)}
        </a>
      </div>
      <Show
        when={checks().checkRuns.length || checks().statuses.length}
        fallback={<Blankslate icon={checklistIcon} title="No checks" class="py-16">No checks have been reported for the latest commit.</Blankslate>}
      >
        <div class="flex flex-col md:flex-row border-b border-line-muted min-h-[400px]">
          <div class="md:w-[460px] shrink-0 md:border-r border-line-muted">
            <For each={groups()}>{(g) => <GroupRow group={g} selectedId={selectedId()} />}</For>
            <Show when={checks().statuses.length}>
              <StatusesGroup statuses={checks().statuses} />
            </Show>
          </div>
          <div class="flex-1 min-w-0 bg-canvas-muted">
            <Show
              when={selected()}
              fallback={
                <div class="flex flex-col items-center justify-center gap-2 h-full py-24 text-fg-muted font-mono text-sm">
                  <Octicon icon={infoIcon} size={24} />
                  Select a check to view from the sidebar
                </div>
              }
            >
              {(c) => <CheckDetails check={c()} pull={props.number} />}
            </Show>
          </div>
        </div>
      </Show>
    </Loading>
  );
}

function GroupRow(props: { group: CheckGroup; selectedId: number }) {
  const location = useLocation();
  const hasSelected = () => props.group.checks.some((c) => c.id === props.selectedId);
  const [toggled, setToggled] = createSignal(false);
  // Open by default when it holds the selected check or something failed.
  const auto = () => hasSelected() || props.group.checks.some((c) => c.conclusion === 'failure');
  const open = () => auto() !== toggled();
  const annotations = () => props.group.checks.reduce((n, c) => n + (c.output?.annotations_count ?? 0), 0);
  const state = (): RunState => {
    const s = props.group.checks.map((c) => runState(c.status, c.conclusion));
    if (s.some((x) => x === 'failure' || x === 'timed_out' || x === 'startup_failure')) return 'failure';
    if (s.some((x) => x === 'in_progress' || x === 'queued' || x === 'waiting')) return 'in_progress';
    if (s.every((x) => x === 'skipped')) return 'skipped';
    if (s.some((x) => x === 'cancelled')) return 'cancelled';
    return 'success';
  };
  return (
    <div class="border-b border-line-muted">
      <button type="button" class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-canvas-muted" onClick={() => setToggled((v) => !v)}>
        <Octicon icon={open() ? chevronDownIcon : chevronRightIcon} class="text-fg-muted shrink-0" />
        <StatusIcon state={state()} />
        <span class="flex-1 min-w-0">
          <span class="block font-semibold truncate">{props.group.name}</span>
          <Show when={props.group.event}>
            <span class="block text-xs text-fg-muted">on: {props.group.event}</span>
          </Show>
        </span>
        <Show when={annotations()}>
          <span class="flex items-center gap-1 text-xs text-fg-muted" title="Annotations">
            <Octicon icon={reportIcon} />
            {annotations()}
          </span>
        </Show>
      </button>
      <Show when={open()}>
        <ul class="pb-2">
          <For each={props.group.checks}>
            {(c) => (
              <li>
                <a
                  class={['flex items-center gap-2 pl-12 pr-4 py-1.5 text-sm link-plain hover:bg-canvas-muted', { 'bg-accent-muted! font-semibold': c.id === props.selectedId }]}
                  href={`${location.pathname}?check_run_id=${c.id}`}
                >
                  <StatusIcon status={c.status} conclusion={c.conclusion} />
                  <span class="flex-1 truncate">{c.name}</span>
                  <span class="text-xs text-fg-muted shrink-0">{c.started_at ? duration(c.started_at, c.completed_at) : ''}</span>
                </a>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}

function StatusesGroup(props: { statuses: CommitStatus[] }) {
  const [open, setOpen] = createSignal(true);
  const STATE: Record<CommitStatus['state'], string> = { success: 'success', failure: 'failure', error: 'failure', pending: 'queued' };
  return (
    <div class="border-b border-line-muted">
      <button type="button" class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-canvas-muted" onClick={() => setOpen((v) => !v)}>
        <Octicon icon={open() ? chevronDownIcon : chevronRightIcon} class="text-fg-muted shrink-0" />
        <span class="flex-1 font-semibold">Commit statuses</span>
      </button>
      <Show when={open()}>
        <ul class="pb-2">
          <For each={props.statuses}>
            {(s) => (
              <li class="flex items-center gap-2 pl-12 pr-4 py-1.5 text-sm">
                <StatusIcon status="completed" conclusion={STATE[s.state]} />
                <Show when={s.avatar_url}>{(src) => <Avatar src={src()} size={16} square />}</Show>
                <span class="flex-1 min-w-0">
                  <span class="font-semibold">{s.context}</span>
                  <Show when={s.description}>
                    <span class="text-fg-muted"> — {s.description}</span>
                  </Show>
                </span>
                <Show when={s.target_url}>
                  {(url) => (
                    <a class="text-xs shrink-0" href={toAppUrl(url())} target={toAppUrl(url()).startsWith('/') ? undefined : '_blank'} rel="noreferrer">
                      Details
                    </a>
                  )}
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}

function CheckDetails(props: { check: CheckRun; pull: string }) {
  const ctx = useRepo();
  const state = () => runState(props.check.status, props.check.conclusion);
  const annotations = createMemo(() =>
    props.check.output?.annotations_count
      ? getAnnotations(ctx.owner(), ctx.name(), [{ id: props.check.id, name: props.check.name }])
      : [],
  );
  const summary = createMemo(() => {
    const text = [props.check.output?.summary, props.check.output?.text].filter(Boolean).join('\n\n');
    return text ? renderSummary(text, ctx.fullName()) : '';
  });
  // action-pr-link: in-app run/job links remember the PR they were opened from.
  const href = () => {
    const h = detailsHref(props.check);
    if (!h || !feature('action-pr-link') || !h.startsWith('/') || !h.includes('/actions/runs/')) return h;
    return `${h}${h.includes('?') ? '&' : '?'}pr=${props.pull}`;
  };
  const isActions = () => props.check.app?.slug === 'github-actions';
  return (
    <div class="p-4 md:p-6">
      <div class="flex flex-wrap items-start gap-3 mb-4">
        <StatusIcon state={state()} size={24} />
        <div class="flex-1 min-w-0">
          <h2 class="text-lg font-semibold break-words">{props.check.name}</h2>
          <div class="text-xs text-fg-muted">
            {stateVerb(state())} <RelativeTime datetime={props.check.completed_at ?? props.check.started_at} />
            <Show when={props.check.started_at}> in {duration(props.check.started_at, props.check.completed_at)}</Show>
            <Show when={props.check.app}>{(app) => <> · {app().name}</>}</Show>
          </div>
        </div>
        <Show when={href()}>
          {(h) => (
            <a class="btn btn-sm" href={h()} target={h().startsWith('/') ? undefined : '_blank'} rel="noreferrer">
              {isActions() ? 'View job logs' : 'Details'}
              <Show when={!h().startsWith('/')}>
                <Octicon icon={linkExternalIcon} />
              </Show>
            </a>
          )}
        </Show>
      </div>
      <Show when={props.check.output?.title}>
        <h3 class="font-semibold mb-2">{props.check.output.title}</h3>
      </Show>
      <Loading fallback={<Spinner size={20} class="text-fg-muted" />}>
        <Show when={summary()}>
          <div class="Box p-4 mb-4">
            <Markdown html={summary()} />
          </div>
        </Show>
        <Show when={annotations().length}>
          <div class="Box">
            <div class="Box-header py-2!">
              <h3 class="font-semibold text-sm">Annotations</h3>
            </div>
            <ul>
              <For each={annotations()}>
                {(a) => (
                  <li class="px-4 py-3 border-t border-line-muted first:border-t-0 text-sm">
                    <div class="flex items-center gap-2">
                      <Octicon
                        icon={a.annotation_level === 'failure' ? xCircleFillIcon : a.annotation_level === 'warning' ? alertIcon : infoIcon}
                        class={a.annotation_level === 'failure' ? 'text-fg-danger' : a.annotation_level === 'warning' ? 'text-fg-attention' : 'text-fg-muted'}
                      />
                      <span class="font-semibold break-words">{a.title || (a.path && a.path !== '.github' ? a.path : props.check.name)}</span>
                    </div>
                    <pre class="font-mono text-xs text-fg-muted whitespace-pre-wrap break-words mt-1 ml-6">{a.message}</pre>
                    <Show when={a.path && a.path !== '.github'}>
                      <a class="block ml-6 mt-1 text-xs font-mono" href={`${ctx.base()}/blob/${props.check.head_sha}/${a.path}#L${a.start_line}`}>
                        {a.path}#L{a.start_line}
                      </a>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </Show>
        <Show when={!summary() && !annotations().length && !props.check.output?.title}>
          <p class="text-sm text-fg-muted">This check did not report any output.</p>
        </Show>
      </Loading>
    </div>
  );
}
