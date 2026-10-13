import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, RelativeTime, toastError } from '../../../components/ui';
import { alertIcon, downloadIcon, infoIcon, packageIcon, xCircleFillIcon } from '../../../icons/octicons';
import { encodePath } from '../../../lib/github';
import { formatBytes, formatDuration, pluralize, shortSha } from '../../../lib/format';
import { useRepo } from '../../repo/context';
import { downloadArtifact, getAnnotations, getRunArtifacts, getSuiteCheckRuns } from '../api';
import { useRun } from '../context';
import { elapsed, eventLabel, isDone, runState, stateLabel } from '../status';
import type { Annotation, Artifact } from '../types';
import WorkflowGraph from './WorkflowGraph';

/** /actions/runs/:id — summary card, jobs graph, annotations, artifacts. */
export default function RunSummary() {
  return (
    <div class="flex flex-col gap-4">
      <SummaryCard />
      <WorkflowGraph />
      <Loading fallback={<div class="Box p-4 text-sm text-fg-muted">Loading annotations…</div>}>
        <Annotations />
      </Loading>
      <Loading fallback={<div class="Box p-4 text-sm text-fg-muted">Loading artifacts…</div>}>
        <Artifacts />
      </Loading>
    </div>
  );
}

function SummaryCard() {
  const ctx = useRepo();
  const rc = useRun();
  const run = () => rc.run();
  const state = () => runState(run().status, run().conclusion);
  const artifacts = createMemo(() => getRunArtifacts(ctx.owner(), ctx.name(), rc.id()));
  const totalMs = () => elapsed(run().run_started_at ?? run().created_at, isDone(run().status) ? run().updated_at : null);
  const pr = () => run().pull_requests[0];
  return (
    <div class="Box p-4 md:px-6 flex flex-wrap gap-x-12 gap-y-4 text-sm">
      <div class="flex-1 min-w-[260px]">
        <div class="text-xs text-fg-muted mb-1">
          Triggered via {eventLabel(run().event)} <RelativeTime datetime={run().run_started_at ?? run().created_at} />
        </div>
        <div class="flex flex-wrap items-center gap-1">
          <Show when={run().triggering_actor ?? run().actor}>
            {(a) => (
              <>
                <Avatar src={a().avatar_url} login={a().login} size={16} />
                <a class="font-semibold link-plain" href={`/${a().login}`}>
                  {a().login.replace(/\[bot\]$/, '')}
                </a>
              </>
            )}
          </Show>
          <Show
            when={pr()}
            fallback={
              <>
                <span>
                  {run().event === 'push' ? 'pushed' : run().event === 'workflow_dispatch' ? 'manually triggered' : eventLabel(run().event)}
                </span>
                <a class="font-mono text-xs link-muted" href={`${ctx.base()}/commit/${run().head_sha}`}>
                  {shortSha(run().head_sha)}
                </a>
              </>
            }
          >
            {(p) => (
              <>
                <span>{eventLabel(run().event)}</span>
                <a href={`${ctx.base()}/pull/${p().number}`}>#{p().number}</a>
              </>
            )}
          </Show>
          <Show when={run().head_branch}>
            {(b) => (
              <a class="branch-name max-w-[240px]" href={`${ctx.base()}/tree/${encodePath(b())}`} title={b()}>
                {b()}
              </a>
            )}
          </Show>
        </div>
      </div>
      <div>
        <div class="text-xs text-fg-muted mb-1">Status</div>
        <div class="font-semibold text-base">{stateLabel(state())}</div>
      </div>
      <div>
        <div class="text-xs text-fg-muted mb-1">Total duration</div>
        <div class="font-semibold text-base">{isDone(run().status) || state() === 'in_progress' ? formatDuration(totalMs()) : '–'}</div>
      </div>
      <div>
        <div class="text-xs text-fg-muted mb-1">Artifacts</div>
        <div class="font-semibold text-base">
          <Loading fallback="–">
            <Show when={artifacts().length} fallback="–">
              <a class="link-plain underline" href="#artifacts">
                {artifacts().length}
              </a>
            </Show>
          </Loading>
        </div>
      </div>
    </div>
  );
}

const LEVEL = {
  failure: { icon: xCircleFillIcon, color: 'text-fg-danger', label: 'error' },
  warning: { icon: alertIcon, color: 'text-fg-attention', label: 'warning' },
  notice: { icon: infoIcon, color: 'text-fg-muted', label: 'notice' },
} as const;

function Annotations() {
  const ctx = useRepo();
  const rc = useRun();
  const checks = createMemo(() => getSuiteCheckRuns(ctx.owner(), ctx.name(), rc.run().check_suite_id));
  const withAnnotations = createMemo(() => {
    const jobIds = new Set(rc.jobs().map((j) => j.id));
    return checks()
      .filter((c) => c.output.annotations_count > 0 && jobIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.name }));
  });
  const annotations = createMemo(() =>
    withAnnotations().length ? getAnnotations(ctx.owner(), ctx.name(), withAnnotations()) : [],
  );
  const sorted = createMemo(() => {
    const order = { failure: 0, warning: 1, notice: 2 };
    return [...annotations()].sort((a, b) => order[a.annotation_level] - order[b.annotation_level]);
  });
  const counts = () => {
    const c = { failure: 0, warning: 0, notice: 0 };
    for (const a of annotations()) c[a.annotation_level]++;
    const parts = [
      c.failure && pluralize(c.failure, 'error'),
      c.warning && pluralize(c.warning, 'warning'),
      c.notice && pluralize(c.notice, 'notice'),
    ].filter(Boolean) as string[];
    return parts.length > 1 ? `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}` : (parts[0] ?? '');
  };
  return (
    <Show when={annotations().length}>
      <div class="Box">
        <div class="px-4 md:px-6 pt-4 pb-3">
          <h2 class="font-semibold">Annotations</h2>
          <div class="text-xs text-fg-muted">{counts()}</div>
        </div>
        <ul>
          <For each={sorted()}>{(a) => <AnnotationRow annotation={a} />}</For>
        </ul>
      </div>
    </Show>
  );
}

export function AnnotationRow(props: { annotation: Annotation & { checkName?: string; checkId?: number } }) {
  const ctx = useRepo();
  const rc = useRun();
  const [expanded, setExpanded] = createSignal(false);
  const level = () => LEVEL[props.annotation.annotation_level] ?? LEVEL.notice;
  const long = () => props.annotation.message.length > 160 || props.annotation.message.includes('\n');
  // `.github` is the pseudo path of annotations raised from the log itself.
  const fileLink = () => {
    const a = props.annotation;
    if (!a.path || a.path === '.github') return null;
    const range = a.end_line && a.end_line !== a.start_line ? `-L${a.end_line}` : '';
    return `${ctx.base()}/blob/${rc.run().head_sha}/${encodePath(a.path)}#L${a.start_line}${range}`;
  };
  const heading = () => props.annotation.title || props.annotation.checkName || 'Annotation';
  return (
    <li class="flex gap-3 px-4 md:px-6 py-3 border-t border-line-muted text-sm">
      <Octicon icon={level().icon} class={`${level().color} mt-0.5 shrink-0`} aria-label={level().label} />
      <div class="min-w-0 flex-1">
        <div class="font-semibold break-words">
          <Show when={props.annotation.checkId} fallback={heading()}>
            <a class="link-plain" href={`${rc.href()}/job/${props.annotation.checkId}`}>
              {heading()}
            </a>
          </Show>
        </div>
        <pre class={['font-mono text-xs text-fg-muted whitespace-pre-wrap break-words mt-0.5', { 'line-clamp-1': !expanded() }]}>
          {props.annotation.message}
        </pre>
        <Show when={long()}>
          <button type="button" class="btn-link text-sm" onClick={() => setExpanded((v) => !v)}>
            {expanded() ? 'Show less' : 'Show more'}
          </button>
        </Show>
        <Show when={fileLink()}>
          {(href) => (
            <a class="block text-xs mt-1 font-mono" href={href()}>
              {props.annotation.path}#L{props.annotation.start_line}
            </a>
          )}
        </Show>
      </div>
    </li>
  );
}

function Artifacts() {
  const ctx = useRepo();
  const rc = useRun();
  const artifacts = createMemo(() => getRunArtifacts(ctx.owner(), ctx.name(), rc.id()));
  return (
    <Show when={artifacts().length}>
      <div class="Box" id="artifacts">
        <div class="px-4 md:px-6 pt-4 pb-3">
          <h2 class="font-semibold">Artifacts</h2>
          <div class="text-xs text-fg-muted">Produced during runtime</div>
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs text-fg-muted border-t border-line-muted">
              <th class="px-4 md:px-6 py-2 font-semibold">Name</th>
              <th class="px-4 py-2 font-semibold">Size</th>
              <th class="px-4 py-2 font-semibold hidden md:table-cell">Digest</th>
              <th class="px-4 md:px-6 py-2" />
            </tr>
          </thead>
          <tbody>
            <For each={artifacts()}>{(a) => <ArtifactRow artifact={a} />}</For>
          </tbody>
        </table>
      </div>
    </Show>
  );
}

function ArtifactRow(props: { artifact: Artifact }) {
  const ctx = useRepo();
  const rc = useRun();
  const [busy, setBusy] = createSignal(false);
  const githubUrl = () => `https://github.com/${ctx.fullName()}/actions/runs/${rc.id()}/artifacts/${props.artifact.id}`;
  const download = async () => {
    setBusy(true);
    try {
      await downloadArtifact(props.artifact);
    } catch (e) {
      toastError(e);
      window.open(githubUrl(), '_blank', 'noreferrer');
    } finally {
      setBusy(false);
    }
  };
  return (
    <tr class="border-t border-line-muted">
      <td class="px-4 md:px-6 py-2">
        <span class={['flex items-center gap-2', { 'text-fg-muted line-through': props.artifact.expired }]}>
          <Octicon icon={packageIcon} class="text-fg-muted" />
          {props.artifact.name}
        </span>
      </td>
      <td class="px-4 py-2 text-fg-muted">{formatBytes(props.artifact.size_in_bytes)}</td>
      <td class="px-4 py-2 text-fg-muted font-mono text-xs hidden md:table-cell truncate max-w-[220px]" title={props.artifact.digest ?? ''}>
        {props.artifact.digest ? props.artifact.digest.slice(0, 20) + '…' : ''}
      </td>
      <td class="px-4 md:px-6 py-2 text-right">
        <Show when={!props.artifact.expired} fallback={<span class="text-xs text-fg-muted">Expired</span>}>
          <button type="button" class="btn-octicon" title={`Download ${props.artifact.name}`} aria-label={`Download ${props.artifact.name}`} disabled={busy()} onClick={() => void download()}>
            <Octicon icon={downloadIcon} />
          </button>
        </Show>
      </td>
    </tr>
  );
}
