/**
 * Line diff (LCS on the changed middle) → unified patch text in GitHub's
 * `patch` format, so edits can be previewed with DiffView.
 */

const MAX_CELLS = 6_000_000;

type Op = { type: ' ' | '-' | '+'; text: string };

function diffLines(a: string[], b: string[]): Op[] | null {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const n = endA - start;
  const m = endB - start;
  if ((n + 1) * (m + 1) > MAX_CELLS) return null;
  // lcs[i][j] = LCS length of a[start+i..endA) and b[start+j..endB)
  const width = m + 1;
  const lcs = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * width + j] =
        a[start + i] === b[start + j] ? lcs[(i + 1) * width + j + 1]! + 1 : Math.max(lcs[(i + 1) * width + j]!, lcs[i * width + j + 1]!);
    }
  }
  const ops: Op[] = a.slice(0, start).map((text) => ({ type: ' ', text }));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[start + i] === b[start + j]) {
      ops.push({ type: ' ', text: a[start + i]! });
      i++;
      j++;
    } else if (lcs[(i + 1) * width + j]! >= lcs[i * width + j + 1]!) {
      ops.push({ type: '-', text: a[start + i++]! });
    } else {
      ops.push({ type: '+', text: b[start + j++]! });
    }
  }
  while (i < n) ops.push({ type: '-', text: a[start + i++]! });
  while (j < m) ops.push({ type: '+', text: b[start + j++]! });
  for (let k = endA; k < a.length; k++) ops.push({ type: ' ', text: a[k]! });
  return ops;
}

const splitLines = (s: string) => {
  if (!s) return [];
  const lines = s.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
};

/** Unified patch between two texts (3 lines of context), plus +/- counts. Null when too large to diff here. */
export function unifiedPatch(before: string, after: string, context = 3) {
  const ops = diffLines(splitLines(before), splitLines(after));
  if (!ops) return null;
  let additions = 0;
  let deletions = 0;
  const changed = ops.map((o) => o.type !== ' ');
  ops.forEach((o) => {
    if (o.type === '+') additions++;
    if (o.type === '-') deletions++;
  });
  const out: string[] = [];
  let k = 0;
  // Old/new line numbers before ops[k].
  const oldAt: number[] = [];
  const newAt: number[] = [];
  let o = 1;
  let nn = 1;
  for (const op of ops) {
    oldAt.push(o);
    newAt.push(nn);
    if (op.type !== '+') o++;
    if (op.type !== '-') nn++;
  }
  while (k < ops.length) {
    if (!changed[k]) {
      k++;
      continue;
    }
    let from = Math.max(0, k - context);
    let to = k;
    // Extend the hunk while changes are within 2*context lines of each other.
    for (;;) {
      while (to < ops.length && changed[to]) to++;
      let next = to;
      while (next < ops.length && !changed[next] && next - to < context * 2) next++;
      if (next < ops.length && changed[next]) to = next;
      else break;
    }
    const end = Math.min(ops.length, to + context);
    const slice = ops.slice(from, end);
    const oldLines = slice.filter((x) => x.type !== '+').length;
    const newLines = slice.filter((x) => x.type !== '-').length;
    const oldStart = oldLines ? oldAt[from]! : oldAt[from]! - 1;
    const newStart = newLines ? newAt[from]! : newAt[from]! - 1;
    out.push(`@@ -${oldStart},${oldLines} +${newStart},${newLines} @@`);
    for (const x of slice) out.push(x.type + x.text);
    k = end;
    from = end;
  }
  return { patch: out.join('\n'), additions, deletions };
}
