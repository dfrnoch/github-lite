import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, For, Match, Show, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, IssueLabel, itemState, RelativeTime, StateIcon, toastError } from '../../../components/ui';
import type { OcticonData } from '../../../icons/octicons';
import {
  checkIcon,
  crossReferenceIcon,
  eyeIcon,
  fileDiffIcon,
  gitBranchIcon,
  gitCommitIcon,
  gitMergeIcon,
  gitPullRequestClosedIcon,
  gitPullRequestDraftIcon,
  gitPullRequestIcon,
  issueClosedIcon,
  issueReopenedIcon,
  issueTrackedByIcon,
  issueTracksIcon,
  lockIcon,
  milestoneIcon,
  pencilIcon,
  personIcon,
  pinIcon,
  repoPushIcon,
  rocketIcon,
  skipIcon,
  tagIcon,
  trashIcon,
  unlockIcon,
  xIcon,
  arrowRightIcon,
  duplicateIcon,
  commentDiscussionIcon,
  typographyIcon,
} from '../../../icons/octicons';
import CommitStatusIcon from '../../repo/components/CommitStatusIcon';
import ReviewThread from '../../pulls/components/ReviewThread';
import { getTimelinePage } from '../api';
import type { GqlLabel, RefSubject, Reviewer, ReviewThread as Thread, TimelineConnection, TimelineNode } from '../types';
import Comment, { userHref } from './Comment';

export interface TimelineProps {
  owner: string;
  repo: string;
  number: number;
  isPull: boolean;
  issueAuthor: string;
  head: TimelineConnection;
  tail: TimelineConnection;
  canReact: boolean;
  onQuote?: (text: string) => void;
  /** PR review threads, shown under the review that started them. */
  threads?: Thread[];
  viewerAvatar?: string;
}

type Entry =
  | { type: 'node'; node: TimelineNode }
  | { type: 'labels'; key: string; actor: TimelineNode['actor']; createdAt: string; added: GqlLabel[]; removed: GqlLabel[] }
  | { type: 'reviewers'; key: string; actor: TimelineNode['actor']; createdAt: string; reviewers: Reviewer[]; removed: boolean }
  | { type: 'commits'; key: string; nodes: TimelineNode[] }
  | { type: 'hidden'; key: string; count: number };

/** Merge consecutive label / review-request / commit events the way GitHub groups them. */
function group(nodes: TimelineNode[]): Entry[] {
  const out: Entry[] = [];
  for (const n of nodes) {
    const last = out[out.length - 1];
    const sameActor = (a: TimelineNode['actor']) => (a?.login ?? null) === (n.actor?.login ?? null);
    if (n.__typename === 'LabeledEvent' || n.__typename === 'UnlabeledEvent') {
      const added = n.__typename === 'LabeledEvent';
      if (last?.type === 'labels' && sameActor(last.actor) && Math.abs(Date.parse(n.createdAt!) - Date.parse(last.createdAt)) < 60_000) {
        const list = added ? last.added : last.removed;
        if (!list.some((l) => l.name === n.label!.name)) list.push(n.label!);
        continue;
      }
      out.push({
        type: 'labels',
        key: n.id ?? `${n.createdAt}-l`,
        actor: n.actor,
        createdAt: n.createdAt!,
        added: added ? [n.label!] : [],
        removed: added ? [] : [n.label!],
      });
    } else if ((n.__typename === 'ReviewRequestedEvent' || n.__typename === 'ReviewRequestRemovedEvent') && n.requestedReviewer) {
      const removed = n.__typename === 'ReviewRequestRemovedEvent';
      if (last?.type === 'reviewers' && last.removed === removed && sameActor(last.actor) && Math.abs(Date.parse(n.createdAt!) - Date.parse(last.createdAt)) < 60_000) {
        last.reviewers.push(n.requestedReviewer);
        continue;
      }
      out.push({ type: 'reviewers', key: n.id ?? `${n.createdAt}-r`, actor: n.actor, createdAt: n.createdAt!, reviewers: [n.requestedReviewer], removed });
    } else if (n.__typename === 'PullRequestCommit') {
      if (last?.type === 'commits') last.nodes.push(n);
      else out.push({ type: 'commits', key: n.id ?? 'c', nodes: [n] });
    } else if (n.__typename === 'ClosedEvent' && last?.type === 'node' && last.node.__typename === 'MergedEvent') {
      // Merging closes the PR too; GitHub only shows the merge.
      continue;
    } else out.push({ type: 'node', node: n });
  }
  return out;
}

/** Issue / PR timeline below the opening comment. */
export default function Timeline(props: TimelineProps) {
  // Items loaded through "Load more" (between head and tail).
  const [extra, setExtra] = createSignal<TimelineNode[]>([]);
  const [cursor, setCursor] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  const entries = createMemo(() => {
    const head = props.head.nodes;
    if (!props.head.pageInfo.hasNextPage) return group(head);
    const seen = new Set(head.map((n) => n.id));
    const middle = extra().filter((n) => !seen.has(n.id));
    for (const n of middle) seen.add(n.id);
    const tail = props.tail.nodes.filter((n) => !seen.has(n.id));
    const tailIds = new Set(props.tail.nodes.map((n) => n.id));
    // The middle reached the tail: nothing hidden any more.
    const joined = middle.some((n) => tailIds.has(n.id)) || extra().length > 0 && middle.length < extra().length;
    const hidden = Math.max(0, (props.head.totalCount ?? 0) - head.length - middle.length - tail.length);
    const before = group([...head, ...middle]);
    const after = group(tail);
    return joined || hidden === 0 ? [...before, ...after] : [...before, { type: 'hidden' as const, key: 'hidden', count: hidden }, ...after];
  });

  const loadMore = async () => {
    const after = cursor() ?? props.head.pageInfo.endCursor;
    if (!after) return;
    setLoading(true);
    try {
      const page = await getTimelinePage(props.owner, props.repo, props.number, props.isPull, after);
      setExtra((list) => [...list, ...page.nodes]);
      setCursor(page.pageInfo.endCursor ?? null);
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  };

  // Review threads by the review that started them.
  const threadsByReview = createMemo(() => {
    const map = new Map<string, Thread[]>();
    for (const t of props.threads ?? []) {
      const id = t.comments.nodes[0]?.pullRequestReview?.id;
      if (!id) continue;
      map.set(id, [...(map.get(id) ?? []), t]);
    }
    return map;
  });

  return (
    <For each={entries()} keyed={(e) => (e.type === 'node' ? (e.node.id ?? e.node.createdAt) : e.key)}>
      {(entry) => (
        <Switch>
          <Match when={entry().type === 'hidden' && (entry() as Extract<Entry, { type: 'hidden' }>)}>
            {(h) => (
              <div class="relative py-4 my-2 text-center bg-canvas">
                <div class="border-y-4 border-dotted border-line py-3">
                  <span class="text-sm text-fg-muted mr-2">{h().count} remaining items</span>
                  <button type="button" class="btn btn-sm" disabled={loading()} onClick={loadMore}>
                    {loading() ? 'Loading…' : 'Load more…'}
                  </button>
                </div>
              </div>
            )}
          </Match>
          <Match when={entry().type === 'labels' && (entry() as Extract<Entry, { type: 'labels' }>)}>
            {(e) => (
              <Event icon={tagIcon} actor={e().actor} createdAt={e().createdAt}>
                <Show when={e().added.length}>
                  added{' '}
                  <For each={e().added}>{(l) => <IssueLabel name={l.name} color={l.color} class="mx-0.5" />}</For>
                </Show>
                <Show when={e().added.length && e().removed.length}> and </Show>
                <Show when={e().removed.length}>
                  removed{' '}
                  <For each={e().removed}>{(l) => <IssueLabel name={l.name} color={l.color} class="mx-0.5" />}</For>
                </Show>{' '}
                {e().added.length + e().removed.length === 1 ? 'label' : 'labels'}
              </Event>
            )}
          </Match>
          <Match when={entry().type === 'reviewers' && (entry() as Extract<Entry, { type: 'reviewers' }>)}>
            {(e) => (
              <Event icon={eyeIcon} actor={e().actor} createdAt={e().createdAt}>
                {e().removed ? 'removed the request for review from ' : 'requested a review from '}
                <For each={e().reviewers}>
                  {(r, i) => (
                    <>
                      {i() > 0 ? ', ' : ''}
                      <ReviewerName reviewer={r} />
                    </>
                  )}
                </For>
              </Event>
            )}
          </Match>
          <Match when={entry().type === 'commits' && (entry() as Extract<Entry, { type: 'commits' }>)}>
            {(e) => <CommitGroup nodes={e().nodes} owner={props.owner} repo={props.repo} />}
          </Match>
          <Match when={entry().type === 'node' && (entry() as Extract<Entry, { type: 'node' }>).node}>
            {(n) => <TimelineNodeView node={n()} props={props} threads={threadsByReview().get(n().id ?? '') ?? []} />}
          </Match>
        </Switch>
      )}
    </For>
  );
}

function ReviewerName(props: { reviewer: Reviewer }) {
  return (
    <Show
      when={props.reviewer.__typename === 'Team' ? (props.reviewer as Extract<Reviewer, { __typename: 'Team' }>) : null}
      fallback={
        <a class="link-plain font-semibold" href={userHref((props.reviewer as { login: string }).login)}>
          {(props.reviewer as { login: string }).login}
        </a>
      }
    >
      {(t) => <span class="font-semibold text-fg">{t().combinedSlug ?? t().name}</span>}
    </Show>
  );
}

/** One condensed event row: badge icon, actor, text, time. */
export function Event(props: {
  icon: OcticonData;
  actor?: TimelineNode['actor'];
  createdAt?: string;
  badgeClass?: string;
  children: JSX.Element;
  extra?: JSX.Element;
}) {
  return (
    <div class="TimelineItem ml-[72px]! py-3!">
      <div class={['TimelineItem-badge', props.badgeClass]}>
        <Octicon icon={props.icon} />
      </div>
      <div class="TimelineItem-body min-w-0 text-sm">
        <div class="flex flex-wrap items-center gap-x-1 gap-y-0.5">
          <Show when={props.actor}>
            {(a) => (
              <>
                <Avatar src={a().avatarUrl} login={a().login} size={20} class="mr-0.5" />
                <a class="link-plain font-semibold" href={userHref(a().login)}>
                  {a().login}
                </a>
              </>
            )}
          </Show>
          <span class="inline-flex flex-wrap items-center gap-x-1">{props.children}</span>
          <Show when={props.createdAt}>
            <a class="link-muted" href="#" onClick={(e) => e.preventDefault()}>
              <RelativeTime datetime={props.createdAt} />
            </a>
          </Show>
        </div>
        {props.extra}
      </div>
    </div>
  );
}

function SubjectLink(props: { subject: RefSubject | null | undefined; currentRepo: string }) {
  return (
    <Show when={props.subject}>
      {(s) => (
        <a class="link-plain font-semibold inline-flex items-center gap-1" href={`/${s().repository.nameWithOwner}/${s().__typename === 'PullRequest' ? 'pull' : 'issues'}/${s().number}`}>
          <StateIcon
            state={itemState({ isPull: s().__typename === 'PullRequest', state: s().state, stateReason: s().stateReason, merged: s().merged, draft: s().isDraft })}
          />
          <span>{s().title}</span>
          <span class="text-fg-muted font-normal">
            {s().repository.nameWithOwner === props.currentRepo ? '' : s().repository.nameWithOwner}#{s().number}
          </span>
        </a>
      )}
    </Show>
  );
}

function CommitGroup(props: { nodes: TimelineNode[]; owner: string; repo: string }) {
  const first = () => props.nodes[0]?.commit?.authors?.nodes[0];
  return (
    <div class="TimelineItem ml-[72px]! py-3! flex-col!">
      <div class="flex items-center">
        <div class="TimelineItem-badge">
          <Octicon icon={repoPushIcon} />
        </div>
        <div class="text-sm text-fg-muted flex items-center gap-1">
          <Show when={first()}>
            {(a) => (
              <>
                <Avatar src={a().avatarUrl} login={a().user?.login} size={20} />
                <a class="link-plain font-semibold" href={a().user ? userHref(a().user!.login) : undefined}>
                  {a().user?.login ?? a().name}
                </a>
              </>
            )}
          </Show>
          added {props.nodes.length} commit{props.nodes.length === 1 ? '' : 's'}{' '}
          <RelativeTime datetime={props.nodes[0]?.commit?.committedDate} />
        </div>
      </div>
      <div class="ml-[-8px] mt-1">
        <For each={props.nodes}>
          {(n) => (
            <div class="flex items-center gap-2 py-1 pl-0 text-sm">
              <span class="relative z-1 bg-canvas text-fg-muted flex">
                <Octicon icon={gitCommitIcon} />
              </span>
              <Avatar src={n.commit?.authors?.nodes[0]?.avatarUrl} size={16} />
              <a
                class="link-muted truncate min-w-0 flex-1"
                href={`/${props.owner}/${props.repo}/commit/${n.commit?.oid}`}
                title={n.commit?.messageHeadline}
              >
                {n.commit?.messageHeadline}
              </a>
              <CommitStatusIcon state={n.commit?.statusCheckRollup?.state} />
              <a class="link-muted font-mono text-xs" href={`/${props.owner}/${props.repo}/commit/${n.commit?.oid}`}>
                {n.commit?.abbreviatedOid}
              </a>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

const REVIEW_LOOK: Record<string, { icon: OcticonData; text: string; badge?: string }> = {
  APPROVED: { icon: checkIcon, text: 'approved these changes', badge: 'bg-success-emphasis! text-fg-on-emphasis!' },
  CHANGES_REQUESTED: { icon: fileDiffIcon, text: 'requested changes', badge: 'bg-danger-emphasis! text-fg-on-emphasis!' },
  COMMENTED: { icon: eyeIcon, text: 'reviewed' },
  DISMISSED: { icon: eyeIcon, text: 'reviewed' },
  PENDING: { icon: eyeIcon, text: 'started a review' },
};

function TimelineNodeView(p: { node: TimelineNode; props: TimelineProps; threads: Thread[] }) {
  const n = () => p.node;
  const repoName = () => `${p.props.owner}/${p.props.repo}`;
  const thing = () => (p.props.isPull ? 'pull request' : 'issue');
  return (
    <Switch>
      <Match when={n().__typename === 'IssueComment'}>
        <Comment
          comment={n() as any}
          anchor={`issuecomment-${n().databaseId}`}
          commentRef={{ kind: 'issue_comment', owner: p.props.owner, repo: p.props.repo, number: p.props.number, databaseId: n().databaseId }}
          repo={repoName()}
          issueAuthor={p.props.issueAuthor}
          canReact={p.props.canReact}
          onQuote={p.props.onQuote}
        />
      </Match>
      <Match when={n().__typename === 'PullRequestReview'}>
        <ReviewItem node={n()} props={p.props} threads={p.threads} />
      </Match>
      <Match when={n().__typename === 'AssignedEvent' || n().__typename === 'UnassignedEvent'}>
        <Event icon={personIcon} actor={n().actor} createdAt={n().createdAt}>
          <Show
            when={n().assignee?.login !== n().actor?.login}
            fallback={n().__typename === 'AssignedEvent' ? 'self-assigned this' : 'removed their assignment'}
          >
            {n().__typename === 'AssignedEvent' ? 'assigned ' : 'unassigned '}
            <a class="link-plain font-semibold" href={userHref(n().assignee?.login ?? 'ghost')}>
              {n().assignee?.login ?? 'ghost'}
            </a>
          </Show>
        </Event>
      </Match>
      <Match when={n().__typename === 'ClosedEvent'}>
        <Event
          icon={p.props.isPull ? gitPullRequestClosedIcon : n().stateReason === 'NOT_PLANNED' || n().stateReason === 'DUPLICATE' ? skipIcon : issueClosedIcon}
          badgeClass={
            p.props.isPull
              ? 'bg-closed-emphasis! text-fg-on-emphasis!'
              : n().stateReason === 'NOT_PLANNED' || n().stateReason === 'DUPLICATE'
                ? 'bg-neutral-emphasis! text-fg-on-emphasis!'
                : 'bg-done-emphasis! text-fg-on-emphasis!'
          }
          actor={n().actor}
          createdAt={n().createdAt}
        >
          {p.props.isPull
            ? 'closed this'
            : n().stateReason === 'NOT_PLANNED'
              ? 'closed this as not planned'
              : n().stateReason === 'DUPLICATE'
                ? 'closed this as a duplicate'
                : 'closed this as completed'}
          <Show when={n().closer}>
            {(c) => (
              <>
                {' in '}
                <Show
                  when={c().__typename === 'PullRequest'}
                  fallback={
                    <a class="link-plain font-mono text-xs font-semibold" href={`/${repoName()}/commit/${c().oid}`}>
                      {c().abbreviatedOid}
                    </a>
                  }
                >
                  <a class="link-plain font-semibold" href={`/${repoName()}/pull/${c().number}`}>
                    #{c().number}
                  </a>
                </Show>
              </>
            )}
          </Show>
        </Event>
      </Match>
      <Match when={n().__typename === 'ReopenedEvent'}>
        <Event
          icon={p.props.isPull ? gitPullRequestIcon : issueReopenedIcon}
          badgeClass="bg-success-emphasis! text-fg-on-emphasis!"
          actor={n().actor}
          createdAt={n().createdAt}
        >
          reopened this
        </Event>
      </Match>
      <Match when={n().__typename === 'RenamedTitleEvent'}>
        <Event icon={pencilIcon} actor={n().actor} createdAt={n().createdAt}>
          changed the title <del class="text-fg-muted">{n().previousTitle}</del> <span class="font-semibold text-fg">{n().currentTitle}</span>
        </Event>
      </Match>
      <Match when={n().__typename === 'CrossReferencedEvent'}>
        <Event
          icon={crossReferenceIcon}
          actor={n().actor}
          createdAt={n().createdAt}
          extra={
            <div class="mt-1.5">
              <SubjectLink subject={n().source} currentRepo={repoName()} />
            </div>
          }
        >
          {n().willCloseTarget ? `linked a ${n().source?.__typename === 'PullRequest' ? 'pull request' : 'issue'} that will close this ${thing()}` : 'mentioned this'}
        </Event>
      </Match>
      <Match when={n().__typename === 'ReferencedEvent'}>
        <Event
          icon={gitCommitIcon}
          actor={n().actor}
          createdAt={n().createdAt}
          extra={
            <Show when={n().commit}>
              {(c) => (
                <div class="mt-1.5 flex items-center gap-2 text-sm">
                  <a class="link-plain truncate" href={`/${n().commitRepository?.nameWithOwner ?? repoName()}/commit/${c().oid}`}>
                    {c().messageHeadline}
                  </a>
                  <a class="link-muted font-mono text-xs" href={`/${n().commitRepository?.nameWithOwner ?? repoName()}/commit/${c().oid}`}>
                    {c().abbreviatedOid}
                  </a>
                </div>
              )}
            </Show>
          }
        >
          added a commit that references this {thing()}
        </Event>
      </Match>
      <Match when={n().__typename === 'MilestonedEvent' || n().__typename === 'DemilestonedEvent'}>
        <Event icon={milestoneIcon} actor={n().actor} createdAt={n().createdAt}>
          {n().__typename === 'MilestonedEvent' ? 'added this to the ' : 'removed this from the '}
          <span class="font-semibold text-fg">{n().milestoneTitle}</span> milestone
        </Event>
      </Match>
      <Match when={n().__typename === 'LockedEvent'}>
        <Event icon={lockIcon} badgeClass="bg-neutral-emphasis! text-fg-on-emphasis!" actor={n().actor} createdAt={n().createdAt}>
          locked{n().lockReason ? ` as ${n().lockReason!.toLowerCase().replace(/_/g, ' ')}` : ''} and limited conversation to collaborators
        </Event>
      </Match>
      <Match when={n().__typename === 'UnlockedEvent'}>
        <Event icon={unlockIcon} actor={n().actor} createdAt={n().createdAt}>
          unlocked this conversation
        </Event>
      </Match>
      <Match when={n().__typename === 'PinnedEvent' || n().__typename === 'UnpinnedEvent'}>
        <Event icon={pinIcon} actor={n().actor} createdAt={n().createdAt}>
          {n().__typename === 'PinnedEvent' ? 'pinned' : 'unpinned'} this issue
        </Event>
      </Match>
      <Match when={n().__typename === 'ConnectedEvent' || n().__typename === 'DisconnectedEvent'}>
        <Event
          icon={crossReferenceIcon}
          actor={n().actor}
          createdAt={n().createdAt}
          extra={
            <div class="mt-1.5">
              <SubjectLink subject={n().subject?.number === p.props.number ? n().source : n().subject} currentRepo={repoName()} />
            </div>
          }
        >
          {n().__typename === 'ConnectedEvent' ? `linked a pull request that will close this ${thing()}` : 'removed a link to a pull request'}
        </Event>
      </Match>
      <Match when={n().__typename === 'TransferredEvent'}>
        <Event icon={arrowRightIcon} actor={n().actor} createdAt={n().createdAt}>
          transferred this issue from <span class="font-semibold text-fg">{n().fromRepository?.nameWithOwner}</span>
        </Event>
      </Match>
      <Match when={n().__typename === 'MarkedAsDuplicateEvent' || n().__typename === 'UnmarkedAsDuplicateEvent'}>
        <Event icon={duplicateIcon} actor={n().actor} createdAt={n().createdAt}>
          {n().__typename === 'MarkedAsDuplicateEvent' ? 'marked this as a duplicate of ' : 'marked this as not a duplicate of '}
          <Show when={n().canonical}>
            {(c) => (
              <a class="link-plain font-semibold" href={`/${c().repository.nameWithOwner}/${c().__typename === 'PullRequest' ? 'pull' : 'issues'}/${c().number}`}>
                #{c().number}
              </a>
            )}
          </Show>
        </Event>
      </Match>
      <Match when={n().__typename === 'CommentDeletedEvent'}>
        <Event icon={trashIcon} actor={n().actor} createdAt={n().createdAt}>
          deleted a comment{n().deletedCommentAuthor ? ` from ${n().deletedCommentAuthor!.login}` : ''}
        </Event>
      </Match>
      <Match when={n().__typename === 'ConvertedToDiscussionEvent'}>
        <Event icon={commentDiscussionIcon} actor={n().actor} createdAt={n().createdAt}>
          converted this issue into discussion{' '}
          <a class="font-semibold" href={`/${repoName()}/discussions/${n().discussion?.number}`}>
            #{n().discussion?.number}
          </a>
        </Event>
      </Match>
      <Match when={n().__typename.startsWith('IssueType')}>
        <Event icon={typographyIcon} actor={n().actor} createdAt={n().createdAt}>
          {n().__typename === 'IssueTypeAddedEvent'
            ? `added the ${n().issueType?.name} issue type`
            : n().__typename === 'IssueTypeRemovedEvent'
              ? `removed the ${n().issueType?.name} issue type`
              : `changed the issue type from ${n().prevIssueType?.name} to ${n().issueType?.name}`}
        </Event>
      </Match>
      <Match when={n().__typename === 'SubIssueAddedEvent' || n().__typename === 'SubIssueRemovedEvent'}>
        <Event icon={issueTracksIcon} actor={n().actor} createdAt={n().createdAt}>
          {n().__typename === 'SubIssueAddedEvent' ? 'added a sub-issue' : 'removed a sub-issue'}{' '}
          <a class="link-plain font-semibold" href={n().subIssue ? new URL(n().subIssue!.url).pathname : undefined}>
            {n().subIssue?.title} #{n().subIssue?.number}
          </a>
        </Event>
      </Match>
      <Match when={n().__typename === 'ParentIssueAddedEvent' || n().__typename === 'ParentIssueRemovedEvent'}>
        <Event icon={issueTrackedByIcon} actor={n().actor} createdAt={n().createdAt}>
          {n().__typename === 'ParentIssueAddedEvent' ? 'added a parent issue' : 'removed a parent issue'}{' '}
          <a class="link-plain font-semibold" href={n().parent ? new URL(n().parent!.url).pathname : undefined}>
            {n().parent?.title} #{n().parent?.number}
          </a>
        </Event>
      </Match>
      {/* Pull requests */}
      <Match when={n().__typename === 'HeadRefForcePushedEvent' || n().__typename === 'BaseRefForcePushedEvent'}>
        <Event icon={repoPushIcon} actor={n().actor} createdAt={n().createdAt}>
          force-pushed the <code class="Label font-mono">{n().ref?.name}</code> branch from{' '}
          <a class="link-plain font-mono text-xs font-semibold" href={`/${repoName()}/commit/${n().beforeCommit?.oid}`}>
            {n().beforeCommit?.abbreviatedOid}
          </a>{' '}
          to{' '}
          <a class="link-plain font-mono text-xs font-semibold" href={`/${repoName()}/commit/${n().afterCommit?.oid}`}>
            {n().afterCommit?.abbreviatedOid}
          </a>
        </Event>
      </Match>
      <Match when={n().__typename === 'HeadRefDeletedEvent'}>
        <Event icon={gitBranchIcon} badgeClass="bg-neutral-emphasis! text-fg-on-emphasis!" actor={n().actor} createdAt={n().createdAt}>
          deleted the <code class="Label font-mono">{n().headRefName}</code> branch
        </Event>
      </Match>
      <Match when={n().__typename === 'HeadRefRestoredEvent'}>
        <Event icon={gitBranchIcon} actor={n().actor} createdAt={n().createdAt}>
          restored the head branch
        </Event>
      </Match>
      <Match when={n().__typename === 'BaseRefChangedEvent'}>
        <Event icon={gitBranchIcon} actor={n().actor} createdAt={n().createdAt}>
          changed the base branch from <code class="Label font-mono">{n().previousRefName}</code> to{' '}
          <code class="Label font-mono">{n().currentRefName}</code>
        </Event>
      </Match>
      <Match when={n().__typename === 'BaseRefDeletedEvent'}>
        <Event icon={gitBranchIcon} actor={n().actor} createdAt={n().createdAt}>
          deleted the base branch <code class="Label font-mono">{n().baseRefName}</code>
        </Event>
      </Match>
      <Match when={n().__typename === 'MergedEvent'}>
        <Event icon={gitMergeIcon} badgeClass="bg-done-emphasis! text-fg-on-emphasis!" actor={n().actor} createdAt={n().createdAt}>
          merged commit{' '}
          <a class="link-plain font-mono text-xs font-semibold" href={`/${repoName()}/commit/${n().commit?.oid}`}>
            {n().commit?.abbreviatedOid}
          </a>{' '}
          into <code class="Label font-mono">{n().mergeRefName}</code>
        </Event>
      </Match>
      <Match when={n().__typename === 'ReadyForReviewEvent'}>
        <Event icon={eyeIcon} actor={n().actor} createdAt={n().createdAt}>
          marked this pull request as ready for review
        </Event>
      </Match>
      <Match when={n().__typename === 'ConvertToDraftEvent'}>
        <Event icon={gitPullRequestDraftIcon} actor={n().actor} createdAt={n().createdAt}>
          marked this pull request as draft
        </Event>
      </Match>
      <Match when={n().__typename === 'ReviewDismissedEvent'}>
        <Event icon={xIcon} actor={n().actor} createdAt={n().createdAt}>
          dismissed {n().review?.author?.login ? `${n().review!.author!.login}’s` : 'a'} review
          <Show when={n().dismissalMessage}>
            <span class="text-fg">: {n().dismissalMessage}</span>
          </Show>
        </Event>
      </Match>
      <Match when={n().__typename.startsWith('AutoMerge') || n().__typename.startsWith('AutoSquash') || n().__typename.startsWith('AutoRebase')}>
        <Event icon={gitMergeIcon} actor={n().actor} createdAt={n().createdAt}>
          {n().__typename === 'AutoMergeDisabledEvent'
            ? 'disabled auto-merge'
            : `enabled auto-merge${n().__typename === 'AutoSquashEnabledEvent' ? ' (squash)' : n().__typename === 'AutoRebaseEnabledEvent' ? ' (rebase)' : ' (merge)'}`}
        </Event>
      </Match>
      <Match when={n().__typename === 'DeployedEvent'}>
        <Event icon={rocketIcon} actor={n().actor} createdAt={n().createdAt}>
          deployed to <span class="font-semibold text-fg">{n().deployment?.environment ?? 'an environment'}</span>
        </Event>
      </Match>
      <Match when={n().__typename === 'AddedToMergeQueueEvent' || n().__typename === 'RemovedFromMergeQueueEvent'}>
        <Event icon={gitMergeIcon} actor={n().actor} createdAt={n().createdAt}>
          {n().__typename === 'AddedToMergeQueueEvent' ? 'added this pull request to the merge queue' : 'removed this pull request from the merge queue'}
          {n().reason ? ` (${n().reason!.toLowerCase().replace(/_/g, ' ')})` : ''}
        </Event>
      </Match>
      <Match when={n().__typename.startsWith('AutomaticBaseChange')}>
        <Event icon={gitBranchIcon} createdAt={n().createdAt}>
          Base {n().__typename.endsWith('FailedEvent') ? 'failed to change' : 'automatically changed'} from{' '}
          <code class="Label font-mono">{n().oldBase}</code> to <code class="Label font-mono">{n().newBase}</code>
        </Event>
      </Match>
    </Switch>
  );
}

function ReviewItem(p: { node: TimelineNode; props: TimelineProps; threads: Thread[] }) {
  const look = () => REVIEW_LOOK[p.node.state ?? 'COMMENTED'] ?? REVIEW_LOOK.COMMENTED!;
  const hasBody = () => !!p.node.body?.trim();
  // GitHub hides empty "reviewed" entries whose comments are replies in other threads.
  const visible = () => p.node.state !== 'COMMENTED' || hasBody() || p.threads.length > 0;
  return (
    <Show when={visible()}>
      <div id={`pullrequestreview-${p.node.databaseId}`} class="scroll-mt-20">
        <Event icon={look().icon} badgeClass={look().badge} actor={p.node.author} createdAt={p.node.submittedAt ?? p.node.createdAt}>
          {look().text}
          <Show when={p.node.state === 'DISMISSED'}>
            <span class="Label">Dismissed</span>
          </Show>
        </Event>
        <Show when={hasBody() || p.threads.length}>
          <div class="pl-14 pb-4 relative">
            <div class="ml-4 pl-4">
              <Show when={hasBody()}>
                <div class="Box">
                <Comment
                  nested
                  comment={p.node as any}
                  commentRef={{ kind: 'review', owner: p.props.owner, repo: p.props.repo, number: p.props.number, databaseId: p.node.databaseId }}
                  repo={`${p.props.owner}/${p.props.repo}`}
                  issueAuthor={p.props.issueAuthor}
                  canReact={p.props.canReact}
                  verb="left a comment"
                />
                </div>
              </Show>
              <For each={p.threads}>
                {(t) => (
                  <ReviewThread
                    thread={t}
                    owner={p.props.owner}
                    repo={p.props.repo}
                    number={p.props.number}
                    issueAuthor={p.props.issueAuthor}
                    viewerAvatar={p.props.viewerAvatar}
                    canReact={p.props.canReact}
                  />
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}

