/**
 * Helpers for GitHub's issue search syntax (`is:issue state:open label:"good first issue"`),
 * used by the list pages to edit the query from the filter menus.
 */

const TOKEN = /(-?[\w-]+):("[^"]*"|\S+)|"[^"]*"|\S+/g;

export interface Token {
  raw: string;
  key?: string;
  value?: string;
  negated?: boolean;
}

export function tokenize(q: string): Token[] {
  const out: Token[] = [];
  for (const m of q.matchAll(TOKEN)) {
    if (m[1]) {
      const negated = m[1].startsWith('-');
      out.push({ raw: m[0], key: (negated ? m[1].slice(1) : m[1]).toLowerCase(), value: unquote(m[2]!), negated });
    } else out.push({ raw: m[0] });
  }
  return out;
}

const unquote = (v: string) => (v.startsWith('"') && v.endsWith('"') && v.length > 1 ? v.slice(1, -1) : v);
export const quote = (v: string) => (/[\s"]/.test(v) ? `"${v.replace(/"/g, '')}"` : v);

/** Values of a qualifier (non-negated), e.g. qualifiers(q, 'label'). */
export const qualifiers = (q: string, key: string) =>
  tokenize(q)
    .filter((t) => t.key === key && !t.negated)
    .map((t) => t.value!);

export const qualifier = (q: string, key: string) => qualifiers(q, key)[0];

/** Replace every `key:` token with the given values (none = remove the qualifier). */
export function setQualifier(q: string, key: string | string[], values: string | string[] | null | undefined) {
  const keys = Array.isArray(key) ? key : [key];
  const kept = tokenize(q).filter((t) => !(t.key && keys.includes(t.key) && !t.negated));
  const list = values == null ? [] : Array.isArray(values) ? values : [values];
  return [...kept.map((t) => t.raw), ...list.map((v) => `${keys[0]}:${quote(v)}`)].join(' ').trim();
}

/** Drop `is:open`, `state:closed`, `is:merged`… so the counts can add their own state. */
export function withoutState(q: string) {
  return tokenize(q)
    .filter((t) => !((t.key === 'is' || t.key === 'state') && /^(open|closed|merged|unmerged)$/i.test(t.value!)))
    .map((t) => t.raw)
    .join(' ');
}

/** The state the query filters on ("open" / "closed" / undefined). */
export function stateOf(q: string): 'open' | 'closed' | 'merged' | undefined {
  for (const t of tokenize(q)) {
    if ((t.key === 'is' || t.key === 'state') && !t.negated) {
      const v = t.value!.toLowerCase();
      if (v === 'open' || v === 'closed' || v === 'merged') return v;
    }
  }
  return undefined;
}

export function withState(q: string, state: 'open' | 'closed') {
  return `${withoutState(q)} state:${state}`.trim();
}

/** Remove `repo:` qualifiers (the repo pages add their own). */
export const withoutRepo = (q: string) => setQualifier(q, 'repo', null);

export const SORTS = [
  { value: 'created-desc', label: 'Newest' },
  { value: 'created-asc', label: 'Oldest' },
  { value: 'comments-desc', label: 'Most commented' },
  { value: 'comments-asc', label: 'Least commented' },
  { value: 'updated-desc', label: 'Recently updated' },
  { value: 'updated-asc', label: 'Least recently updated' },
  { value: 'reactions-+1-desc', label: '👍 Most thumbs up' },
  { value: 'reactions-desc', label: 'Most reactions' },
] as const;
