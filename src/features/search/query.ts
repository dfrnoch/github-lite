/** Helpers for GitHub search query strings (`solid language:TypeScript is:pr`). */

/** Split a query into tokens, keeping quoted phrases (`"foo bar"`, `label:"good first issue"`) together. */
export function tokenize(q: string): string[] {
  return q.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
}

const QUALIFIER = /^-?[a-z_-]+:/i;

/** The free-text words of a query (no qualifiers, no operators) — used to highlight matches. */
export function freeTerms(q: string): string[] {
  return tokenize(q)
    .filter((t) => !QUALIFIER.test(t) && !/^(AND|OR|NOT)$/.test(t))
    .map((t) => t.replace(/^"|"$/g, ''))
    .filter((t) => t.length > 1);
}

/**
 * Add `is:issue` / `is:pr` unless the query already names a type. With
 * `force`, an existing type qualifier is replaced (sidebar counts).
 */
export function withType(q: string, kind: 'issue' | 'pr', force = false) {
  const tokens = tokenize(q);
  const isType = (t: string) => /^is:(issue|pr|pull-request|pullrequest)$/i.test(t) || /^type:(issue|pr)$/i.test(t);
  if (!force && tokens.some(isType)) return q;
  return [...tokens.filter((t) => !isType(t)), `is:${kind}`].join(' ');
}

/** Whether the query contains `key:value` (case-insensitive). */
export function hasQualifier(q: string, key: string, value: string) {
  const v = value.includes(' ') ? `"${value}"` : value;
  return tokenize(q).some((t) => t.toLowerCase() === `${key}:${v}`.toLowerCase());
}

/** Toggle `key:value` in the query (replacing any other value of the same key). */
export function toggleQualifier(q: string, key: string, value: string) {
  const v = value.includes(' ') ? `"${value}"` : value;
  const tokens = tokenize(q);
  const had = hasQualifier(q, key, value);
  const rest = tokens.filter((t) => !t.toLowerCase().startsWith(`${key.toLowerCase()}:`));
  return (had ? rest : [...rest, `${key}:${v}`]).join(' ');
}

/** Split `text` into plain and highlighted parts for the given terms (case-insensitive). */
export function highlightParts(text: string, terms: string[]): { text: string; match: boolean }[] {
  if (!text || !terms.length) return [{ text, match: false }];
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length);
  const split = new RegExp(`(${escaped.join('|')})`, 'gi');
  const whole = new RegExp(`^(?:${escaped.join('|')})$`, 'i');
  return text
    .split(split)
    .filter(Boolean)
    .map((part) => ({ text: part, match: whole.test(part) }));
}

/** Split a text-match fragment into parts using the API's match indices. */
export function fragmentParts(fragment: string, matches: { indices: [number, number] }[]) {
  const out: { text: string; match: boolean }[] = [];
  let pos = 0;
  for (const m of [...matches].sort((a, b) => a.indices[0] - b.indices[0])) {
    const [start, end] = m.indices;
    if (start < pos) continue;
    if (start > pos) out.push({ text: fragment.slice(pos, start), match: false });
    out.push({ text: fragment.slice(start, end), match: true });
    pos = end;
  }
  if (pos < fragment.length) out.push({ text: fragment.slice(pos), match: false });
  return out;
}
