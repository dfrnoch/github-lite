import { useLocation } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, For, Match, onSettled, Show, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, AvatarStack, IssueLabel, itemState, RelativeTime, StateIcon, toast, toastError } from '../../../components/ui';
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
import { useHotkey } from '../../../lib/hotkeys';
import ReviewThread from '../../pulls/components/ReviewThread';
import { feature } from '../../refined';
import { getTimelinePage } from '../api';
import { activityFilter, cycleActivityFilter, isBot, isBotLogin, isLowQualityComment, RichText, UserName } from '../refined';
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

/** Authors whose comments always stay visible (they get a label in the header). */
const LABELLED = new Set(['OWNER', 'MEMBER', 'COLLABORATOR', 'CONTRIBUTOR', 'FIRST_TIME_CONTRIBUTOR', 'FIRST_TIMER']);

const anchorOf = (n: TimelineNode) =>
  n.__typename === 'IssueComment' ? `issuecomment-${n.databaseId}` : n.__typename === 'PullRequestReview' ? `pullrequestreview-${n.databaseId}` : '';

/** Issue / PR timeline below the opening comment. */
export default function Timeline(props: TimelineProps) {
  const location = useLocation();
  // Items loaded through "Load more" (between head and tail).
  const [extra, setExtra] = createSignal<TimelineNode[]>([]);
  const [cursor, setCursor] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [showLowQuality, setShowLowQuality] = createSignal(false);

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

  const fetchPage = async (after: string) => {
    const page = await getTimelinePage(props.owner, props.repo, props.number, props.isPull, after);
    setExtra((list) => [...list, ...page.nodes]);
    setCursor(page.pageInfo.endCursor ?? null);
    return page;
  };
  /** Next page of hidden items — or, with `all` (alt-click), every hidden item. */
  const loadMore = async (all = false) => {
    let after = cursor() ?? props.head.pageInfo.endCursor;
    if (!after) return;
    setLoading(true);
    try {
      const tailIds = new Set(props.tail.nodes.map((n) => n.id));
      for (let i = 0; i < (all ? 20 : 1); i++) {
        const page = await fetchPage(after);
        after = page.pageInfo.endCursor ?? null;
        if (!after || !page.pageInfo.hasNextPage || page.nodes.some((n) => tailIds.has(n.id))) break;
      }
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

  const path = () => `/${props.owner}/${props.repo}/${props.isPull ? 'pull' : 'issues'}/${props.number}`;
  const filter = () => activityFilter(path());
  const deepLinked = (n: TimelineNode) => !!location.hash && location.hash.slice(1) === anchorOf(n);

  // hide-low-quality-comments: "+1" comments by people without a label, unless they already said something useful.
  const lowQuality = createMemo(() => {
    const hidden: string[] = [];
    if (props.isPull || !feature('hide-low-quality-comments')) return hidden;
    const spoke = new Set<string>();
    for (const e of entries()) {
      if (e.type !== 'node' || e.node.__typename !== 'IssueComment') continue;
      const n = e.node;
      const login = n.author?.login ?? 'ghost';
      const candidate =
        !deepLinked(n) && login !== props.issueAuthor && !LABELLED.has(n.authorAssociation ?? '') && isLowQualityComment(n.body ?? '', n.bodyHTML ?? '');
      if (candidate && !spoke.has(login)) hidden.push(n.id!);
      else spoke.add(login);
    }
    return hidden;
  });

  /** Review threads still shown under a review with the current filter. */
  const threadsFor = (reviewId: string | undefined) => {
    const all = threadsByReview().get(reviewId ?? '') ?? [];
    return filter() === 'hideAllNoise' ? all.filter((t) => !t.isResolved) : all;
  };

  // The activity filter and hidden low-quality comments.
  const visible = createMemo(() => {
    const f = filter();
    const hiddenLowQuality = new Set(showLowQuality() ? [] : lowQuality());
    return entries().filter((e) => {
      if (e.type === 'hidden') return true;
      if (e.type === 'node' && hiddenLowQuality.has(e.node.id!)) return false;
      if (f === 'showAll' || e.type === 'commits') return true;
      if (e.type !== 'node') return false;
      const n = e.node;
      if (deepLinked(n)) return true;
      if (n.__typename === 'IssueComment') return f === 'hideEvents' || (!n.isMinimized && !isBot(n.author));
      if (n.__typename === 'PullRequestReview') {
        if (f === 'hideEvents') return true;
        if (n.state === 'DISMISSED' || isBot(n.author)) return false;
        return (!!n.body?.trim() && !n.isMinimized) || threadsFor(n.id).length > 0;
      }
      return false;
    });
  });

  // j / k move between comments.
  const focusComment = (direction: 1 | -1) => {
    const items = [...document.querySelectorAll<HTMLElement>('[data-rgh-comment][id]')].filter(
      (el) => el.offsetParent !== null && !el.querySelector(':scope > .timeline-comment > .rgh-minimized-comment, :scope > div > .timeline-comment > .rgh-minimized-comment'),
    );
    if (!items.length) return;
    const current = items.findIndex((el) => `#${el.id}` === window.location.hash);
    const next = Math.min(Math.max(0, current + direction), items.length - 1);
    if (current === next) return;
    document.querySelector('.rgh-keyboard-target')?.classList.remove('rgh-keyboard-target');
    const el = items[next]!;
    history.replaceState(history.state, '', `#${el.id}`);
    el.classList.add('rgh-keyboard-target');
    el.scrollIntoView({ block: 'start' });
  };
  useHotkey({ keys: 'j', description: 'Focus the comment below', group: 'Conversations', handler: () => focusComment(1) });
  useHotkey({ keys: 'k', description: 'Focus the comment above', group: 'Conversations', handler: () => focusComment(-1) });
  useHotkey({
    keys: 'h',
    description: 'Cycle through conversation activity filters',
    group: 'Conversations',
    handler: () => cycleActivityFilter(path()),
  });

  onSettled(() => {
    // Warn that the browser's find won't see unloaded / hidden items.
    const onKey = (e: KeyboardEvent) => {
      const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? e.metaKey : e.ctrlKey;
      if (!mod || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'f') return;
      const loadMoreEl = document.querySelector('[data-rgh-load-more]');
      const filtered = filter() !== 'showAll' || (lowQuality().length > 0 && !showLowQuality());
      if (!loadMoreEl && !filtered) return;
      loadMoreEl?.scrollIntoView({ block: 'center' });
      toast(loadMoreEl ? 'There are hidden comments that won’t be searched' : 'Some comments are filtered out and won’t be searched', 'info', 4000);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Review threads (rendered by ReviewThread): alt-click toggles them all, clicking a header bar toggles one.
  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const toggle = target.closest<HTMLButtonElement>('button[aria-label="Expand thread"], button[aria-label="Collapse thread"]');
    if (toggle && e.altKey) {
      for (const b of document.querySelectorAll<HTMLButtonElement>(`button[aria-label="${toggle.getAttribute('aria-label')}"]`)) if (b !== toggle) b.click();
      return;
    }
    const minimized = target.closest('.rgh-show-minimized, .rgh-hide-minimized');
    if (minimized && e.altKey) {
      const cls = minimized.classList.contains('rgh-show-minimized') ? '.rgh-show-minimized' : '.rgh-hide-minimized';
      for (const b of document.querySelectorAll<HTMLButtonElement>(cls)) if (b !== minimized) b.click();
      return;
    }
    if (toggle || target.closest('a, button, input, textarea, select, summary')) return;
    const header = target.closest('.Box > div:first-child');
    const headerToggle = header?.querySelector<HTMLButtonElement>(':scope > button[aria-label="Expand thread"], :scope > button[aria-label="Collapse thread"]');
    headerToggle?.click();
  };

  const revealLowQuality = () => {
    const first = lowQuality()[0];
    setShowLowQuality(true);
    requestAnimationFrame(() => {
      const node = entries().find((e) => e.type === 'node' && e.node.id === first);
      if (node?.type === 'node') document.getElementById(anchorOf(node.node))?.scrollIntoView({ block: 'center' });
    });
  };

  return (
    <div class="rgh-timeline" data-rgh-activity-filter={filter()} onClick={onClick}>
      <For each={visible()} keyed={(e) => (e.type === 'node' ? (e.node.id ?? e.node.createdAt) : e.key)}>
        {(entry) => (
          <Switch>
            <Match when={entry().type === 'hidden' && (entry() as Extract<Entry, { type: 'hidden' }>)}>
              {(h) => (
                <div class="relative py-4 my-2 text-center bg-canvas" data-rgh-load-more>
                  <div class="border-y-4 border-dotted border-line py-3">
                    <span class="text-sm text-fg-muted mr-2">{h().count} remaining items</span>
                    <button
                      type="button"
                      class="btn btn-sm"
                      disabled={loading()}
                      title="Alt-click to load all remaining items"
                      onClick={(e) => void loadMore(e.altKey)}
                    >
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
              {(n) => <TimelineNodeView node={n()} props={props} threads={threadsFor(n().id)} />}
            </Match>
          </Switch>
        )}
      </For>
      <Show when={lowQuality().length > 0 && !showLowQuality()}>
        <div class="rgh-low-quality-comments ml-14 mb-4 px-3 py-2 rounded-md border border-line bg-canvas-muted text-sm text-fg-muted flex items-center gap-2">
          <span class="flex-1">
            {lowQuality().length} unhelpful comment{lowQuality().length === 1 ? ' was' : 's were'} automatically hidden.
          </span>
          <button type="button" class="btn-link text-sm" onClick={revealLowQuality}>
            Show
          </button>
        </div>
      </Show>
    </div>
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
  /** Marks a close / merge event (the header badge jumps to the latest one). */
  closeEvent?: boolean;
}) {
  return (
    <div class="TimelineItem ml-[72px]! py-3!" data-rgh-close-event={props.closeEvent ? '' : undefined}>
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
                <UserName login={a().login} />
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
          <span>
            <RichText text={s().title} links={false} />
          </span>
          <span class="text-fg-muted font-normal">
            {s().repository.nameWithOwner === props.currentRepo ? '' : s().repository.nameWithOwner}#{s().number}
          </span>
        </a>
      )}
    </Show>
  );
}

/** A commit's distinct authors (a co-author trailer for the author themself is the same person). */
const commitAvatars = (n: TimelineNode) => {
  const nodes = n.commit?.authors?.nodes ?? [];
  return nodes
    .filter((a, i) => nodes.findIndex((x) => (x.user && a.user ? x.user.login === a.user.login : x.name === a.name)) === i)
    .map((a) => ({ src: a.avatarUrl, login: a.user?.login }));
};

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
            <div
              class={[
                'flex items-center gap-2 py-1 pl-0 text-sm',
                { 'rgh-dim-bot': feature('dim-bots') && isBotLogin(n.commit?.authors?.nodes[0]?.user?.login ?? n.commit?.authors?.nodes[0]?.name) },
              ]}
            >
              <span class="relative z-1 bg-canvas text-fg-muted flex">
                <Octicon icon={gitCommitIcon} />
              </span>
              <AvatarStack avatars={commitAvatars(n)} size={16} />
              <a
                class="link-muted truncate min-w-0 flex-1"
                href={`/${props.owner}/${props.repo}/commit/${n.commit?.oid}`}
                title={n.commit?.messageHeadline}
              >
                <RichText text={n.commit?.messageHeadline} links={false} />
              </a>
              <CommitStatusIcon state={n.commit?.statusCheckRollup?.state} owner={props.owner} repo={props.repo} sha={n.commit?.oid} />
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
          closeEvent
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
        <Event
          icon={pencilIcon}
          actor={n().actor}
          createdAt={n().createdAt}
          extra={
            <div class="rgh-readable-title-change mt-1 flex flex-col gap-0.5 text-sm">
              <del class="text-fg-muted break-words">
                <RichText text={n().previousTitle} />
              </del>
              <span class="font-semibold text-fg break-words">
                <RichText text={n().currentTitle} repo={repoName()} />
              </span>
            </div>
          }
        >
          changed the title
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
        <Event icon={gitMergeIcon} badgeClass="bg-done-emphasis! text-fg-on-emphasis!" actor={n().actor} createdAt={n().createdAt} closeEvent>
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

