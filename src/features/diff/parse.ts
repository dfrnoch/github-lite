/**
 * Unified-diff parsing for GitHub's `patch` strings (REST `files[].patch`):
 * hunks, line numbers, split-view pairing and word-level change ranges.
 */

export type Side = 'LEFT' | 'RIGHT';

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  /** Text after the second `@@` (usually the enclosing function). */
  section: string;
  /** The full `@@ -a,b +c,d @@ section` header. */
  header: string;
}

export interface DiffLine {
  type: 'ctx' | 'add' | 'del' | 'hunk';
  /** Line content without the +/-/space marker. */
  text: string;
  oldNo?: number;
  newNo?: number;
  /** Set on `hunk` lines. */
  hunk?: Hunk;
  /** Index of the hunk this line belongs to. */
  hunkIndex: number;
  /** "\ No newline at end of file" followed this line. */
  noNewline?: boolean;
  /** Changed character range for word-level highlighting. */
  word?: [number, number];
}

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;

export function parsePatch(patch: string | undefined): DiffLine[] {
  if (!patch) return [];
  const out: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;
  let hunkIndex = -1;
  const raw = patch.split('\n');
  // A trailing newline yields an empty last element, not a context line.
  if (raw.length && raw[raw.length - 1] === '') raw.pop();
  for (const line of raw) {
    if (line.startsWith('@@')) {
      const m = HUNK_RE.exec(line);
      if (!m) continue;
      hunkIndex++;
      const hunk: Hunk = {
        oldStart: Number(m[1]),
        oldLines: m[2] == null ? 1 : Number(m[2]),
        newStart: Number(m[3]),
        newLines: m[4] == null ? 1 : Number(m[4]),
        section: m[5] ?? '',
        header: line,
      };
      oldNo = hunk.oldStart;
      newNo = hunk.newStart;
      out.push({ type: 'hunk', text: line, hunk, hunkIndex });
      continue;
    }
    if (line.startsWith('\\')) {
      const prev = out[out.length - 1];
      if (prev) prev.noNewline = true;
      continue;
    }
    const marker = line[0];
    const text = line.slice(1);
    if (marker === '+') out.push({ type: 'add', text, newNo: newNo++, hunkIndex });
    else if (marker === '-') out.push({ type: 'del', text, oldNo: oldNo++, hunkIndex });
    else out.push({ type: 'ctx', text, oldNo: oldNo++, newNo: newNo++, hunkIndex });
  }
  markWordChanges(out);
  return out;
}

/**
 * For each block of deletions directly followed by additions, pair the lines
 * one-to-one and record the differing middle (after the common prefix and
 * suffix) — GitHub's word-level highlight.
 */
function markWordChanges(lines: DiffLine[]) {
  let i = 0;
  while (i < lines.length) {
    if (lines[i]!.type !== 'del') {
      i++;
      continue;
    }
    const delStart = i;
    while (i < lines.length && lines[i]!.type === 'del') i++;
    const addStart = i;
    while (i < lines.length && lines[i]!.type === 'add') i++;
    const dels = addStart - delStart;
    const adds = i - addStart;
    if (!adds || dels !== adds) continue;
    for (let k = 0; k < dels; k++) {
      const a = lines[delStart + k]!;
      const b = lines[addStart + k]!;
      const range = changedRange(a.text, b.text);
      if (!range) continue;
      a.word = range.old;
      b.word = range.new;
    }
  }
}

function changedRange(a: string, b: string) {
  if (a === b) return null;
  const max = Math.min(a.length, b.length);
  let pre = 0;
  while (pre < max && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < max - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  // Nothing in common: the whole line changed, which the line color already says.
  if (pre + suf === 0) return null;
  const oldRange: [number, number] = [pre, a.length - suf];
  const newRange: [number, number] = [pre, b.length - suf];
  // Mostly-rewritten lines read better without a highlight.
  if (oldRange[1] - oldRange[0] > a.length * 0.7 && newRange[1] - newRange[0] > b.length * 0.7) return null;
  return { old: oldRange, new: newRange };
}

export type SplitRow =
  | { kind: 'hunk'; line: DiffLine }
  | { kind: 'pair'; left?: DiffLine; right?: DiffLine };

/** Pair deletions with additions side by side; context lines appear on both sides. */
export function toSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.type === 'hunk') {
      rows.push({ kind: 'hunk', line });
      i++;
    } else if (line.type === 'ctx') {
      rows.push({ kind: 'pair', left: line, right: line });
      i++;
    } else {
      const dels: DiffLine[] = [];
      const adds: DiffLine[] = [];
      while (i < lines.length && lines[i]!.type === 'del') dels.push(lines[i++]!);
      while (i < lines.length && lines[i]!.type === 'add') adds.push(lines[i++]!);
      for (let k = 0; k < Math.max(dels.length, adds.length); k++) rows.push({ kind: 'pair', left: dels[k], right: adds[k] });
    }
  }
  return rows;
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ESC[c]!);

/**
 * Wrap the text range [start, end) of an HTML fragment (flat Shiki spans or
 * escaped text) in `<span class="x">`, splitting around tags so the result
 * stays well-formed.
 */
export function markRange(html: string, start: number, end: number): string {
  if (start >= end) return html;
  let out = '';
  let pos = 0;
  let open = false;
  let i = 0;
  while (i < html.length) {
    const ch = html[i]!;
    if (ch === '<') {
      const close = html.indexOf('>', i);
      if (open) {
        out += '</span>';
        open = false;
      }
      out += html.slice(i, close + 1);
      i = close + 1;
      continue;
    }
    let len = 1;
    if (ch === '&') {
      const semi = html.indexOf(';', i);
      if (semi > i && semi - i < 10) len = semi - i + 1;
    }
    if (pos >= start && pos < end && !open) {
      out += '<span class="x">';
      open = true;
    } else if (pos >= end && open) {
      out += '</span>';
      open = false;
    }
    out += html.slice(i, i + len);
    i += len;
    pos++;
  }
  if (open) out += '</span>';
  return out;
}

/** Five-square diffstat like github.com: [added, deleted, neutral] block counts. */
export function diffstatBlocks(additions: number, deletions: number): [number, number, number] {
  const total = additions + deletions;
  if (!total) return [0, 0, 5];
  let add: number;
  let del: number;
  if (total <= 5) {
    add = additions;
    del = deletions;
  } else {
    add = Math.floor((additions / total) * 5);
    del = Math.floor((deletions / total) * 5);
    if (additions && !add) add = 1;
    if (deletions && !del) del = 1;
    while (add + del > 5) {
      if (additions > deletions) add--;
      else del--;
    }
  }
  return [add, del, 5 - add - del];
}

// ---------------------------------------------------------------------------
// SHA-256 (sync) — github.com anchors files in a diff as `#diff-<sha256(path)>`.

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);

export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const len = bytes.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, len * 8);
  view.setUint32(padded.length - 8, Math.floor((len * 8) / 2 ** 32));
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(off + t * 4);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15]!, 7) ^ rotr(w[t - 15]!, 18) ^ (w[t - 15]! >>> 3);
      const s1 = rotr(w[t - 2]!, 17) ^ rotr(w[t - 2]!, 19) ^ (w[t - 2]! >>> 10);
      w[t] = (w[t - 16]! + s0 + w[t - 7]! + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h as unknown as number[];
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e!, 6) ^ rotr(e!, 11) ^ rotr(e!, 25);
      const ch = (e! & f!) ^ (~e! & g!);
      const t1 = (hh! + S1 + ch + K[t]! + w[t]!) | 0;
      const S0 = rotr(a!, 2) ^ rotr(a!, 13) ^ rotr(a!, 22);
      const maj = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const t2 = (S0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d! + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] = h[0]! + a!;
    h[1] = h[1]! + b!;
    h[2] = h[2]! + c!;
    h[3] = h[3]! + d!;
    h[4] = h[4]! + e!;
    h[5] = h[5]! + f!;
    h[6] = h[6]! + g!;
    h[7] = h[7]! + hh!;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('');
}

/** github.com's anchor for a file in a diff. */
export const diffAnchor = (path: string) => `diff-${sha256Hex(path)}`;

// ---------------------------------------------------------------------------
// Hide whitespace (`git diff -w`, github.com's `?w=1`)

const squash = (s: string) => s.replace(/\s+/g, '');
/** Blocks bigger than this keep their raw diff (LCS is quadratic). */
const MAX_WS_BLOCK = 400;

/**
 * Approximate `git diff --ignore-all-space` on an already-parsed patch: inside
 * each run of deletions + additions, lines that only differ in whitespace are
 * aligned (LCS) and shown once as context. Returns new line objects; the input
 * is left untouched.
 */
export function ignoreWhitespaceChanges(lines: DiffLine[]): DiffLine[] {
  const out: DiffLine[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.type !== 'del' && line.type !== 'add') {
      out.push({ ...line, word: undefined });
      i++;
      continue;
    }
    const dels: DiffLine[] = [];
    const adds: DiffLine[] = [];
    while (i < lines.length && (lines[i]!.type === 'del' || lines[i]!.type === 'add')) {
      const l = lines[i++]!;
      (l.type === 'del' ? dels : adds).push(l);
    }
    if (!dels.length || !adds.length || dels.length * adds.length > MAX_WS_BLOCK * MAX_WS_BLOCK) {
      for (const l of [...dels, ...adds]) out.push({ ...l, word: undefined });
      continue;
    }
    const a = dels.map((l) => squash(l.text));
    const b = adds.map((l) => squash(l.text));
    // LCS table (suffix form) for an in-order alignment.
    const n = a.length;
    const m = b.length;
    const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let x = n - 1; x >= 0; x--)
      for (let y = m - 1; y >= 0; y--) dp[x]![y] = a[x] === b[y] ? dp[x + 1]![y + 1]! + 1 : Math.max(dp[x + 1]![y]!, dp[x]![y + 1]!);
    let x = 0;
    let y = 0;
    const pendingDel: DiffLine[] = [];
    const pendingAdd: DiffLine[] = [];
    const flush = () => {
      for (const l of pendingDel) out.push({ ...l, word: undefined });
      for (const l of pendingAdd) out.push({ ...l, word: undefined });
      pendingDel.length = 0;
      pendingAdd.length = 0;
    };
    while (x < n || y < m) {
      if (x < n && y < m && a[x] === b[y]) {
        flush();
        const add = adds[y]!;
        out.push({ type: 'ctx', text: add.text, oldNo: dels[x]!.oldNo, newNo: add.newNo, hunkIndex: add.hunkIndex, noNewline: add.noNewline });
        x++;
        y++;
      } else if (y >= m || (x < n && dp[x + 1]![y]! >= dp[x]![y + 1]!)) pendingDel.push(dels[x++]!);
      else pendingAdd.push(adds[y++]!);
    }
    flush();
  }
  markWordChanges(out);
  return out;
}
