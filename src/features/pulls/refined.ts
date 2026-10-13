/** Pure helpers for the Refined GitHub pull request features (see registry/pulls.ts). */
import type { SquashCommit } from './api';

/** sync-pr-commit-title: "Title (#12)" → "Title". */
export const cleanPrCommitTitle = (title: string, pr: number) => title.replace(new RegExp(String.raw`\(#${pr}\)\s*$`), '').trim();

const noreplyUser = (author: string) => /<(?:\d+\+)?([^<>@]+)@users\.noreply\.github\.com>/i.exec(author)?.[1];

/**
 * clear-pr-merge-commit-message: keep only (deduplicated) Co-authored-by and
 * Signed-off-by trailers, dropping co-authors in `excludeUsers`. With
 * `closingKeywords` (PR not against the default branch, where GitHub won't
 * close issues) "Fixes #1" lines are kept too.
 */
export function cleanCommitMessage(message: string, closingKeywords = false, excludeUsers: string[] = []) {
  const kept = new Set<string>();
  for (const m of message.matchAll(/co-authored-by: ([^\n]+)/gi)) {
    const user = noreplyUser(m[1]!);
    if (user && excludeUsers.some((u) => u.toLowerCase() === user.toLowerCase())) continue;
    kept.add(`Co-authored-by: ${m[1]!.trim()}`);
  }
  for (const m of message.matchAll(/signed-off-by: ([^\n]+)/gi)) kept.add(`Signed-off-by: ${m[1]!.trim()}`);
  if (closingKeywords) for (const [line] of message.matchAll(/(?:fix|fixe|close|resolve)(?:s|d)?\s+(?:#\d+|https?:\S+)/gi)) kept.add(line);
  return [...kept].join('\n');
}

/**
 * The squash commit message GitHub would prefill (per the repo's setting),
 * including Co-authored-by trailers for other commit authors.
 */
export function defaultSquashMessage(commits: SquashCommit[], opts: { setting: string; body: string; title: string; prAuthor: string | null }) {
  const main =
    opts.setting === 'PR_BODY' ? opts.body : opts.setting === 'BLANK' ? '' : commits.map((c) => `* ${c.message.trim()}`).join('\n\n');
  const trailers = new Set<string>();
  for (const c of commits)
    for (const a of c.authors) {
      if (!a.email || (a.login && a.login === opts.prAuthor)) continue;
      const line = `Co-authored-by: ${a.name ?? a.login ?? a.email} <${a.email}>`;
      if (!main.includes(line)) trailers.add(line);
    }
  return [main.trim(), [...trailers].join('\n')].filter(Boolean).join('\n\n');
}

/**
 * pr-branch-auto-delete: the extension's list of long-lived branch names.
 * Space/comma separated; `/regex/`, globs with `*`, or exact names.
 */
export const DEFAULT_BRANCH_EXCEPTIONS = 'dev develop development main master next pre prod stage staging /production/ /^release/ /^v\\d/';

export function matchesBranchPattern(branch: string, patterns: string) {
  return patterns
    .split(/[\s,]+/)
    .filter(Boolean)
    .some((p) => {
      if (p.length > 2 && p.startsWith('/') && p.endsWith('/')) {
        try {
          return new RegExp(p.slice(1, -1)).test(branch);
        } catch {
          return false;
        }
      }
      if (p.includes('*')) return new RegExp(`^${p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(branch);
      return p === branch;
    });
}
