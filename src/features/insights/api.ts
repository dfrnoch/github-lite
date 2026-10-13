import { query } from '@solidjs/router';
import { getToken } from '../../lib/auth';
import { buildUrl, gh, GitHubError, ghPage, gql } from '../../lib/github';
import type { Repository, SimpleUser } from '../../lib/types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * /stats/* endpoints answer 202 (empty body) while GitHub computes them in
 * the background; retry a few times before giving up with an empty result.
 */
async function stats<T>(path: string): Promise<T | null> {
  for (let i = 0; i < 6; i++) {
    const data = await gh<any>(path);
    if (Array.isArray(data)) return data as T;
    // 204 = no data (empty repo)
    if (data === undefined) return [] as T;
    await sleep(1500 + i * 1000);
  }
  return null;
}

export interface ContributorStats {
  author: SimpleUser | null;
  total: number;
  weeks: { w: number; a: number; d: number; c: number }[];
}

/** null = GitHub is still computing the statistics. */
export const getContributorStats = query(
  (owner: string, repo: string) => stats<ContributorStats[]>(`/repos/${owner}/${repo}/stats/contributors`),
  'stats-contributors',
);

export const getCommitActivity = query(
  (owner: string, repo: string) =>
    stats<{ days: number[]; total: number; week: number }[]>(`/repos/${owner}/${repo}/stats/commit_activity`),
  'stats-commit-activity',
);

export const getCodeFrequency = query(
  (owner: string, repo: string) => stats<[number, number, number][]>(`/repos/${owner}/${repo}/stats/code_frequency`),
  'stats-code-frequency',
);

/* --------------------------------------------------------------- traffic */

export interface TrafficSeries {
  count: number;
  uniques: number;
  points: { timestamp: string; count: number; uniques: number }[];
}

export const getTraffic = query(async (owner: string, repo: string) => {
  const [views, clones, referrers, paths] = await Promise.all([
    gh<any>(`/repos/${owner}/${repo}/traffic/views`),
    gh<any>(`/repos/${owner}/${repo}/traffic/clones`),
    gh<{ referrer: string; count: number; uniques: number }[]>(`/repos/${owner}/${repo}/traffic/popular/referrers`),
    gh<{ path: string; title: string; count: number; uniques: number }[]>(`/repos/${owner}/${repo}/traffic/popular/paths`),
  ]);
  return {
    views: { count: views.count, uniques: views.uniques, points: views.views } as TrafficSeries,
    clones: { count: clones.count, uniques: clones.uniques, points: clones.clones } as TrafficSeries,
    referrers,
    paths,
  };
}, 'traffic');

/* ------------------------------------------------------- stars/watchers */

export interface PersonCard {
  login: string;
  name: string | null;
  avatarUrl: string;
  company: string | null;
  location: string | null;
  bio: string | null;
  createdAt: string;
  starredAt?: string;
  isOrganization?: boolean;
}

const PERSON = `login name avatarUrl company location bio createdAt`;

export interface PeoplePage {
  totalCount: number;
  people: PersonCard[];
  pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean; startCursor: string | null; endCursor: string | null };
}

/** Stargazers (newest first) or watchers, 48 per page, cursor-paginated. */
export const getRepoPeople = query(
  async (owner: string, repo: string, kind: 'stargazers' | 'watchers', after?: string, before?: string): Promise<PeoplePage> => {
    const args = `first:$first,last:$last,after:$after,before:$before`;
    const field =
      kind === 'stargazers'
        ? `stargazers(${args},orderBy:{field:STARRED_AT,direction:DESC}){totalCount pageInfo{hasNextPage hasPreviousPage startCursor endCursor} edges{starredAt node{${PERSON}}}}`
        : `watchers(${args}){totalCount pageInfo{hasNextPage hasPreviousPage startCursor endCursor} edges{node{${PERSON}}}}`;
    const data = await gql<any>(
      `query($owner:String!,$name:String!,$first:Int,$last:Int,$after:String,$before:String){repository(owner:$owner,name:$name){${field}}}`,
      { owner, name: repo, first: before ? null : 48, last: before ? 48 : null, after: after ?? null, before: before ?? null },
    );
    const conn = data.repository[kind];
    return {
      totalCount: conn.totalCount,
      pageInfo: conn.pageInfo,
      people: conn.edges.map((e: any) => ({ ...e.node, starredAt: e.starredAt })),
    };
  },
  'repo-people',
);

/* ----------------------------------------------------------------- forks */

export const getForks = query(
  (owner: string, repo: string, sort: string, page: number) =>
    ghPage<Repository>(`/repos/${owner}/${repo}/forks`, { page, perPage: 30, query: { sort } }),
  'forks',
);

/* ---------------------------------------------------------------- pulse */

export interface PulseItem {
  number: number;
  title: string;
  url: string;
  author: { login: string; avatarUrl: string } | null;
  createdAt: string;
  closedAt: string | null;
  mergedAt?: string | null;
}

/** Pulse: PRs/issues opened, merged and closed since `since`, plus commit counts. One GraphQL call. */
export const getPulse = query(async (owner: string, repo: string, since: string, branch: string) => {
  const q = (extra: string) => JSON.stringify(`repo:${owner}/${repo} ${extra}`);
  const ITEM = `... on PullRequest{number title url author{login avatarUrl} createdAt closedAt mergedAt}
    ... on Issue{number title url author{login avatarUrl} createdAt closedAt}`;
  const day = since.slice(0, 10);
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$branch:String!,$since:GitTimestamp!){
      mergedPrs:search(type:ISSUE,first:25,query:${q(`is:pr is:merged merged:>=${day}`)}){issueCount nodes{${ITEM}}}
      openedPrs:search(type:ISSUE,first:25,query:${q(`is:pr is:open created:>=${day}`)}){issueCount nodes{${ITEM}}}
      closedIssues:search(type:ISSUE,first:25,query:${q(`is:issue is:closed closed:>=${day}`)}){issueCount nodes{${ITEM}}}
      openedIssues:search(type:ISSUE,first:25,query:${q(`is:issue is:open created:>=${day}`)}){issueCount nodes{${ITEM}}}
      repository(owner:$owner,name:$name){
        object(expression:$branch){... on Commit{history(since:$since,first:100){totalCount nodes{author{user{login avatarUrl}} additions deletions changedFilesIfAvailable}}}}
      }
    }`,
    { owner, name: repo, branch, since },
  );
  const conn = (k: string) => ({ count: data[k].issueCount as number, items: data[k].nodes as PulseItem[] });
  const history = data.repository.object?.history ?? { totalCount: 0, nodes: [] };
  const authors = new Map<string, { login: string; avatarUrl: string; commits: number }>();
  let additions = 0;
  let deletions = 0;
  let files = 0;
  for (const c of history.nodes) {
    additions += c.additions;
    deletions += c.deletions;
    files += c.changedFilesIfAvailable ?? 0;
    const u = c.author?.user;
    if (!u) continue;
    const a = authors.get(u.login) ?? { ...u, commits: 0 };
    a.commits++;
    authors.set(u.login, a);
  }
  return {
    mergedPrs: conn('mergedPrs'),
    openedPrs: conn('openedPrs'),
    closedIssues: conn('closedIssues'),
    openedIssues: conn('openedIssues'),
    commits: history.totalCount as number,
    additions,
    deletions,
    files,
    authors: [...authors.values()].sort((a, b) => b.commits - a.commits),
  };
}, 'pulse');

/* -------------------------------------------------------------- activity */

export interface RepoActivity {
  id: number;
  node_id: string;
  before: string;
  after: string;
  ref: string;
  timestamp: string;
  activity_type: 'push' | 'force_push' | 'branch_creation' | 'branch_deletion' | 'pr_merge' | 'merge_queue_merge';
  actor: SimpleUser | null;
}

/**
 * GET /repos/{o}/{r}/activity — cursor pagination lives in the Link header
 * (`after`/`before` cursors), which `ghPage` can't parse, so this reads the
 * header directly.
 */
export const getActivity = query(
  async (
    owner: string,
    repo: string,
    opts: { ref?: string; actor?: string; type?: string; period?: string; after?: string; before?: string },
  ) => {
    const url = buildUrl(`/repos/${owner}/${repo}/activity`, {
      per_page: 30,
      ref: opts.ref,
      actor: opts.actor,
      activity_type: opts.type,
      time_period: opts.period,
      after: opts.after,
      before: opts.before,
    });
    const token = getToken();
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new GitHubError(res.status, (await res.json().catch(() => null))?.message ?? res.statusText);
    const items = (await res.json()) as RepoActivity[];
    const link = res.headers.get('link') ?? '';
    const cursor = (rel: string, key: string) => {
      const m = link.split(',').find((p) => p.includes(`rel="${rel}"`))?.match(/<([^>]+)>/);
      return m ? new URL(m[1]!).searchParams.get(key) : null;
    };
    return { items, next: cursor('next', 'after'), prev: cursor('prev', 'before') };
  },
  'repo-activity',
);

/* -------------------------------------------------------------- projects */

export interface LinkedProject {
  number: number;
  title: string;
  shortDescription: string | null;
  url: string;
  closed: boolean;
  public: boolean;
  updatedAt: string;
  items: { totalCount: number };
  owner: { login: string };
}

/** Projects (v2) linked to the repository. */
export const getRepoProjects = query(async (owner: string, repo: string, q: string, closed: boolean) => {
  let data: any;
  try {
    data = await gql<any>(
    `query($owner:String!,$name:String!,$q:String){repository(owner:$owner,name:$name){
      projectsV2(first:50,query:$q,orderBy:{field:UPDATED_AT,direction:DESC}){totalCount nodes{
        number title shortDescription url closed public updatedAt items{totalCount}
        owner{... on User{login} ... on Organization{login}}
      }}
    }}`,
    { owner, name: repo, q: q || null },
    );
  } catch (e) {
    // Projects need the read:project scope, which older tokens lack.
    if (e instanceof GitHubError && /read:project/.test(e.message)) {
      return { projects: [] as LinkedProject[], missingScope: true };
    }
    throw e;
  }
  return {
    projects: (data.repository.projectsV2.nodes as LinkedProject[]).filter((p) => p.closed === closed),
    missingScope: false,
  };
}, 'repo-projects');
