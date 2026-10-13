import { useAction, useNavigate } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Dialog, Dropdown, Markdown, MarkdownEditor, RelativeTime, toast, toastError } from '../../../components/ui';
import { eyeClosedIcon, foldIcon, kebabHorizontalIcon, mentionIcon, pencilIcon, unfoldIcon } from '../../../icons/octicons';
import { feature } from '../../refined';
import { deleteComment, editComment, type CommentRef, type MinimizeReason, setCommentMinimized } from '../api';
import { commitAt, UserName } from '../refined';
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
/** Labels linkify-user-labels turns into links to the author's commits. */
const COMMITTER_LABELS = new Set(['MEMBER', 'COLLABORATOR', 'CONTRIBUTOR']);

const HIDE_REASONS: { value: MinimizeReason; label: string }[] = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'ABUSE', label: 'Abuse' },
  { value: 'OFF_TOPIC', label: 'Off topic' },
  { value: 'OUTDATED', label: 'Outdated' },
  { value: 'DUPLICATE', label: 'Duplicate' },
  { value: 'RESOLVED', label: 'Resolved' },
];

export const userHref = (login: string) => `/${login.replace(/\[bot\]$/, '')}`;
export const displayLogin = (a: { login: string } | null | undefined) => a?.login ?? 'ghost';

/** Quote a comment's markdown for a reply ("> line" per line). */
export const quoteText = (body: string) =>
  body
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n') + '\n\n';

/** First words of a comment as plain text (preview-hidden-comments). */
const preview = (body: string) =>
  body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, ' […] ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[image]')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^>.*$/gm, '')
    .replace(/[#*_`>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

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
  const [hideDialog, setHideDialog] = createSignal(false);
  const [hideReason, setHideReason] = createSignal<MinimizeReason>('OFF_TOPIC');
  const reactions = useReactions({
    get subjectId() {
      return props.comment.id;
    },
    get groups() {
      return props.comment.reactionGroups;
    },
  });
  const remove = useAction(deleteComment);
  const minimize = useAction(setCommentMinimized);
  const navigate = useNavigate();
  const author = () => displayLogin(props.comment.author);
  const edited = () => !!props.comment.lastEditedAt && !props.comment.includesCreatedEdit;
  const canDelete = () => !!props.comment.viewerCanDelete && props.commentRef.kind !== 'body' && props.commentRef.kind !== 'review';
  const canEdit = () => !!props.comment.viewerCanUpdate;

  const hide = async (reason: MinimizeReason | null) => {
    try {
      await minimize(props.comment.id, reason);
      setHideDialog(false);
    } catch (e) {
      toastError(e);
    }
  };
  const browseAtTime = async () => {
    try {
      const sha = await commitAt(props.commentRef.owner, props.commentRef.repo, props.comment.createdAt);
      if (sha) navigate(`/${props.commentRef.owner}/${props.commentRef.repo}/tree/${sha}`);
      else toast('No commits before this comment', 'info', 3000);
    } catch (e) {
      toastError(e);
    }
  };

  const associationLabel = () => {
    const label = ASSOCIATION[props.comment.authorAssociation];
    if (!label) return null;
    const href =
      feature('linkify-user-labels') && COMMITTER_LABELS.has(props.comment.authorAssociation) && props.comment.author
        ? `/${props.repo}/commits?author=${encodeURIComponent(props.comment.author.login)}`
        : undefined;
    return { label, href };
  };

  const header = () => (
    <div class={['timeline-comment-header group', { 'py-1! min-h-0! bg-canvas! border-0!': !!props.nested }]}>
      <Show when={props.nested}>
        <Avatar src={props.comment.author?.avatarUrl} login={author()} size={24} class="mr-1" />
      </Show>
      <div class="flex-1 min-w-0 truncate text-sm">
        <a class="link-plain font-semibold" href={userHref(author())}>
          {author()}
        </a>
        <UserName login={props.comment.author?.login} />{' '}
        <span class="text-fg-muted">
          {props.verb ?? 'commented'}{' '}
          <a class="link-muted" href={props.anchor ? `#${props.anchor}` : undefined}>
            <RelativeTime datetime={props.comment.createdAt} />
          </a>
          <Show when={edited()}>
            <span> · edited</span>
          </Show>
        </span>
        <Show when={feature('quick-mention') && props.onQuote && props.comment.author && !props.comment.viewerDidAuthor}>
          <button
            type="button"
            class="rgh-quick-mention btn-octicon w-6 h-6 ml-1 align-middle opacity-0 group-hover:opacity-100 focus:opacity-100"
            title={`Mention @${author()} in a new comment`}
            aria-label={`Mention @${author()} in a new comment`}
            onClick={() => props.onQuote?.(`@${author()} `)}
          >
            <Octicon icon={mentionIcon} />
          </button>
        </Show>
      </div>
      <Show when={props.issueAuthor && props.comment.author?.login === props.issueAuthor && props.commentRef.kind !== 'body'}>
        <span class="Label">Author</span>
      </Show>
      <Show when={associationLabel()}>
        {(a) => (
          <Show when={a().href} fallback={<span class="Label">{a().label}</span>}>
            <a class="Label hover:text-fg-accent! no-underline!" href={a().href} title={`${author()}’s commits in this repository`}>
              {a().label}
            </a>
          </Show>
        )}
      </Show>
      <Show when={feature('quick-comment-edit') && canEdit() && !editing()}>
        <button type="button" class="btn-octicon" title="Edit comment" aria-label="Edit comment" onClick={() => setEditing(true)}>
          <Octicon icon={pencilIcon} />
        </button>
      </Show>
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
            <Show when={feature('comments-time-machine-links')}>
              <button
                type="button"
                class="SelectMenu-item"
                title="Browse the repository like it appeared on this day"
                onClick={() => {
                  close();
                  void browseAtTime();
                }}
              >
                View repo at this time
              </button>
            </Show>
            <Show when={canEdit() || canDelete() || props.comment.viewerCanMinimize}>
              <hr class="SelectMenu-divider" />
            </Show>
            <Show when={canEdit()}>
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
            <Show when={props.comment.viewerCanMinimize}>
              <Show
                when={props.comment.isMinimized}
                fallback={
                  <Show
                    when={feature('quick-comment-hiding')}
                    fallback={
                      <button
                        type="button"
                        class="SelectMenu-item"
                        onClick={() => {
                          close();
                          setHideDialog(true);
                        }}
                      >
                        Hide
                      </button>
                    }
                  >
                    <div class="px-4 pt-1 pb-0.5 text-xs text-fg-muted">Hide as…</div>
                    <For each={HIDE_REASONS}>
                      {(r) => (
                        <button
                          type="button"
                          class="SelectMenu-item pl-7!"
                          onClick={() => {
                            close();
                            void hide(r.value);
                          }}
                        >
                          {r.label}
                        </button>
                      )}
                    </For>
                  </Show>
                }
              >
                <button
                  type="button"
                  class="SelectMenu-item"
                  onClick={() => {
                    close();
                    void hide(null);
                  }}
                >
                  Unhide
                </button>
              </Show>
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

  const minimizedReason = () => (props.comment.minimizedReason ?? 'hidden').toLowerCase().replace(/_/g, ' ');
  const easyToggle = () => feature('easy-toggle-hidden-comments');

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
          <div
            class={['rgh-minimized-comment flex items-center gap-2 px-4 py-2 text-sm text-fg-muted bg-canvas-muted rounded-md', { 'cursor-pointer': easyToggle() }]}
            onClick={(e) => {
              if (easyToggle() && !(e.target as HTMLElement).closest('button, a')) setShowMinimized(true);
            }}
          >
            <Octicon icon={eyeClosedIcon} class="shrink-0" />
            <span class="flex-1 min-w-0 truncate">
              This comment was marked as {minimizedReason()}.
              <Show when={feature('preview-hidden-comments') && preview(props.comment.body)}>
                {(text) => (
                  <span class="rgh-hidden-comment-preview ml-2 italic" title={text()}>
                    <span class="font-semibold not-italic">{author()}:</span> {text()}
                  </span>
                )}
              </Show>
            </span>
            <button type="button" class="btn-link text-sm rgh-show-minimized" onClick={() => setShowMinimized(true)}>
              <Octicon icon={unfoldIcon} /> Show comment
            </button>
          </div>
        }
      >
        <Show when={props.comment.isMinimized}>
          <div
            class={['flex items-center gap-2 px-4 py-1.5 text-xs text-fg-muted bg-canvas-muted border-b border-line', { 'cursor-pointer': easyToggle() }]}
            onClick={(e) => {
              if (easyToggle() && !(e.target as HTMLElement).closest('button, a')) setShowMinimized(false);
            }}
          >
            <span class="flex-1">This comment was marked as {minimizedReason()}.</span>
            <button type="button" class="btn-link text-xs rgh-hide-minimized" onClick={() => setShowMinimized(false)}>
              <Octicon icon={foldIcon} /> Hide comment
            </button>
          </div>
        </Show>
        {header()}
        <Show
          when={editing()}
          fallback={
            <>
              <div class={['timeline-comment-body', { 'pt-1! pl-12! pb-2!': !!props.nested }]}>
                <Show when={props.comment.body.trim()} fallback={<p class="text-fg-muted italic">No description provided.</p>}>
                  <Markdown html={props.comment.bodyHTML} comment={{ repo: props.repo, createdAt: props.comment.createdAt }} />
                </Show>
              </div>
              <div class={{ 'pl-8': !!props.nested }}>
                <Reactions state={reactions} canReact={props.canReact} subjectId={props.comment.id} />
              </div>
            </>
          }
        >
          <EditCommentForm
            body={props.comment.body}
            commentRef={props.commentRef}
            repo={props.repo}
            onDone={() => setEditing(false)}
            onDelete={
              feature('quick-review-comment-deletion') && props.commentRef.kind === 'review_comment' && canDelete() ? () => setConfirmDelete(true) : undefined
            }
          />
        </Show>
      </Show>
    </div>
  );

  return (
    <>
      <Show when={!props.nested} fallback={<div id={props.anchor} data-rgh-comment>{box()}</div>}>
        <div id={props.anchor} data-rgh-comment class="relative pl-14 pb-4 scroll-mt-20">
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
                setEditing(false);
              } catch (e) {
                toastError(e);
              }
            }}
          >
            Delete
          </button>
        </div>
      </Dialog>
      <Dialog open={hideDialog()} onClose={() => setHideDialog(false)} title="Hide comment" width="400px">
        <label class="form-label" for={`hide-reason-${props.comment.id}`}>
          Choose a reason for hiding this comment
        </label>
        <select
          id={`hide-reason-${props.comment.id}`}
          class="form-select w-full"
          value={hideReason()}
          onChange={(e) => setHideReason(e.currentTarget.value as MinimizeReason)}
        >
          <For each={HIDE_REASONS}>{(r) => <option value={r.value}>{r.label}</option>}</For>
        </select>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="btn" onClick={() => setHideDialog(false)}>
            Cancel
          </button>
          <button type="button" class="btn btn-primary" onClick={() => void hide(hideReason())}>
            Hide comment
          </button>
        </div>
      </Dialog>
    </>
  );
}

function EditCommentForm(props: { body: string; commentRef: CommentRef; repo: string; onDone: () => void; onDelete?: () => void }) {
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
        <Show when={props.onDelete}>
          <button type="button" class="btn btn-sm btn-danger rgh-quick-review-comment-deletion mr-auto" onClick={() => props.onDelete?.()}>
            Delete comment
          </button>
        </Show>
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
