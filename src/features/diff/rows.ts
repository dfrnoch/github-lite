// @unocss-include — the class names in the HTML strings below must be generated.
/**
 * Diff rows as HTML strings. A diff body is rendered in chunks of rows (one
 * `<tbody>` each, see DiffView's `Chunk`) straight from these strings instead
 * of one reactive component per cell — a 10k-line diff would otherwise create
 * hundreds of thousands of reactive nodes. Clicks are handled by delegation
 * through the `data-*` attributes emitted here.
 */
import { foldUpIcon, plusIcon, unfoldIcon, type OcticonData } from '../../icons/octicons';
import { escapeHtml, type DiffLine, type Side, type SplitRow } from './parse';

/** Rows per `<tbody>` chunk — the unit of lazy mounting. */
export const CHUNK_ROWS = 80;
/** Height of one diff row (`.blob-code` line-height). */
export const ROW_HEIGHT = 20;

export interface Selection {
  side: Side;
  start: number;
  end: number;
}

export interface RowRenderContext {
  /** HTML of a line's code (highlighted / escaped, transformed). */
  html: (line: DiffLine) => string;
  selection: Selection | null;
  /** Show the hover "+" (add a review comment) button. */
  commentable: boolean;
  /** Hunk rows get an expand button. */
  canExpand: (hunk: DiffLine) => boolean;
  /** extend-diff-expander: the whole hunk row expands. */
  wideExpand: (hunk: DiffLine) => boolean;
}

function svg(icon: OcticonData, size = 16) {
  const d = icon.sizes[16]!;
  const w = (d.width * size) / 16;
  return `<svg class="octicon" width="${w}" height="${size}" viewBox="0 0 ${d.width} 16" aria-hidden="true">${d.d.map((p) => `<path d="${p}"></path>`).join('')}</svg>`;
}
const PLUS = svg(plusIcon, 12);
const FOLD_UP = svg(foldUpIcon);
const UNFOLD = svg(unfoldIcon);

const selected = (sel: Selection | null, side: Side, n: number | undefined) =>
  !!sel && n != null && sel.side === side && n >= sel.start && n <= sel.end;

type NumKind = 'add' | 'del' | 'ctx' | 'empty';

function numCell(n: number | undefined, side: Side, kind: NumKind, sel: Selection | null) {
  let cls = 'blob-num';
  if (kind === 'add') cls += ' blob-num-addition';
  else if (kind === 'del') cls += ' blob-num-deletion';
  else if (kind === 'empty') cls += ' bg-canvas-muted cursor-default!';
  if (selected(sel, side, n)) cls += ' highlighted-line';
  return n == null ? `<td class="${cls}"></td>` : `<td class="${cls}" data-line-number="${n}" data-side="${side}"></td>`;
}

function codeCell(line: DiffLine | undefined, side: Side, n: number | undefined, wrap: boolean, ctx: RowRenderContext) {
  let cls = 'blob-code';
  if (!line) return `<td class="${cls} bg-canvas-muted${wrap ? ' whitespace-pre-wrap! break-all' : ''}"></td>`;
  if (line.type === 'add') cls += ' blob-code-addition';
  else if (line.type === 'del') cls += ' blob-code-deletion';
  if (selected(ctx.selection, side, n)) cls += ' highlighted-line';
  if (wrap) cls += ' whitespace-pre-wrap! break-all';
  const marker = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ';
  // Commentable cells only carry their slot; the "+" button is moved in on hover (see `commentButton`).
  const slot = ctx.commentable && n != null ? ` data-comment="${side}:${n}"` : '';
  const noNewline = line.noNewline ? '<span class="ml-2 text-fg-danger" title="No newline at end of file">⊖</span>' : '';
  return `<td class="${cls}"${slot}><span class="blob-code-marker" data-code-marker="${marker}"></span><span class="blob-code-inner shiki">${ctx.html(line)}</span>${noNewline}</td>`;
}

/**
 * The hover "+" (add a review comment) button. One per file is moved into
 * the hovered code cell (`td[data-comment]`) rather than rendered on every
 * line; it shows while its row is hovered.
 */
export function commentButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className =
    'absolute -left-2.5 top-0.5 z-1 w-5 h-4 rounded-md bg-accent-emphasis text-fg-on-emphasis items-center justify-center hidden group-hover:flex';
  button.setAttribute('aria-label', 'Add a comment on this line');
  button.innerHTML = PLUS;
  return button;
}

function expandButton(hunk: DiffLine, ctx: RowRenderContext) {
  if (!ctx.canExpand(hunk)) return '';
  return `<button type="button" class="w-full h-5 flex items-center justify-center text-fg-muted hover:text-fg-on-emphasis hover:bg-accent-emphasis" aria-label="Expand hidden lines" title="Expand hidden lines" data-expand="${hunk.hunkIndex}">${hunk.hunkIndex === 0 ? FOLD_UP : UNFOLD}</button>`;
}

function hunkRow(hunk: DiffLine, split: boolean, ctx: RowRenderContext) {
  const cls = ctx.wideExpand(hunk) ? ' class="rgh-extend-diff-expander"' : '';
  const num = `<td${split ? '' : ' colspan="2"'} class="blob-num blob-num-hunk p-0! cursor-default!">${expandButton(hunk, ctx)}</td>`;
  return `<tr${cls} data-hunk="${hunk.hunkIndex}">${num}<td${split ? ' colspan="3"' : ''} class="blob-code blob-code-hunk">${escapeHtml(hunk.text)}</td></tr>`;
}

/** One unified-view row. */
export function unifiedRowHtml(line: DiffLine, ctx: RowRenderContext): string {
  if (line.type === 'hunk') return hunkRow(line, false, ctx);
  const side: Side = line.type === 'del' ? 'LEFT' : 'RIGHT';
  const n = line.type === 'del' ? line.oldNo : line.newNo;
  return `<tr class="group">${numCell(line.oldNo, 'LEFT', line.type, ctx.selection)}${numCell(line.newNo, side, line.type, ctx.selection)}${codeCell(line, side, n, false, ctx)}</tr>`;
}

/** One split-view row. */
export function splitRowHtml(row: SplitRow, ctx: RowRenderContext): string {
  if (row.kind === 'hunk') return hunkRow(row.line, true, ctx);
  const { left, right } = row;
  const lk: NumKind = left ? (left.type === 'del' ? 'del' : 'ctx') : 'empty';
  const rk: NumKind = right ? (right.type === 'add' ? 'add' : 'ctx') : 'empty';
  return `<tr class="group">${numCell(left?.oldNo, 'LEFT', lk, ctx.selection)}${codeCell(left, 'LEFT', left?.oldNo, true, ctx)}${numCell(right?.newNo, 'RIGHT', rk, ctx.selection)}${codeCell(right, 'RIGHT', right?.newNo, true, ctx)}</tr>`;
}

/** Review-comment slots a row carries, in display order (see DiffView's `extraKeys`). */
export function unifiedRowSlots(line: DiffLine): [Side, number][] {
  if (line.type === 'hunk') return [];
  const out: [Side, number][] = [];
  if (line.type !== 'add' && line.oldNo != null) out.push(['LEFT', line.oldNo]);
  if (line.type !== 'del' && line.newNo != null) out.push(['RIGHT', line.newNo]);
  return out;
}
export function splitRowSlots(row: SplitRow): [Side, number][] {
  if (row.kind === 'hunk') return [];
  const out: [Side, number][] = [];
  if (row.left?.type === 'del' && row.left.oldNo != null) out.push(['LEFT', row.left.oldNo]);
  if (row.right?.newNo != null) out.push(['RIGHT', row.right.newNo]);
  return out;
}

/** Line-number span of a range of rows, per side — to tell whether a selection touches a chunk. */
export function lineSpan(lines: (DiffLine | undefined)[]) {
  let l0 = Infinity;
  let l1 = -Infinity;
  let r0 = Infinity;
  let r1 = -Infinity;
  for (const l of lines) {
    if (!l) continue;
    if (l.oldNo != null) {
      if (l.oldNo < l0) l0 = l.oldNo;
      if (l.oldNo > l1) l1 = l.oldNo;
    }
    if (l.newNo != null) {
      if (l.newNo < r0) r0 = l.newNo;
      if (l.newNo > r1) r1 = l.newNo;
    }
  }
  return { LEFT: [l0, l1] as const, RIGHT: [r0, r1] as const };
}

/** Expanded display width of a line (tabs at `tabSize`), for the unified table's width sizer. */
export function displayWidth(text: string, tabSize: number) {
  let w = 0;
  for (let i = 0; i < text.length; i++) w = text.charCodeAt(i) === 9 ? w + tabSize - (w % tabSize) : w + 1;
  return w;
}
