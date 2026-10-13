import { createSignal, For, onSettled, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Markdown, MarkdownEditor, RelativeTime, toastError } from '../../../components/ui';
import { checkIcon, chevronDownIcon, chevronRightIcon, trashIcon } from '../../../icons/octicons';
import type { LineRef } from '../../diff/DiffView';
import type { ReviewThread } from '../pullApi';

/** A review conversation under a diff line: comments, reply box, resolve toggle. */
export function ThreadView(props: {
  thread: ReviewThread;
  repo: string;
  viewer?: string;
  onReply: (commentId: number, body: string) => Promise<void>;
  onResolve: (resolved: boolean) => Promise<void>;
  onDelete: (commentId: number) => Promise<void>;
}) {
  const [expanded, setExpanded] = createSignal(() => !props.thread.isResolved);
  const [replying, setReplying] = createSignal(false);
  const [reply, setReply] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const root = () => props.thread.comments[0];
  const range = () =>
    props.thread.startLine && props.thread.startLine !== props.thread.line
      ? `Comment on lines ${props.thread.diffSide === 'LEFT' ? '-' : '+'}${props.thread.startLine} to ${props.thread.diffSide === 'LEFT' ? '-' : '+'}${props.thread.line}`
      : null;

  const send = async () => {
    if (!reply().trim() || !root()) return;
    setBusy(true);
    try {
      await props.onReply(root()!.databaseId, reply().trim());
      setReply('');
      setReplying(false);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="Box m-2 max-w-[780px]">
      <Show when={props.thread.isResolved || range()}>
        <div class="Box-header py-2! px-3! flex items-center gap-2 text-xs">
          <Show when={props.thread.isResolved}>
            <button type="button" class="btn-link text-fg-muted flex items-center gap-1" onClick={() => setExpanded(!expanded())}>
              <Octicon icon={expanded() ? chevronDownIcon : chevronRightIcon} />
              This conversation was marked as resolved.
            </button>
          </Show>
          <Show when={range()}>
            <span class="text-fg-muted">{range()}</span>
          </Show>
        </div>
      </Show>
      <Show when={expanded()}>
        <For each={props.thread.comments}>
          {(c) => (
            <div class="px-3 py-2 border-b border-line-muted last:border-b-0">
              <div class="flex items-center gap-2 text-sm">
                <Avatar src={c.author?.avatarUrl} size={20} login={c.author?.login} />
                <a class="font-semibold link-plain" href={c.author ? `/${c.author.login}` : undefined}>
                  {c.author?.login ?? 'ghost'}
                </a>
                <a class="text-fg-muted text-xs link-muted" href={c.url.replace('https://github.com', '')}>
                  <RelativeTime datetime={c.createdAt} />
                </a>
                <Show when={c.state === 'PENDING'}>
                  <span class="Label Label--attention">Pending</span>
                </Show>
                <div class="flex-1" />
                <Show when={props.viewer && c.author?.login === props.viewer}>
                  <button
                    type="button"
                    class="btn-octicon btn-octicon-danger w-6 h-6"
                    aria-label="Delete comment"
                    title="Delete comment"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this comment?')) void props.onDelete(c.databaseId).catch(toastError);
                    }}
                  >
                    <Octicon icon={trashIcon} />
                  </button>
                </Show>
              </div>
              <div class="pl-7 mt-1">
                <Markdown html={c.bodyHTML} />
              </div>
            </div>
          )}
        </For>
        <div class="px-3 py-2 bg-canvas-muted rounded-b-md border-t border-line-muted">
          <Show
            when={replying()}
            fallback={
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="form-control form-control-sm flex-1 text-left text-fg-muted"
                  onClick={() => setReplying(true)}
                >
                  Reply...
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  disabled={busy()}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await props.onResolve(!props.thread.isResolved);
                    } catch (e) {
                      toastError(e);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {props.thread.isResolved ? 'Unresolve conversation' : 'Resolve conversation'}
                </button>
              </div>
            }
          >
            <div ref={(el) => queueMicrotask(() => el.querySelector('textarea')?.focus())}>
              <MarkdownEditor value={reply()} onInput={setReply} repo={props.repo} minHeight={80} onSubmit={() => void send()} />
            </div>
            <div class="flex justify-end gap-2 mt-2">
              <button type="button" class="btn btn-sm" onClick={() => setReplying(false)}>
                Cancel
              </button>
              <button type="button" class="btn btn-sm btn-primary" disabled={busy() || !reply().trim()} onClick={() => void send()}>
                {busy() ? 'Commenting…' : 'Comment'}
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

/** New comment form shown under a line after clicking its "+". */
export function DraftCommentForm(props: {
  draft: LineRef;
  repo: string;
  hasPendingReview: boolean;
  onCancel: () => void;
  onSubmit: (kind: 'single' | 'review', body: string) => Promise<void>;
}) {
  const [body, setBody] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const sign = () => (props.draft.side === 'LEFT' ? '-' : '+');
  let box!: HTMLDivElement;
  // `autofocus` only applies on page load; focus the new form explicitly.
  onSettled(() => box.querySelector('textarea')?.focus());
  const submit = async (kind: 'single' | 'review') => {
    if (!body().trim()) return;
    setBusy(true);
    try {
      await props.onSubmit(kind, body().trim());
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div ref={box} class="Box m-2 max-w-[780px] p-3">
      <Show when={props.draft.startLine}>
        <p class="text-xs text-fg-muted mb-2">
          Commenting on lines {sign()}
          {props.draft.startLine} to {sign()}
          {props.draft.line}
        </p>
      </Show>
      <MarkdownEditor
        value={body()}
        onInput={setBody}
        repo={props.repo}
        minHeight={80}
        autofocus
        placeholder="Leave a comment"
        onSubmit={() => void submit(props.hasPendingReview ? 'review' : 'single')}
      />
      <div class="flex flex-wrap justify-end gap-2 mt-2">
        <button type="button" class="btn btn-sm" onClick={() => props.onCancel()}>
          Cancel
        </button>
        <Show when={!props.hasPendingReview}>
          <button type="button" class="btn btn-sm" disabled={busy() || !body().trim()} onClick={() => void submit('single')}>
            Add single comment
          </button>
        </Show>
        <button type="button" class="btn btn-sm btn-primary" disabled={busy() || !body().trim()} onClick={() => void submit('review')}>
          <Show when={busy()}>
            <Octicon icon={checkIcon} />
          </Show>
          {props.hasPendingReview ? 'Add review comment' : 'Start a review'}
        </button>
      </div>
    </div>
  );
}
