import { useLocation, useNavigate } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, createSignal, For, onSettled, Show } from 'solid-js';
import Octicon from '../../components/Octicon';
import { CopyButton, Dropdown } from '../../components/ui';
import {
  arrowRightIcon,
  checkIcon,
  chevronDownIcon,
  chevronRightIcon,
  foldDownIcon,
  foldUpIcon,
  kebabHorizontalIcon,
  plusIcon,
  sidebarCollapseIcon,
  sidebarExpandIcon,
  unfoldIcon,
} from '../../icons/octicons';
import { formatNumber } from '../../lib/format';
import { useHotkey } from '../../lib/hotkeys';
import type { DiffFile } from '../../lib/types';
import { codeTransformOptions, tabSizeStyle, transformCodeLine } from '../code/refined';
import { feature } from '../refined';
import DiffFileTree, { FileStatusIcon } from './DiffFileTree';
import { highlightDiff, plainDiffHtml } from './highlight';
import {
  diffAnchor,
  diffstatBlocks,
  escapeHtml,
  ignoreWhitespaceChanges,
  parsePatch,
  toSplitRows,
  type DiffLine,
  type Side,
} from './parse';

export type { Side } from './parse';

/** A line (or range) of a file in a diff — where a review comment attaches. */
export interface LineRef {
  path: string;
  side: Side;
  line: number;
  startLine?: number;
  startSide?: Side;
}

/** Key of a commentable line in `extraKeys`: `${path}:${side}:${line}`. */
export const lineKey = (path: string, side: Side, line: number) => `${path}:${side}:${line}`;

// ---------------------------------------------------------------------------
// Preferences (app-wide, remembered in localStorage).

const SPLIT_KEY = 'gh-lite:diff-split';
const TREE_KEY = 'gh-lite:diff-tree';
const ls = typeof localStorage !== 'undefined' ? localStorage : undefined;
const [split, setSplitSignal] = createSignal(ls?.getItem(SPLIT_KEY) === '1');
const [treeOpen, setTreeOpenSignal] = createSignal(ls?.getItem(TREE_KEY) !== '0');
export const diffSplit = split;
export function setDiffSplit(value: boolean) {
  ls?.setItem(SPLIT_KEY, value ? '1' : '0');
  setSplitSignal(value);
}
function setTreeOpen(value: boolean) {
  ls?.setItem(TREE_KEY, value ? '1' : '0');
  setTreeOpenSignal(value);
}

function readViewed(key: string | undefined): Record<string, boolean> {
  if (!key) return {};
  try {
    return JSON.parse(ls?.getItem(`gh-lite:viewed:${key}`) ?? '{}');
  } catch {
    return {};
  }
}

/** Patches longer than this start collapsed behind "Load diff". */
const LARGE_FILE_LINES = 400;
/** After this many rendered lines in one diff, the remaining files start collapsed. */
const TOTAL_LINES_BUDGET = 8000;

export interface DiffViewProps {
  files: DiffFile[];
  /** localStorage key for local "Viewed" checkboxes (e.g. `owner/repo@sha`). */
  viewedKey?: string;
  /** Controlled viewed state (PRs keep it on the server). Use with `onViewedChange`. */
  viewed?: Record<string, boolean>;
  onViewedChange?: (path: string, viewed: boolean) => void;
  /** "View file" destination for a file. */
  fileHref?: (file: DiffFile) => string | undefined;
  /** Full content of a file's new version — enables "expand context" between hunks. */
  loadContent?: (file: DiffFile) => Promise<string>;
  /** Lines that have something rendered under them (see `lineKey`). */
  extraKeys?: Set<string>;
  /** Renders under a line listed in `extraKeys` (review threads, comment forms). */
  renderExtras?: (path: string, side: Side, line: number) => JSX.Element;
  /** Shows a "+" on hover over lines; called with the clicked line (and shift-selected range). */
  onAddComment?: (ref: LineRef) => void;
  /** Extra controls at the right end of the toolbar (e.g. "Review changes"). */
  toolbar?: JSX.Element;
  /** Replace the default "N files changed" summary on the left of the toolbar. */
  summary?: JSX.Element;
  /** Extra items for a file's "…" menu (e.g. restore-file). */
  fileMenu?: (file: DiffFile, close: () => void) => JSX.Element;
}

/** "/o/r/blob/ref/path" → raw / blame / history links (more-file-links). */
function moreFileLinks(href: string | undefined) {
  const m = href?.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  if (!m) return null;
  const [, owner, repo, rest] = m;
  return {
    raw: `https://github.com/${owner}/${repo}/raw/${rest}`,
    blame: `/${owner}/${repo}/blame/${rest}`,
    history: `/${owner}/${repo}/commits/${rest}`,
  };
}

/**
 * GitHub's diff viewer for REST `files` arrays: per-file headers with
 * diffstat, unified / split views, syntax highlighting, word-level changes,
 * a file tree, viewed checkboxes, large-diff collapsing, context expansion
 * and review-comment slots under lines.
 */
export default function DiffView(props: DiffViewProps) {
  const location = useLocation();
  const navigate = useNavigate();
  /** github.com's `?w=1`: hide whitespace-only changes. */
  const hideWhitespace = () => new URLSearchParams(location.search).get('w') === '1';
  const whitespaceHref = () => {
    const sp = new URLSearchParams(location.search);
    if (hideWhitespace()) sp.delete('w');
    else sp.set('w', '1');
    const qs = sp.toString();
    return `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
  };
  useHotkey({
    keys: 'd w',
    description: 'Show/hide whitespace changes in diffs',
    group: 'Pull request list / diffs',
    feature: 'one-click-diff-options',
    handler: () => navigate(whitespaceHref(), { replace: true, scroll: false }),
  });
  /** "/owner/repo" of the page, for linkify-code's issue references. */
  const repoBase = () => location.pathname.split('/').slice(0, 3).join('/');
  const [localViewed, setLocalViewed] = createSignal<Record<string, boolean>>(() => readViewed(props.viewedKey));
  const viewable = () => !!props.viewedKey || !!props.onViewedChange;
  const isViewed = (path: string) => (props.viewed ? !!props.viewed[path] : !!localViewed()[path]);
  const setViewed = (path: string, value: boolean) => {
    if (props.onViewedChange) props.onViewedChange(path, value);
    if (!props.viewed && props.viewedKey) {
      // Updater form: several files can change in one tick (batch-mark-files-as-viewed).
      const key = `gh-lite:viewed:${props.viewedKey}`;
      setLocalViewed((prev) => {
        const next = { ...prev, [path]: value };
        if (!value) delete next[path];
        ls?.setItem(key, JSON.stringify(next));
        return next;
      });
    }
  };

  /** batch-mark-files-as-viewed: shift-click marks every file between the last clicked checkbox and this one. */
  let lastViewedIndex: number | null = null;
  const onViewedClick = (index: number, value: boolean, shift: boolean) => {
    if (shift && lastViewedIndex != null && lastViewedIndex !== index && feature('batch-mark-files-as-viewed')) {
      const [from, to] = [Math.min(lastViewedIndex, index), Math.max(lastViewedIndex, index)];
      for (let i = from; i <= to; i++) {
        const path = props.files[i]?.filename;
        if (path && isViewed(path) !== value) setViewed(path, value);
      }
    } else setViewed(props.files[index]!.filename, value);
    lastViewedIndex = index;
  };
  /** pr-jump-to-first-non-viewed-file */
  const jumpToFirstUnviewed = () => {
    const file = props.files.find((f) => !isViewed(f.filename));
    if (file) jumpTo(file);
  };

  const anchors = createMemo(() => new Map(props.files.map((f) => [f, diffAnchor(f.filename)] as const)));
  /** Which files start collapsed behind "Load diff" (large ones, and everything past the line budget). */
  const startCollapsed = createMemo(() => {
    let budget = TOTAL_LINES_BUDGET;
    const out = new Set<DiffFile>();
    for (const f of props.files) {
      const lines = f.patch ? f.patch.split('\n').length : 0;
      if (lines > LARGE_FILE_LINES || f.status === 'removed' || (budget <= 0 && lines > 0)) out.add(f);
      else budget -= lines;
    }
    return out;
  });
  const totals = createMemo(() =>
    props.files.reduce((acc, f) => ({ add: acc.add + f.additions, del: acc.del + f.deletions }), { add: 0, del: 0 }),
  );
  const [active, setActive] = createSignal<string>();
  const [forced, setForced] = createSignal<string>();

  const jumpTo = (file: DiffFile) => {
    setActive(file.filename);
    setForced(file.filename);
    const id = anchors().get(file);
    if (!id) return;
    history.replaceState(history.state, '', `#${id}`);
    queueMicrotask(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
  };

  // Deep links: #diff-<sha256(path)> (optionally with R12 / L12) jump to the file.
  onSettled(() => {
    const m = location.hash.match(/^#(diff-[0-9a-f]{64})/);
    if (!m) return;
    const file = props.files.find((f) => anchors().get(f) === m[1]);
    if (file) jumpTo(file);
  });

  const showTree = () => props.files.length > 1;

  return (
    <div class={['flex gap-4 items-start', { 'rgh-hide-diff-signs': feature('hide-diff-signs') }]} style={tabSizeStyle()}>
      <Show when={showTree() && treeOpen()}>
        <aside class="hidden md:block w-[280px] shrink-0 sticky top-2 max-h-[calc(100vh-16px)] overflow-auto pr-1">
          <DiffFileTree
            files={props.files}
            active={active()}
            onSelect={jumpTo}
            isViewed={viewable() ? isViewed : undefined}
          />
        </aside>
      </Show>
      <div class="flex-1 min-w-0">
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <Show when={showTree()}>
            <button
              type="button"
              class="btn btn-sm px-2! hidden md:inline-flex"
              aria-label={treeOpen() ? 'Collapse file tree' : 'Expand file tree'}
              title={treeOpen() ? 'Collapse file tree' : 'Expand file tree'}
              onClick={() => setTreeOpen(!treeOpen())}
            >
              <Octicon icon={treeOpen() ? sidebarExpandIcon : sidebarCollapseIcon} />
            </button>
          </Show>
          <div class="text-sm text-fg-muted flex items-center gap-2">
            <Show
              when={props.summary}
              fallback={
                <>
                  <strong class="text-fg">{formatNumber(props.files.length)}</strong>
                  {props.files.length === 1 ? 'file' : 'files'} changed
                  <span class="text-fg-success font-semibold">+{formatNumber(totals().add)}</span>
                  <span class="text-fg-danger font-semibold">−{formatNumber(totals().del)}</span>
                </>
              }
            >
              {props.summary}
            </Show>
            <Show when={viewable()}>
              <Show
                when={feature('pr-jump-to-first-non-viewed-file')}
                fallback={
                  <span class="ml-2">
                    {props.files.filter((f) => isViewed(f.filename)).length} / {props.files.length} viewed
                  </span>
                }
              >
                <button
                  type="button"
                  class="ml-2 text-fg-muted hover:text-fg-accent hover:underline"
                  title="Jump to the first file that isn't marked as viewed"
                  onClick={jumpToFirstUnviewed}
                >
                  {props.files.filter((f) => isViewed(f.filename)).length} / {props.files.length} viewed
                </button>
              </Show>
            </Show>
          </div>
          <div class="flex-1" />
          <Show when={feature('one-click-diff-options')}>
            <a
              class={['btn btn-sm', { 'text-fg-muted!': hideWhitespace() }]}
              href={whitespaceHref()}
              title={`${hideWhitespace() ? 'Show' : 'Hide'} whitespace changes (d w)`}
              onClick={(e) => {
                e.preventDefault();
                navigate(whitespaceHref(), { replace: true, scroll: false });
              }}
            >
              <Show when={hideWhitespace()}>
                <Octicon icon={checkIcon} />
              </Show>
              No whitespace
            </a>
          </Show>
          <div class="SegmentedControl" role="group" aria-label="Diff view">
            <button type="button" class={['SegmentedControl-item text-xs!', { selected: !split() }]} onClick={() => setDiffSplit(false)}>
              Unified
            </button>
            <button type="button" class={['SegmentedControl-item text-xs!', { selected: split() }]} onClick={() => setDiffSplit(true)}>
              Split
            </button>
          </div>
          {props.toolbar}
        </div>
        <For each={props.files}>
          {(file, index) => (
            <DiffFileView
              file={file}
              anchor={anchors().get(file) ?? ''}
              split={split() && !(feature('no-unnecessary-split-diff-view') && (!file.additions || !file.deletions))}
              hideWhitespace={hideWhitespace()}
              repoBase={repoBase()}
              fileMenu={props.fileMenu}
              startLoaded={!startCollapsed().has(file)}
              forceVisible={forced() === file.filename}
              viewable={viewable()}
              viewed={isViewed(file.filename)}
              onViewed={(v, shift) => onViewedClick(index(), v, shift)}
              href={props.fileHref?.(file)}
              loadContent={props.loadContent}
              extraKeys={props.extraKeys}
              renderExtras={props.renderExtras}
              onAddComment={props.onAddComment}
            />
          )}
        </For>
      </div>
    </div>
  );
}

/** "+12 −3 ■■■□□" */
export function Diffstat(props: { additions: number; deletions: number; showCounts?: boolean }) {
  const blocks = createMemo(() => diffstatBlocks(props.additions, props.deletions));
  return (
    <span class="inline-flex items-center gap-1 text-xs font-semibold font-mono">
      <Show when={props.showCounts !== false}>
        <Show when={props.additions}>
          <span class="text-fg-success">+{formatNumber(props.additions)}</span>
        </Show>
        <Show when={props.deletions}>
          <span class="text-fg-danger">−{formatNumber(props.deletions)}</span>
        </Show>
      </Show>
      <span class="inline-flex gap-px ml-1" aria-hidden="true">
        <For each={Array.from({ length: blocks()[0] })}>{() => <span class="w-2 h-2 rounded-[2px] bg-success-emphasis" />}</For>
        <For each={Array.from({ length: blocks()[1] })}>{() => <span class="w-2 h-2 rounded-[2px] bg-danger-emphasis" />}</For>
        <For each={Array.from({ length: blocks()[2] })}>{() => <span class="w-2 h-2 rounded-[2px] bg-neutral-muted" />}</For>
      </span>
    </span>
  );
}

const END = -1;

function DiffFileView(props: {
  file: DiffFile;
  anchor: string;
  split: boolean;
  startLoaded: boolean;
  forceVisible: boolean;
  viewable: boolean;
  viewed: boolean;
  onViewed: (viewed: boolean, shift: boolean) => void;
  href?: string;
  hideWhitespace: boolean;
  repoBase: string;
  fileMenu?: (file: DiffFile, close: () => void) => JSX.Element;
  loadContent?: (file: DiffFile) => Promise<string>;
  extraKeys?: Set<string>;
  renderExtras?: (path: string, side: Side, line: number) => JSX.Element;
  onAddComment?: (ref: LineRef) => void;
}) {
  const path = () => props.file.filename;
  const parsed = createMemo(() => parsePatch(props.file.patch));
  const lines = createMemo(() => (props.hideWhitespace ? ignoreWhitespaceChanges(parsed()) : parsed()));
  const [collapsed, setCollapsed] = createSignal(() => props.viewed);
  const [loaded, setLoaded] = createSignal(() => props.startLoaded);
  const [seen, setSeen] = createSignal(false);
  const visible = () => seen() || props.forceVisible;
  /** Highlighted HTML for a specific `lines()` array (stale once whitespace mode re-parses). */
  const [hl, setHl] = createSignal<{ lines: DiffLine[]; html: string[] } | null>(null);
  const plain = createMemo(() => plainDiffHtml(lines()));
  const transforms = createMemo(() => codeTransformOptions(props.repoBase));
  const htmlMap = createMemo(() => {
    const h = hl();
    const arr = h && h.lines === lines() ? h.html : plain();
    const opts = transforms();
    const map = new Map<DiffLine, string>();
    lines().forEach((l, i) => map.set(l, transformCodeLine(arr[i] ?? '', opts)));
    return map;
  });
  const htmlOf = (line: DiffLine) => htmlMap().get(line) ?? escapeHtml(line.text);
  const showBody = () => !collapsed() && loaded() && visible();

  // Highlight once the file is on screen (keeps huge diffs cheap).
  createEffect(
    () => (showBody() && hl()?.lines !== lines() ? lines() : null),
    (ls) => {
      if (!ls?.length) return;
      void highlightDiff(ls, path()).then((html) => {
        if (html) setHl({ lines: ls, html });
      });
    },
  );

  // ---- context expansion
  const [content, setContent] = createSignal<string[] | null>(null);
  const [expanded, setExpanded] = createSignal<Set<number>>(new Set());
  const expandable = () => !!props.loadContent && props.file.status !== 'added' && !!props.file.patch;
  const expand = async (hunkIndex: number) => {
    if (!content() && props.loadContent) {
      const text = await props.loadContent(props.file);
      const all = text.split('\n');
      if (all[all.length - 1] === '') all.pop();
      setContent(all);
    }
    setExpanded((s) => new Set(s).add(hunkIndex));
  };
  const rows = createMemo(() => {
    const ls = lines();
    const exp = expanded();
    const text = content();
    if (!exp.size || !text) return ls;
    const out: DiffLine[] = [];
    let prevNewEnd = 0;
    let prevOldEnd = 0;
    const fill = (src: string[], from: number, to: number, delta: number, hunkIndex: number) => {
      for (let n = from; n <= to && n <= src.length; n++)
        out.push({ type: 'ctx', text: src[n - 1] ?? '', newNo: n, oldNo: n + delta, hunkIndex });
    };
    for (const l of ls) {
      if (l.type === 'hunk' && l.hunk) {
        const h = l.hunk;
        if (exp.has(l.hunkIndex)) fill(text, prevNewEnd + 1, h.newStart - 1, h.oldStart - h.newStart, l.hunkIndex);
        else out.push(l);
        prevNewEnd = h.newStart + h.newLines - 1;
        prevOldEnd = h.oldStart + h.oldLines - 1;
      } else out.push(l);
    }
    if (exp.has(END)) fill(text, prevNewEnd + 1, text.length, prevOldEnd - prevNewEnd, END);
    return out;
  });
  const splitRows = createMemo(() => (props.split ? toSplitRows(rows()) : []));
  const canExpandEnd = () => expandable() && !expanded().has(END);

  // ---- line selection (#diff-…R12 / shift-click ranges)
  const [selection, setSelection] = createSignal<{ side: Side; start: number; end: number } | null>(null);
  const selectLine = (side: Side, n: number, shift: boolean) => {
    const cur = selection();
    const next =
      shift && cur && cur.side === side ? { side, start: Math.min(cur.start, n), end: Math.max(cur.start, n) } : { side, start: n, end: n };
    setSelection(next);
    const s = side === 'LEFT' ? 'L' : 'R';
    history.replaceState(
      history.state,
      '',
      `#${props.anchor}${s}${next.start}${next.end !== next.start ? `-${s}${next.end}` : ''}`,
    );
  };
  onSettled(() => {
    const m = location.hash.match(/^#diff-[0-9a-f]{64}([LR])(\d+)(?:-[LR](\d+))?$/);
    if (m && location.hash.startsWith(`#${props.anchor}`)) {
      setSelection({ side: m[1] === 'L' ? 'LEFT' : 'RIGHT', start: Number(m[2]), end: Number(m[3] ?? m[2]) });
    }
  });
  const isSelected = (side: Side, n: number | undefined) => {
    const s = selection();
    return !!s && n != null && s.side === side && n >= s.start && n <= s.end;
  };
  const comment = (side: Side, n: number) => {
    const s = selection();
    const range = s && s.side === side && s.end === n && s.start < n ? s.start : undefined;
    props.onAddComment?.({ path: path(), side, line: n, startLine: range, startSide: range ? side : undefined });
  };
  const hasExtras = (side: Side, n: number | undefined) => n != null && !!props.extraKeys?.has(lineKey(path(), side, n));

  // ---- lazy rendering: only build rows once the file scrolls near the viewport
  let box!: HTMLDivElement;
  onSettled(() => {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: '1500px 0px' },
    );
    io.observe(box);
    return () => io.disconnect();
  });
  const estimate = () => Math.max(lines().length, 3) * 20;

  const notice = () => {
    const f = props.file;
    if (f.patch) return null;
    if (f.status === 'renamed' && !f.changes) return 'File renamed without changes.';
    if (!f.changes) return f.status === 'removed' || f.status === 'added' ? 'Empty file.' : 'Binary file not shown.';
    return 'Large diffs are not rendered by default.';
  };

  const NumCell = (p: { n?: number; side: Side; kind: 'add' | 'del' | 'ctx' | 'empty' }) => (
    <td
      class={[
        'blob-num',
        {
          'blob-num-addition': p.kind === 'add',
          'blob-num-deletion': p.kind === 'del',
          'bg-canvas-muted cursor-default!': p.kind === 'empty',
          'highlighted-line': isSelected(p.side, p.n),
        },
      ]}
      data-line-number={p.n}
      onClick={(e) => p.n != null && selectLine(p.side, p.n, e.shiftKey)}
    />
  );

  const CodeCell = (p: { line?: DiffLine; side: Side; n?: number; wrap: boolean }) => (
    <td
      class={[
        'blob-code',
        {
          'blob-code-addition': p.line?.type === 'add',
          'blob-code-deletion': p.line?.type === 'del',
          'bg-canvas-muted': !p.line,
          'highlighted-line': isSelected(p.side, p.n),
          'whitespace-pre-wrap! break-all': p.wrap,
        },
      ]}
    >
      <Show when={p.line}>
        {(line) => (
          <>
            <Show when={props.onAddComment && p.n != null}>
              <button
                type="button"
                class="absolute -left-2.5 top-0.5 z-1 w-5 h-4 rounded-md bg-accent-emphasis text-fg-on-emphasis items-center justify-center hidden group-hover:flex"
                aria-label="Add a comment on this line"
                onClick={() => comment(p.side, p.n!)}
              >
                <Octicon icon={plusIcon} size={12} />
              </button>
            </Show>
            <span
              class="blob-code-marker"
              data-code-marker={line().type === 'add' ? '+' : line().type === 'del' ? '-' : ' '}
            />
            {/* oxlint-disable-next-line solid/no-innerhtml -- escaped / highlighted source */}
            <span class="blob-code-inner shiki" innerHTML={htmlOf(line())} />
            <Show when={line().noNewline}>
              <span class="ml-2 text-fg-danger" title="No newline at end of file">
                ⊖
              </span>
            </Show>
          </>
        )}
      </Show>
    </td>
  );

  const canExpandHunk = (hunk: DiffLine) => expandable() && !!hunk.hunk && hunk.hunk.newStart > 1;
  /** extend-diff-expander: the whole hunk row expands, not just the small button. */
  const wideExpand = (hunk: DiffLine) => feature('extend-diff-expander') && canExpandHunk(hunk);
  const onHunkRowClick = (e: MouseEvent, hunk: DiffLine) => {
    if (!wideExpand(hunk) || (e.target as HTMLElement).closest('button')) return;
    void expand(hunk.hunkIndex);
  };
  const ExpandButton = (p: { hunk: DiffLine }) => (
    <Show when={canExpandHunk(p.hunk)}>
      <button
        type="button"
        class="w-full h-5 flex items-center justify-center text-fg-muted hover:text-fg-on-emphasis hover:bg-accent-emphasis"
        aria-label="Expand hidden lines"
        title="Expand hidden lines"
        onClick={() => void expand(p.hunk.hunkIndex)}
      >
        <Octicon icon={p.hunk.hunkIndex === 0 ? foldUpIcon : unfoldIcon} />
      </button>
    </Show>
  );

  const ExtrasRow = (p: { side: Side; n?: number; cols: number }) => (
    <Show when={hasExtras(p.side, p.n) && props.renderExtras}>
      <tr>
        <td colspan={p.cols} class="border-y border-line-muted bg-canvas p-0 whitespace-normal font-sans">
          {props.renderExtras!(path(), p.side, p.n!)}
        </td>
      </tr>
    </Show>
  );

  return (
    <div ref={box} id={props.anchor} class="Box mb-4 scroll-mt-2" data-path={path()}>
      <div
        class={[
          'Box-header sticky top-0 z-2 flex items-center gap-2 py-1.5! px-2! text-sm',
          { 'rounded-b-md': collapsed() || !loaded(), 'cursor-pointer': feature('easy-toggle-files') },
        ]}
        onClick={(e) => {
          // easy-toggle-files: a click on the bar (not on its controls or while selecting text) toggles the file.
          if (!feature('easy-toggle-files')) return;
          if ((e.target as HTMLElement).closest('a, button, input, label, summary, [role="menu"]')) return;
          if (getSelection()?.toString()) return;
          setCollapsed(!collapsed());
        }}
      >
        <button
          type="button"
          class="btn-octicon w-7 h-7"
          aria-label={collapsed() ? 'Expand file' : 'Collapse file'}
          aria-expanded={collapsed() ? 'false' : 'true'}
          onClick={() => setCollapsed(!collapsed())}
        >
          <Octicon icon={collapsed() ? chevronRightIcon : chevronDownIcon} />
        </button>
        <FileStatusIcon status={props.file.status} class="shrink-0" />
        <span class="font-mono text-xs min-w-0 flex items-center gap-1 flex-wrap break-all">
          <Show when={props.file.previous_filename && props.file.previous_filename !== props.file.filename}>
            <span class="text-fg-muted">{props.file.previous_filename}</span>
            <Octicon icon={arrowRightIcon} class="text-fg-muted" />
          </Show>
          <a class="link-plain font-semibold" href={`#${props.anchor}`}>
            {path()}
          </a>
        </span>
        <CopyButton value={path()} label="Copy file name to clipboard" class="btn-octicon w-7 h-7 shrink-0" />
        <Show when={expandable() && loaded() && !collapsed()}>
          <button
            type="button"
            class="btn-octicon w-7 h-7 shrink-0 hidden md:inline-flex"
            title="Expand all"
            aria-label="Expand all lines"
            onClick={async () => {
              for (const l of lines()) if (l.type === 'hunk') await expand(l.hunkIndex);
              await expand(END);
            }}
          >
            <Octicon icon={unfoldIcon} />
          </button>
        </Show>
        <div class="flex-1" />
        <Diffstat additions={props.file.additions} deletions={props.file.deletions} />
        <Show when={props.viewable}>
          <label
            class={[
              'ml-2 flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs cursor-pointer select-none',
              props.viewed ? 'bg-accent-muted border-line-accent-muted' : 'border-line',
            ]}
          >
            <input
              type="checkbox"
              checked={props.viewed}
              onClick={(e) => props.onViewed(e.currentTarget.checked, e.shiftKey)}
            />
            Viewed
          </label>
        </Show>
        <Dropdown class="btn-octicon w-7 h-7" align="right" title="More options" button={<Octicon icon={kebabHorizontalIcon} />}>
          {(close) => (
            <>
              <Show when={props.href}>
                <a class="SelectMenu-item" href={props.href} onClick={close}>
                  View file
                </a>
                <Show when={feature('more-file-links') && moreFileLinks(props.href)}>
                  {(links) => (
                    <>
                      <a class="SelectMenu-item" href={links().raw} target="_blank" rel="noreferrer" onClick={close}>
                        View raw
                      </a>
                      <a class="SelectMenu-item" href={links().blame} onClick={close}>
                        View blame
                      </a>
                      <a class="SelectMenu-item" href={links().history} onClick={close}>
                        View history
                      </a>
                    </>
                  )}
                </Show>
              </Show>
              {props.fileMenu?.(props.file, close)}
              <button
                type="button"
                class="SelectMenu-item"
                onClick={() => {
                  setCollapsed(!collapsed());
                  close();
                }}
              >
                {collapsed() ? 'Expand file' : 'Collapse file'}
              </button>
            </>
          )}
        </Dropdown>
      </div>

      <Show when={!collapsed()}>
        <Show
          when={!notice()}
          fallback={
            <div class="py-6 text-center text-sm text-fg-muted">
              {notice()}
              <Show when={props.href && props.file.changes}>
                {' '}
                <a href={props.href}>View file</a>
              </Show>
            </div>
          }
        >
          <Show
            when={loaded()}
            fallback={
              <div class="py-8 text-center">
                <button type="button" class="btn-link text-fg-accent font-semibold hover:underline" onClick={() => setLoaded(true)}>
                  Load diff
                </button>
                <p class="text-sm text-fg-muted mt-1">
                  {props.file.status === 'removed' ? 'This file was deleted.' : 'Large diffs are not rendered by default.'}
                </p>
              </div>
            }
          >
            <Show when={visible()} fallback={<div style={{ height: `${estimate()}px` }} />}>
              <div class={props.split ? '' : 'overflow-x-auto'}>
                <Show
                  when={props.split}
                  fallback={
                    <table class="diff-table table-auto! min-w-full w-max" style={{ 'border-spacing': 0 }}>
                      <tbody>
                        <For each={rows()}>
                          {(line) =>
                            line.type === 'hunk' ? (
                              <tr class={{ 'rgh-extend-diff-expander': wideExpand(line) }} onClick={(e) => onHunkRowClick(e, line)}>
                                <td colspan={2} class="blob-num blob-num-hunk p-0! cursor-default!">
                                  <ExpandButton hunk={line} />
                                </td>
                                <td class="blob-code blob-code-hunk">{line.text}</td>
                              </tr>
                            ) : (
                              <>
                                <tr class="group">
                                  <NumCell n={line.oldNo} side="LEFT" kind={line.type} />
                                  <NumCell n={line.newNo} side={line.type === 'del' ? 'LEFT' : 'RIGHT'} kind={line.type} />
                                  <CodeCell
                                    line={line}
                                    side={line.type === 'del' ? 'LEFT' : 'RIGHT'}
                                    n={line.type === 'del' ? line.oldNo : line.newNo}
                                    wrap={false}
                                  />
                                </tr>
                                <Show when={line.type !== 'add'}>
                                  <ExtrasRow side="LEFT" n={line.oldNo} cols={3} />
                                </Show>
                                <Show when={line.type !== 'del'}>
                                  <ExtrasRow side="RIGHT" n={line.newNo} cols={3} />
                                </Show>
                              </>
                            )
                          }
                        </For>
                        <Show when={canExpandEnd()}>
                          <tr>
                            <td colspan={2} class="blob-num blob-num-hunk p-0! cursor-default!">
                              <button
                                type="button"
                                class="w-full h-5 flex items-center justify-center text-fg-muted hover:text-fg-on-emphasis hover:bg-accent-emphasis"
                                aria-label="Expand below"
                                onClick={() => void expand(END)}
                              >
                                <Octicon icon={foldDownIcon} />
                              </button>
                            </td>
                            <td class="blob-code blob-code-hunk" />
                          </tr>
                        </Show>
                      </tbody>
                    </table>
                  }
                >
                  <table class="diff-table" style={{ 'border-spacing': 0 }}>
                    {/* Fixed layout sizes columns from the first row, so give it one cell per column. */}
                    <thead>
                      <tr class="h-0">
                        <th class="w-[50px] p-0" />
                        <th class="p-0" />
                        <th class="w-[50px] p-0" />
                        <th class="p-0" />
                      </tr>
                    </thead>
                    <tbody>
                      <For each={splitRows()}>
                        {(row) =>
                          row.kind === 'hunk' ? (
                            <tr class={{ 'rgh-extend-diff-expander': wideExpand(row.line) }} onClick={(e) => onHunkRowClick(e, row.line)}>
                              <td class="blob-num blob-num-hunk p-0! cursor-default!">
                                <ExpandButton hunk={row.line} />
                              </td>
                              <td colspan={3} class="blob-code blob-code-hunk">
                                {row.line.text}
                              </td>
                            </tr>
                          ) : (
                            <>
                              <tr class="group">
                                <NumCell
                                  n={row.left?.oldNo}
                                  side="LEFT"
                                  kind={row.left ? (row.left.type === 'del' ? 'del' : 'ctx') : 'empty'}
                                />
                                <CodeCell line={row.left} side="LEFT" n={row.left?.oldNo} wrap />
                                <NumCell
                                  n={row.right?.newNo}
                                  side="RIGHT"
                                  kind={row.right ? (row.right.type === 'add' ? 'add' : 'ctx') : 'empty'}
                                />
                                <CodeCell line={row.right} side="RIGHT" n={row.right?.newNo} wrap />
                              </tr>
                              <Show when={row.left && row.left.type === 'del'}>
                                <ExtrasRow side="LEFT" n={row.left?.oldNo} cols={4} />
                              </Show>
                              <Show when={row.right}>
                                <ExtrasRow side="RIGHT" n={row.right?.newNo} cols={4} />
                              </Show>
                            </>
                          )
                        }
                      </For>
                      <Show when={canExpandEnd()}>
                        <tr>
                          <td class="blob-num blob-num-hunk p-0! cursor-default!">
                            <button
                              type="button"
                              class="w-full h-5 flex items-center justify-center text-fg-muted hover:text-fg-on-emphasis hover:bg-accent-emphasis"
                              aria-label="Expand below"
                              onClick={() => void expand(END)}
                            >
                              <Octicon icon={foldDownIcon} />
                            </button>
                          </td>
                          <td colspan={3} class="blob-code blob-code-hunk" />
                        </tr>
                      </Show>
                    </tbody>
                  </table>
                </Show>
              </div>
            </Show>
          </Show>
        </Show>
      </Show>
    </div>
  );
}
