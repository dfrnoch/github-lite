import { action, query } from '@solidjs/router';
import { gh, ghAll, GitHubError, gql } from '../../lib/github';
import type { Issue, Label, Milestone } from '../../lib/types';
import { ACTOR, ISSUE_PAGE, PROJECT_ITEMS, TIMELINE_PAGE } from './graphql';
import { withoutState } from './query';
import type { IssueDetail, ListItem, ReactionContent, RepoMeta, TimelineConnection } from './types';

// ---------------------------------------------------------------------------
// Lists (GraphQL search)
// ---------------------------------------------------------------------------

const LIST_COMMON = `id number title titleHTML url state createdAt updatedAt closedAt author{${ACTOR}} authorAssociation
  repository{nameWithOwner} labels(first:10){nodes{name color description}} assignees(first:5){nodes{login avatarUrl}}
  milestone{number title} comments{totalCount}`;

const LIST_FIELDS = `__typename
  ... on Issue{${LIST_COMMON} stateReason issueType{name color} closedByPullRequestsReferences(first:0){totalCount} subIssuesSummary{total completed}}
  ... on PullRequest{${LIST_COMMON} isDraft reviewDecision closingIssuesReferences(first:0){totalCount}
    commits(last:1){nodes{commit{statusCheckRollup{state contexts(first:0){totalCount checkRunCountsByState{state count} statusContextCountsByState{state count}}}}}}}`;

export const PER_PAGE = 25;

export interface SearchResult {
  items: ListItem[];
  total: number;
  open: number;
  closed: number;
}

/**
 * One page of an issue/PR search plus the Open / Closed counts for the same
 * query — one GraphQL request. GitHub's search cursors are offsets
 * ("cursor:N", base64), which lets us jump straight to ?page=N.
 */
export const searchIssues = query(async (q: string, page = 1): Promise<SearchResult> => {
  const base = withoutState(q);
  const offset = (page - 1) * PER_PAGE;
  const data = await gql<any>(
    `query($q:String!,$open:String!,$closed:String!,$after:String,$first:Int!){
      list:search(query:$q,type:ISSUE_ADVANCED,first:$first,after:$after){issueCount nodes{${LIST_FIELDS}}}
      open:search(query:$open,type:ISSUE_ADVANCED,first:0){issueCount}
      closed:search(query:$closed,type:ISSUE_ADVANCED,first:0){issueCount}
    }`,
    {
      q,
      open: `${base} state:open`,
      closed: `${base} state:closed`,
      after: offset ? btoa(`cursor:${offset}`) : null,
      first: PER_PAGE,
    },
  );
  return {
    items: data.list.nodes.filter((n: any) => n && n.number),
    total: data.list.issueCount,
    open: data.open.issueCount,
    closed: data.closed.issueCount,
  };
}, 'issue-search');

// ---------------------------------------------------------------------------
// Repo metadata used by pickers and filters
// ---------------------------------------------------------------------------

export interface RepoLabel {
  id: string;
  name: string;
  color: string;
  description: string | null;
  openIssues: number;
  openPulls: number;
  createdAt: string;
}

/** Every label of the repo with open issue / PR counts. */
export const getRepoLabels = query(async (owner: string, repo: string): Promise<RepoLabel[]> => {
  const out: RepoLabel[] = [];
  let after: string | null = null;
  for (let i = 0; i < 10; i++) {
    const data: any = await gql(
      `query($owner:String!,$name:String!,$after:String){repository(owner:$owner,name:$name){
        labels(first:100,after:$after,orderBy:{field:NAME,direction:ASC}){pageInfo{hasNextPage endCursor}
          nodes{id name color description createdAt issues(states:OPEN){totalCount} pullRequests(states:OPEN){totalCount}}}
      }}`,
      { owner, name: repo, after },
    );
    const conn = data.repository.labels;
    for (const l of conn.nodes) {
      out.push({
        id: l.id,
        name: l.name,
        color: l.color,
        description: l.description,
        openIssues: l.issues.totalCount,
        openPulls: l.pullRequests.totalCount,
        createdAt: l.createdAt,
      });
    }
    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return out;
}, 'repo-labels');

/** Milestones (REST: has open/closed issue counts and due dates). */
export const getMilestones = query(
  (owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open', sort = 'due_on', direction = 'asc') =>
    ghAll<Milestone & { description: string | null; created_at: string }>(`/repos/${owner}/${repo}/milestones`, {
      query: { state, sort, direction },
      max: 300,
    }),
  'milestones',
);

export const getMilestone = query(
  (owner: string, repo: string, number: number) =>
    gh<Milestone & { description: string | null; created_at: string; html_url: string }>(
      `/repos/${owner}/${repo}/milestones/${number}`,
    ),
  'milestone',
);

export interface PickerUser {
  login: string;
  avatarUrl: string;
  name: string | null;
}

/** Users that can be assigned (also the author / reviewer suggestions). */
export const getAssignableUsers = query(async (owner: string, repo: string): Promise<PickerUser[]> => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){assignableUsers(first:100){nodes{login avatarUrl name}}}}`,
    { owner, name: repo },
  );
  return data.repository.assignableUsers.nodes;
}, 'assignable-users');

/** Users matching a login prefix (for the Author filter beyond the assignable list). */
export const searchUsers = query(async (text: string): Promise<PickerUser[]> => {
  if (!text.trim()) return [];
  const data = await gql<any>(
    `query($q:String!){search(query:$q,type:USER,first:10){nodes{... on User{login avatarUrl name}}}}`,
    { q: `${text} in:login` },
  );
  return data.search.nodes.filter((n: any) => n?.login);
}, 'search-users');

export interface IssueTemplate {
  name: string;
  title: string | null;
  body: string | null;
  about: string | null;
  filename: string;
  labels: { nodes: { name: string }[] } | null;
  assignees: { nodes: { login: string }[] } | null;
}

/** Markdown issue templates from .github/ISSUE_TEMPLATE (issue forms are not exposed by the API). */
export const getIssueTemplates = query(async (owner: string, repo: string) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){
      issueTemplates{name title body about filename labels(first:10){nodes{name}} assignees(first:10){nodes{login}}}
      contactLinks{name about url}
    }}`,
    { owner, name: repo },
  );
  return {
    templates: (data.repository.issueTemplates ?? []) as IssueTemplate[],
    contactLinks: (data.repository.contactLinks ?? []) as { name: string; about: string; url: string }[],
  };
}, 'issue-templates');

// ---------------------------------------------------------------------------
// Issue page
// ---------------------------------------------------------------------------

export const TIMELINE_EDGE = 60;

export type IssuePageData =
  | { repo: RepoMeta; kind: 'pull' }
  | { repo: RepoMeta; kind: 'issue'; issue: IssueDetail };

/** The issue with its whole sidebar and timeline (first/last 60 items) in one request. */
export const getIssuePage = query(async (owner: string, repo: string, number: number): Promise<IssuePageData> => {
  const data = await gql<any>(ISSUE_PAGE, { owner, name: repo, number, first: TIMELINE_EDGE, last: TIMELINE_EDGE });
  const item = data.repository?.issueOrPullRequest;
  if (!item) throw new GitHubError(404, 'Not Found');
  const { issueOrPullRequest: _, ...meta } = data.repository;
  if (item.__typename === 'PullRequest') return { repo: meta, kind: 'pull' };
  return { repo: meta, kind: 'issue', issue: item };
}, 'issue-page');

/** A page of timeline items after `after` (the hidden middle of long timelines). */
export const getTimelinePage = query(
  async (owner: string, repo: string, number: number, isPull: boolean, after: string): Promise<TimelineConnection> => {
    const data = await gql<any>(TIMELINE_PAGE(isPull), { owner, name: repo, number, after });
    return data.repository.issueOrPullRequest.timelineItems;
  },
  'timeline-page',
);

export interface ProjectItem {
  id: string;
  project: { title: string; url: string; number: number };
  fieldValueByName: { name: string } | null;
}

/** Projects (v2) an issue / PR is in. Empty when the token lacks read:project. */
export const getProjectItems = query(async (owner: string, repo: string, number: number): Promise<ProjectItem[] | null> => {
  try {
    const data = await gql<any>(PROJECT_ITEMS, { owner, name: repo, number });
    return data.repository?.issueOrPullRequest?.projectItems?.nodes ?? [];
  } catch {
    return null;
  }
}, 'project-items');

/** REST issue (used after creating one, and for quick lookups). */
export const getIssue = query(
  (owner: string, repo: string, number: number) => gh<Issue>(`/repos/${owner}/${repo}/issues/${number}`),
  'issue',
);

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface IssuePatch {
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  state_reason?: 'completed' | 'not_planned' | 'reopened' | 'duplicate' | null;
  labels?: string[];
  assignees?: string[];
  milestone?: number | null;
}

/** PATCH an issue or pull request (the issues endpoint accepts PR numbers too). */
export const updateIssue = action(async (owner: string, repo: string, number: number, patch: IssuePatch) => {
  await gh(`/repos/${owner}/${repo}/issues/${number}`, { method: 'PATCH', body: patch });
}, 'update-issue');

export const createIssue = action(
  async (
    owner: string,
    repo: string,
    issue: { title: string; body: string; labels?: string[]; assignees?: string[]; milestone?: number | null },
  ) => gh<Issue>(`/repos/${owner}/${repo}/issues`, { method: 'POST', body: issue }),
  'create-issue',
);

/** Comment, optionally changing the state in the same go ("Close with comment"). */
export const addComment = action(
  async (owner: string, repo: string, number: number, body: string, state?: IssuePatch) => {
    if (body.trim()) await gh(`/repos/${owner}/${repo}/issues/${number}/comments`, { method: 'POST', body: { body } });
    if (state) await gh(`/repos/${owner}/${repo}/issues/${number}`, { method: 'PATCH', body: state });
  },
  'add-comment',
);

export type CommentKind = 'body' | 'issue_comment' | 'review' | 'review_comment';

export interface CommentRef {
  kind: CommentKind;
  owner: string;
  repo: string;
  /** Issue / PR number. */
  number: number;
  databaseId?: number;
}

export const editComment = action(async (ref: CommentRef, body: string) => {
  const base = `/repos/${ref.owner}/${ref.repo}`;
  switch (ref.kind) {
    case 'body':
      return void (await gh(`${base}/issues/${ref.number}`, { method: 'PATCH', body: { body } }));
    case 'issue_comment':
      return void (await gh(`${base}/issues/comments/${ref.databaseId}`, { method: 'PATCH', body: { body } }));
    case 'review':
      return void (await gh(`${base}/pulls/${ref.number}/reviews/${ref.databaseId}`, { method: 'PUT', body: { body } }));
    case 'review_comment':
      return void (await gh(`${base}/pulls/comments/${ref.databaseId}`, { method: 'PATCH', body: { body } }));
  }
}, 'edit-comment');

export const deleteComment = action(async (ref: CommentRef) => {
  const base = `/repos/${ref.owner}/${ref.repo}`;
  if (ref.kind === 'issue_comment') await gh(`${base}/issues/comments/${ref.databaseId}`, { method: 'DELETE' });
  else if (ref.kind === 'review_comment') await gh(`${base}/pulls/comments/${ref.databaseId}`, { method: 'DELETE' });
}, 'delete-comment');

/** Add / remove the viewer's reaction on any reactable node. */
export const toggleReaction = action(async (subjectId: string, content: ReactionContent, add: boolean) => {
  await gql(
    `mutation($id:ID!,$content:ReactionContent!){${add ? 'addReaction' : 'removeReaction'}(input:{subjectId:$id,content:$content}){clientMutationId}}`,
    { id: subjectId, content },
  );
}, 'toggle-reaction');

export const setLocked = action(
  async (owner: string, repo: string, number: number, lock: boolean, reason?: string) => {
    if (lock)
      await gh(`/repos/${owner}/${repo}/issues/${number}/lock`, {
        method: 'PUT',
        body: reason ? { lock_reason: reason } : {},
      });
    else await gh(`/repos/${owner}/${repo}/issues/${number}/lock`, { method: 'DELETE' });
  },
  'set-locked',
);

export const setSubscription = action(async (subjectId: string, subscribe: boolean) => {
  await gql(`mutation($id:ID!,$state:SubscriptionState!){updateSubscription(input:{subscribableId:$id,state:$state}){clientMutationId}}`, {
    id: subjectId,
    state: subscribe ? 'SUBSCRIBED' : 'UNSUBSCRIBED',
  });
}, 'set-subscription');

export const setPinned = action(async (issueId: string, pin: boolean) => {
  await gql(`mutation($id:ID!){${pin ? 'pinIssue' : 'unpinIssue'}(input:{issueId:$id}){clientMutationId}}`, { id: issueId });
}, 'set-pinned');

export const deleteIssue = action(async (issueId: string) => {
  await gql(`mutation($id:ID!){deleteIssue(input:{issueId:$id}){clientMutationId}}`, { id: issueId });
}, 'delete-issue');

/** Move an issue to another repository; resolves to the new issue's URL path. */
export const transferIssue = action(async (issueId: string, target: string) => {
  const [owner, name] = target.split('/');
  if (!owner || !name) throw new Error('Choose a repository as owner/name');
  const repo = await gql<any>(`query($owner:String!,$name:String!){repository(owner:$owner,name:$name){id}}`, { owner, name });
  const data = await gql<any>(
    `mutation($id:ID!,$repo:ID!){transferIssue(input:{issueId:$id,repositoryId:$repo}){issue{number repository{nameWithOwner}}}}`,
    { id: issueId, repo: repo.repository.id },
  );
  const issue = data.transferIssue.issue;
  return `/${issue.repository.nameWithOwner}/issues/${issue.number}`;
}, 'transfer-issue');

// Labels -------------------------------------------------------------------

export const createLabel = action(
  async (owner: string, repo: string, label: { name: string; color: string; description: string }) =>
    gh<Label>(`/repos/${owner}/${repo}/labels`, { method: 'POST', body: label }),
  'create-label',
);

export const updateLabel = action(
  async (owner: string, repo: string, name: string, label: { new_name: string; color: string; description: string }) =>
    gh<Label>(`/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`, { method: 'PATCH', body: label }),
  'update-label',
);

export const deleteLabel = action(async (owner: string, repo: string, name: string) => {
  await gh(`/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`, { method: 'DELETE' });
}, 'delete-label');

// Milestones ----------------------------------------------------------------

export interface MilestoneInput {
  title?: string;
  description?: string;
  due_on?: string | null;
  state?: 'open' | 'closed';
}

export const createMilestone = action(
  async (owner: string, repo: string, m: MilestoneInput) =>
    gh<Milestone>(`/repos/${owner}/${repo}/milestones`, { method: 'POST', body: m }),
  'create-milestone',
);

export const updateMilestone = action(
  async (owner: string, repo: string, number: number, m: MilestoneInput) =>
    gh<Milestone>(`/repos/${owner}/${repo}/milestones/${number}`, { method: 'PATCH', body: m }),
  'update-milestone',
);

export const deleteMilestone = action(async (owner: string, repo: string, number: number) => {
  await gh(`/repos/${owner}/${repo}/milestones/${number}`, { method: 'DELETE' });
}, 'delete-milestone');


/** Label / open-milestone counts for the list page buttons. */
export const getListCounts = query(async (owner: string, repo: string) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){labels{totalCount} milestones(states:OPEN){totalCount}}}`,
    { owner, name: repo },
  );
  return { labels: data.repository.labels.totalCount as number, milestones: data.repository.milestones.totalCount as number };
}, 'issue-list-counts');
