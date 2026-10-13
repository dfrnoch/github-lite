import { ansiToHtml, newAnsiState, stripAnsi } from './ansi';
import type { JobStep } from './types';

/** One rendered log line of a step. */
export interface LogLine {
  /** 1-based line number within the step (what github.com shows). */
  n: number;
  /** ISO timestamp the runner prefixed the line with. */
  time: string | null;
  /** Safe HTML (ANSI colors converted, HTML escaped). */
  html: string;
  /** Plain text without escapes (for search). */
  plain: string;
  kind: 'normal' | 'group' | 'error' | 'warning' | 'notice' | 'debug' | 'command';
  /** Line number (`n`) of the `##[group]` header this line is folded under. */
  group: number | null;
}

export interface StepLog {
  lines: LogLine[];
}

const TS_RE = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z) ?(.*)$/;

interface RawLine {
  time: string | null;
  ms: number;
  text: string;
}

function splitRaw(text: string): RawLine[] {
  const out: RawLine[] = [];
  let lastTime: string | null = null;
  let lastMs = 0;
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  for (const line of lines) {
    const m = TS_RE.exec(line);
    if (m) {
      lastTime = m[1]!;
      lastMs = Date.parse(lastTime);
      out.push({ time: lastTime, ms: lastMs, text: m[2]! });
    } else {
      // A multi-line value (e.g. a `run:` script echoed in a group) continues the previous line.
      out.push({ time: lastTime, ms: lastMs, text: line });
    }
  }
  return out;
}

/** Does `content` open the log of `step`? */
function isStepStart(content: string, step: JobStep) {
  const name = step.name;
  if (name === 'Complete job') return content.startsWith('Cleaning up orphan processes');
  if (name.startsWith('Post ')) return content === 'Post job cleanup.';
  if (!content.startsWith('##[group]Run ')) return false;
  if (name.startsWith('Run ')) {
    const marker = content.slice('##[group]'.length);
    const n = Math.min(30, marker.length, name.length);
    return marker.slice(0, n) === name.slice(0, n);
  }
  return true; // a custom-named step: its first group is "Run <uses|script>"
}

/**
 * Split a job's log into its steps. The REST API only offers the whole job
 * log; steps report start/end times with one-second precision, so a line
 * starts the next step when it is the step's opening marker (`##[group]Run …`,
 * `Post job cleanup.`) at or after the step's start second, or when it is past
 * the current step's end second.
 */
export function splitLogBySteps(text: string, steps: JobStep[]): Map<number, StepLog> {
  const raw = splitRaw(text);
  const active = steps
    .filter((s) => s.conclusion !== 'skipped' && s.started_at)
    .sort((a, b) => a.number - b.number);
  const buckets = new Map<number, RawLine[]>();
  if (!active.length) {
    buckets.set(0, raw);
  } else {
    let i = 0;
    for (const line of raw) {
      while (i + 1 < active.length) {
        const cur = active[i]!;
        const next = active[i + 1]!;
        const curEnd = cur.completed_at ? Date.parse(cur.completed_at) : Infinity;
        const nextStart = Date.parse(next.started_at!);
        if (line.ms >= curEnd + 1000 || (line.ms >= nextStart && isStepStart(line.text, next))) i++;
        else break;
      }
      const num = active[i]!.number;
      let bucket = buckets.get(num);
      if (!bucket) buckets.set(num, (bucket = []));
      bucket.push(line);
    }
  }
  const out = new Map<number, StepLog>();
  for (const [num, lines] of buckets) out.set(num, { lines: toLogLines(lines) });
  return out;
}

function toLogLines(raw: RawLine[]): LogLine[] {
  const out: LogLine[] = [];
  const ansi = newAnsiState();
  let group: number | null = null;
  for (const r of raw) {
    let text = r.text;
    let kind: LogLine['kind'] = 'normal';
    if (text.startsWith('##[endgroup]')) {
      group = null;
      continue;
    }
    const cmd = /^##\[(group|error|warning|notice|debug|command|section)\]/.exec(text);
    if (cmd) {
      text = text.slice(cmd[0].length);
      kind = cmd[1] === 'section' ? 'normal' : (cmd[1] as LogLine['kind']);
    } else if (text.startsWith('[command]')) {
      text = text.slice('[command]'.length);
      kind = 'command';
    }
    const n = out.length + 1;
    if (kind === 'group') {
      out.push({ n, time: r.time, html: ansiToHtml(text, ansi), plain: stripAnsi(text), kind, group: null });
      group = n;
      continue;
    }
    const prefix = kind === 'error' ? 'Error: ' : kind === 'warning' ? 'Warning: ' : kind === 'notice' ? 'Notice: ' : '';
    out.push({
      n,
      time: r.time,
      html: (prefix ? `<span class="log-prefix">${prefix}</span>` : '') + ansiToHtml(text, ansi),
      plain: prefix + stripAnsi(text),
      kind,
      group,
    });
  }
  return out;
}
