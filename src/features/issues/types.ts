/** Shapes of the GraphQL payloads in ./graphql.ts (only the fields we read). */

export interface GqlActor {
  __typename?: string;
  login: string;
  avatarUrl: string;
}

export interface GqlLabel {
  id?: string;
  name: string;
  color: string;
  description?: string | null;
}

export type ReactionContent = 'THUMBS_UP' | 'THUMBS_DOWN' | 'LAUGH' | 'HOORAY' | 'CONFUSED' | 'HEART' | 'ROCKET' | 'EYES';

export interface ReactionGroup {
  content: ReactionContent;
  viewerHasReacted: boolean;
  reactors: { totalCount: number };
}

/** Anything rendered as a comment box (issue body, comment, review, review comment). */
export interface GqlComment {
  id: string;
  databaseId?: number;
  url?: string;
  author: GqlActor | null;
  authorAssociation: string;
  body: string;
  bodyHTML: string;
  createdAt: string;
  lastEditedAt: string | null;
  includesCreatedEdit: boolean;
  viewerDidAuthor: boolean;
  viewerCanUpdate?: boolean;
  viewerCanDelete?: boolean;
  isMinimized?: boolean;
  minimizedReason?: string | null;
  reactionGroups: ReactionGroup[] | null;
}

export interface RefSubject {
  __typename: 'Issue' | 'PullRequest';
  number: number;
  title: string;
  url: string;
  state: string;
  stateReason?: string | null;
  isDraft?: boolean;
  merged?: boolean;
  repository: { nameWithOwner: string };
}

/** A timeline node; which fields are set depends on __typename. */
export interface TimelineNode extends Partial<Omit<GqlComment, 'id'>> {
  __typename: string;
  id?: string;
  actor?: GqlActor | null;
  createdAt?: string;
  label?: GqlLabel;
  assignee?: { login: string; avatarUrl: string } | null;
  stateReason?: string | null;
  closer?: { __typename: string; oid?: string; abbreviatedOid?: string; url?: string; number?: number; title?: string } | null;
  previousTitle?: string;
  currentTitle?: string;
  willCloseTarget?: boolean;
  isCrossRepository?: boolean;
  source?: RefSubject | null;
  subject?: RefSubject | null;
  canonical?: RefSubject | null;
  commit?: {
    oid: string;
    abbreviatedOid: string;
    messageHeadline?: string;
    committedDate?: string;
    url?: string;
    statusCheckRollup?: { state: string } | null;
    authors?: { nodes: { name: string | null; avatarUrl: string; user: { login: string } | null }[] };
  } | null;
  commitRepository?: { nameWithOwner: string };
  milestoneTitle?: string;
  lockReason?: string | null;
  fromRepository?: { nameWithOwner: string } | null;
  deletedCommentAuthor?: { login: string } | null;
  discussion?: { number: number; url: string } | null;
  issueType?: { name: string; color: string } | null;
  prevIssueType?: { name: string; color: string } | null;
  subIssue?: { number: number; title: string; url: string } | null;
  parent?: { number: number; title: string; url: string } | null;
  // pull requests
  state?: string;
  submittedAt?: string | null;
  beforeCommit?: { oid: string; abbreviatedOid: string } | null;
  afterCommit?: { oid: string; abbreviatedOid: string } | null;
  ref?: { name: string } | null;
  headRefName?: string;
  baseRefName?: string;
  previousRefName?: string;
  currentRefName?: string;
  mergeRefName?: string;
  requestedReviewer?: Reviewer | null;
  dismissalMessage?: string | null;
  review?: { author: { login: string } | null } | null;
  reason?: string | null;
  deployment?: { environment: string | null } | null;
  oldBase?: string;
  newBase?: string;
}

export type Reviewer =
  | { __typename: 'User' | 'Bot' | 'Mannequin'; login: string; avatarUrl: string }
  | { __typename: 'Team'; name: string; slug: string; combinedSlug: string; avatarUrl: string | null };

export interface TimelineConnection {
  totalCount?: number;
  pageInfo: { hasNextPage?: boolean; endCursor?: string | null; hasPreviousPage?: boolean; startCursor?: string | null };
  nodes: TimelineNode[];
}

export interface IssueBase extends GqlComment {
  number: number;
  title: string;
  titleHTML: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  locked: boolean;
  activeLockReason: string | null;
  viewerCanReact: boolean;
  viewerSubscription: 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'IGNORED' | null;
  viewerCanSubscribe: boolean;
  viewerCanLabel: boolean;
  assignees: { nodes: { login: string; avatarUrl: string; name: string | null }[] };
  labels: { nodes: GqlLabel[] };
  milestone: { number: number; title: string; dueOn: string | null; progressPercentage: number; state: string } | null;
  participants: { totalCount: number; nodes: GqlActor[] };
  comments: { totalCount: number };
  head: TimelineConnection;
  tail: TimelineConnection;
}

export interface LinkedPull {
  number: number;
  title: string;
  url: string;
  state: string;
  isDraft?: boolean;
  merged?: boolean;
  stateReason?: string | null;
  repository: { nameWithOwner: string };
}

export interface IssueDetail extends IssueBase {
  __typename: 'Issue';
  stateReason: string | null;
  isPinned: boolean;
  viewerCanDelete: boolean;
  issueType: { name: string; color: string; description: string | null } | null;
  parent: { number: number; title: string; url: string; repository: { nameWithOwner: string } } | null;
  subIssuesSummary: { total: number; completed: number; percentCompleted: number } | null;
  closedByPullRequestsReferences: { nodes: LinkedPull[] };
  linkedBranches: { nodes: { ref: { name: string } | null }[] };
}

export interface CheckContext {
  __typename: 'CheckRun' | 'StatusContext';
  id: string;
  // CheckRun
  name?: string;
  status?: string;
  conclusion?: string | null;
  detailsUrl?: string | null;
  title?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  checkSuite?: { app: { name: string; logoUrl: string; slug: string } | null; workflowRun: { event: string; workflow: { name: string } } | null };
  // StatusContext
  context?: string;
  state?: string;
  targetUrl?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  isRequired?: boolean;
}

export interface ReviewThreadComment extends GqlComment {
  path: string;
  diffHunk: string;
  outdated: boolean;
  line: number | null;
  originalLine: number | null;
  replyTo: { id: string } | null;
  pullRequestReview: { id: string } | null;
}

export interface ReviewThread {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  isCollapsed: boolean;
  path: string;
  line: number | null;
  originalLine: number | null;
  startLine: number | null;
  diffSide: 'LEFT' | 'RIGHT';
  subjectType: 'LINE' | 'FILE';
  viewerCanResolve: boolean;
  viewerCanUnresolve: boolean;
  viewerCanReply: boolean;
  comments: { nodes: ReviewThreadComment[] };
}

export type MergeMethod = 'MERGE' | 'SQUASH' | 'REBASE';

export interface PullDetail extends IssueBase {
  __typename: 'PullRequest';
  isDraft: boolean;
  merged: boolean;
  mergedAt: string | null;
  mergedBy: GqlActor | null;
  closed: boolean;
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  mergeStateStatus: 'BEHIND' | 'BLOCKED' | 'CLEAN' | 'DIRTY' | 'DRAFT' | 'HAS_HOOKS' | 'UNKNOWN' | 'UNSTABLE';
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  baseRefName: string;
  headRefName: string;
  headRefOid: string;
  baseRefOid: string;
  isCrossRepository: boolean;
  maintainerCanModify: boolean;
  headRepository: { nameWithOwner: string } | null;
  headRepositoryOwner: { login: string } | null;
  headRef: { id: string; name: string } | null;
  baseRef: { id: string; name: string } | null;
  viewerCanDeleteHeadRef: boolean;
  viewerCanUpdateBranch: boolean;
  viewerCanMergeAsAdmin: boolean;
  viewerCanEnableAutoMerge: boolean;
  viewerCanDisableAutoMerge: boolean;
  canBeRebased: boolean;
  autoMergeRequest: { enabledAt: string; mergeMethod: MergeMethod; enabledBy: { login: string } | null } | null;
  mergeQueueEntry: { position: number; state: string } | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  reviewRequests: { nodes: { requestedReviewer: Reviewer | null }[] };
  latestOpinionatedReviews: { nodes: { state: string; author: GqlActor | null }[] };
  latestReviews: { nodes: { state: string; author: GqlActor | null }[] };
  suggestedReviewers: { reviewer: { login: string; avatarUrl: string } }[];
  closingIssuesReferences: { nodes: LinkedPull[] };
  commits: {
    totalCount: number;
    nodes: {
      commit: {
        oid: string;
        committedDate: string;
        statusCheckRollup: { state: string; contexts: { totalCount: number; nodes: CheckContext[] } } | null;
      };
    }[];
  };
  reviewThreads: { nodes: ReviewThread[] };
}

export type ViewerPermission = 'ADMIN' | 'MAINTAIN' | 'WRITE' | 'TRIAGE' | 'READ' | null;

export interface RepoMeta {
  id: string;
  nameWithOwner: string;
  viewerPermission: ViewerPermission;
}

export interface PullRepoMeta extends RepoMeta {
  mergeCommitAllowed: boolean;
  squashMergeAllowed: boolean;
  rebaseMergeAllowed: boolean;
  autoMergeAllowed: boolean;
  deleteBranchOnMerge: boolean;
  viewerDefaultMergeMethod: MergeMethod;
  mergeCommitTitle: 'PR_TITLE' | 'MERGE_MESSAGE';
  mergeCommitMessage: 'PR_BODY' | 'PR_TITLE' | 'BLANK';
  squashMergeCommitTitle: 'PR_TITLE' | 'COMMIT_OR_PR_TITLE';
  squashMergeCommitMessage: 'PR_BODY' | 'COMMIT_MESSAGES' | 'BLANK';
}

/** A row of the issue / PR list (GraphQL search). */
export interface ListItem {
  __typename: 'Issue' | 'PullRequest';
  id: string;
  number: number;
  title: string;
  titleHTML: string;
  url: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  stateReason?: string | null;
  isDraft?: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  author: GqlActor | null;
  authorAssociation: string;
  repository: { nameWithOwner: string };
  labels: { nodes: GqlLabel[] };
  assignees: { nodes: GqlActor[] };
  milestone: { number: number; title: string } | null;
  comments: { totalCount: number };
  issueType?: { name: string; color: string } | null;
  closedByPullRequestsReferences?: { totalCount: number };
  subIssuesSummary?: { total: number; completed: number } | null;
  reviewDecision?: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  commits?: {
    nodes: { commit: { statusCheckRollup: { state: string; contexts: { totalCount: number; checkRunCountsByState: { state: string; count: number }[] | null; statusContextCountsByState: { state: string; count: number }[] | null } } | null } }[];
  };
  closingIssuesReferences?: { totalCount: number };
}

export const canTriage = (p: ViewerPermission) => p === 'ADMIN' || p === 'MAINTAIN' || p === 'WRITE' || p === 'TRIAGE';
export const canPush = (p: ViewerPermission) => p === 'ADMIN' || p === 'MAINTAIN' || p === 'WRITE';
