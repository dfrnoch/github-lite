/**
 * What the global header shows for the current URL (breadcrumbs, search
 * scope) — derived purely from the pathname, mirroring github.com's URL
 * layout: /:owner, /:owner/:repo/..., /orgs/:org/..., and reserved top-level
 * pages (/settings, /notifications, …).
 */

/** First path segments that are app pages rather than user/org logins. */
export const RESERVED = new Set([
  'settings',
  'notifications',
  'new',
  'login',
  'logout',
  'search',
  'orgs',
  'organizations',
  'pulls',
  'issues',
  'explore',
  'topics',
  'trending',
  'stars',
  'dashboard',
  'codespaces',
  'marketplace',
  'sponsors',
  'features',
  'about',
]);

export type HeaderContext =
  | { kind: 'dashboard' }
  | { kind: 'page'; title: string; href: string }
  | { kind: 'owner'; owner: string }
  | { kind: 'org'; org: string }
  | { kind: 'repo'; owner: string; repo: string };

const TITLES: Record<string, string> = {
  settings: 'Settings',
  notifications: 'Notifications',
  new: 'New repository',
  search: 'Search',
  pulls: 'Pull requests',
  issues: 'Issues',
  explore: 'Explore',
  topics: 'Topics',
  organizations: 'Organizations',
};

export function headerContext(pathname: string): HeaderContext {
  const [first, second] = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (!first) return { kind: 'dashboard' };
  if (first === 'orgs' && second) return { kind: 'org', org: second };
  if (RESERVED.has(first)) return { kind: 'page', title: TITLES[first] ?? first, href: `/${first}` };
  if (second) return { kind: 'repo', owner: first, repo: second };
  return { kind: 'owner', owner: first };
}
