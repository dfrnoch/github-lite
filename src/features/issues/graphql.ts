/**
 * GraphQL documents for issue / pull request pages. Kept as plain strings
 * (no types) so they can be pasted into `gh api graphql` for debugging.
 */

export const ACTOR = `__typename login avatarUrl`;

const REACTIONS = `reactionGroups{content viewerHasReacted reactors{totalCount}}`;

export const COMMENT = `id author{${ACTOR}} authorAssociation body bodyHTML createdAt lastEditedAt includesCreatedEdit viewerDidAuthor ${REACTIONS}`;

const ASSIGNEE = `... on User{login avatarUrl} ... on Bot{login avatarUrl} ... on Mannequin{login avatarUrl} ... on Organization{login avatarUrl}`;
const REVIEWER = `... on User{__typename login avatarUrl} ... on Bot{__typename login avatarUrl} ... on Mannequin{__typename login avatarUrl} ... on Team{__typename name slug combinedSlug avatarUrl}`;
const REF_SUBJECT = `__typename ... on Issue{number title url state stateReason repository{nameWithOwner}} ... on PullRequest{number title url state isDraft merged repository{nameWithOwner}}`;
const EV = `actor{${ACTOR}} createdAt`;

/** Timeline item fields shared by issues and pull requests. */
export const ISSUE_TIMELINE_ITEM = `__typename
  ... on Node{id}
  ... on IssueComment{${COMMENT} databaseId url viewerCanUpdate viewerCanDelete isMinimized minimizedReason}
  ... on LabeledEvent{${EV} label{name color description}}
  ... on UnlabeledEvent{${EV} label{name color description}}
  ... on AssignedEvent{${EV} assignee{${ASSIGNEE}}}
  ... on UnassignedEvent{${EV} assignee{${ASSIGNEE}}}
  ... on ClosedEvent{${EV} stateReason closer{__typename ... on Commit{oid abbreviatedOid url} ... on PullRequest{number title url}}}
  ... on ReopenedEvent{${EV}}
  ... on RenamedTitleEvent{${EV} previousTitle currentTitle}
  ... on CrossReferencedEvent{${EV} willCloseTarget isCrossRepository source{${REF_SUBJECT}}}
  ... on ReferencedEvent{${EV} isCrossRepository commit{oid abbreviatedOid messageHeadline url} commitRepository{nameWithOwner}}
  ... on MilestonedEvent{${EV} milestoneTitle}
  ... on DemilestonedEvent{${EV} milestoneTitle}
  ... on LockedEvent{${EV} lockReason}
  ... on UnlockedEvent{${EV}}
  ... on PinnedEvent{${EV}}
  ... on UnpinnedEvent{${EV}}
  ... on ConnectedEvent{${EV} source{${REF_SUBJECT}} subject{${REF_SUBJECT}}}
  ... on DisconnectedEvent{${EV} source{${REF_SUBJECT}} subject{${REF_SUBJECT}}}
  ... on TransferredEvent{${EV} fromRepository{nameWithOwner}}
  ... on MarkedAsDuplicateEvent{${EV} canonical{${REF_SUBJECT}}}
  ... on UnmarkedAsDuplicateEvent{${EV} canonical{${REF_SUBJECT}}}
  ... on CommentDeletedEvent{${EV} deletedCommentAuthor{login}}
  ... on ConvertedToDiscussionEvent{${EV} discussion{number url}}
  ... on IssueTypeAddedEvent{${EV} issueType{name color}}
  ... on IssueTypeRemovedEvent{${EV} issueType{name color}}
  ... on IssueTypeChangedEvent{${EV} issueType{name color} prevIssueType{name color}}
  ... on SubIssueAddedEvent{${EV} subIssue{number title url}}
  ... on SubIssueRemovedEvent{${EV} subIssue{number title url}}
  ... on ParentIssueAddedEvent{${EV} parent{number title url}}
  ... on ParentIssueRemovedEvent{${EV} parent{number title url}}`;

/** Extra timeline item fields for pull requests. */
export const PULL_TIMELINE_ITEM = `${ISSUE_TIMELINE_ITEM}
  ... on PullRequestCommit{commit{oid abbreviatedOid messageHeadline committedDate url statusCheckRollup{state} authors(first:2){nodes{name avatarUrl user{login}}}}}
  ... on PullRequestReview{${COMMENT} databaseId url state submittedAt viewerCanUpdate viewerCanDelete isMinimized minimizedReason}
  ... on HeadRefForcePushedEvent{${EV} beforeCommit{oid abbreviatedOid} afterCommit{oid abbreviatedOid} ref{name}}
  ... on BaseRefForcePushedEvent{${EV} beforeCommit{oid abbreviatedOid} afterCommit{oid abbreviatedOid} ref{name}}
  ... on HeadRefDeletedEvent{${EV} headRefName}
  ... on HeadRefRestoredEvent{${EV}}
  ... on BaseRefChangedEvent{${EV} previousRefName currentRefName}
  ... on BaseRefDeletedEvent{${EV} baseRefName}
  ... on MergedEvent{${EV} commit{oid abbreviatedOid} mergeRefName}
  ... on ReadyForReviewEvent{${EV}}
  ... on ConvertToDraftEvent{${EV}}
  ... on ReviewRequestedEvent{${EV} requestedReviewer{${REVIEWER}}}
  ... on ReviewRequestRemovedEvent{${EV} requestedReviewer{${REVIEWER}}}
  ... on ReviewDismissedEvent{${EV} dismissalMessage review{author{login}}}
  ... on AutoMergeEnabledEvent{${EV}}
  ... on AutoMergeDisabledEvent{${EV} reason}
  ... on AutoSquashEnabledEvent{${EV}}
  ... on AutoRebaseEnabledEvent{${EV}}
  ... on DeployedEvent{${EV} deployment{environment}}
  ... on AddedToMergeQueueEvent{${EV}}
  ... on RemovedFromMergeQueueEvent{${EV} reason}
  ... on AutomaticBaseChangeSucceededEvent{createdAt oldBase newBase}
  ... on AutomaticBaseChangeFailedEvent{createdAt oldBase newBase}`;

export const ISSUE_ITEM_TYPES = [
  'ISSUE_COMMENT',
  'CROSS_REFERENCED_EVENT',
  'ASSIGNED_EVENT',
  'UNASSIGNED_EVENT',
  'CLOSED_EVENT',
  'REOPENED_EVENT',
  'COMMENT_DELETED_EVENT',
  'CONNECTED_EVENT',
  'DISCONNECTED_EVENT',
  'CONVERTED_TO_DISCUSSION_EVENT',
  'LABELED_EVENT',
  'UNLABELED_EVENT',
  'LOCKED_EVENT',
  'UNLOCKED_EVENT',
  'MARKED_AS_DUPLICATE_EVENT',
  'UNMARKED_AS_DUPLICATE_EVENT',
  'MILESTONED_EVENT',
  'DEMILESTONED_EVENT',
  'PINNED_EVENT',
  'UNPINNED_EVENT',
  'REFERENCED_EVENT',
  'RENAMED_TITLE_EVENT',
  'TRANSFERRED_EVENT',
  'ISSUE_TYPE_ADDED_EVENT',
  'ISSUE_TYPE_REMOVED_EVENT',
  'ISSUE_TYPE_CHANGED_EVENT',
  'SUB_ISSUE_ADDED_EVENT',
  'SUB_ISSUE_REMOVED_EVENT',
  'PARENT_ISSUE_ADDED_EVENT',
  'PARENT_ISSUE_REMOVED_EVENT',
];

export const PULL_ITEM_TYPES = [
  ...ISSUE_ITEM_TYPES.filter((t) => !t.startsWith('SUB_ISSUE') && !t.startsWith('PARENT_ISSUE') && !t.startsWith('ISSUE_TYPE')),
  'PULL_REQUEST_COMMIT',
  'PULL_REQUEST_REVIEW',
  'HEAD_REF_FORCE_PUSHED_EVENT',
  'BASE_REF_FORCE_PUSHED_EVENT',
  'HEAD_REF_DELETED_EVENT',
  'HEAD_REF_RESTORED_EVENT',
  'BASE_REF_CHANGED_EVENT',
  'BASE_REF_DELETED_EVENT',
  'MERGED_EVENT',
  'READY_FOR_REVIEW_EVENT',
  'CONVERT_TO_DRAFT_EVENT',
  'REVIEW_REQUESTED_EVENT',
  'REVIEW_REQUEST_REMOVED_EVENT',
  'REVIEW_DISMISSED_EVENT',
  'AUTO_MERGE_ENABLED_EVENT',
  'AUTO_MERGE_DISABLED_EVENT',
  'AUTO_SQUASH_ENABLED_EVENT',
  'AUTO_REBASE_ENABLED_EVENT',
  'DEPLOYED_EVENT',
  'ADDED_TO_MERGE_QUEUE_EVENT',
  'REMOVED_FROM_MERGE_QUEUE_EVENT',
  'AUTOMATIC_BASE_CHANGE_SUCCEEDED_EVENT',
  'AUTOMATIC_BASE_CHANGE_FAILED_EVENT',
];

/** Fields the issue page and the PR conversation share (header + sidebar). */
const SHARED = `id number title titleHTML state locked activeLockReason createdAt url
  ${COMMENT} viewerCanUpdate viewerCanReact viewerSubscription viewerCanSubscribe viewerCanLabel
  assignees(first:20){nodes{login avatarUrl name}}
  labels(first:50){nodes{id name color description}}
  milestone{number title dueOn progressPercentage state}
  participants(first:30){totalCount nodes{login avatarUrl}}
  comments{totalCount}`;

const timeline = (types: string[], fields: string) => `
  head:timelineItems(first:$first,itemTypes:[${types.join(',')}]){totalCount pageInfo{hasNextPage endCursor} nodes{${fields}}}
  tail:timelineItems(last:$last,itemTypes:[${types.join(',')}]){pageInfo{hasPreviousPage startCursor} nodes{${fields}}}`;

const REPO_FIELDS = `id nameWithOwner viewerPermission`;

/** Issue page (also tells us when the number is really a PR). */
export const ISSUE_PAGE = `query($owner:String!,$name:String!,$number:Int!,$first:Int!,$last:Int!){repository(owner:$owner,name:$name){
  ${REPO_FIELDS}
  issueOrPullRequest(number:$number){
    __typename
    ... on PullRequest{number}
    ... on Issue{
      ${SHARED}
      stateReason isPinned viewerCanDelete
      issueType{name color description}
      parent{number title url repository{nameWithOwner}}
      subIssuesSummary{total completed percentCompleted}
      closedByPullRequestsReferences(first:10,includeClosedPrs:true){nodes{number title url state isDraft merged repository{nameWithOwner}}}
      linkedBranches(first:10){nodes{ref{name}}}
      ${timeline(ISSUE_ITEM_TYPES, ISSUE_TIMELINE_ITEM)}
    }
  }
}}`;

const CHECK_CONTEXTS = `contexts(first:100){totalCount nodes{__typename
  ... on CheckRun{id name status conclusion detailsUrl startedAt completedAt isRequired(pullRequestNumber:$number) title checkSuite{app{name logoUrl slug} workflowRun{event workflow{name}}}}
  ... on StatusContext{id context state targetUrl description avatarUrl isRequired(pullRequestNumber:$number)}
}}`;

/** PR conversation tab: everything except the diff. */
export const PULL_PAGE = `query($owner:String!,$name:String!,$number:Int!,$first:Int!,$last:Int!){repository(owner:$owner,name:$name){
  ${REPO_FIELDS}
  mergeCommitAllowed squashMergeAllowed rebaseMergeAllowed autoMergeAllowed deleteBranchOnMerge viewerDefaultMergeMethod
  mergeCommitTitle mergeCommitMessage squashMergeCommitTitle squashMergeCommitMessage
  issueOrPullRequest(number:$number){
    __typename
    ... on Issue{number}
    ... on PullRequest{
      ${SHARED}
      isDraft merged mergedAt mergedBy{${ACTOR}} closed
      mergeable mergeStateStatus reviewDecision
      baseRefName headRefName headRefOid baseRefOid isCrossRepository maintainerCanModify
      headRepository{nameWithOwner} headRepositoryOwner{login}
      headRef{id name} baseRef{id name}
      viewerCanDeleteHeadRef viewerCanUpdateBranch viewerCanMergeAsAdmin viewerCanEnableAutoMerge viewerCanDisableAutoMerge
      canBeRebased
      autoMergeRequest{enabledAt mergeMethod enabledBy{login}}
      mergeQueueEntry{position state}
      additions deletions changedFiles
      reviewRequests(first:20){nodes{requestedReviewer{${REVIEWER}}}}
      latestOpinionatedReviews(first:30){nodes{state author{${ACTOR}}}}
      latestReviews(first:30){nodes{state author{${ACTOR}}}}
      suggestedReviewers{reviewer{login avatarUrl}}
      closingIssuesReferences(first:10){nodes{number title url state stateReason repository{nameWithOwner}}}
      commits(last:1){totalCount nodes{commit{oid committedDate statusCheckRollup{state ${CHECK_CONTEXTS}}}}}
      reviewThreads(first:100){nodes{id isResolved isOutdated isCollapsed path line originalLine startLine diffSide subjectType viewerCanResolve viewerCanUnresolve viewerCanReply
        comments(first:50){nodes{${COMMENT} databaseId url path diffHunk outdated line originalLine viewerCanUpdate viewerCanDelete isMinimized minimizedReason replyTo{id} pullRequestReview{id}}}}}
      ${timeline(PULL_ITEM_TYPES, PULL_TIMELINE_ITEM)}
    }
  }
}}`;

/** A further page of timeline items (the "Load more" between head and tail). */
export const TIMELINE_PAGE = (isPull: boolean) => `query($owner:String!,$name:String!,$number:Int!,$after:String!){repository(owner:$owner,name:$name){
  issueOrPullRequest(number:$number){
    ... on ${isPull ? 'PullRequest' : 'Issue'}{
      timelineItems(first:100,after:$after,itemTypes:[${(isPull ? PULL_ITEM_TYPES : ISSUE_ITEM_TYPES).join(',')}]){pageInfo{hasNextPage endCursor} nodes{${isPull ? PULL_TIMELINE_ITEM : ISSUE_TIMELINE_ITEM}}}
    }
  }
}}`;

/** Projects an issue/PR belongs to (needs the read:project scope — fetched separately so it can fail alone). */
export const PROJECT_ITEMS = `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){
  issueOrPullRequest(number:$number){
    ... on Issue{projectItems(first:10){nodes{id project{title url number} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}
    ... on PullRequest{projectItems(first:10){nodes{id project{title url number} fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}
  }
}}`;
