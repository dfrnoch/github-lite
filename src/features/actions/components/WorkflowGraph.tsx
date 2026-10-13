import { createEffect, createMemo, createSignal, For, Loading, onSettled, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import {
  dashIcon,
  plusIcon,
  screenFullIcon,
  screenNormalIcon,
  zoomInIcon,
} from '../../../icons/octicons';
import { getRawFile } from '../../repo/api';
import { useRepo } from '../../repo/context';
import { useRun } from '../context';
import { buildGraph, type GraphNode } from '../graph';
import { duration } from '../status';
import type { Job } from '../types';
import { workflowFile } from './ActionsShell';
import StatusIcon from './StatusIcon';

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;
/** Matrix cards list this many jobs before "Show all". */
const MATRIX_PREVIEW = 5;

interface EdgePath {
  from: string;
  to: string;
  d: string;
}

/**
 * The run's job graph like github.com: jobs in dependency columns joined by
 * connectors, on a canvas you can drag to pan, zoom (Ctrl/⌘ + scroll or the
 * buttons), fit to view and expand to fullscreen.
 */
export default function WorkflowGraph() {
  const ctx = useRepo();
  const rc = useRun();
  const path = () => rc.run().path.replace(/@.*$/, '');

  // Dependencies come from the workflow file at the run's commit (dynamic
  // workflows like Pages builds have none — the graph then just groups jobs).
  const source = createMemo(() =>
    path().startsWith('.github/')
      ? getRawFile(ctx.owner(), ctx.name(), rc.run().head_sha, path()).catch(() => null)
      : null,
  );
  const graph = createMemo(() => buildGraph(rc.jobs(), source()));

  const [fullscreen, setFullscreen] = createSignal(false);
  const [zoom, setZoom] = createSignal(1);
  const [pan, setPan] = createSignal({ x: 0, y: 0 });
  const [edges, setEdges] = createSignal<EdgePath[]>([]);
  const [size, setSize] = createSignal({ w: 0, h: 0 });
  const [hovered, setHovered] = createSignal<string | null>(null);
  const [dragging, setDragging] = createSignal(false);

  let viewport!: HTMLDivElement;
  let content!: HTMLDivElement;
  let fitted = false;

  /** Measure node boxes (in unscaled content coordinates) and route the connectors. */
  const measure = () => {
    if (!content) return;
    const w = content.offsetWidth;
    const h = content.offsetHeight;
    setSize({ w, h });
    const box = (id: string) => {
      const el = content.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`);
      return el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null;
    };
    // Called from observers outside any reactive scope: the graph may still be loading.
    let graphEdges: { from: string; to: string }[];
    try {
      graphEdges = graph().edges;
    } catch {
      return;
    }
    const routed: EdgePath[] = [];
    for (const e of graphEdges) {
      const a = box(e.from);
      const b = box(e.to);
      if (!a || !b) continue;
      // Connect at the card's header line (first row), like github.com.
      const x1 = a.x + a.w;
      const y1 = a.y + Math.min(a.h / 2, 22);
      const x2 = b.x;
      const y2 = b.y + Math.min(b.h / 2, 22);
      const bend = Math.max(24, (x2 - x1) / 2);
      routed.push({ ...e, d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}` });
    }
    setEdges(routed);
    if (!fitted && w > 0) {
      fitted = true;
      // Start at 100%, scaled down only if the graph is wider than the view.
      const vw = viewport.clientWidth;
      setZoom(Math.max(MIN_ZOOM, Math.min(1, vw / w)));
      setPan({ x: 0, y: 0 });
    }
  };

  onSettled(() => {
    const ro = new ResizeObserver(() => measure());
    ro.observe(content);
    // Ctrl/⌘ + wheel zooms around the cursor; plain wheel keeps scrolling the page.
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey) && !fullscreen()) return;
      e.preventDefault();
      if (!(e.ctrlKey || e.metaKey)) {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
        return;
      }
      const rect = viewport.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX - rect.left, e.clientY - rect.top);
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && fullscreen() && setFullscreen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      ro.disconnect();
      viewport.removeEventListener('wheel', onWheel);
      document.removeEventListener('keydown', onKey);
    };
  });
  // Re-route when the graph changes (jobs update while a run is in progress).
  createEffect(
    () => graph(),
    () => queueMicrotask(measure),
  );

  /** Zoom by `factor`, keeping the point (px, py) of the viewport fixed. */
  const zoomAt = (factor: number, px: number, py: number) => {
    const z = zoom();
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor));
    const k = next / z;
    setPan((p) => ({ x: px - (px - p.x) * k, y: py - (py - p.y) * k }));
    setZoom(next);
  };
  const zoomCenter = (factor: number) => zoomAt(factor, viewport.clientWidth / 2, viewport.clientHeight / 2);
  const fit = () => {
    const { w, h } = size();
    if (!w || !h) return;
    const z = Math.max(MIN_ZOOM, Math.min(1.25, viewport.clientWidth / w, viewport.clientHeight / h));
    setZoom(z);
    setPan({ x: (viewport.clientWidth - w * z) / 2, y: (viewport.clientHeight - h * z) / 2 });
  };

  // Drag anywhere on the canvas (but not on a link or button) to pan.
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || (e.target as Element).closest('a, button')) return;
    const initial = { x: e.clientX, y: e.clientY, pan: pan() };
    setDragging(true);
    viewport.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) =>
      setPan({ x: initial.pan.x + ev.clientX - initial.x, y: initial.pan.y + ev.clientY - initial.y });
    const up = () => {
      setDragging(false);
      viewport.removeEventListener('pointermove', move);
      viewport.removeEventListener('pointerup', up);
      viewport.removeEventListener('pointercancel', up);
    };
    viewport.addEventListener('pointermove', move);
    viewport.addEventListener('pointerup', up);
    viewport.addEventListener('pointercancel', up);
  };

  /** Edges touching the hovered node light up. */
  const active = (e: EdgePath) => hovered() != null && (e.from === hovered() || e.to === hovered());
  // Sized to the content at 100% (capped) outside fullscreen.
  const height = () => Math.min(560, Math.max(160, size().h * Math.min(1, zoom()) + 8));

  return (
    <div class={['Box overflow-hidden run-graph-box', { 'is-fullscreen': fullscreen() }]}>
      <div class="flex items-start gap-2 px-4 md:px-6 pt-4 pb-3 bg-canvas-muted border-b border-line-muted">
        <div class="flex-1 min-w-0">
          <h2 class="font-semibold truncate">{workflowFile(path())}</h2>
          <div class="text-xs text-fg-muted">on: {rc.run().event}</div>
        </div>
        <div class="flex items-center gap-1" role="toolbar" aria-label="Graph controls">
          <button type="button" class="btn-octicon w-7! h-7!" aria-label="Zoom out" title="Zoom out" onClick={() => zoomCenter(1 / 1.2)}>
            <Octicon icon={dashIcon} />
          </button>
          <button type="button" class="btn btn-sm btn-invisible text-fg-muted! font-mono w-14 justify-center!" title="Reset zoom" onClick={() => zoomCenter(1 / zoom())}>
            {Math.round(zoom() * 100)}%
          </button>
          <button type="button" class="btn-octicon w-7! h-7!" aria-label="Zoom in" title="Zoom in" onClick={() => zoomCenter(1.2)}>
            <Octicon icon={plusIcon} />
          </button>
          <button type="button" class="btn-octicon w-7! h-7!" aria-label="Fit to view" title="Fit to view" onClick={fit}>
            <Octicon icon={zoomInIcon} />
          </button>
          <button
            type="button"
            class="btn-octicon w-7! h-7!"
            aria-label={fullscreen() ? 'Exit fullscreen' : 'Fullscreen'}
            title={fullscreen() ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
            onClick={() => {
              setFullscreen(!fullscreen());
              queueMicrotask(fit);
            }}
          >
            <Octicon icon={fullscreen() ? screenNormalIcon : screenFullIcon} />
          </button>
        </div>
      </div>
      <div
        ref={viewport}
        class={['run-graph-viewport', { 'is-dragging': dragging() }]}
        style={{
          height: fullscreen() ? undefined : `${height()}px`,
          'background-position': `${pan().x}px ${pan().y}px`,
          'background-size': `${16 * zoom()}px ${16 * zoom()}px`,
        }}
        onPointerDown={onPointerDown}
      >
        <div
          class="run-graph-world"
          style={{ transform: `translate(${pan().x}px, ${pan().y}px) scale(${zoom()})` }}
        >
          <svg class="run-graph-edges" width={size().w} height={size().h} aria-hidden="true">
            <For each={edges()} keyed={(e) => `${e.from}>${e.to}`}>
              {(e) => <path d={e().d} class={{ 'is-active': active(e()) }} />}
            </For>
          </svg>
          <div ref={content} class="run-graph-columns">
            <Loading fallback={<div class="text-sm text-fg-muted p-2">Loading jobs…</div>}>
              <For
                each={graph().columns}
                keyed={(column) => column.map((n) => n.id).join('|')}
                fallback={<div class="text-sm text-fg-muted p-2">No jobs</div>}
              >
                {(column) => (
                  <div class="run-graph-column">
                    <For each={column()} keyed={(node) => node.id}>
                      {(node) => (
                        <NodeCard
                          node={node()}
                          onHover={setHovered}
                          hasIn={graph().edges.some((e) => e.to === node().id)}
                          hasOut={graph().edges.some((e) => e.from === node().id)}
                        />
                      )}
                    </For>
                  </div>
                )}
              </For>
            </Loading>
          </div>
        </div>
      </div>
    </div>
  );
}

function JobRow(props: { job: Job }) {
  const rc = useRun();
  return (
    <a class="run-graph-job" href={`${rc.href()}/job/${props.job.id}`} title={props.job.name}>
      <StatusIcon status={props.job.status} conclusion={props.job.conclusion} />
      <span class="truncate flex-1">{props.job.name}</span>
      <span class="text-xs text-fg-muted shrink-0 tabular-nums">
        {props.job.status === 'completed' && props.job.conclusion === 'skipped' ? '' : duration(props.job.started_at, props.job.completed_at)}
      </span>
    </a>
  );
}

function NodeCard(props: { node: GraphNode; onHover: (id: string | null) => void; hasIn: boolean; hasOut: boolean }) {
  const [all, setAll] = createSignal(false);
  // Collapsed, the preview leads with what needs attention: failures, then running jobs.
  const rank = (j: Job) =>
    j.status !== 'completed' ? 1 : ['failure', 'timed_out', 'startup_failure', 'action_required'].includes(j.conclusion ?? '') ? 0 : 2;
  const shown = () =>
    all() ? props.node.jobs : [...props.node.jobs].sort((a, b) => rank(a) - rank(b)).slice(0, MATRIX_PREVIEW);
  const done = () => props.node.jobs.filter((j) => j.status === 'completed').length;
  return (
    <div
      class={['run-graph-card', { 'is-group': props.node.group, 'has-in': props.hasIn, 'has-out': props.hasOut }]}
      data-node={props.node.id}
      onPointerEnter={() => props.onHover(props.node.id)}
      onPointerLeave={() => props.onHover(null)}
    >
      <Show when={props.node.group} fallback={<JobRow job={props.node.jobs[0]!} />}>
        <div class="run-graph-group-header">
          <span class="truncate">
            <span class="text-fg-muted">Matrix: </span>
            <span class="font-semibold">{props.node.name}</span>
          </span>
          <span class="text-xs text-fg-muted shrink-0">
            {done()}/{props.node.jobs.length}
          </span>
        </div>
        <For each={shown()} keyed={(job) => job.id}>{(job) => <JobRow job={job()} />}</For>
        <Show when={props.node.jobs.length > MATRIX_PREVIEW}>
          <button type="button" class="run-graph-more" onClick={() => setAll(!all())}>
            {all() ? 'Show less' : `Show all ${props.node.jobs.length} jobs`}
          </button>
        </Show>
      </Show>
    </div>
  );
}
