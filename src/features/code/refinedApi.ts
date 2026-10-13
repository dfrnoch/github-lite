import { query } from '@solidjs/router';
import { encodePath, gh, GitHubError, gql } from '../../lib/github';

/**
 * Reads for the Refined GitHub features of the code area. Every query here is
 * only called while its feature is enabled, so disabled features cost nothing.
 */

// ---------------------------------------------------------------------------
// previous-version

/** The commit before the latest one that touched `path` at `ref` (null for a file's first version). */
export const getPreviousFileCommit = query(async (owner: string, repo: string, ref: string, path: string) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$ref:String!,$path:String!){repository(owner:$owner,name:$name){
      object(expression:$ref){... on Commit{history(first:2,path:$path){nodes{oid}}}}
    }}`,
    { owner, name: repo, ref, path },
  );
  return (data.repository?.object?.history?.nodes?.[1]?.oid as string | undefined) ?? null;
}, 'rgh-previous-file-commit');

// ---------------------------------------------------------------------------
// list-prs-for-file

export interface FilePull {
  number: number;
  title: string;
  isDraft: boolean;
}

/**
 * Open PRs against `base` (25 most recently updated, like the extension), keyed
 * by the paths they change. One GraphQL request per repo/branch, cached.
 */
export const getOpenPullsByFile = query(async (owner: string, repo: string, base: string) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$base:String!){repository(owner:$owner,name:$name){
      pullRequests(first:25,states:OPEN,baseRefName:$base,orderBy:{field:UPDATED_AT,direction:DESC}){
        nodes{number title isDraft files(first:100){nodes{path}}}
      }
    }}`,
    { owner, name: repo, base },
  );
  const out: Record<string, FilePull[]> = {};
  for (const pr of data.repository?.pullRequests?.nodes ?? []) {
    for (const f of pr.files?.nodes ?? []) {
      out[f.path] ??= [];
      if (out[f.path]!.length < 10) out[f.path]!.push({ number: pr.number, title: pr.title, isDraft: pr.isDraft });
    }
  }
  return out;
}, 'rgh-open-pulls-by-file');

// ---------------------------------------------------------------------------
// list-prs-for-branch / pr-from-branch / delete-branch

export interface BranchPull {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  isDraft: boolean;
  /** "owner/repo" the PR lives in (differs from the branch's repo for fork → upstream PRs). */
  repo: string;
}

const BRANCH_PULL_FIELDS = `number title state isDraft repository{nameWithOwner}
  timelineItems(last:1,itemTypes:[HEAD_REF_DELETED_EVENT,HEAD_REF_RESTORED_EVENT]){nodes{__typename}}`;

/** Picks the PR shown for a branch: an open one, else the newest; skips PRs whose head branch was deleted (same name, other branch). */
export function pickBranchPull(nodes: any[]): BranchPull | null {
  const live = nodes.filter((n) => n.timelineItems?.nodes?.[0]?.__typename !== 'HeadRefDeletedEvent');
  const pr = live.find((n) => n.state === 'OPEN') ?? [...live].sort((a, b) => b.number - a.number)[0];
  return pr ? { number: pr.number, title: pr.title, state: pr.state, isDraft: pr.isDraft, repo: pr.repository.nameWithOwner } : null;
}

/** Branch status vs the default branch + its PR — the "branch info bar" of a branch's root. */
export const getBranchStatus = query(async (owner: string, repo: string, branch: string, defaultBranch: string) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$ref:String!,$base:String!){repository(owner:$owner,name:$name){
      ref(qualifiedName:$ref){
        compare(headRef:$base){aheadBy behindBy}
        associatedPullRequests(first:5,orderBy:{field:CREATED_AT,direction:DESC}){nodes{${BRANCH_PULL_FIELDS}}}
      }
    }}`,
    { owner, name: repo, ref: `refs/heads/${branch}`, base: defaultBranch },
  );
  const ref = data.repository?.ref;
  if (!ref) return null;
  return {
    // compare(base = this branch, head = default): the default's lead is this branch's lag.
    behind: (ref.compare?.aheadBy as number) ?? 0,
    ahead: (ref.compare?.behindBy as number) ?? 0,
    pull: pickBranchPull(ref.associatedPullRequests?.nodes ?? []),
  };
}, 'rgh-branch-status');

// ---------------------------------------------------------------------------
// tags-on-commits-list

/**
 * Tags pointing at commits, newest first, paging until the tags are older than
 * `lastCommit` (the oldest commit on screen) — like the extension.
 */
export const getCommitTags = query(async (owner: string, repo: string, lastCommit: string) => {
  const tags: Record<string, string[]> = {};
  let after: string | null = null;
  for (let page = 0; page < 5; page++) {
    const data: any = await gql<any>(
      `query($owner:String!,$name:String!,$commit:String!,$after:String){repository(owner:$owner,name:$name){
        object(expression:$commit){... on Commit{committedDate}}
        refs(refPrefix:"refs/tags/",first:100,after:$after,orderBy:{field:TAG_COMMIT_DATE,direction:DESC}){
          pageInfo{hasNextPage endCursor}
          nodes{name target{__typename ... on Commit{oid committedDate} ... on Tag{tagger{date} target{... on Commit{oid committedDate}}}}}
        }
      }}`,
      { owner, name: repo, commit: lastCommit, after },
    );
    const refs = data.repository?.refs;
    if (!refs) break;
    let lastDate = '';
    for (const node of refs.nodes) {
      const t = node.target;
      const commit = t.__typename === 'Tag' ? t.target : t;
      lastDate = t.__typename === 'Tag' ? (t.tagger?.date ?? commit?.committedDate ?? '') : (t.committedDate ?? '');
      if (!commit?.oid || node.name === 'nightly') continue;
      (tags[commit.oid] ??= []).push(node.name);
    }
    const lastCommitDate = data.repository?.object?.committedDate;
    if (!refs.pageInfo.hasNextPage || !refs.nodes.length || !lastCommitDate || new Date(lastCommitDate) >= new Date(lastDate)) break;
    after = refs.pageInfo.endCursor;
  }
  return tags;
}, 'rgh-commit-tags');

// ---------------------------------------------------------------------------
// deep-reblame

/** The PR's last commit, to blame "inside" a squash-merged PR. Not a query: runs on Alt-click. */
export async function getPullBlameCommit(owner: string, repo: string, commit: string, path: string) {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$commit:String!,$file:String!){repository(owner:$owner,name:$name){
      file:object(expression:$file){id}
      object(expression:$commit){... on Commit{
        associatedPullRequests(last:1){nodes{number mergeCommit{oid} commits(last:1){nodes{commit{oid}}}}}
      }}
    }}`,
    { owner, name: repo, commit, file: `${commit}:${path}` },
  );
  const pr = data.repository?.object?.associatedPullRequests?.nodes?.[0];
  if (!pr || pr.mergeCommit?.oid !== commit) throw new Error('The PR linked in the title didn’t create this commit');
  if (!data.repository.file) throw new Error('The file was renamed and can’t be found in the PR');
  return pr.commits.nodes[0].commit.oid as string;
}

// ---------------------------------------------------------------------------
// pr-base-commit

/** How many commits a PR head is behind its base branch (one GraphQL request). */
export const getPullBehind = query(async (owner: string, repo: string, baseRef: string, headSha: string) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$base:String!,$head:String!){repository(owner:$owner,name:$name){
      ref(qualifiedName:$base){compare(headRef:$head){status behindBy}}
    }}`,
    { owner, name: repo, base: `refs/heads/${baseRef}`, head: headSha },
  );
  const cmp = data.repository?.ref?.compare;
  return cmp ? { behindBy: cmp.behindBy as number, needsUpdate: cmp.status === 'DIVERGED' } : null;
}, 'rgh-pull-behind');

// ---------------------------------------------------------------------------
// restore-file

export interface RestoreTarget {
  owner: string;
  repo: string;
  number: number;
  /** "owner/repo" of the PR head. */
  headRepo: string;
  headBranch: string;
  headSha: string;
  baseRef: string;
  headLabel: string;
}

/**
 * Discard a PR's changes to one file: commit the merge-base version back onto
 * the head branch (or delete the file if the PR added it), with
 * `createCommitOnBranch` guarded by the expected head commit.
 */
export async function restoreFile(t: RestoreTarget, file: { filename: string; previous_filename?: string }, headline: string) {
  const original = file.previous_filename ?? file.filename;
  const cmp = await gh<{ merge_base_commit: { sha: string } }>(
    `/repos/${t.owner}/${t.repo}/compare/${encodeURIComponent(t.baseRef)}...${encodeURIComponent(t.headLabel)}`,
    { query: { per_page: 1 } },
  );
  let contents: string | undefined;
  try {
    const blob = await gh<{ content: string }>(`/repos/${t.owner}/${t.repo}/contents/${encodePath(original)}`, {
      query: { ref: cmp.merge_base_commit.sha },
    });
    contents = blob.content.replace(/\n/g, '');
  } catch (e) {
    if (!(e instanceof GitHubError && e.status === 404)) throw e;
  }
  const renamed = original !== file.filename;
  const fileChanges =
    contents === undefined
      ? { deletions: [{ path: file.filename }] }
      : renamed
        ? { additions: [{ path: original, contents }], deletions: [{ path: file.filename }] }
        : { additions: [{ path: original, contents }] };
  await gql(
    `mutation($input:CreateCommitOnBranchInput!){createCommitOnBranch(input:$input){commit{oid}}}`,
    {
      input: {
        branch: { repositoryNameWithOwner: t.headRepo, branchName: t.headBranch },
        expectedHeadOid: t.headSha,
        fileChanges,
        message: { headline },
      },
    },
  );
}
