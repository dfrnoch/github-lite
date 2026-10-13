import { Title } from '@solidjs/meta';
import { useAction } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Blankslate, Dialog, ErrorView, IssueLabel, Markdown, MarkdownEditor, Spinner, toastError } from '../../../components/ui';
import {
  bellIcon,
  bellSlashIcon,
  checkCircleFillIcon,
  commentDiscussionIcon,
  discussionClosedIcon,
  issueReopenedIcon,
  lockIcon,
  unlockIcon,
} from '../../../icons/octicons';
import { pluralize } from '../../../lib/format';
import { GitHubError } from '../../../lib/github';
import { useRepo } from '../../repo/context';
import {
  addDiscussionComment,
  categoryEmoji,
  type CommentsPage,
  type Discussion,
  type DiscussionComment as Comment,
  getDiscussion,
  getDiscussionComments,
  setClosed,
  setLocked,
  setSubscription,
  voteOnPoll,
} from '../api';
import DiscussionComment, { AuthorLine, commentAnchor } from './DiscussionComment';
import Reactions, { UpvoteButton } from './Reactions';
import { stickySidebar } from '../../../features/repo/refined/sticky';

/** /discussions/:number — post, threaded comments, answer, reactions, comment box, sidebar. */
export default function DiscussionView(props: { number: number }) {
  const ctx = useRepo();
  const data = createMemo(() => getDiscussion(ctx.owner(), ctx.name(), props.number));
  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Show
        when={data()}
        fallback={<ErrorView error={new GitHubError(404, 'Discussion not found')} />}
      >
        {(d) => <DiscussionBody discussion={d().discussion} comments={d().comments} />}
      </Show>
    </div>
  );
}

function DiscussionBody(props: { discussion: Discussion; comments: CommentsPage }) {
  const ctx = useRepo();
  const d = () => props.discussion;
  // Pages loaded with "Load more" (cursors), appended after the first page.
  const [cursors, setCursors] = createSignal<string[]>([]);
  const canModerate = () => ['ADMIN', 'MAINTAIN', 'WRITE', 'TRIAGE'].includes(d().repository.viewerPermission ?? '');
  const canComment = () => !d().locked || canModerate();
  const participants = createMemo(() => {
    const seen = new Map<string, string>();
    const add = (a: { login: string; avatarUrl: string } | null) => a && !seen.has(a.login) && seen.set(a.login, a.avatarUrl);
    add(d().author);
    for (const c of props.comments.nodes) {
      add(c.author);
      for (const r of c.replies?.nodes ?? []) add(r.author);
    }
    return [...seen].map(([login, avatarUrl]) => ({ login, avatarUrl }));
  });
  const replyCount = () => props.comments.nodes.reduce((n, c) => n + (c.replies?.totalCount ?? 0), 0);

  return (
    <>
      <Title>{`${d().title} · ${ctx.fullName()} · Discussion #${d().number}`}</Title>
      <h1 class="text-[32px] leading-tight font-normal break-words">
        {d().title} <span class="text-fg-muted font-light">#{d().number}</span>
      </h1>
      <div class="flex flex-wrap items-center gap-2 mt-2 pb-4 mb-6 text-sm">
        <Show when={d().isAnswered && d().answer}>
          {(answer) => (
            <a
              class="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-line-success text-fg-success font-semibold"
              href={`#answer`}
            >
              <Octicon icon={checkCircleFillIcon} />
              Answered by {answer().author?.login ?? 'ghost'}
            </a>
          )}
        </Show>
        <Show when={d().closed}>
          <span class="State State--done State--small">
            <Octicon icon={discussionClosedIcon} /> Closed
          </span>
        </Show>
        <Show when={d().locked}>
          <span class="Label">
            <Octicon icon={lockIcon} class="mr-1" /> Locked
          </span>
        </Show>
        <span class="text-fg-muted">
          <a class="font-semibold link-plain" href={`/${d().author?.login ?? 'ghost'}`}>
            {d().author?.login ?? 'ghost'}
          </a>{' '}
          {d().category.isAnswerable ? 'asked this question' : 'started this conversation'} in{' '}
          <a class="font-semibold link-plain" href={`${ctx.base()}/discussions/categories/${d().category.slug}`}>
            {d().category.name}
          </a>
        </span>
      </div>

      <div class="flex flex-col md:flex-row gap-8">
        <div class="flex-1 min-w-0 flex flex-col gap-4">
          <div class="rounded-md border border-line">
            <div class="flex gap-3 p-4">
              <div class="shrink-0">
                <UpvoteButton vertical subjectId={d().id} count={d().upvoteCount} upvoted={d().viewerHasUpvoted} canUpvote={d().viewerCanUpvote} />
              </div>
              <div class="flex-1 min-w-0">
                <div class="mb-3">
                  <AuthorLine
                    author={d().author}
                    association={d().authorAssociation}
                    createdAt={d().createdAt}
                    edited={!!d().lastEditedAt}
                    href={`${ctx.base()}/discussions/${d().number}`}
                    avatarSize={32}
                  />
                </div>
                <Markdown html={d().bodyHTML} />
                <Show when={d().poll}>{(poll) => <Poll poll={poll()} />}</Show>
                <div class="mt-4">
                  <Reactions subjectId={d().id} groups={d().reactionGroups} canReact={d().viewerCanReact} />
                </div>
              </div>
            </div>
          </div>

          <Show when={d().isAnswered && d().answer}>
            {(answer) => <AnswerJump id={answer().id} comments={props.comments.nodes} />}
          </Show>

          <h2 class="flex items-center gap-2 text-base font-semibold mt-4">
            <Octicon icon={commentDiscussionIcon} class="text-fg-muted" />
            {pluralize(props.comments.totalCount, 'comment')} · {pluralize(replyCount(), 'reply', 'replies')}
          </h2>

          <Show when={props.comments.nodes.length} fallback={<p class="text-sm text-fg-muted">No comments yet.</p>}>
            <For each={props.comments.nodes}>
              {(c) => (
                <DiscussionComment
                  comment={c}
                  discussionId={d().id}
                  opLogin={d().author?.login ?? null}
                  answerable={d().category.isAnswerable}
                  locked={d().locked}
                  canComment={canComment()}
                />
              )}
            </For>
          </Show>
          <For each={cursors()}>
            {(cursor) => (
              <Loading fallback={<div class="flex justify-center py-4 text-fg-muted"><Spinner size={24} /></div>}>
                <MoreComments
                  discussion={d()}
                  cursor={cursor}
                  canComment={canComment()}
                  isLast={cursors()[cursors().length - 1] === cursor}
                  onMore={(next) => setCursors((list) => [...list, next])}
                />
              </Loading>
            )}
          </For>
          <Show when={!cursors().length && props.comments.pageInfo.hasNextPage}>
            <button type="button" class="btn btn-block" onClick={() => setCursors([props.comments.pageInfo.endCursor!])}>
              Load more comments
            </button>
          </Show>

          <NewComment discussion={d()} canComment={canComment()} />
        </div>

        <aside class="md:w-[280px] shrink-0 text-sm" ref={stickySidebar()}>
          <SidebarSection title="Category">
            <a class="flex items-center gap-2 font-semibold link-plain" href={`${ctx.base()}/discussions/categories/${d().category.slug}`}>
              <span class="w-8 h-8 flex items-center justify-center rounded-md bg-canvas-muted text-base">{categoryEmoji(d().category.emojiHTML)}</span>
              {d().category.name}
            </a>
          </SidebarSection>
          <SidebarSection title="Labels">
            <Show when={d().labels?.nodes.length} fallback={<span class="text-fg-muted">None yet</span>}>
              <div class="flex flex-wrap gap-1">
                <For each={d().labels!.nodes}>
                  {(l) => <IssueLabel name={l.name} color={l.color} title={l.description} href={`${ctx.base()}/discussions?discussions_q=${encodeURIComponent(`label:"${l.name}"`)}`} />}
                </For>
              </div>
            </Show>
          </SidebarSection>
          <SidebarSection title={pluralize(participants().length, 'participant')}>
            <div class="flex flex-wrap gap-1">
              <For each={participants()}>
                {(p) => (
                  <a href={`/${p.login}`} title={p.login}>
                    <Avatar src={p.avatarUrl} login={p.login} size={26} />
                  </a>
                )}
              </For>
            </div>
          </SidebarSection>
          <SidebarActions discussion={d()} canModerate={canModerate()} />
        </aside>
      </div>
    </>
  );
}

function SidebarSection(props: { title: string; children: any }) {
  return (
    <section class="pb-4 mb-4 border-b border-line-muted">
      <h3 class="text-xs font-semibold text-fg-muted mb-2">{props.title}</h3>
      {props.children}
    </section>
  );
}

/** Notification, lock and close controls. */
function SidebarActions(props: { discussion: Discussion; canModerate: boolean }) {
  const lock = useAction(setLocked);
  const close = useAction(setClosed);
  const subscribe = useAction(setSubscription);
  const [lockOpen, setLockOpen] = createSignal(false);
  const [reason, setReason] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  const subscribed = () => props.discussion.viewerSubscription === 'SUBSCRIBED';
  return (
    <>
      <Show when={props.discussion.viewerCanSubscribe}>
        <SidebarSection title="Notifications">
          <button type="button" class="btn btn-sm btn-block" disabled={busy()} onClick={() => run(() => subscribe(props.discussion.id, !subscribed()))}>
            <Octicon icon={subscribed() ? bellSlashIcon : bellIcon} />
            {subscribed() ? 'Unsubscribe' : 'Subscribe'}
          </button>
          <p class="text-xs text-fg-muted mt-2">
            {subscribed() ? 'You’re receiving notifications because you’re subscribed to this thread.' : 'You’re not receiving notifications from this thread.'}
          </p>
        </SidebarSection>
      </Show>
      <div class="flex flex-col gap-2">
        <Show when={props.canModerate}>
          <button
            type="button"
            class="btn-link text-fg! text-left flex items-center gap-2 font-semibold"
            disabled={busy()}
            onClick={() => (props.discussion.locked ? run(() => lock(props.discussion.id, false)) : setLockOpen(true))}
          >
            <Octicon icon={props.discussion.locked ? unlockIcon : lockIcon} />
            {props.discussion.locked ? 'Unlock conversation' : 'Lock conversation'}
          </button>
        </Show>
        <Show when={props.discussion.closed ? props.discussion.viewerCanReopen : props.discussion.viewerCanClose}>
          <button
            type="button"
            class="btn-link text-fg! text-left flex items-center gap-2 font-semibold"
            disabled={busy()}
            onClick={() => run(() => close(props.discussion.id, !props.discussion.closed))}
          >
            <Octicon icon={props.discussion.closed ? issueReopenedIcon : discussionClosedIcon} />
            {props.discussion.closed ? 'Reopen discussion' : 'Close discussion'}
          </button>
        </Show>
      </div>
      <Dialog open={lockOpen()} onClose={() => setLockOpen(false)} title="Lock conversation on this discussion" width="480px">
        <ul class="list-disc pl-5 text-sm mb-4 space-y-1">
          <li>Other users can’t add new comments to this discussion.</li>
          <li>You and other collaborators with access to this repository can still leave comments that others can see.</li>
          <li>You can always unlock this discussion again in the future.</li>
        </ul>
        <label class="block text-sm font-semibold mb-1" for="lock-reason">
          Reason for locking
        </label>
        <select id="lock-reason" class="form-select w-full" value={reason()} onChange={(e) => setReason(e.currentTarget.value)}>
          <option value="">Choose a reason</option>
          <option value="OFF_TOPIC">Off-topic</option>
          <option value="TOO_HEATED">Too heated</option>
          <option value="RESOLVED">Resolved</option>
          <option value="SPAM">Spam</option>
        </select>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="btn" onClick={() => setLockOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-danger"
            disabled={busy()}
            onClick={() =>
              run(async () => {
                await lock(props.discussion.id, true, reason());
                setLockOpen(false);
              })
            }
          >
            Lock conversation
          </button>
        </div>
      </Dialog>
    </>
  );
}

/** "Answer selected by …" summary near the top that links to the answer comment. */
function AnswerJump(props: { id: string; comments: Comment[] }) {
  const answer = () => props.comments.find((c) => c.id === props.id);
  return (
    <Show when={answer()}>
      {(a) => (
        <a id="answer" class="flex items-center gap-2 rounded-md border border-line-success bg-success-muted px-4 py-2 text-sm link-plain" href={`#${commentAnchor(a())}`}>
          <Octicon icon={checkCircleFillIcon} class="text-fg-success" />
          <span>
            Answer selected — <strong>{a().author?.login ?? 'ghost'}</strong>’s comment
          </span>
          <span class="text-fg-muted truncate flex-1">{a().body.slice(0, 120)}</span>
        </a>
      )}
    </Show>
  );
}

function MoreComments(props: {
  discussion: Discussion;
  cursor: string;
  canComment: boolean;
  isLast: boolean;
  onMore: (cursor: string) => void;
}) {
  const ctx = useRepo();
  const page = createMemo(() => getDiscussionComments(ctx.owner(), ctx.name(), props.discussion.number, props.cursor));
  return (
    <>
      <For each={page().nodes}>
        {(c) => (
          <DiscussionComment
            comment={c}
            discussionId={props.discussion.id}
            opLogin={props.discussion.author?.login ?? null}
            answerable={props.discussion.category.isAnswerable}
            locked={props.discussion.locked}
            canComment={props.canComment}
          />
        )}
      </For>
      <Show when={props.isLast && page().pageInfo.hasNextPage}>
        <button type="button" class="btn btn-block" onClick={() => props.onMore(page().pageInfo.endCursor!)}>
          Load more comments
        </button>
      </Show>
    </>
  );
}

function NewComment(props: { discussion: Discussion; canComment: boolean }) {
  const ctx = useRepo();
  const add = useAction(addDiscussionComment);
  const [text, setText] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const submit = async () => {
    if (!text().trim()) return;
    setBusy(true);
    try {
      await add(props.discussion.id, text());
      setText('');
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Show
      when={props.canComment}
      fallback={
        <Blankslate icon={lockIcon} title="This conversation has been locked" class="Box mt-4">
          Comments are limited to collaborators.
        </Blankslate>
      }
    >
      <div class="mt-4">
        <MarkdownEditor
          value={text()}
          onInput={setText}
          repo={ctx.fullName()}
          placeholder={props.discussion.category.isAnswerable ? 'Write an answer' : 'Write a comment'}
          onSubmit={() => void submit()}
        />
        <div class="flex justify-end mt-2">
          <button type="button" class="btn btn-primary" disabled={busy() || !text().trim()} onClick={() => void submit()}>
            {busy() ? 'Commenting…' : props.discussion.category.isAnswerable ? 'Answer' : 'Comment'}
          </button>
        </div>
      </div>
    </Show>
  );
}

function Poll(props: { poll: NonNullable<Discussion['poll']> }) {
  const vote = useAction(voteOnPoll);
  const [busy, setBusy] = createSignal(false);
  const pct = (n: number) => (props.poll.totalVoteCount ? Math.round((n / props.poll.totalVoteCount) * 100) : 0);
  return (
    <div class="Box mt-4 p-4">
      <h3 class="font-semibold mb-3">{props.poll.question}</h3>
      <ul class="flex flex-col gap-2">
        <For each={props.poll.options.nodes}>
          {(o) => (
            <li>
              <Show
                when={props.poll.viewerHasVoted}
                fallback={
                  <button
                    type="button"
                    class="btn btn-sm w-full justify-start!"
                    disabled={busy()}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await vote(o.id);
                      } catch (e) {
                        toastError(e);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {o.option}
                  </button>
                }
              >
                <div class="flex justify-between text-sm mb-1">
                  <span>{o.option}</span>
                  <span class="text-fg-muted">{pct(o.totalVoteCount)}%</span>
                </div>
                <div class="h-2 rounded-full bg-canvas-muted overflow-hidden">
                  <div class="h-full bg-accent-emphasis" style={{ width: `${pct(o.totalVoteCount)}%` }} />
                </div>
              </Show>
            </li>
          )}
        </For>
      </ul>
      <p class="text-xs text-fg-muted mt-3">{pluralize(props.poll.totalVoteCount, 'vote')}</p>
    </div>
  );
}
