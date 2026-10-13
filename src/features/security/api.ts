import { query } from '@solidjs/router';
import { gh, GitHubError, gql } from '../../lib/github';
import type { SimpleUser } from '../../lib/types';

export interface Advisory {
  ghsa_id: string;
  cve_id: string | null;
  summary: string;
  description: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | null;
  state: 'published' | 'closed' | 'withdrawn' | 'draft' | 'triage';
  published_at: string | null;
  updated_at: string;
  created_at: string;
  author: SimpleUser | null;
  publisher: SimpleUser | null;
  html_url: string;
  cvss?: { score: number | null; vector_string: string | null } | null;
  cwes?: { cwe_id: string; name: string }[];
  vulnerabilities?: {
    package: { ecosystem: string; name: string | null } | null;
    vulnerable_version_range: string | null;
    patched_versions: string | null;
  }[];
  credits?: { login: string; type: string }[];
}

export interface DependabotAlert {
  number: number;
  state: 'open' | 'dismissed' | 'fixed' | 'auto_dismissed';
  html_url: string;
  created_at: string;
  dependency: { package: { ecosystem: string; name: string }; manifest_path: string; scope: string | null };
  security_advisory: { ghsa_id: string; summary: string; severity: string; cve_id: string | null };
  security_vulnerability: { vulnerable_version_range: string; first_patched_version: { identifier: string } | null };
}

const POLICY_PATHS = ['SECURITY.md', '.github/SECURITY.md', 'docs/SECURITY.md'];

/**
 * The rendered security policy: SECURITY.md in the repo root, .github/ or
 * docs/ — or, like github.com, the owner's community-health `.github` repo.
 */
export const getSecurityPolicy = query(async (owner: string, repo: string) => {
  const files = (alias: string) =>
    POLICY_PATHS.map((p, i) => `${alias}${i}:object(expression:${JSON.stringify(`HEAD:${p}`)}){id}`).join(' ');
  // Separate requests: a missing `.github` repo makes GraphQL report NOT_FOUND.
  const lookup = (name: string) =>
    gql<any>(`query($owner:String!,$name:String!){r:repository(owner:$owner,name:$name){defaultBranchRef{name} ${files('f')}}}`, {
      owner,
      name,
    })
      .then((d) => d.r)
      .catch(() => null);
  const [repoData, orgData] = await Promise.all([lookup(repo), lookup('.github')]);
  const data = { repo: repoData, org: orgData };
  for (const [key, name] of [['repo', repo], ['org', '.github']] as const) {
    const r = data[key];
    if (!r) continue;
    const i = POLICY_PATHS.findIndex((_, i) => r[`f${i}`]);
    if (i < 0) continue;
    const path = POLICY_PATHS[i]!;
    const ref = r.defaultBranchRef?.name ?? 'HEAD';
    const html = await gh<string>(`/repos/${owner}/${name}/contents/${path}`, { accept: 'application/vnd.github.html' });
    return { html, path: `/${owner}/${name}/blob/${ref}/${path}`, name: path.split('/').pop()! };
  }
  return null;
}, 'security-policy');

/** Repository security advisories (published ones are public; drafts need admin). */
export const getAdvisories = query(async (owner: string, repo: string) => {
  try {
    return await gh<Advisory[]>(`/repos/${owner}/${repo}/security-advisories`, { query: { per_page: 100, sort: 'published' } });
  } catch (e) {
    if (e instanceof GitHubError && (e.status === 403 || e.status === 404)) return [];
    throw e;
  }
}, 'security-advisories');

export const getAdvisory = query(
  (owner: string, repo: string, ghsa: string) => gh<Advisory>(`/repos/${owner}/${repo}/security-advisories/${ghsa}`),
  'security-advisory',
);

/**
 * Dependabot alerts — needs the `security_events` scope (or admin), and
 * Dependabot alerts enabled. `error` explains why they can't be shown.
 */
export const getDependabotAlerts = query(async (owner: string, repo: string, state: string) => {
  try {
    const alerts = await gh<DependabotAlert[]>(`/repos/${owner}/${repo}/dependabot/alerts`, { query: { state, per_page: 100 } });
    return { alerts, error: null as string | null };
  } catch (e) {
    if (e instanceof GitHubError && [403, 404, 422].includes(e.status)) return { alerts: [] as DependabotAlert[], error: e.message };
    throw e;
  }
}, 'dependabot-alerts');
