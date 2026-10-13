import { highlightLines } from '../../lib/highlight';
import { escapeHtml, markRange, type DiffLine } from './parse';

/** Patches above this many lines are shown without syntax colors. */
const MAX_HIGHLIGHT_LINES = 3000;

/** Plain (escaped) HTML for each line, with word-level marks. */
export function plainDiffHtml(lines: DiffLine[]): string[] {
  return lines.map((l) => (l.type === 'hunk' ? '' : withWord(escapeHtml(l.text), l)));
}

const withWord = (html: string, line: DiffLine) => (line.word ? markRange(html, line.word[0], line.word[1]) : html);

/**
 * Syntax-highlighted HTML for each line of a parsed patch. The old side
 * (context + deletions) and new side (context + additions) are highlighted as
 * two pseudo-files so multi-line tokens (comments, strings) carry over within
 * a hunk. Returns null for unknown languages / huge patches.
 */
export async function highlightDiff(lines: DiffLine[], filename: string): Promise<string[] | null> {
  if (lines.length > MAX_HIGHLIGHT_LINES) return null;
  const oldIdx: number[] = [];
  const newIdx: number[] = [];
  lines.forEach((l, i) => {
    if (l.type === 'ctx' || l.type === 'del') oldIdx.push(i);
    if (l.type === 'ctx' || l.type === 'add') newIdx.push(i);
  });
  const [oldHl, newHl] = await Promise.all([
    oldIdx.length ? highlightLines(oldIdx.map((i) => lines[i]!.text).join('\n'), filename) : Promise.resolve([]),
    newIdx.length ? highlightLines(newIdx.map((i) => lines[i]!.text).join('\n'), filename) : Promise.resolve([]),
  ]);
  if (!oldHl || !newHl) return null;
  const out = plainDiffHtml(lines);
  oldIdx.forEach((li, k) => {
    if (lines[li]!.type === 'del' && oldHl[k] != null) out[li] = withWord(oldHl[k]!, lines[li]!);
  });
  newIdx.forEach((li, k) => {
    if (newHl[k] != null) out[li] = withWord(newHl[k]!, lines[li]!);
  });
  return out;
}
