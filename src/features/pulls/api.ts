import { action, query } from '@solidjs/router';
import { gh, ghAll, GitHubError, gql } from '../../lib/github';
import type { PullRequest } from '../../lib/types';
import { TIMELINE_EDGE } from '../issues/api';
import { PULL_PAGE } from '../issues/graphql';
import type { MergeMethod, PullDetail, PullRepoMeta } from '../issues/types';

/**
 * GET /repos/{owner}/{repo}/pulls/{number} — the REST pull request (head/base,
 * counts, diff stats). Resolves to null when the number is an issue (the
 * layout then redirects to /issues/:n like github.com).
 */
export const getPull = query(async (owner: string, repo: string, number: number): Promise<PullRequest | null> => {
  try {
    return await gh<PullRequest>(`/repos/${owner}/${repo}/pulls/${number}`);
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) {
      // Not a PR: an issue with that number exists → let the caller redirect.
      await gh(`/repos/${owner}/${repo}/issues/${number}`);
      return null;
    }
    throw e;
  }
}, 'pull');

/**
 * Number of checks on the head commit (Checks tab counter), plus whether the
 * head branch is gone.
 */
export const getPullChecksCount = query(async (owner: string, repo: string, number: number) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){
      headRef{id} headRepository{id}
      commits(last:1){nodes{commit{statusCheckRollup{state contexts(first:0){totalCount}}}}}
    }}}`,
    { owner, name: repo, number },
  );
  const pr = data.repository.pullRequest;
  const rollup = pr?.commits.nodes[0]?.commit.statusCheckRollup;
  return {
    count: (rollup?.contexts.totalCount ?? 0) as number,
    state: (rollup?.state ?? null) as string | null,
    headDeleted: !!pr && (!pr.headRef || !pr.headRepository),
  };
}, 'pull-checks-count');

// ---------------------------------------------------------------------------
// Refined GitHub (pulls area)
// ---------------------------------------------------------------------------

export interface PullDeployment {
  createdAt: string;
  environment: string | null;
  /** ACTIVE | INACTIVE | FAILURE | ERROR | PENDING | … */
  state: string;
  url: string | null;
}

/** Key matching a timeline DeployedEvent node to its deployment (the timeline query has no ids). */
export const deploymentKey = (createdAt: string | undefined, environment: string | null | undefined) => `${createdAt}|${environment ?? ''}`;

/** The PR's deployments, oldest first. */
export const getPullDeployments = query(async (owner: string, repo: string, number: number): Promise<PullDeployment[]> => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){
      timelineItems(last:100,itemTypes:[DEPLOYED_EVENT]){nodes{... on DeployedEvent{createdAt deployment{state environment latestStatus{state environmentUrl}}}}}
    }}}`,
    { owner, name: repo, number },
  );
  return (data.repository.pullRequest?.timelineItems.nodes ?? [])
    .filter((n: any) => n.deployment)
    .map((n: any) => ({
      createdAt: n.createdAt,
      environment: n.deployment.environment,
      state: n.deployment.state,
      url: n.deployment.latestStatus?.environmentUrl ?? null,
    }));
}, 'pull-deployments');

/** Versioned tags (v1.2.3, 1.2) are preferred over e.g. "nightly". */
const isVersionTag = (name: string) => !name.includes('nightly') && /\d[.]\d/.test(name);

/**
 * Closing remarks: for a merged PR, the first tag that contains its merge
 * commit and whether the repo has any tags at all (null when not merged).
 * Walks tags newest → oldest down to the merge date (the first page comes
 * with the PR in one request), then checks containment with the compare API.
 */
export const getFirstTag = query(async (owner: string, repo: string, number: number): Promise<{ tag: string | null; hasTags: boolean; sha: string } | null> => {
  const TAGS = `refs(refPrefix:"refs/tags/",first:100,after:$after,orderBy:{field:TAG_COMMIT_DATE,direction:DESC}){
    totalCount pageInfo{hasNextPage endCursor}
    nodes{name target{__typename ... on Commit{committedDate} ... on Tag{target{... on Commit{committedDate}}}}}
  }`;
  const first: any = await gql<any>(
    `query($owner:String!,$name:String!,$number:Int!,$after:String){repository(owner:$owner,name:$name){
      pullRequest(number:$number){merged mergedAt mergeCommit{oid}} ${TAGS}
    }}`,
    { owner, name: repo, number, after: null },
  );
  const pr = first.repository.pullRequest;
  if (!pr?.merged || !pr.mergeCommit) return null;
  const sha: string = pr.mergeCommit.oid;
  const since = Date.parse(pr.mergedAt) - 60_000;
  const hasTags = first.repository.refs.totalCount > 0;
  const candidates: { name: string; date: number }[] = [];
  let refs = first.repository.refs;
  for (let page = 0; page < 5; page++) {
    // The order follows tag dates, which can differ from commit dates — keep
    // walking a month past the merge before giving up on older pages.
    let reachedMerge = false;
    for (const n of refs.nodes) {
      const date = Date.parse(n.target?.committedDate ?? n.target?.target?.committedDate ?? '');
      if (Number.isNaN(date)) continue;
      if (date >= since) candidates.push({ name: n.name, date });
      else if (date < since - 30 * 86_400_000) reachedMerge = true;
    }
    if (reachedMerge || !refs.pageInfo.hasNextPage) break;
    const next: any = await gql<any>(`query($owner:String!,$name:String!,$after:String){repository(owner:$owner,name:$name){${TAGS}}}`, {
      owner,
      name: repo,
      after: refs.pageInfo.endCursor,
    });
    refs = next.repository.refs;
  }
  candidates.sort((a, b) => a.date - b.date);
  const contains = async (tag: string) => {
    try {
      const cmp = await gh<{ status: string }>(`/repos/${owner}/${repo}/compare/${sha}...${encodeURIComponent(tag)}`, { query: { per_page: 1 } });
      return cmp.status === 'ahead' || cmp.status === 'identical';
    } catch {
      return false;
    }
  };
  for (const list of [candidates.filter((c) => isVersionTag(c.name)).slice(0, 5), candidates.filter((c) => !isVersionTag(c.name)).slice(0, 2)]) {
    for (const c of list) if (await contains(c.name)) return { tag: c.name, hasTags, sha };
  }
  return { tag: null, hasTags, sha };
}, 'pull-first-tag');

/**
 * Whether the head branch is behind its base
 * (and still ahead, i.e. diverged) and the viewer may push to it.
 */
export const getPullBranchUpdatable = query(async (owner: string, repo: string, number: number, base: string): Promise<boolean> => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$number:Int!,$base:String!){repository(owner:$owner,name:$name){pullRequest(number:$number){
      mergeable viewerCanUpdate viewerCanEditFiles
      headRef{compare(headRef:$base){status aheadBy}}
      headRepository{viewerPermission}
    }}}`,
    { owner, name: repo, number, base },
  );
  const pr = data.repository.pullRequest;
  if (!pr?.headRef) return false;
  const canPushHead = pr.viewerCanUpdate || pr.viewerCanEditFiles || ['ADMIN', 'MAINTAIN', 'WRITE'].includes(pr.headRepository?.viewerPermission);
  // compare() runs head → base, so "DIVERGED" means the head is behind (and ahead).
  return canPushHead && pr.mergeable !== 'CONFLICTING' && pr.headRef.compare?.status === 'DIVERGED';
}, 'pull-branch-updatable');

export interface SquashCommit {
  message: string;
  authors: { name: string | null; email: string | null; login: string | null }[];
}

/** Commit messages and authors (clear-pr-merge-commit-message builds the squash message from them). */
export const getPullCommitMessages = query(async (owner: string, repo: string, number: number): Promise<SquashCommit[]> => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){
      commits(first:250){nodes{commit{message authors(first:10){nodes{name email user{login}}}}}}
    }}}`,
    { owner, name: repo, number },
  );
  return (data.repository.pullRequest?.commits.nodes ?? []).map((n: any) => ({
    message: n.commit.message,
    authors: n.commit.authors.nodes.map((a: any) => ({ name: a.name, email: a.email, login: a.user?.login ?? null })),
  }));
}, 'pull-commit-messages');

/** pr-branch-auto-delete: open PRs that use `branch` as their base (deleting it would close them). */
export const countPullsBasedOn = (owner: string, repo: string, branch: string) =>
  gql<any>(
    `query($owner:String!,$name:String!,$base:String!){repository(owner:$owner,name:$name){pullRequests(baseRefName:$base,states:OPEN){totalCount}}}`,
    { owner, name: repo, base: branch },
  ).then((d) => d.repository.pullRequests.totalCount as number);

interface CompareFile {
  filename: string;
  previous_filename?: string;
}

/**
 * Merge box: an approximation of the files a conflicting PR conflicts in —
 * the API doesn't list them. Files the PR changes (GET /pulls/:n/files) that
 * were also changed on the base branch since the two diverged (compare from
 * the merge base to the base branch's tip). Renames match on either name.
 */
export const getPullConflictFiles = query(
  async (owner: string, repo: string, number: number, base: string, headSha: string, headLabel: string): Promise<string[]> => {
    const path = `/repos/${owner}/${repo}`;
    const mergeBase = async () => {
      const cmp = (head: string) =>
        gh<{ merge_base_commit: { sha: string } }>(`${path}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`, { query: { per_page: 1 } });
      // A fork's head SHA usually resolves in the parent's network; fall back to "owner:branch".
      const res = await cmp(headSha).catch(() => cmp(headLabel));
      return res.merge_base_commit.sha;
    };
    const [sha, prFiles] = await Promise.all([mergeBase(), ghAll<CompareFile>(`${path}/pulls/${number}/files`, { max: 3000 })]);
    const onBase = await gh<{ files?: CompareFile[] }>(`${path}/compare/${sha}...${encodeURIComponent(base)}`, { query: { per_page: 1 } });
    const changed = new Set<string>();
    for (const f of onBase.files ?? []) {
      changed.add(f.filename);
      if (f.previous_filename) changed.add(f.previous_filename);
    }
    return prFiles
      .filter((f) => changed.has(f.filename) || (!!f.previous_filename && changed.has(f.previous_filename)))
      .map((f) => f.filename)
      .sort((a, b) => a.localeCompare(b));
  },
  'pull-conflict-files',
);

export interface PullPageData {
  repo: PullRepoMeta;
  pull: PullDetail | null;
}

/** Conversation tab: PR + timeline + review threads + merge state (one GraphQL request). */
export const getPullPage = query(async (owner: string, repo: string, number: number): Promise<PullPageData> => {
  const data = await gql<any>(PULL_PAGE, { owner, name: repo, number, first: TIMELINE_EDGE, last: TIMELINE_EDGE });
  if (!data.repository?.issueOrPullRequest) throw new GitHubError(404, 'Not Found');
  const { issueOrPullRequest: item, ...meta } = data.repository;
  return { repo: meta, pull: item.__typename === 'PullRequest' ? item : null };
}, 'pull-page');

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const mergePull = action(
  async (
    owner: string,
    repo: string,
    number: number,
    opts: { method: MergeMethod; title?: string; message?: string; sha: string },
  ) => {
    await gh(`/repos/${owner}/${repo}/pulls/${number}/merge`, {
      method: 'PUT',
      body: {
        merge_method: opts.method.toLowerCase(),
        sha: opts.sha,
        ...(opts.title != null ? { commit_title: opts.title } : {}),
        ...(opts.message != null ? { commit_message: opts.message } : {}),
      },
    });
  },
  'merge-pull',
);

/** Merge or rebase the base branch into the head branch (GraphQL supports both). */
export const updatePullBranch = action(async (pullId: string, headOid: string, method: 'MERGE' | 'REBASE') => {
  await gql(
    `mutation($input:UpdatePullRequestBranchInput!){updatePullRequestBranch(input:$input){clientMutationId}}`,
    { input: { pullRequestId: pullId, expectedHeadOid: headOid, updateMethod: method } },
  );
}, 'update-pull-branch');

/** Approve right away (POST /pulls/{n}/reviews, event APPROVE). */
export const approvePull = action(async (owner: string, repo: string, number: number, body: string) => {
  await gh(`/repos/${owner}/${repo}/pulls/${number}/reviews`, { method: 'POST', body: { event: 'APPROVE', body } });
}, 'approve-pull');

/** Delete the head branch (`repo` is the head repository's "owner/name"). */
export const deleteBranch = action(async (headRepo: string, branch: string) => {
  await gh(`/repos/${headRepo}/git/refs/heads/${branch.split('/').map(encodeURIComponent).join('/')}`, { method: 'DELETE' });
}, 'delete-branch');

export const restoreBranch = action(async (headRepo: string, branch: string, sha: string) => {
  await gh(`/repos/${headRepo}/git/refs`, { method: 'POST', body: { ref: `refs/heads/${branch}`, sha } });
}, 'restore-branch');

/** Draft ↔ ready for review (GraphQL-only mutations). */
export const setDraft = action(async (pullId: string, draft: boolean) => {
  await gql(
    draft
      ? `mutation($id:ID!){convertPullRequestToDraft(input:{pullRequestId:$id}){clientMutationId}}`
      : `mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){clientMutationId}}`,
    { id: pullId },
  );
}, 'set-draft');

export const updatePull = action(
  async (owner: string, repo: string, number: number, patch: { title?: string; body?: string; state?: 'open' | 'closed'; base?: string }) => {
    await gh(`/repos/${owner}/${repo}/pulls/${number}`, { method: 'PATCH', body: patch });
  },
  'update-pull',
);

/** Request / un-request reviews. Team reviewers are given as "team:slug". */
export const setReviewers = action(
  async (owner: string, repo: string, number: number, add: string[], remove: string[]) => {
    const split = (list: string[]) => ({
      reviewers: list.filter((r) => !r.startsWith('team:')),
      team_reviewers: list.filter((r) => r.startsWith('team:')).map((r) => r.slice(5)),
    });
    const path = `/repos/${owner}/${repo}/pulls/${number}/requested_reviewers`;
    if (remove.length) await gh(path, { method: 'DELETE', body: split(remove) });
    if (add.length) await gh(path, { method: 'POST', body: split(add) });
  },
  'set-reviewers',
);

export const replyToThread = action(
  async (owner: string, repo: string, number: number, commentId: number, body: string) => {
    await gh(`/repos/${owner}/${repo}/pulls/${number}/comments/${commentId}/replies`, { method: 'POST', body: { body } });
  },
  'reply-review-thread',
);

export const setThreadResolved = action(async (threadId: string, resolved: boolean) => {
  await gql(
    `mutation($id:ID!){${resolved ? 'resolveReviewThread' : 'unresolveReviewThread'}(input:{threadId:$id}){clientMutationId}}`,
    { id: threadId },
  );
}, 'set-thread-resolved');

export const setAutoMerge = action(async (pullId: string, method: MergeMethod | null) => {
  if (method)
    await gql(
      `mutation($id:ID!,$method:PullRequestMergeMethod!){enablePullRequestAutoMerge(input:{pullRequestId:$id,mergeMethod:$method}){clientMutationId}}`,
      { id: pullId, method },
    );
  else await gql(`mutation($id:ID!){disablePullRequestAutoMerge(input:{pullRequestId:$id}){clientMutationId}}`, { id: pullId });
}, 'set-auto-merge');
