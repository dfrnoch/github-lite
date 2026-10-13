import { For, Show } from 'solid-js';
import { arrowLeftIcon, commentIcon, personIcon } from '../../icons/octicons';
import { formatDate } from '../../lib/format';
import Octicon from '../Octicon';
import Avatar from '../ui/Avatar';
import IssueLabel from '../ui/IssueLabel';
import StateIcon, { itemState } from '../ui/StateIcon';
import type { IssueHovercardData } from './api';

const REVIEW: Record<string, { text: string; cls: string }> = {
  APPROVED: { text: 'Approved', cls: 'text-fg-success' },
  CHANGES_REQUESTED: { text: 'Changes requested', cls: 'text-fg-danger' },
  REVIEW_REQUIRED: { text: 'Review required', cls: 'text-fg-attention' },
};

/** github.com's issue / pull request hovercard: repo, state, title, excerpt, labels, context. */
export default function IssueHovercard(props: { data: IssueHovercardData }) {
  const d = () => props.data;
  const href = () => `/${d().repo}/${d().kind === 'pull' ? 'pull' : 'issues'}/${d().number}`;
  const state = () =>
    itemState({
      isPull: d().kind === 'pull',
      state: d().state,
      stateReason: d().stateReason,
      merged: d().state === 'MERGED',
      draft: d().draft,
    });
  const noun = () => (d().kind === 'pull' ? 'pull request' : 'issue');

  return (
    <div class="p-4 flex flex-col gap-2 text-sm">
      <div class="flex items-center gap-1.5 text-xs text-fg-muted min-w-0">
        <Avatar src={d().ownerAvatar} size={16} square />
        <a class="link-muted truncate" href={`/${d().repo}`}>
          {d().repo}
        </a>
        <span class="shrink-0">on {formatDate(d().createdAt)}</span>
      </div>

      <div class="flex gap-2">
        <StateIcon state={state()} class="mt-0.5 shrink-0" />
        <div class="min-w-0">
          <a class="link-plain font-semibold text-base leading-snug break-words" href={href()}>
            {d().title}
          </a>{' '}
          <span class="text-fg-muted text-base">#{d().number}</span>
        </div>
      </div>

      <Show when={d().body}>
        <p class="text-fg-muted line-clamp-2 break-words pl-6">{d().body}</p>
      </Show>

      <Show when={d().kind === 'pull' && d().baseRef}>
        <div class="flex items-center gap-1 pl-6 text-xs font-mono text-fg-muted min-w-0">
          <span class="px-1.5 rounded-md bg-accent-muted text-fg-accent truncate shrink-0 max-w-[45%]">{d().baseRef}</span>
          <Octicon icon={arrowLeftIcon} size={12} class="shrink-0" />
          <span class="px-1.5 rounded-md bg-accent-muted text-fg-accent truncate min-w-0">{d().headRef}</span>
        </div>
      </Show>

      <Show when={d().labels.length}>
        <div class="flex flex-wrap gap-1 pl-6">
          <For each={d().labels}>{(l) => <IssueLabel name={l.name} color={l.color} />}</For>
        </div>
      </Show>

      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 pt-1 text-xs text-fg-muted">
        <Show when={d().author}>
          {(a) => (
            <span class="flex items-center gap-1">
              <Avatar src={a().avatarUrl} size={16} />
              <span>
                {d().viewerDidAuthor ? 'You' : a().login} opened this {noun()}
              </span>
            </span>
          )}
        </Show>
        <Show when={!d().author && d().viewerDidAuthor}>
          <span class="flex items-center gap-1">
            <Octicon icon={personIcon} size={12} /> You opened this {noun()}
          </span>
        </Show>
        <Show when={d().comments}>
          <span class="flex items-center gap-1">
            <Octicon icon={commentIcon} size={12} /> {d().comments}
          </span>
        </Show>
        <Show when={d().kind === 'pull' && d().state === 'OPEN' && d().reviewDecision && REVIEW[d().reviewDecision!]}>
          {(r) => <span class={r().cls}>{r().text}</span>}
        </Show>
      </div>
    </div>
  );
}
