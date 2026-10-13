import { query, revalidate } from '@solidjs/router';
import { gh, ghAll, gql } from '../../lib/github';
import type { DiffFile } from '../../lib/types';
import type { Side } from '../diff/parse';
import { COMMIT_NODE_FIELDS, toHistoryCommit, type HistoryCommit } from './api';

/**
 * Data + mutations for the pull request "Files changed" and "Commits" tabs.
 * Review mutations are plain async functions that revalidate only the review
 * threads (a router action would refetch the whole diff and reset its state).
 */

/** Changed files with patches (REST caps this at 3,000). */
export const getPullFiles = query(
  (owner: string, repo: string, number: number) => ghAll<DiffFile>(`/repos/${owner}/${repo}/pulls/${number}/files`, { max: 3000 }),
  'pull-files',
);

export interface ReviewComment {
  id: string;
  databaseId: number;
  body: string;
  bodyHTML: string;
  createdAt: string;
  state: 'PENDING' | 'SUBMITTED' | string;
  url: string;
  author: { login: string; avatarUrl: string } | null;
}

export interface ReviewThread {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  line: number | null;
  startLine: number | null;
  diffSide: Side;
  startDiffSide: Side | null;
  originalLine: number | null;
  comments: ReviewComment[];
}

export interface PullReviewState {
  pullId: string;
  headSha: string;
  /** The viewer's pending (unsubmitted) review, if any. */
  pendingReview: { id: string; databaseId: number } | null;
  threads: ReviewThread[];
}

/** Review threads (with resolved/outdated state) and the viewer's pending review. */
export const getPullReviewState = query(async (owner: string, repo: string, number: number): Promise<PullReviewState> => {
  let after: string | null = null;
  const threads: ReviewThread[] = [];
  let head: any;
  for (let i = 0; i < 10; i++) {
    const data: any = await gql<any>(
      `query($owner:String!,$name:String!,$number:Int!,$after:String){repository(owner:$owner,name:$name){pullRequest(number:$number){
        id headRefOid
        reviews(states:[PENDING],first:1){nodes{id databaseId}}
        reviewThreads(first:100,after:$after){pageInfo{hasNextPage endCursor} nodes{
          id isResolved isOutdated path line startLine diffSide startDiffSide originalLine
          comments(first:100){nodes{id databaseId body bodyHTML createdAt state url author{login avatarUrl}}}
        }}
      }}}`,
      { owner, name: repo, number, after },
    );
    const pr = data.repository.pullRequest;
    head ??= pr;
    for (const t of pr.reviewThreads.nodes) threads.push({ ...t, comments: t.comments.nodes });
    if (!pr.reviewThreads.pageInfo.hasNextPage) break;
    after = pr.reviewThreads.pageInfo.endCursor;
  }
  return {
    pullId: head.id,
    headSha: head.headRefOid,
    pendingReview: head.reviews.nodes[0] ?? null,
    threads,
  };
}, 'pull-review-state');

const refreshThreads = (owner: string, repo: string, number: number) =>
  revalidate(getPullReviewState.keyFor(owner, repo, number), true);

/** Server-side "Viewed" checkboxes. */
export const getPullViewed = query(async (owner: string, repo: string, number: number) => {
  const out: Record<string, boolean> = {};
  let after: string | null = null;
  for (let i = 0; i < 30; i++) {
    const data: any = await gql<any>(
      `query($owner:String!,$name:String!,$number:Int!,$after:String){repository(owner:$owner,name:$name){pullRequest(number:$number){
        files(first:100,after:$after){pageInfo{hasNextPage endCursor} nodes{path viewerViewedState}}
      }}}`,
      { owner, name: repo, number, after },
    );
    const files = data.repository.pullRequest.files;
    for (const f of files.nodes) if (f.viewerViewedState === 'VIEWED') out[f.path] = true;
    if (!files.pageInfo.hasNextPage) break;
    after = files.pageInfo.endCursor;
  }
  return out;
}, 'pull-viewed');

export async function setFileViewed(pullId: string, path: string, viewed: boolean) {
  await gql(
    viewed
      ? `mutation($id:ID!,$path:String!){markFileAsViewed(input:{pullRequestId:$id,path:$path}){clientMutationId}}`
      : `mutation($id:ID!,$path:String!){unmarkFileAsViewed(input:{pullRequestId:$id,path:$path}){clientMutationId}}`,
    { id: pullId, path },
  );
}

export interface NewComment {
  path: string;
  line: number;
  side: Side;
  startLine?: number;
  startSide?: Side;
  body: string;
}

/** "Add single comment" — POST /pulls/{n}/comments (published immediately). */
export async function addSingleComment(owner: string, repo: string, number: number, commitId: string, c: NewComment) {
  await gh(`/repos/${owner}/${repo}/pulls/${number}/comments`, {
    method: 'POST',
    body: {
      body: c.body,
      commit_id: commitId,
      path: c.path,
      line: c.line,
      side: c.side,
      ...(c.startLine ? { start_line: c.startLine, start_side: c.startSide ?? c.side } : {}),
    },
  });
  refreshThreads(owner, repo, number);
}

/** "Start a review" / "Add review comment" — a thread on the viewer's pending review (created on demand). */
export async function addReviewComment(
  owner: string,
  repo: string,
  number: number,
  state: Pick<PullReviewState, 'pullId' | 'pendingReview'>,
  c: NewComment,
) {
  const thread = {
    path: c.path,
    line: c.line,
    side: c.side,
    startLine: c.startLine ?? null,
    startSide: c.startLine ? (c.startSide ?? c.side) : null,
    body: c.body,
  };
  if (state.pendingReview) {
    await gql(
      `mutation($input:AddPullRequestReviewThreadInput!){addPullRequestReviewThread(input:$input){thread{id}}}`,
      { input: { pullRequestReviewId: state.pendingReview.id, ...thread } },
    );
  } else {
    await gql(`mutation($input:AddPullRequestReviewInput!){addPullRequestReview(input:$input){pullRequestReview{id}}}`, {
      input: { pullRequestId: state.pullId, threads: [thread] },
    });
  }
  refreshThreads(owner, repo, number);
}

export async function replyToThread(owner: string, repo: string, number: number, commentId: number, body: string) {
  await gh(`/repos/${owner}/${repo}/pulls/${number}/comments/${commentId}/replies`, { method: 'POST', body: { body } });
  refreshThreads(owner, repo, number);
}

export async function setThreadResolved(owner: string, repo: string, number: number, threadId: string, resolved: boolean) {
  await gql(
    resolved
      ? `mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{id}}}`
      : `mutation($id:ID!){unresolveReviewThread(input:{threadId:$id}){thread{id}}}`,
    { id: threadId },
  );
  refreshThreads(owner, repo, number);
}

export async function deleteReviewComment(owner: string, repo: string, number: number, commentId: number) {
  await gh(`/repos/${owner}/${repo}/pulls/comments/${commentId}`, { method: 'DELETE' });
  refreshThreads(owner, repo, number);
}

export type ReviewEvent = 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES';

/** Submit the pending review, or create + submit one in a single call. */
export async function submitReview(
  owner: string,
  repo: string,
  number: number,
  state: Pick<PullReviewState, 'pendingReview' | 'headSha'>,
  event: ReviewEvent,
  body: string,
) {
  if (state.pendingReview) {
    await gh(`/repos/${owner}/${repo}/pulls/${number}/reviews/${state.pendingReview.databaseId}/events`, {
      method: 'POST',
      body: { event, body },
    });
  } else {
    await gh(`/repos/${owner}/${repo}/pulls/${number}/reviews`, {
      method: 'POST',
      body: { event, body, commit_id: state.headSha },
    });
  }
  // Everything on the PR can change after a review (state, timeline): full refresh.
  revalidate();
}

// ---------------------------------------------------------------------------
// Commits tab

/** Commits of a PR (oldest first, up to 250 like github.com). */
export const getPullCommits = query(async (owner: string, repo: string, number: number): Promise<HistoryCommit[]> => {
  const out: HistoryCommit[] = [];
  let after: string | null = null;
  for (let i = 0; i < 3; i++) {
    const data: any = await gql<any>(
      `query($owner:String!,$name:String!,$number:Int!,$after:String){repository(owner:$owner,name:$name){pullRequest(number:$number){
        commits(first:100,after:$after){pageInfo{hasNextPage endCursor} nodes{commit{${COMMIT_NODE_FIELDS}}}}
      }}}`,
      { owner, name: repo, number, after },
    );
    const commits = data.repository.pullRequest.commits;
    out.push(...commits.nodes.map((n: any) => toHistoryCommit(n.commit)));
    if (!commits.pageInfo.hasNextPage) break;
    after = commits.pageInfo.endCursor;
  }
  return out.slice(0, 250);
}, 'pull-commits');
