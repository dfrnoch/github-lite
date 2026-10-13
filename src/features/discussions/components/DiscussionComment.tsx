import { useAction } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Dropdown, Markdown, MarkdownEditor, RelativeTime, toast, toastError } from '../../../components/ui';
import { checkCircleFillIcon, checkCircleIcon, kebabHorizontalIcon, linkIcon, pencilIcon, trashIcon } from '../../../icons/octicons';
import { useRepo } from '../../repo/context';
import {
  addDiscussionComment,
  type DiscussionComment as Comment,
  deleteDiscussionComment,
  setAnswer,
  updateDiscussionComment,
} from '../api';
import Reactions, { UpvoteButton } from './Reactions';

const ASSOCIATION: Record<string, string> = {
  OWNER: 'Owner',
  MEMBER: 'Member',
  COLLABORATOR: 'Collaborator',
  CONTRIBUTOR: 'Contributor',
  FIRST_TIME_CONTRIBUTOR: 'First-time contributor',
};

export const commentAnchor = (c: { databaseId: number }) => `discussioncomment-${c.databaseId}`;

/** Author line shared by posts, comments and replies. */
export function AuthorLine(props: {
  author: { login: string; avatarUrl: string } | null;
  association?: string;
  createdAt: string;
  edited: boolean;
  href: string;
  avatarSize?: number;
  isOp?: boolean;
}) {
  return (
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 text-sm">
      <Avatar src={props.author?.avatarUrl} login={props.author?.login} size={props.avatarSize ?? 24} />
      <a class="font-semibold link-plain" href={`/${props.author?.login ?? 'ghost'}`}>
        {props.author?.login ?? 'ghost'}
      </a>
      <Show when={props.association && ASSOCIATION[props.association]}>
        <span class="Label">{ASSOCIATION[props.association!]}</span>
      </Show>
      <Show when={props.isOp}>
        <span class="Label">Author</span>
      </Show>
      <a class="link-muted text-fg-muted" href={props.href}>
        <RelativeTime datetime={props.createdAt} />
      </a>
      <Show when={props.edited}>
        <span class="text-fg-muted text-xs">· edited</span>
      </Show>
    </div>
  );
}

/** Kebab menu: copy link, edit, delete. */
function CommentMenu(props: { comment: Comment; onEdit: () => void }) {
  const remove = useAction(deleteDiscussionComment);
  return (
    <Dropdown class="btn-octicon" align="right" menuClass="w-[200px]" title="Comment actions" button={<Octicon icon={kebabHorizontalIcon} />}>
      {(close) => (
        <>
          <button
            type="button"
            class="SelectMenu-item"
            onClick={() => {
              close();
              void navigator.clipboard.writeText(`${location.origin}${location.pathname}#${commentAnchor(props.comment)}`);
              toast('Link copied.', 'success', 2000);
            }}
          >
            <Octicon icon={linkIcon} />
            Copy link
          </button>
          <Show when={props.comment.viewerCanUpdate}>
            <button type="button" class="SelectMenu-item" onClick={() => (close(), props.onEdit())}>
              <Octicon icon={pencilIcon} />
              Edit
            </button>
          </Show>
          <Show when={props.comment.viewerCanDelete}>
            <hr class="SelectMenu-divider" />
            <button
              type="button"
              class="SelectMenu-item danger"
              onClick={async () => {
                close();
                if (!confirm('Are you sure you want to delete this comment?')) return;
                try {
                  await remove(props.comment.id);
                } catch (e) {
                  toastError(e);
                }
              }}
            >
              <Octicon icon={trashIcon} />
              Delete
            </button>
          </Show>
        </>
      )}
    </Dropdown>
  );
}

/** Body that turns into an editor while editing. */
function EditableBody(props: { comment: Comment; editing: boolean; onDone: () => void }) {
  const ctx = useRepo();
  const save = useAction(updateDiscussionComment);
  const [text, setText] = createSignal(() => props.comment.body);
  const [busy, setBusy] = createSignal(false);
  const submit = async () => {
    setBusy(true);
    try {
      await save(props.comment.id, text());
      props.onDone();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Show when={props.editing} fallback={<Markdown html={props.comment.bodyHTML} class="text-sm" />}>
      <MarkdownEditor value={text()} onInput={setText} repo={ctx.fullName()} onSubmit={() => void submit()} />
      <div class="flex justify-end gap-2 mt-2">
        <button type="button" class="btn btn-sm" onClick={() => props.onDone()}>
          Cancel
        </button>
        <button type="button" class="btn btn-sm btn-primary" disabled={busy() || !text().trim()} onClick={() => void submit()}>
          Update comment
        </button>
      </div>
    </Show>
  );
}

/** A top-level discussion comment with its replies and reply box. */
export default function DiscussionComment(props: {
  comment: Comment;
  discussionId: string;
  opLogin: string | null;
  answerable: boolean;
  locked: boolean;
  canComment: boolean;
}) {
  const [editing, setEditing] = createSignal(false);
  const mark = useAction(setAnswer);
  const [marking, setMarking] = createSignal(false);
  const toggleAnswer = async () => {
    setMarking(true);
    try {
      await mark(props.comment.id, !props.comment.isAnswer);
    } catch (e) {
      toastError(e);
    } finally {
      setMarking(false);
    }
  };
  const anchor = () => commentAnchor(props.comment);

  return (
    <div
      id={anchor()}
      class={['rounded-md border bg-canvas', props.comment.isAnswer ? 'border-line-success border-2' : 'border-line']}
    >
      <Show when={props.comment.isAnswer}>
        <div class="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-fg-success border-b border-line-success-muted bg-success-muted rounded-t-md">
          <Octicon icon={checkCircleFillIcon} />
          Marked as answer
        </div>
      </Show>
      <Show
        when={!props.comment.isMinimized}
        fallback={
          <div class="px-4 py-3 text-sm text-fg-muted italic">
            This comment has been minimized{props.comment.minimizedReason ? ` (${props.comment.minimizedReason.toLowerCase().replace('_', ' ')})` : ''}.
          </div>
        }
      >
        <div class="flex gap-3 p-4">
          <div class="shrink-0">
            <UpvoteButton
              vertical
              subjectId={props.comment.id}
              count={props.comment.upvoteCount}
              upvoted={props.comment.viewerHasUpvoted}
              canUpvote={props.comment.viewerCanUpvote}
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start gap-2 mb-2">
              <div class="flex-1 min-w-0">
                <AuthorLine
                  author={props.comment.author}
                  association={props.comment.authorAssociation}
                  createdAt={props.comment.createdAt}
                  edited={!!props.comment.lastEditedAt}
                  href={`#${anchor()}`}
                  isOp={!!props.opLogin && props.comment.author?.login === props.opLogin}
                />
              </div>
              <CommentMenu comment={props.comment} onEdit={() => setEditing(true)} />
            </div>
            <EditableBody comment={props.comment} editing={editing()} onDone={() => setEditing(false)} />
            <div class="flex flex-wrap items-center gap-2 mt-3">
              <Reactions subjectId={props.comment.id} groups={props.comment.reactionGroups} canReact={props.comment.viewerCanReact} />
              <div class="flex-1" />
              <Show when={props.answerable && (props.comment.viewerCanMarkAsAnswer || props.comment.viewerCanUnmarkAsAnswer)}>
                <button type="button" class="btn btn-sm" disabled={marking()} onClick={() => void toggleAnswer()}>
                  <Octicon icon={props.comment.isAnswer ? checkCircleFillIcon : checkCircleIcon} class={props.comment.isAnswer ? 'text-fg-success' : undefined} />
                  {props.comment.isAnswer ? 'Unmark as answer' : 'Mark as answer'}
                </button>
              </Show>
            </div>
          </div>
        </div>
      </Show>
      <Replies
        replies={props.comment.replies?.nodes ?? []}
        total={props.comment.replies?.totalCount ?? 0}
        discussionId={props.discussionId}
        replyToId={props.comment.id}
        opLogin={props.opLogin}
        canReply={props.canComment && !props.locked}
      />
    </div>
  );
}

function Replies(props: {
  replies: Comment[];
  total: number;
  discussionId: string;
  replyToId: string;
  opLogin: string | null;
  canReply: boolean;
}) {
  const ctx = useRepo();
  const [open, setOpen] = createSignal(false);
  const [text, setText] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const add = useAction(addDiscussionComment);
  const submit = async () => {
    if (!text().trim()) return;
    setBusy(true);
    try {
      await add(props.discussionId, text(), props.replyToId);
      setText('');
      setOpen(false);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Show when={props.replies.length || props.canReply}>
      <div class="border-t border-line-muted bg-canvas-muted rounded-b-md">
        <Show when={props.replies.length}>
          <div class="px-4 pt-3 text-xs text-fg-muted font-semibold">
            {props.total} {props.total === 1 ? 'reply' : 'replies'}
          </div>
        </Show>
        <For each={props.replies}>{(r) => <Reply reply={r} opLogin={props.opLogin} />}</For>
        <Show when={props.total > props.replies.length}>
          <div class="px-4 py-2 text-xs text-fg-muted">{props.total - props.replies.length} more replies are only shown on github.com.</div>
        </Show>
        <Show when={props.canReply}>
          <div class="p-3">
            <Show
              when={open()}
              fallback={
                <button type="button" class="form-control w-full text-left text-fg-muted bg-canvas" onClick={() => setOpen(true)}>
                  Write a reply
                </button>
              }
            >
              <MarkdownEditor value={text()} onInput={setText} repo={ctx.fullName()} placeholder="Write a reply" autofocus minHeight={80} onSubmit={() => void submit()} />
              <div class="flex justify-end gap-2 mt-2">
                <button type="button" class="btn btn-sm" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="button" class="btn btn-sm btn-primary" disabled={busy() || !text().trim()} onClick={() => void submit()}>
                  {busy() ? 'Replying…' : 'Reply'}
                </button>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
}

function Reply(props: { reply: Comment; opLogin: string | null }) {
  const [editing, setEditing] = createSignal(false);
  const anchor = () => commentAnchor(props.reply);
  return (
    <div id={anchor()} class="flex gap-3 px-4 py-3 border-b border-line-muted last:border-b-0">
      <Show
        when={!props.reply.isMinimized}
        fallback={<div class="text-sm text-fg-muted italic">This reply has been minimized.</div>}
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-start gap-2 mb-1">
            <div class="flex-1 min-w-0">
              <AuthorLine
                author={props.reply.author}
                association={props.reply.authorAssociation}
                createdAt={props.reply.createdAt}
                edited={!!props.reply.lastEditedAt}
                href={`#${anchor()}`}
                avatarSize={20}
                isOp={!!props.opLogin && props.reply.author?.login === props.opLogin}
              />
            </div>
            <CommentMenu comment={props.reply} onEdit={() => setEditing(true)} />
          </div>
          <div class="pl-7">
            <EditableBody comment={props.reply} editing={editing()} onDone={() => setEditing(false)} />
            <div class="flex flex-wrap items-center gap-2 mt-2">
              <Reactions subjectId={props.reply.id} groups={props.reply.reactionGroups} canReact={props.reply.viewerCanReact} />
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
