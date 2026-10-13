import { useAction } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Dropdown, MarkdownEditor, toastError } from '../../../components/ui';
import {
  checkIcon,
  gitPullRequestClosedIcon,
  issueClosedIcon,
  issueReopenedIcon,
  lockIcon,
  skipIcon,
  triangleDownIcon,
} from '../../../icons/octicons';
import { addComment, type IssuePatch } from '../api';

/**
 * "Add a comment" box at the bottom of an issue / PR, with the state buttons
 * (Close as completed / not planned, Reopen; Close pull request).
 * The draft lives in the page so "Quote reply" can append to it.
 */
export default function CommentForm(props: {
  owner: string;
  repo: string;
  number: number;
  isPull: boolean;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  canChangeState: boolean;
  locked: boolean;
  canComment: boolean;
  viewerAvatar?: string;
  value: string;
  onInput: (v: string) => void;
}) {
  const comment = useAction(addComment);
  const [busy, setBusy] = createSignal(false);
  const [reason, setReason] = createSignal<'completed' | 'not_planned'>('completed');

  const submit = async (state?: IssuePatch) => {
    if (!state && !props.value.trim()) return;
    setBusy(true);
    try {
      await comment(props.owner, props.repo, props.number, props.value, state);
      props.onInput('');
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  const close = () => submit(props.isPull ? { state: 'closed' } : { state: 'closed', state_reason: reason() });
  const reopen = () => submit(props.isPull ? { state: 'open' } : { state: 'open', state_reason: 'reopened' });
  const withComment = () => !!props.value.trim();

  return (
    <Show
      when={props.canComment}
      fallback={
        <div class="flex items-center gap-2 p-4 rounded-md border border-line bg-canvas-muted text-sm">
          <Octicon icon={lockIcon} class="text-fg-muted" />
          This conversation has been locked and limited to collaborators.
        </div>
      }
    >
      <div class="relative pl-14" id="new-comment">
        <Avatar src={props.viewerAvatar} size={40} class="absolute left-0 top-0" />
        <div class="timeline-comment timeline-comment--caret p-2">
          <h2 class="sr-only">Add a comment</h2>
          <Show when={props.locked}>
            <div class="flash flash-warn mb-2 text-sm">
              <Octicon icon={lockIcon} /> This conversation has been locked. You can comment because you are a collaborator.
            </div>
          </Show>
          <MarkdownEditor
            value={props.value}
            onInput={props.onInput}
            repo={`${props.owner}/${props.repo}`}
            placeholder="Use Markdown to format your comment"
            onSubmit={() => void submit()}
            disabled={busy()}
          />
          <div class="flex flex-wrap items-center justify-end gap-2 mt-2">
            <Show when={props.canChangeState && props.state !== 'MERGED'}>
              <Show
                when={props.state === 'OPEN'}
                fallback={
                  <button type="button" class="btn" disabled={busy()} onClick={reopen}>
                    <Octicon icon={issueReopenedIcon} class="text-fg-success!" />
                    {props.isPull ? 'Reopen pull request' : withComment() ? 'Reopen with comment' : 'Reopen issue'}
                  </button>
                }
              >
                <Show
                  when={!props.isPull}
                  fallback={
                    <button type="button" class="btn" disabled={busy()} onClick={close}>
                      <Octicon icon={gitPullRequestClosedIcon} class="text-fg-closed!" />
                      {withComment() ? 'Close with comment' : 'Close pull request'}
                    </button>
                  }
                >
                  <div class="BtnGroup">
                    <button type="button" class="btn" disabled={busy()} onClick={close}>
                      <Octicon
                        icon={reason() === 'completed' ? issueClosedIcon : skipIcon}
                        class={reason() === 'completed' ? 'text-fg-done!' : 'text-fg-muted!'}
                      />
                      {withComment() ? 'Close with comment' : reason() === 'completed' ? 'Close issue' : 'Close as not planned'}
                    </button>
                    <Dropdown class="btn px-2!" align="right" menuClass="w-80" title="Choose a reason for closing" button={<Octicon icon={triangleDownIcon} />}>
                      {(closeMenu) => (
                        <>
                          <ReasonItem
                            selected={reason() === 'completed'}
                            icon={issueClosedIcon}
                            iconClass="text-fg-done!"
                            title="Close as completed"
                            desc="Done, closed, fixed, resolved"
                            onClick={() => {
                              setReason('completed');
                              closeMenu();
                            }}
                          />
                          <ReasonItem
                            selected={reason() === 'not_planned'}
                            icon={skipIcon}
                            iconClass="text-fg-muted!"
                            title="Close as not planned"
                            desc="Won’t fix, can’t repro, stale"
                            onClick={() => {
                              setReason('not_planned');
                              closeMenu();
                            }}
                          />
                        </>
                      )}
                    </Dropdown>
                  </div>
                </Show>
              </Show>
            </Show>
            <button type="button" class="btn btn-primary" disabled={busy() || !withComment()} onClick={() => void submit()}>
              Comment
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

function ReasonItem(props: {
  selected: boolean;
  icon: typeof checkIcon;
  iconClass: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button type="button" class="SelectMenu-item items-start!" onClick={() => props.onClick()}>
      <span class="w-4 mt-0.5">
        <Show when={props.selected}>
          <Octicon icon={checkIcon} />
        </Show>
      </span>
      <Octicon icon={props.icon} class={`mt-0.5 ${props.iconClass}`} />
      <span>
        <span class="block font-semibold">{props.title}</span>
        <span class="block text-xs text-fg-muted font-normal">{props.desc}</span>
      </span>
    </button>
  );
}
