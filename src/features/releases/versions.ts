/** Version-tag helpers (Refined GitHub's unreleased-commits / tag-changes-link logic). */

/** Link to a release page by tag (slashes in tags stay path separators). */
export const tagHref = (base: string, tag: string) => `${base}/releases/tag/${tag.split('/').map(encodeURIComponent).join('/')}`;

const validVersion = /^[rv]?\d+(?:\.\d+)+/;
const prerelease = /^[rv]?\d+(?:\.\d+)+-\d/;

const parts = (v: string) => {
  const clean = v.replace(/^[^\d]+/, '');
  const dash = clean.indexOf('-');
  const main = (dash === -1 ? clean : clean.slice(0, dash)).split(/[.+]/).map((n) => Number.parseInt(n, 10) || 0);
  const pre = dash === -1 ? null : clean.slice(dash + 1).split('.');
  return { main, pre };
};

/** Semver-ish compare: -1 / 0 / 1. Pre-releases sort before their release. */
export function compareVersions(a: string, b: string): number {
  const A = parts(a);
  const B = parts(b);
  for (let i = 0; i < Math.max(A.main.length, B.main.length); i++) {
    const d = (A.main[i] ?? 0) - (B.main[i] ?? 0);
    if (d) return Math.sign(d);
  }
  if (!A.pre && !B.pre) return 0;
  if (!A.pre) return 1;
  if (!B.pre) return -1;
  for (let i = 0; i < Math.max(A.pre.length, B.pre.length); i++) {
    const x = A.pre[i];
    const y = B.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = Number(x);
    const ny = Number(y);
    const d = Number.isNaN(nx) || Number.isNaN(ny) ? x.localeCompare(y) : nx - ny;
    if (d) return Math.sign(d);
  }
  return 0;
}

/**
 * The newest version among tags listed newest-first. When some tags aren't
 * versions, comparing is meaningless: the first (newest) one wins.
 */
export function getLatestVersionTag(tags: string[]): string {
  if (tags.some((t) => !validVersion.test(t))) return tags[0]!;
  let releases = tags.filter((t) => !prerelease.test(t));
  if (!releases.length) releases = tags;
  let latest = releases[0]!;
  for (const t of releases) if (compareVersions(latest, t) < 0) latest = t;
  return latest;
}

/** "pkg@1.2.3" → { namespace: "pkg", version: "1.2.3" }. */
export function parseTag(tag: string) {
  const m = /(?:(?<namespace>.*)@)?(?<version>[^@]+)/.exec(tag);
  return { namespace: m?.groups?.namespace ?? '', version: m?.groups?.version ?? '' };
}

export interface TagCommit {
  name: string;
  oid: string;
}

/**
 * The tag a tag's changes are counted from: the next older tag (in the
 * newest-first list) on another commit with a lower version, preferring the
 * same namespace (`pkg@1.2` → `pkg@1.1`).
 */
export function previousTag(tag: string, tags: TagCommit[]): string | undefined {
  const index = tags.findIndex((t) => t.name === tag);
  if (index === -1) return undefined;
  const current = tags[index]!;
  const { version, namespace } = parseTag(current.name);
  let otherNamespace: string | undefined;
  for (const next of tags.slice(index + 1)) {
    if (next.oid === current.oid) continue;
    const parsed = parseTag(next.name);
    if (compareVersions(version, parsed.version) < 1) continue;
    if (parsed.namespace === namespace) return next.name;
    otherNamespace ??= next.name;
  }
  return otherNamespace;
}
