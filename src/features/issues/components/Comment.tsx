import { useAction } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Dialog, Dropdown, Markdown, MarkdownEditor, RelativeTime, toast, toastError } from '../../../components/ui';
import { kebabHorizontalIcon } from '../../../icons/octicons';
import { deleteComment, editComment, type CommentRef } from '../api';
import type { GqlComment } from '../types';
import Reactions, { ReactionPicker, useReactions } from './Reactions';

const ASSOCIATION: Record<string, string> = {
  OWNER: 'Owner',
  MEMBER: 'Member',
  COLLABORATOR: 'Collaborator',
  CONTRIBUTOR: 'Contributor',
  FIRST_TIME_CONTRIBUTOR: 'First-time contributor',
  FIRST_TIMER: 'First-time contributor',
};

export const userHref = (login: string) => `/${login.replace(/\[bot\]$/, '')}`;
export const displayLogin = (a: { login: string } | null | undefined) => a?.login ?? 'ghost';

/** Quote a comment's markdown for a reply ("> line" per line). */
export const quoteText = (body: string) =>
  body
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n') + '\n\n';

export interface CommentProps {
  comment: GqlComment;
  commentRef: CommentRef;
  /** "owner/name" — for the markdown preview context. */
  repo: string;
  /** Login of the issue / PR author (adds the "Author" label). */
  issueAuthor?: string;
  verb?: string;
  /** Element id / link fragment, e.g. issuecomment-123. */
  anchor?: string;
  canReact?: boolean;
  onQuote?: (text: string) => void;
  /** Inside a review thread: no outer avatar / caret, compact. */
  nested?: boolean;
  /** Highlight as the author's comment (blue header). */
  highlight?: boolean;
}

/** A comment box: header (author, time, labels, menu), rendered body, reactions; inline editing. */
export default function Comment(props: CommentProps) {
  const [editing, setEditing] = createSignal(false);
  const [confirmDelete, setConfirmDelete] = createSignal(false);
  const [showMinimized, setShowMinimized] = createSignal(false);
  const reactions = useReactions({
    get subjectId() {
      return props.comment.id;
    },
    get groups() {
      return props.comment.reactionGroups;
    },
  });
  const remove = useAction(deleteComment);
  const author = () => displayLogin(props.comment.author);
  const edited = () => !!props.comment.lastEditedAt && !props.comment.includesCreatedEdit;
  const canDelete = () => !!props.comment.viewerCanDelete && props.commentRef.kind !== 'body' && props.commentRef.kind !== 'review';

  const header = () => (
    <div class={['timeline-comment-header', { 'py-1! min-h-0! bg-canvas! border-0!': !!props.nested }]}>
      <Show when={props.nested}>
        <Avatar src={props.comment.author?.avatarUrl} login={author()} size={24} class="mr-1" />
      </Show>
      <div class="flex-1 min-w-0 truncate text-sm">
        <a class="link-plain font-semibold" href={userHref(author())}>
          {author()}
        </a>{' '}
        <span class="text-fg-muted">
          {props.verb ?? 'commented'}{' '}
          <a class="link-muted" href={props.anchor ? `#${props.anchor}` : undefined}>
            <RelativeTime datetime={props.comment.createdAt} />
          </a>
          <Show when={edited()}>
            <span> · edited</span>
          </Show>
        </span>
      </div>
      <Show when={props.issueAuthor && props.comment.author?.login === props.issueAuthor && props.commentRef.kind !== 'body'}>
        <span class="Label">Author</span>
      </Show>
      <Show when={ASSOCIATION[props.comment.authorAssociation]}>{(label) => <span class="Label">{label()}</span>}</Show>
      <Show when={props.canReact !== false && !props.nested}>
        <ReactionPicker
          onPick={(c) => reactions.toggle(c)}
          reacted={(c) => !!reactions.groups().find((g) => g.content === c)?.viewerHasReacted}
        />
      </Show>
      <Dropdown class="btn-octicon" align="right" title="Show options" button={<Octicon icon={kebabHorizontalIcon} />}>
        {(close) => (
          <>
            <button
              type="button"
              class="SelectMenu-item"
              onClick={() => {
                close();
                const url = new URL(location.href);
                url.hash = props.anchor ?? '';
                void navigator.clipboard.writeText(url.toString()).then(() => toast('Link copied', 'success', 2000));
              }}
            >
              Copy link
            </button>
            <Show when={props.onQuote}>
              <button
                type="button"
                class="SelectMenu-item"
                onClick={() => {
                  close();
                  props.onQuote?.(quoteText(props.comment.body));
                }}
              >
                Quote reply
              </button>
            </Show>
            <Show when={props.comment.viewerCanUpdate || canDelete()}>
              <hr class="SelectMenu-divider" />
            </Show>
            <Show when={props.comment.viewerCanUpdate}>
              <button
                type="button"
                class="SelectMenu-item"
                onClick={() => {
                  close();
                  setEditing(true);
                }}
              >
                Edit
              </button>
            </Show>
            <Show when={canDelete()}>
              <button
                type="button"
                class="SelectMenu-item danger"
                onClick={() => {
                  close();
                  setConfirmDelete(true);
                }}
              >
                Delete
              </button>
            </Show>
          </>
        )}
      </Dropdown>
    </div>
  );

  const box = () => (
    <div
      class={[
        'timeline-comment',
        {
          'timeline-comment--caret': !props.nested,
          'timeline-comment--author': !!props.highlight && !props.nested,
          'border-0! rounded-none!': !!props.nested,
        },
      ]}
    >
      <Show
        when={!props.comment.isMinimized || showMinimized()}
        fallback={
          <div class="flex items-center gap-2 px-4 py-2 text-sm text-fg-muted bg-canvas-muted rounded-md">
            <span class="flex-1">
              This comment was marked as {(props.comment.minimizedReason ?? 'hidden').toLowerCase().replace(/_/g, ' ')}.
            </span>
            <button type="button" class="btn-link text-sm" onClick={() => setShowMinimized(true)}>
              Show comment
            </button>
          </div>
        }
      >
        {header()}
        <Show
          when={editing()}
          fallback={
            <>
              <div class={['timeline-comment-body', { 'pt-1! pl-12! pb-2!': !!props.nested }]}>
                <Show when={props.comment.body.trim()} fallback={<p class="text-fg-muted italic">No description provided.</p>}>
                  <Markdown html={props.comment.bodyHTML} />
                </Show>
              </div>
              <div class={{ 'pl-8': !!props.nested }}>
                <Reactions state={reactions} canReact={props.canReact} />
              </div>
            </>
          }
        >
          <EditCommentForm
            body={props.comment.body}
            commentRef={props.commentRef}
            repo={props.repo}
            onDone={() => setEditing(false)}
          />
        </Show>
      </Show>
    </div>
  );

  return (
    <>
      <Show when={!props.nested} fallback={<div id={props.anchor}>{box()}</div>}>
        <div id={props.anchor} class="relative pl-14 pb-4 scroll-mt-20">
          <a href={userHref(author())} class="absolute left-0 top-0">
            <Avatar src={props.comment.author?.avatarUrl} login={author()} size={40} />
          </a>
          {box()}
        </div>
      </Show>
      <Dialog open={confirmDelete()} onClose={() => setConfirmDelete(false)} title="Delete comment" width="440px">
        <p>Are you sure you want to delete this comment?</p>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="btn" onClick={() => setConfirmDelete(false)}>
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-danger"
            onClick={async () => {
              setConfirmDelete(false);
              try {
                await remove(props.commentRef);
              } catch (e) {
                toastError(e);
              }
            }}
          >
            Delete
          </button>
        </div>
      </Dialog>
    </>
  );
}

function EditCommentForm(props: { body: string; commentRef: CommentRef; repo: string; onDone: () => void }) {
  const [text, setText] = createSignal(() => props.body);
  const [busy, setBusy] = createSignal(false);
  const save = useAction(editComment);
  const submit = async () => {
    setBusy(true);
    try {
      await save(props.commentRef, text());
      props.onDone();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class="p-2">
      <MarkdownEditor value={text()} onInput={setText} repo={props.repo} onSubmit={submit} autofocus />
      <div class="flex justify-end gap-2 mt-2">
        <button type="button" class="btn btn-sm" onClick={() => props.onDone()}>
          Cancel
        </button>
        <button type="button" class="btn btn-sm btn-primary" disabled={busy()} onClick={submit}>
          {busy() ? 'Updating…' : 'Update comment'}
        </button>
      </div>
    </div>
  );
}
