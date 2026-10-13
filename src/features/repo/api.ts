import { action, query } from '@solidjs/router';
import { encodePath, gh, GitHubError, gql } from '../../lib/github';
import type { ContentItem, Repository } from '../../lib/types';

/** GET /repos/{owner}/{repo} — the repository (with `permissions` for the viewer). */
export const getRepo = query((owner: string, repo: string) => gh<Repository>(`/repos/${owner}/${repo}`), 'repo');

/** Whether the viewer starred / watches the repo. */
export const getRepoViewerState = query(async (owner: string, repo: string) => {
  const data = await gql<{
    repository: { viewerHasStarred: boolean; viewerSubscription: 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'IGNORED' | null };
  }>(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){viewerHasStarred viewerSubscription}}`,
    { owner, name: repo },
  );
  return data.repository;
}, 'repo-viewer-state');

export const starRepo = action(async (owner: string, repo: string, star: boolean) => {
  await gh(`/user/starred/${owner}/${repo}`, { method: star ? 'PUT' : 'DELETE' });
}, 'star-repo');

/** `watching` | `ignoring` | `none` (participating & @mentions only). */
export const setRepoSubscription = action(async (owner: string, repo: string, mode: 'watching' | 'ignoring' | 'none') => {
  if (mode === 'none') await gh(`/repos/${owner}/${repo}/subscription`, { method: 'DELETE' });
  else
    await gh(`/repos/${owner}/${repo}/subscription`, {
      method: 'PUT',
      body: { subscribed: mode === 'watching', ignored: mode === 'ignoring' },
    });
}, 'repo-subscription');

export interface RepoOverview {
  openIssues: number;
  openPulls: number;
  branches: number;
  tags: number;
  releases: { totalCount: number; latest: { name: string | null; tagName: string; publishedAt: string } | null };
  languages: { totalSize: number; items: { name: string; color: string | null; size: number }[] };
  contributors?: number;
  hasDiscussions: boolean;
  hasProjects: boolean;
  hasWiki: boolean;
}

/** Counts and sidebar data for the repo home + tab counters (one GraphQL call). */
export const getRepoOverview = query(async (owner: string, repo: string): Promise<RepoOverview> => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){
      issues(states:OPEN){totalCount}
      pullRequests(states:OPEN){totalCount}
      branches:refs(refPrefix:"refs/heads/"){totalCount}
      tags:refs(refPrefix:"refs/tags/"){totalCount}
      releases{totalCount}
      latestRelease{name tagName publishedAt}
      languages(first:12,orderBy:{field:SIZE,direction:DESC}){totalSize edges{size node{name color}}}
      hasDiscussionsEnabled hasProjectsEnabled hasWikiEnabled
    }}`,
    { owner, name: repo },
  );
  const r = data.repository;
  return {
    openIssues: r.issues.totalCount,
    openPulls: r.pullRequests.totalCount,
    branches: r.branches.totalCount,
    tags: r.tags.totalCount,
    releases: { totalCount: r.releases.totalCount, latest: r.latestRelease },
    languages: {
      totalSize: r.languages.totalSize,
      items: r.languages.edges.map((e: any) => ({ name: e.node.name, color: e.node.color, size: e.size })),
    },
    hasDiscussions: r.hasDiscussionsEnabled,
    hasProjects: r.hasProjectsEnabled,
    hasWiki: r.hasWikiEnabled,
  };
}, 'repo-overview');

export interface LastCommit {
  oid: string;
  abbreviatedOid: string;
  messageHeadline: string;
  message: string;
  committedDate: string;
  authors: { name: string | null; avatarUrl: string; user: { login: string } | null }[];
  status: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | 'EXPECTED' | null;
  historyCount: number;
  associatedPullNumber?: number;
}

const COMMIT_FIELDS = `oid abbreviatedOid messageHeadline message committedDate
  authors(first:3){nodes{name avatarUrl user{login}}}
  statusCheckRollup{state}`;

const toLastCommit = (c: any, historyCount = 0): LastCommit => ({
  oid: c.oid,
  abbreviatedOid: c.abbreviatedOid,
  messageHeadline: c.messageHeadline,
  message: c.message,
  committedDate: c.committedDate,
  authors: c.authors.nodes,
  status: c.statusCheckRollup?.state ?? null,
  historyCount,
});

/** Latest commit touching `path` at `ref` (whole repo when path is empty), plus the commit count. */
export const getLastCommit = query(async (owner: string, repo: string, ref: string, path = '') => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$ref:String!,$path:String){repository(owner:$owner,name:$name){
      object(expression:$ref){... on Commit{
        history(first:1,path:$path){totalCount nodes{${COMMIT_FIELDS}}}
      }}
    }}`,
    { owner, name: repo, ref, path: path || null },
  );
  const history = data.repository.object?.history;
  if (!history?.nodes.length) return null;
  return toLastCommit(history.nodes[0], history.totalCount);
}, 'last-commit');

export interface TreeEntry {
  name: string;
  path: string;
  type: 'blob' | 'tree' | 'commit'; // commit = submodule
  mode: number;
  oid: string;
  size?: number;
  /** Symlink / submodule target. */
  target?: string;
}

/** Directory listing at `ref:path`, folders first like GitHub. Null when the path is not a directory. */
export const getTree = query(async (owner: string, repo: string, ref: string, path = '') => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$expr:String!){repository(owner:$owner,name:$name){
      object(expression:$expr){... on Tree{entries{name path type mode oid object{... on Blob{byteSize}}}}}
    }}`,
    { owner, name: repo, expr: `${ref}:${path}` },
  );
  const entries: any[] | undefined = data.repository.object?.entries;
  if (!entries) return null;
  const order = { tree: 0, commit: 1, blob: 2 } as Record<string, number>;
  return entries
    .map(
      (e): TreeEntry => ({
        name: e.name,
        path: e.path,
        type: e.type,
        mode: e.mode,
        oid: e.oid,
        size: e.object?.byteSize,
      }),
    )
    .sort((a, b) => order[a.type]! - order[b.type]! || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}, 'tree');

/**
 * Last commit for each entry of a directory — what github.com shows in the
 * file table's message/date columns. One GraphQL call with an aliased
 * `history(first:1, path:…)` per entry.
 */
export const getTreeCommits = query(async (owner: string, repo: string, ref: string, paths: string[]) => {
  if (!paths.length) return {} as Record<string, LastCommit>;
  const fields = paths
    .slice(0, 200)
    .map((p, i) => `e${i}:history(first:1,path:${JSON.stringify(p)}){nodes{oid messageHeadline committedDate}}`)
    .join('\n');
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$ref:String!){repository(owner:$owner,name:$name){
      object(expression:$ref){... on Commit{${fields}}}
    }}`,
    { owner, name: repo, ref },
  );
  const obj = data.repository.object ?? {};
  const out: Record<string, { oid: string; messageHeadline: string; committedDate: string }> = {};
  paths.slice(0, 200).forEach((p, i) => {
    const node = obj[`e${i}`]?.nodes?.[0];
    if (node) out[p] = node;
  });
  return out;
}, 'tree-commits');

/** Rendered README HTML for a directory (null when there is none). */
export const getReadme = query(async (owner: string, repo: string, ref: string, dir = '') => {
  try {
    const html = await gh<string>(`/repos/${owner}/${repo}/readme${dir ? `/${encodePath(dir)}` : ''}`, {
      query: { ref },
      accept: 'application/vnd.github.html',
    });
    return html;
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}, 'readme');

/** Which README-like files exist for the sidebar links (license, contributing, …). */
export const getCommunityFiles = query(async (owner: string, repo: string) => {
  try {
    return await gh<{
      files: {
        code_of_conduct: { html_url: string } | null;
        contributing: { html_url: string } | null;
        license: { html_url: string } | null;
        readme: { html_url: string } | null;
        security?: { html_url: string } | null;
      };
    }>(`/repos/${owner}/${repo}/community/profile`);
  } catch {
    return null;
  }
}, 'community');

/** File metadata + base64 content (contents API). Null when `path` is not a file. */
export const getFile = query(async (owner: string, repo: string, ref: string, path: string) => {
  const data = await gh<ContentItem | ContentItem[]>(`/repos/${owner}/${repo}/contents/${encodePath(path)}`, {
    query: { ref },
  });
  return Array.isArray(data) ? null : data;
}, 'file');

/** Raw file text (works beyond the 1 MB limit of the JSON contents API, up to 100 MB). */
export const getRawFile = query(
  (owner: string, repo: string, ref: string, path: string) =>
    gh<string>(`/repos/${owner}/${repo}/contents/${encodePath(path)}`, {
      query: { ref },
      accept: 'application/vnd.github.raw',
    }),
  'raw-file',
);

/** Rendered HTML of a markdown/rich file (README-style rendering of any .md). */
export const getRenderedFile = query(
  (owner: string, repo: string, ref: string, path: string) =>
    gh<string>(`/repos/${owner}/${repo}/contents/${encodePath(path)}`, {
      query: { ref },
      accept: 'application/vnd.github.html',
    }),
  'rendered-file',
);

export interface ResolvedRef {
  ref: string;
  path: string;
  kind: 'branch' | 'tag' | 'commit';
}

/**
 * Split a `tree/<ref>/<path>` splat into ref + path. Branch names may contain
 * slashes, so — like github.com — every prefix is checked against the repo's
 * branches and tags (one GraphQL call) and the longest match wins.
 */
export const resolveRefPath = query(
  async (owner: string, repo: string, splat: string, defaultBranch?: string): Promise<ResolvedRef> => {
    const segments = splat.split('/').filter(Boolean);
    if (!segments.length) return { ref: defaultBranch ?? 'HEAD', path: '', kind: 'branch' };
    const first = segments[0]!;
    if (/^[0-9a-f]{40}$/i.test(first)) return { ref: first, path: segments.slice(1).join('/'), kind: 'commit' };
    if (segments.length === 1 || first === defaultBranch) {
      return { ref: first, path: segments.slice(1).join('/'), kind: 'branch' };
    }
    const candidates = segments.slice(0, 8).map((_, i) => segments.slice(0, i + 1).join('/'));
    const fields = candidates
      .map(
        (c, i) =>
          `b${i}:ref(qualifiedName:${JSON.stringify(`refs/heads/${c}`)}){name} t${i}:ref(qualifiedName:${JSON.stringify(`refs/tags/${c}`)}){name}`,
      )
      .join(' ');
    const data = await gql<any>(`query($owner:String!,$name:String!){repository(owner:$owner,name:$name){${fields}}}`, {
      owner,
      name: repo,
    });
    for (let i = candidates.length - 1; i >= 0; i--) {
      const hit = data.repository[`b${i}`] ? 'branch' : data.repository[`t${i}`] ? 'tag' : null;
      if (hit) return { ref: candidates[i]!, path: segments.slice(i + 1).join('/'), kind: hit };
    }
    // Unknown: maybe a short SHA — let the content request decide.
    return { ref: first, path: segments.slice(1).join('/'), kind: /^[0-9a-f]{7,40}$/i.test(first) ? 'commit' : 'branch' };
  },
  'resolve-ref',
);

/** Branch + tag names for the ref picker. */
export const getRefNames = query(async (owner: string, repo: string) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){
      branches:refs(refPrefix:"refs/heads/",first:100,orderBy:{field:TAG_COMMIT_DATE,direction:DESC}){nodes{name}}
      tags:refs(refPrefix:"refs/tags/",first:100,orderBy:{field:TAG_COMMIT_DATE,direction:DESC}){nodes{name}}
    }}`,
    { owner, name: repo },
  );
  return {
    branches: data.repository.branches.nodes.map((n: any) => n.name as string),
    tags: data.repository.tags.nodes.map((n: any) => n.name as string),
  };
}, 'ref-names');
