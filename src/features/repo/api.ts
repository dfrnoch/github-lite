import { action, query } from '@solidjs/router';
import { encodePath, gh, GitHubError, ghPage, gql } from '../../lib/github';
import { type CommitSignature, SIGNATURE_FIELDS, signatureFromGql } from '../../lib/signature';
import type { ContentItem, Repository } from '../../lib/types';
import { getLatestVersionTag } from '../releases/versions';

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

export interface SidebarRelease {
  name: string | null;
  tagName: string;
  publishedAt: string;
}

export interface RepoOverview {
  openIssues: number;
  openPulls: number;
  branches: number;
  tags: number;
  releases: {
    totalCount: number;
    /** The release marked "Latest" (the newest stable one). */
    latest: SidebarRelease | null;
    /** The newest published pre-release when it is newer than `latest` (or there is no latest). */
    prerelease: SidebarRelease | null;
  };
  languages: { totalSize: number; items: { name: string; color: string | null; size: number }[] };
  contributors?: number;
  hasDiscussions: boolean;
  hasProjects: boolean;
  hasWiki: boolean;
}

/** The newest published pre-release, if it is newer than the latest (stable) release. */
function newerPrerelease(
  latest: SidebarRelease | null,
  recent: (SidebarRelease & { isPrerelease: boolean; isDraft: boolean })[],
): SidebarRelease | null {
  const pre = recent
    .filter((r) => r.isPrerelease && !r.isDraft && r.publishedAt)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
  if (!pre || (latest && pre.publishedAt <= latest.publishedAt)) return null;
  return { name: pre.name, tagName: pre.tagName, publishedAt: pre.publishedAt };
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
      recentReleases:releases(first:10,orderBy:{field:CREATED_AT,direction:DESC}){nodes{name tagName isPrerelease isLatest isDraft publishedAt}}
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
    releases: { totalCount: r.releases.totalCount, latest: r.latestRelease, prerelease: newerPrerelease(r.latestRelease, r.recentReleases.nodes) },
    languages: {
      totalSize: r.languages.totalSize,
      items: r.languages.edges.map((e: any) => ({ name: e.node.name, color: e.node.color, size: e.size })),
    },
    hasDiscussions: r.hasDiscussionsEnabled,
    hasProjects: r.hasProjectsEnabled,
    hasWiki: r.hasWikiEnabled,
  };
}, 'repo-overview');

export interface RepoContributors {
  /** All contributors, anonymous ones included (the count github.com shows). */
  total: number;
  /** The first ones by contributions (users only). */
  top: { login: string; avatar_url: string; type: string }[];
}

/**
 * Sidebar "Contributors": the count from the Link header of a one-per-page
 * request, and the top 14 avatars. Null when GitHub won't list them (huge
 * repositories answer 403, empty ones 204).
 */
export const getRepoContributors = query(async (owner: string, repo: string): Promise<RepoContributors | null> => {
  const path = `/repos/${owner}/${repo}/contributors`;
  try {
    const [count, top] = await Promise.all([
      ghPage<{ login?: string }>(path, { perPage: 1, query: { anon: 1 } }),
      ghPage<{ login: string; avatar_url: string; type: string }>(path, { perPage: 14 }),
    ]);
    const total = count.pageInfo.lastPage ?? count.items.length;
    if (!total) return null;
    return { total, top: top.items };
  } catch (e) {
    if (e instanceof GitHubError && (e.status === 403 || e.status === 404)) return null;
    // 204 No Content (empty repository) has no JSON body.
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}, 'repo-contributors');

export interface LastCommit {
  oid: string;
  abbreviatedOid: string;
  messageHeadline: string;
  message: string;
  committedDate: string;
  /** Distinct authors (co-authors with the same login / name are merged). */
  authors: { name: string | null; avatarUrl: string; user: { login: string } | null }[];
  /** All authors, including ones beyond the fetched `authors`. */
  authorCount: number;
  status: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | 'EXPECTED' | null;
  signature: CommitSignature | null;
  historyCount: number;
  associatedPullNumber?: number;
}

const COMMIT_FIELDS = `oid abbreviatedOid messageHeadline message committedDate
  authors(first:3){totalCount nodes{name avatarUrl user{login}}}
  statusCheckRollup{state}
  ${SIGNATURE_FIELDS}`;

/** A co-author trailer for the commit author themself (another email) is the same person. */
const distinctAuthors = (nodes: LastCommit['authors']) =>
  nodes.filter((a, i) => nodes.findIndex((x) => (x.user && a.user ? x.user.login === a.user.login : x.name === a.name)) === i);

const toLastCommit = (c: any, historyCount = 0): LastCommit => ({
  oid: c.oid,
  abbreviatedOid: c.abbreviatedOid,
  messageHeadline: c.messageHeadline,
  message: c.message,
  committedDate: c.committedDate,
  authors: distinctAuthors(c.authors.nodes),
  authorCount: Math.max(distinctAuthors(c.authors.nodes).length, c.authors.totalCount ?? 0),
  status: c.statusCheckRollup?.state ?? null,
  signature: signatureFromGql(c.signature),
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
      object(expression:$expr){... on Tree{entries{name path type mode oid submodule{gitUrl}}}}
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
        target: e.submodule?.gitUrl ?? undefined,
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
  type Entry = { oid: string; messageHeadline: string; committedDate: string };
  const out: Record<string, Entry> = {};
  const list = paths.slice(0, 300);
  // Big directories time out as one query: ask in parallel chunks and keep whatever answers.
  const chunks: string[][] = [];
  for (let i = 0; i < list.length; i += 50) chunks.push(list.slice(i, i + 50));
  await Promise.all(
    chunks.map(async (chunk) => {
      const fields = chunk
        .map((p, i) => `e${i}:history(first:1,path:${JSON.stringify(p)}){nodes{oid messageHeadline committedDate}}`)
        .join('\n');
      const data = await gql<any>(
        `query($owner:String!,$name:String!,$ref:String!){repository(owner:$owner,name:$name){
          object(expression:$ref){... on Commit{${fields}}}
        }}`,
        { owner, name: repo, ref },
      ).catch(() => null);
      const obj = data?.repository?.object ?? {};
      chunk.forEach((p, i) => {
        const node = obj[`e${i}`]?.nodes?.[0];
        if (node) out[p] = node;
      });
    }),
  );
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

/* ------------------------------------------------ Refined GitHub (repo area) */

export interface RepoHeaderInfo {
  stars: number;
  starred: boolean;
  isPrivate: boolean;
  /** "owner/name" of the fork parent. */
  parent: string | null;
  /** READ-only viewers can't open the stargazers list. */
  canSeeStargazers: boolean;
  /** Newest of the last 3 default-branch commits that reports checks (CI-generated commits often don't). */
  ci: { oid: string; state: string } | null;
}

/** Stars, privacy, fork parent and CI state in one request. */
export const getRepoHeaderInfo = query(async (owner: string, repo: string): Promise<RepoHeaderInfo> => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){
      stargazerCount isPrivate viewerHasStarred viewerPermission isEmpty parent{nameWithOwner}
      defaultBranchRef{target{... on Commit{history(first:3){nodes{oid statusCheckRollup{state}}}}}}
    }}`,
    { owner, name: repo },
  );
  const r = data.repository;
  const ci = (r.defaultBranchRef?.target?.history?.nodes ?? []).find((c: any) => c.statusCheckRollup);
  return {
    stars: r.stargazerCount,
    starred: r.viewerHasStarred,
    isPrivate: r.isPrivate,
    parent: r.parent?.nameWithOwner ?? null,
    canSeeStargazers: r.viewerPermission !== 'READ',
    ci: ci ? { oid: ci.oid, state: ci.statusCheckRollup.state } : null,
  };
}, 'rgh-repo-header-info');

/** More than 20 unreleased commits: the exact number isn't known. */
export const MANY_UNRELEASED = Number.MAX_SAFE_INTEGER;

/**
 * The latest version tag and how many default-branch
 * commits came after it (looking at the newest 20 commits / tags).
 */
export const getPublishState = query(async (owner: string, repo: string) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){
      refs(first:20,refPrefix:"refs/tags/",orderBy:{field:TAG_COMMIT_DATE,direction:DESC}){
        nodes{name tag:target{oid ... on Tag{commit:target{oid}}}}
      }
      defaultBranchRef{name target{... on Commit{history(first:20){nodes{oid}}}}}
    }}`,
    { owner, name: repo },
  );
  const r = data.repository;
  const defaultBranch: string = r.defaultBranchRef?.name ?? '';
  if (!r.refs.nodes.length || !r.defaultBranchRef) return { latestTag: null, aheadBy: 0, defaultBranch };
  const tags = new Map<string, string>();
  // Lightweight tags point straight at the commit.
  for (const n of r.refs.nodes) tags.set(n.name, n.tag.commit?.oid ?? n.tag.oid);
  const latestTag = getLatestVersionTag([...tags.keys()]);
  const oid = tags.get(latestTag);
  const index = (r.defaultBranchRef.target.history?.nodes ?? []).findIndex((n: any) => n.oid === oid);
  return { latestTag, aheadBy: index === -1 ? MANY_UNRELEASED : index, defaultBranch };
}, 'rgh-publish-state');

/** Date (and sha) of the first commit on the default branch. */
export const getFirstCommit = query(async (owner: string, repo: string) => {
  const head = await gql<any>(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){
      defaultBranchRef{target{... on Commit{oid committedDate history{totalCount}}}}
    }}`,
    { owner, name: repo },
  );
  const target = head.repository.defaultBranchRef?.target;
  if (!target) return null;
  const count: number = target.history.totalCount;
  if (count <= 1) return { oid: target.oid as string, date: target.committedDate as string };
  // History cursors are "<sha> <offset>": jump straight to the last few commits.
  const tail = await gql<any>(
    `query($owner:String!,$name:String!,$cursor:String!){repository(owner:$owner,name:$name){
      defaultBranchRef{target{... on Commit{history(first:5,after:$cursor){nodes{oid committedDate}}}}}
    }}`,
    { owner, name: repo, cursor: `${target.oid} ${count - Math.min(6, count)}` },
  );
  const nodes: { oid: string; committedDate: string }[] = tail.repository.defaultBranchRef.target.history.nodes;
  // Some imported histories carry bogus 1970 dates.
  const first = nodes.findLast((c) => new Date(c.committedDate).getFullYear() > 1970) ?? nodes.at(-1);
  return first ? { oid: first.oid, date: first.committedDate } : null;
}, 'rgh-first-commit');

const BUG_LABEL = /^(?:bug|bug-?fix|confirmed-bug|(?:category|type|kind|triage|issue)[-/:]bug|(?::[\w-]+:|\p{Emoji})bug)$/iu;
/** Whether a label name means "bug" (bug, Type: Bug, kind/bug, 🐛bug…). */
export const isBugLabel = (name: string) => BUG_LABEL.test(name.replace(/\s/g, ''));

const bugsQuery = (label: string) => `(label:${/[\s"]/.test(label) ? `"${label.replace(/"/g, '')}"` : label} OR type:Bug)`;

export interface RepoTabExtras {
  /** bugs-tab: open bugs (label or issue type) and the issue query that lists them. */
  bugs: { label: string; count: number; query: string } | null;
  /** extend-repo-tabs: check suites on the default branch head (0 = Actions unused). */
  checkSuites: number | null;
}

/**
 * Counters for the extra/demoted repo tabs, in one GraphQL request; parts
 * whose feature is off are skipped with @include.
 */
export const getRepoTabExtras = query(
  async (owner: string, repo: string, bugs: boolean, actions: boolean): Promise<RepoTabExtras> => {
    const guess = bugsQuery('bug');
    const data = await gql<any>(
      `query($owner:String!,$name:String!,$bugs:Boolean!,$actions:Boolean!,$q:String!){
        repository(owner:$owner,name:$name){
          hasIssuesEnabled
          labels(query:"bug",first:10) @include(if:$bugs){nodes{name issues(states:OPEN){totalCount}}}
          typeBug:issues(filterBy:{type:"Bug",states:OPEN}) @include(if:$bugs){totalCount}
          openIssues:issues(states:OPEN) @include(if:$bugs){totalCount}
          defaultBranchRef @include(if:$actions){target{... on Commit{checkSuites{totalCount}}}}
        }
        exact:search(query:$q,type:ISSUE_ADVANCED,first:0) @include(if:$bugs){issueCount}
      }`,
      { owner, name: repo, bugs, actions, q: `repo:${owner}/${repo} is:issue is:open ${guess}` },
    );
    const r = data.repository;
    let bugInfo: RepoTabExtras['bugs'] = null;
    if (bugs && r.hasIssuesEnabled) {
      const labels: { name: string; issues: { totalCount: number } }[] = r.labels?.nodes ?? [];
      const label = labels.find((l) => l.name === 'bug') ?? labels.find((l) => isBugLabel(l.name));
      const name = label?.name ?? 'bug';
      let count: number;
      if (name === 'bug') count = data.exact?.issueCount ?? 0;
      else {
        const exact = await gql<any>(`query($q:String!){search(query:$q,type:ISSUE_ADVANCED,first:0){issueCount}}`, {
          q: `repo:${owner}/${repo} is:issue is:open ${bugsQuery(name)}`,
        });
        count = exact.search.issueCount;
      }
      // Labelled issues are counted even when issues are disabled; never exceed the open total.
      bugInfo = { label: name, count: Math.min(count, r.openIssues?.totalCount ?? count), query: `is:issue state:open ${bugsQuery(name)}` };
    }
    return { bugs: bugInfo, checkSuites: actions ? (r.defaultBranchRef?.target?.checkSuites?.totalCount ?? 0) : null };
  },
  'rgh-repo-tab-extras',
);

// Projects need the read:project scope; once a request was refused, stop asking.
let projectsScopeMissing = false;
/** extend-repo-tabs: number of projects linked to the repo (null when the token can't read them). */
export const getProjectsCount = query(async (owner: string, repo: string): Promise<number | null> => {
  if (projectsScopeMissing) return null;
  try {
    const data = await gql<any>(`query($owner:String!,$name:String!){repository(owner:$owner,name:$name){projectsV2{totalCount}}}`, {
      owner,
      name: repo,
    });
    return data.repository.projectsV2?.totalCount ?? 0;
  } catch (e) {
    if (e instanceof GitHubError && /scope/i.test(e.message)) projectsScopeMissing = true;
    return null;
  }
}, 'rgh-projects-count');

/**
 * The viewer's open PRs from this fork into its
 * parent. One PR → link to it directly.
 */
export const getForkOpenPulls = query(async (parent: string, fork: string, viewer: string) => {
  const data = await gql<any>(
    `query($q:String!){search(query:$q,type:ISSUE,first:100){nodes{... on PullRequest{number headRepository{nameWithOwner}}}}}`,
    { q: `is:pr state:open archived:false repo:${parent} author:${viewer}` },
  );
  const prs = (data.search.nodes as { number: number; headRepository: { nameWithOwner: string } | null }[]).filter(
    (pr) => pr.headRepository?.nameWithOwner.toLowerCase() === fork.toLowerCase(),
  );
  return { count: prs.length, href: prs.length === 1 ? `/${parent}/pull/${prs[0]!.number}` : `/${parent}/pulls?q=${encodeURIComponent('is:pr state:open author:@me')}` };
}, 'rgh-fork-open-pulls');
