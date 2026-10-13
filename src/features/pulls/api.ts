import { action, query } from '@solidjs/router';
import { gh, GitHubError, gql } from '../../lib/github';
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

/** Number of checks on the head commit (Checks tab counter). */
export const getPullChecksCount = query(async (owner: string, repo: string, number: number) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){
      commits(last:1){nodes{commit{statusCheckRollup{state contexts(first:0){totalCount}}}}}
    }}}`,
    { owner, name: repo, number },
  );
  const rollup = data.repository.pullRequest?.commits.nodes[0]?.commit.statusCheckRollup;
  return { count: (rollup?.contexts.totalCount ?? 0) as number, state: (rollup?.state ?? null) as string | null };
}, 'pull-checks-count');

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

export const updatePullBranch = action(async (owner: string, repo: string, number: number, headSha: string) => {
  await gh(`/repos/${owner}/${repo}/pulls/${number}/update-branch`, {
    method: 'PUT',
    body: { expected_head_sha: headSha },
  });
}, 'update-pull-branch');

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
