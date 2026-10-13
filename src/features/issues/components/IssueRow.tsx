import { For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, IssueLabel, itemState, RelativeTime, StateIcon } from '../../../components/ui';
import { alertIcon, checkIcon, commentIcon, fileDiffIcon, gitPullRequestIcon, lockIcon, milestoneIcon, pinIcon } from '../../../icons/octicons';
import CommitStatusIcon from '../../repo/components/CommitStatusIcon';
import { feature } from '../../refined';
import { isBot } from '../refined';
import type { ListItem } from '../types';
import { userHref } from './Comment';

/** Inline `code` inside GitHub's rendered titles (titleHTML). */
export const TITLE_CODE =
  '[&_code]:font-mono [&_code]:text-[85%] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:bg-[var(--bgColor-neutral-muted)]';

const REVIEW_TEXT: Record<string, { text: string; class: string; filter: string }> = {
  APPROVED: { text: 'Approved', class: 'text-fg-success', filter: 'review:approved' },
  CHANGES_REQUESTED: { text: 'Changes requested', class: 'text-fg-danger', filter: 'review:changes_requested' },
  REVIEW_REQUIRED: { text: 'Review required', class: '', filter: 'review:required' },
};

/** Collaborator associations highlighted by conversation-authors. */
const COLLABORATOR = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

/** "7/8" passing checks for a PR row. */
function checkCounts(item: ListItem) {
  const rollup = item.commits?.nodes[0]?.commit.statusCheckRollup;
  if (!rollup) return null;
  const counts = [...(rollup.contexts.checkRunCountsByState ?? []), ...(rollup.contexts.statusContextCountsByState ?? [])];
  const ok = counts.filter((c) => ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(c.state)).reduce((n, c) => n + c.count, 0);
  return { state: rollup.state, text: `${ok}/${rollup.contexts.totalCount}` };
}

export interface IssueRowProps {
  item: ListItem;
  /** Prefix the number with owner/repo (global lists). */
  showRepo?: boolean;
  labelHref?: (name: string) => string;
  /** The current list with one more qualifier (links the review state), e.g. filterHref('review:approved'). */
  filterHref?: (qualifier: string) => string;
  /** Logged-in user (conversation-authors). */
  viewerLogin?: string;
}

/** One row of an issue / PR list. */
export default function IssueRow(props: IssueRowProps) {
  const isPull = () => props.item.__typename === 'PullRequest';
  const path = () => `/${props.item.repository.nameWithOwner}/${isPull() ? 'pull' : 'issues'}/${props.item.number}`;
  const author = () => props.item.author?.login ?? 'ghost';
  const checks = () => checkCounts(props.item);
  const draft = () => isPull() && !!props.item.isDraft;
  /** conversation-authors: own conversations, and (repo lists) collaborators'. */
  const authorClass = () => {
    if (!feature('conversation-authors')) return null;
    if (props.viewerLogin && author() === props.viewerLogin) return 'rgh-own-conversation';
    if (!props.showRepo && COLLABORATOR.has(props.item.authorAssociation)) return 'rgh-collaborator';
    return null;
  };
  const reviews = () => {
    const nodes = props.item.latestOpinionatedReviews?.nodes ?? [];
    return {
      approved: nodes.filter((r) => r.state === 'APPROVED').length,
      changes: nodes.filter((r) => r.state === 'CHANGES_REQUESTED').length,
    };
  };
  const nonDefaultBase = () => {
    const base = props.item.baseRefName;
    const def = props.item.repository.defaultBranchRef?.name;
    return isPull() && base && def && base !== def ? base : null;
  };
  const commentsHref = () => {
    const last = props.item.lastComment?.nodes[0]?.databaseId;
    return last ? `${path()}#issuecomment-${last}` : path();
  };
  const filterLink = (qualifier: string, text: string, cls?: string) => (
    <Show when={props.filterHref} fallback={<span class={cls}>{text}</span>}>
      <a class={['link-muted rgh-linkify-pr-review-state', cls]} href={props.filterHref!(qualifier)} title={`Show only PRs with ${qualifier}`}>
        {text}
      </a>
    </Show>
  );
  const labels = () => (
    <For each={props.item.labels.nodes}>
      {(l) => <IssueLabel class="mr-1 align-middle" name={l.name} color={l.color} title={l.description} href={props.labelHref?.(l.name)} />}
    </For>
  );

  return (
    <div class={['Box-row Box-row--hover flex items-start gap-3 py-2! px-4!', { 'rgh-dim-bot': feature('dim-bots') && isBot(props.item.author) }]}>
      <StateIcon
        class="mt-1 shrink-0"
        state={itemState({ isPull: isPull(), state: props.item.state, stateReason: props.item.stateReason, draft: props.item.isDraft })}
      />
      <div class="flex-1 min-w-0">
        <div class="leading-snug">
          <Show when={draft()}>
            <span class="Label Label--secondary mr-1 align-middle rgh-draft-label">Draft</span>
          </Show>
          <a
            class={['link-plain font-semibold text-base mr-1 break-words', TITLE_CODE, { 'text-fg-muted!': draft() }]}
            href={path()}
            // oxlint-disable-next-line solid/no-innerhtml -- titleHTML is rendered + sanitized by GitHub
            innerHTML={props.item.titleHTML || props.item.title}
          />
          <Show when={props.item.isPinned}>
            <span class="text-fg-muted mr-1 align-middle rgh-pinned" title="Pinned issue" aria-label="Pinned issue">
              <Octicon icon={pinIcon} size={14} />
            </span>
          </Show>
          <Show when={props.item.locked}>
            <span class="text-fg-muted mr-1 align-middle rgh-locked" title="Locked conversation" aria-label="Locked conversation">
              <Octicon icon={lockIcon} size={14} />
            </span>
          </Show>
        </div>
        <Show when={props.item.labels.nodes.length}>
          <div class="mt-1 flex flex-wrap gap-y-1 rgh-align-issue-labels">{labels()}</div>
        </Show>
        <div class="mt-1 text-xs text-fg-muted flex flex-wrap items-center gap-x-1">
          <span>
            {props.showRepo ? props.item.repository.nameWithOwner : ''}#{props.item.number}
          </span>
          <span>·</span>
          <a class={['link-muted inline-flex items-center gap-1', authorClass()]} href={userHref(author())}>
            <Avatar src={props.item.author?.avatarUrl} login={author()} size={14} class="rgh-small-user-avatars" />
            {author()}
          </a>
          <Show
            when={props.item.state === 'OPEN'}
            fallback={
              <span>
                {props.item.state === 'MERGED' ? 'was merged' : 'was closed'} <RelativeTime datetime={props.item.closedAt} />
              </span>
            }
          >
            <span>
              opened <RelativeTime datetime={props.item.createdAt} />
            </span>
          </Show>
          <Show when={isPull() && !props.item.isDraft && props.item.state === 'OPEN' && props.item.reviewDecision}>
            {(d) => <span>· {filterLink(REVIEW_TEXT[d()]?.filter ?? '', REVIEW_TEXT[d()]?.text ?? '', REVIEW_TEXT[d()]?.class)}</span>}
          </Show>
          <Show when={checks()}>
            {(c) => (
              <span class="inline-flex items-center gap-1">
                ·{' '}
                <CommitStatusIcon
                  state={c().state}
                  href={`${path()}/checks`}
                  owner={props.item.repository.nameWithOwner.split('/')[0]}
                  repo={props.item.repository.nameWithOwner.split('/')[1]}
                  pull={props.item.number}
                />
                <a class="link-muted" href={`${path()}/checks`}>
                  {c().text}
                </a>
              </span>
            )}
          </Show>
          <Show when={nonDefaultBase()}>
            {(base) => (
              <span class="inline-flex items-center gap-1">
                ·
                <a
                  class="font-mono text-xs px-1.5 rounded-md bg-accent-muted text-fg-accent hover:underline rgh-base-branch"
                  href={`/${props.item.repository.nameWithOwner}/tree/${base()}`}
                  title="Base branch (not the default branch)"
                >
                  {base()}
                </a>
              </span>
            )}
          </Show>
          <Show when={props.item.milestone}>
            {(m) => (
              <span class="inline-flex items-center gap-1">
                ·
                <a class="link-muted inline-flex items-center gap-1" href={`/${props.item.repository.nameWithOwner}/milestone/${m().number}`}>
                  <Octicon icon={milestoneIcon} size={12} />
                  {m().title}
                </a>
              </span>
            )}
          </Show>
          <Show when={props.item.issueType}>
            {(t) => <span>· {t().name}</span>}
          </Show>
        </div>
      </div>
      <div class="hidden sm:flex items-center gap-4 shrink-0 text-xs text-fg-muted pt-1">
        <Show when={isPull() && props.item.state === 'OPEN' && props.item.mergeable === 'CONFLICTING'}>
          <a class="inline-flex items-center text-fg-danger! rgh-conflict-marker" href={path()} title="This PR has conflicts that must be resolved">
            <Octicon icon={alertIcon} />
          </a>
        </Show>
        <Show when={isPull() && (reviews().approved || reviews().changes)}>
          <span class="inline-flex items-center gap-2 rgh-pr-approvals-count">
            <Show when={reviews().approved}>
              <span class="inline-flex items-center gap-0.5 text-fg-success" title={`${reviews().approved} approval${reviews().approved === 1 ? '' : 's'}`}>
                <Octicon icon={checkIcon} />
                {reviews().approved}
              </span>
            </Show>
            <Show when={reviews().changes}>
              <span class="inline-flex items-center gap-0.5 text-fg-danger" title={`${reviews().changes} change request${reviews().changes === 1 ? '' : 's'}`}>
                <Octicon icon={fileDiffIcon} />
                {reviews().changes}
              </span>
            </Show>
          </span>
        </Show>
        <Show when={(props.item.closedByPullRequestsReferences?.totalCount ?? 0) > 0}>
          <span class="inline-flex items-center gap-1" title="Linked pull requests">
            <Octicon icon={gitPullRequestIcon} />
            {props.item.closedByPullRequestsReferences!.totalCount}
          </span>
        </Show>
        <Show when={props.item.assignees.nodes.length}>
          <span class="AvatarStack flex">
            <For each={props.item.assignees.nodes.slice(0, 3)}>
              {(a) => (
                <a href={userHref(a.login)} title={`Assigned to ${a.login}`}>
                  <Avatar src={a.avatarUrl} login={a.login} size={20} />
                </a>
              )}
            </For>
          </span>
        </Show>
        <Show when={props.item.comments.totalCount > 0}>
          <a class="link-muted inline-flex items-center gap-1" href={commentsHref()} aria-label={`${props.item.comments.totalCount} comments`}>
            <Octicon icon={commentIcon} />
            {props.item.comments.totalCount}
          </a>
        </Show>
      </div>
    </div>
  );
}
