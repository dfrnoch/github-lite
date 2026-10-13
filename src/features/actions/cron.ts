/**
 * Next run time of a GitHub Actions `schedule` cron (5 fields, UTC):
 * `minute hour day-of-month month day-of-week`, with `*`, lists, ranges,
 * steps and JAN–DEC / SUN–SAT names.
 */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function field(spec: string, min: number, max: number, names?: string[], nameOffset = 0): Set<number> | null {
  const out = new Set<number>();
  const value = (s: string) => {
    const i = names?.indexOf(s.toUpperCase()) ?? -1;
    if (i !== -1) return i + nameOffset;
    const n = Number(s);
    if (!Number.isInteger(n)) throw new Error(`bad cron value ${s}`);
    return n;
  };
  for (const part of spec.split(',')) {
    const [range = '*', stepText] = part.split('/');
    const step = stepText ? Number(stepText) : 1;
    if (!Number.isInteger(step) || step < 1) return null;
    let lo = min;
    let hi = max;
    if (range !== '*') {
      const [a, b] = range.split('-');
      lo = value(a!);
      hi = b === undefined ? (stepText ? max : lo) : value(b);
    }
    if (lo < min || hi > max || lo > hi) return null;
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

export function nextCronDate(expr: string, from = new Date()): Date | null {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) return null;
  try {
    const minutes = field(f[0]!, 0, 59);
    const hours = field(f[1]!, 0, 23);
    const dom = field(f[2]!, 1, 31);
    const months = field(f[3]!, 1, 12, MONTHS, 1);
    const dowRaw = field(f[4]!, 0, 7, DAYS);
    if (!minutes || !hours || !dom || !months || !dowRaw) return null;
    const dow = new Set([...dowRaw].map((d) => d % 7));
    const domAny = f[2] === '*';
    const dowAny = f[4] === '*';
    const mins = [...minutes].sort((a, b) => a - b);
    const hrs = [...hours].sort((a, b) => a - b);
    const start = new Date(from.getTime() + 60_000);
    start.setUTCSeconds(0, 0);
    for (let d = 0; d < 366 * 4; d++) {
      const day = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + d));
      if (!months.has(day.getUTCMonth() + 1)) continue;
      const domHit = dom.has(day.getUTCDate());
      const dowHit = dow.has(day.getUTCDay());
      // Both restricted: either matches (cron's OR rule).
      const dayOk = domAny && dowAny ? true : domAny ? dowHit : dowAny ? domHit : domHit || dowHit;
      if (!dayOk) continue;
      for (const h of hrs) {
        for (const m of mins) {
          const t = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m);
          if (t >= start.getTime()) return new Date(t);
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** `cron:` entries of a workflow's `on.schedule`. */
export function workflowCrons(source: string): string[] {
  return [...source.matchAll(/^\s*-?\s*cron\s*:\s*["']?([^"'\n#]+?)["']?\s*(?:#.*)?$/gm)].map((m) => m[1]!.trim());
}
