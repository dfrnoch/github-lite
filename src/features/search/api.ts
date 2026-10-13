import { query } from '@solidjs/router';
import { getToken } from '../../lib/auth';
import { GitHubError, ghPage, gql } from '../../lib/github';
import type { Issue, Repository, SimpleUser } from '../../lib/types';
import { proxyCodeSearch } from './codeSearch';
import { withType } from './query';

/** Results per page — github.com shows 10 per page on /search. */
export const PER_PAGE = 10;
/** The search API never returns more than the first 1000 results. */
export const MAX_RESULTS = 1000;

export type SearchType = 'repositories' | 'code' | 'issues' | 'pullrequests' | 'discussions' | 'users' | 'commits' | 'topics';

export interface SearchError {
  status: number;
  message: string;
}

/** One page of results — or the error the API answered (invalid query, rate limit…). */
export interface SearchPage<T> {
  items: T[];
  total: number;
  incomplete?: boolean;
  error?: SearchError;
}

const TEXT_MATCH = 'application/vnd.github.text-match+json';

/**
 * Bad queries (422) and the search rate limit (403/429) are expected while
 * typing queries, so they come back as data and render as a flash message
 * instead of tearing the page down through <Errored>.
 */
async function guard<T>(run: () => Promise<SearchPage<T>>): Promise<SearchPage<T>> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof GitHubError && [400, 403, 422, 429, 503].includes(e.status)) {
      return { items: [], total: 0, error: { status: e.status, message: e.message } };
    }
    throw e;
  }
}

async function restSearch<T>(path: string, q: string, page: number, sort?: string, order?: string, textMatch = false) {
  return guard(async () => {
    const res = await ghPage<T>(path, {
      page,
      perPage: PER_PAGE,
      accept: textMatch ? TEXT_MATCH : undefined,
      query: { q, sort: sort || undefined, order: sort ? order || 'desc' : undefined },
    });
    return { items: res.items, total: res.total ?? res.items.length };
  });
}

export interface TextMatch {
  fragment: string;
  property: string;
  matches: { text: string; indices: [number, number] }[];
}

export type RepoHit = Repository & { text_matches?: TextMatch[] };
export interface CodeHit {
  name: string;
  path: string;
  sha: string;
  html_url: string;
  repository: { full_name: string; name: string; owner: SimpleUser; private: boolean };
  text_matches?: TextMatch[];
}
export type IssueHit = Issue & { text_matches?: TextMatch[] };
export interface UserHit {
  login: string;
  id: number;
  avatar_url: string;
  type: string;
}
export interface CommitHit {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string }; committer: { name: string; date: string } };
  author: SimpleUser | null;
  committer: SimpleUser | null;
  repository: { full_name: string; name: string; owner: SimpleUser; private: boolean };
}
export interface TopicHit {
  name: string;
  display_name: string | null;
  short_description: string | null;
  description: string | null;
  created_by: string | null;
  released: string | null;
  created_at: string;
  updated_at: string;
  featured: boolean;
  curated: boolean;
  score: number;
  /** Present on /search/topics responses for some topics. */
  logo_url?: string | null;
}
export interface DiscussionHit {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  isAnswered: boolean | null;
  bodyText: string;
  category: { name: string; emojiHTML: string } | null;
  author: { login: string; avatarUrl: string } | null;
  comments: { totalCount: number };
  upvoteCount: number;
  repository: { nameWithOwner: string; owner: { avatarUrl: string; __typename: string } };
}

export const searchRepos = query(
  (q: string, page: number, sort?: string, order?: string) => restSearch<RepoHit>('/search/repositories', q, page, sort, order),
  'search-repos',
);

/** Code search goes through the app server (see ./codeSearch — the endpoint has no CORS). */
export const searchCode = query(
  (q: string, page: number): Promise<SearchPage<CodeHit>> =>
    proxyCodeSearch(getToken() ?? '', q, page, PER_PAGE).then(
      ({ status, data }) => {
        if (status >= 400) {
          const errors = Array.isArray(data?.errors) ? `: ${data.errors.map((e: any) => e.message ?? e.code).join(', ')}` : '';
          return { items: [], total: 0, error: { status, message: `${data?.message ?? `HTTP ${status}`}${errors}` } };
        }
        return { items: data.items ?? [], total: data.total_count ?? 0, incomplete: data.incomplete_results };
      },
      () => ({
        items: [],
        total: 0,
        error: {
          status: 0,
          message: "Code search needs this app's server: GitHub's code search API does not allow requests from browsers.",
        },
      }),
    ),
  'search-code',
);

/** Issues or pull requests (`is:issue` / `is:pr` added when the query has no `is:` type). */
export const searchIssues = query(
  (q: string, kind: 'issue' | 'pr', page: number, sort?: string, order?: string) =>
    restSearch<IssueHit>('/search/issues', withType(q, kind), page, sort, order, true),
  'search-issues',
);

export const searchUsers = query(
  (q: string, page: number, sort?: string, order?: string) => restSearch<UserHit>('/search/users', q, page, sort, order),
  'search-users',
);

export const searchCommits = query(
  (q: string, page: number, sort?: string, order?: string) => restSearch<CommitHit>('/search/commits', q, page, sort, order),
  'search-commits',
);

export const searchTopics = query(
  (q: string, page: number, perPage = PER_PAGE) =>
    guard(async () => {
      const res = await ghPage<TopicHit>('/search/topics', { page, perPage, query: { q } });
      return { items: res.items, total: res.total ?? res.items.length };
    }),
  'search-topics',
);

/**
 * Discussions only exist in GraphQL search. Search cursors are opaque but
 * stable (`cursor:<offset>` base64), so page N maps to an offset like REST.
 */
export const searchDiscussions = query(
  (q: string, page: number) =>
    guard(async () => {
      const after = page > 1 ? btoa(`cursor:${(page - 1) * PER_PAGE}`) : null;
      const data = await gql<any>(
        `query($q:String!,$first:Int!,$after:String){search(type:DISCUSSION,query:$q,first:$first,after:$after){
          discussionCount
          nodes{... on Discussion{
            number title url createdAt updatedAt isAnswered bodyText upvoteCount
            category{name emojiHTML}
            author{login avatarUrl}
            comments{totalCount}
            repository{nameWithOwner owner{avatarUrl __typename}}
          }}
        }}`,
        { q, first: PER_PAGE, after },
      );
      return { items: data.search.nodes.filter((n: any) => n?.number) as DiscussionHit[], total: data.search.discussionCount };
    }),
  'search-discussions',
);

export interface SearchCounts {
  repositories: number;
  issues: number;
  pullrequests: number;
  discussions: number;
  users: number;
}

/** Result counts for the "Filter by" sidebar — one GraphQL call with aliases. */
export const getSearchCounts = query(async (q: string): Promise<SearchCounts | null> => {
  try {
    const data = await gql<any>(
      `query($q:String!,$issue:String!,$pr:String!){
        repositories:search(type:REPOSITORY,query:$q,first:0){repositoryCount}
        issues:search(type:ISSUE,query:$issue,first:0){issueCount}
        pullrequests:search(type:ISSUE,query:$pr,first:0){issueCount}
        users:search(type:USER,query:$q,first:0){userCount}
        discussions:search(type:DISCUSSION,query:$q,first:0){discussionCount}
      }`,
      { q, issue: withType(q, 'issue', true), pr: withType(q, 'pr', true) },
    );
    return {
      repositories: data.repositories?.repositoryCount ?? 0,
      issues: data.issues?.issueCount ?? 0,
      pullrequests: data.pullrequests?.issueCount ?? 0,
      users: data.users?.userCount ?? 0,
      discussions: data.discussions?.discussionCount ?? 0,
    };
  } catch {
    // Counts are decoration; a query GraphQL rejects just shows no numbers.
    return null;
  }
}, 'search-counts');

export interface OwnerDetails {
  name: string | null;
  bio: string | null;
  location: string | null;
  followers?: number;
  repositories?: number;
}

/** Name / bio / location for a page of user search hits (one aliased GraphQL call). */
export const getOwnerDetails = query(async (logins: string[]): Promise<Record<string, OwnerDetails>> => {
  if (!logins.length) return {};
  const fields = logins
    .map(
      (login, i) => `u${i}:repositoryOwner(login:${JSON.stringify(login)}){
        ... on User{name bio location followers{totalCount} repositories(privacy:PUBLIC){totalCount}}
        ... on Organization{name description location repositories(privacy:PUBLIC){totalCount}}
      }`,
    )
    .join('\n');
  try {
    const data = await gql<any>(`query{${fields}}`);
    const out: Record<string, OwnerDetails> = {};
    logins.forEach((login, i) => {
      const u = data[`u${i}`];
      if (!u) return;
      out[login] = {
        name: u.name ?? null,
        bio: u.bio ?? u.description ?? null,
        location: u.location ?? null,
        followers: u.followers?.totalCount,
        repositories: u.repositories?.totalCount,
      };
    });
    return out;
  } catch {
    return {};
  }
}, 'search-owner-details');
