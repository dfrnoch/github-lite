import { useAction } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dropdown, toastError } from '../../../components/ui';
import { arrowUpIcon, smileyIcon } from '../../../icons/octicons';
import { type ReactionContent, type ReactionGroup, setUpvote, toggleReaction } from '../api';

export const REACTION_EMOJI: Record<ReactionContent, string> = {
  THUMBS_UP: '👍',
  THUMBS_DOWN: '👎',
  LAUGH: '😄',
  HOORAY: '🎉',
  CONFUSED: '😕',
  HEART: '❤️',
  ROCKET: '🚀',
  EYES: '👀',
};
const ORDER = Object.keys(REACTION_EMOJI) as ReactionContent[];

/** Reaction pills + the smiley picker under a discussion or comment. */
export default function Reactions(props: { subjectId: string; groups: ReactionGroup[]; canReact: boolean }) {
  const react = useAction(toggleReaction);
  const [busy, setBusy] = createSignal(false);
  const used = () => props.groups.filter((g) => g.users.totalCount > 0);
  const has = (c: ReactionContent) => props.groups.find((g) => g.content === c)?.viewerHasReacted ?? false;
  const toggle = async (content: ReactionContent) => {
    if (!props.canReact || busy()) return;
    setBusy(true);
    try {
      await react(props.subjectId, content, !has(content));
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class="flex flex-wrap items-center gap-1">
      <Show when={props.canReact}>
        <Dropdown
          class="btn-octicon w-7! h-7! rounded-full! border border-line"
          title="Add or remove reactions"
          menuClass="w-auto! min-w-0!"
          button={<Octicon icon={smileyIcon} />}
        >
          {(close) => (
            <div class="flex gap-1 px-2 py-1">
              <For each={ORDER}>
                {(c) => (
                  <button
                    type="button"
                    class={['w-8 h-8 rounded-md text-base hover:bg-canvas-muted', { 'bg-accent-muted': has(c) }]}
                    aria-label={c.toLowerCase().replace('_', ' ')}
                    onClick={() => {
                      close();
                      void toggle(c);
                    }}
                  >
                    {REACTION_EMOJI[c]}
                  </button>
                )}
              </For>
            </div>
          )}
        </Dropdown>
      </Show>
      <For each={used()}>
        {(g) => (
          <button
            type="button"
            class={[
              'inline-flex items-center gap-1 h-7 px-2 rounded-full border text-xs',
              g.viewerHasReacted ? 'bg-accent-muted border-line-accent text-fg-accent' : 'border-line text-fg-muted',
            ]}
            disabled={!props.canReact}
            onClick={() => void toggle(g.content)}
          >
            <span>{REACTION_EMOJI[g.content]}</span>
            <span class="font-semibold">{g.users.totalCount}</span>
          </button>
        )}
      </For>
    </div>
  );
}

/** "↑ 12" upvote toggle (discussions and their comments). */
export function UpvoteButton(props: {
  subjectId: string;
  count: number;
  upvoted: boolean;
  canUpvote: boolean;
  vertical?: boolean;
}) {
  const vote = useAction(setUpvote);
  const [busy, setBusy] = createSignal(false);
  return (
    <button
      type="button"
      class={[
        'inline-flex items-center justify-center gap-1 rounded-md border text-xs font-semibold',
        props.vertical ? 'flex-col w-10 py-1' : 'h-7 px-2',
        props.upvoted ? 'bg-accent-muted border-line-accent text-fg-accent' : 'border-line text-fg bg-canvas hover:bg-canvas-muted',
      ]}
      aria-pressed={props.upvoted ? 'true' : 'false'}
      aria-label={`Upvote: ${props.count}`}
      title={props.canUpvote ? (props.upvoted ? 'Remove upvote' : 'Upvote') : 'You cannot upvote this'}
      disabled={!props.canUpvote || busy()}
      onClick={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await vote(props.subjectId, !props.upvoted);
        } catch (err) {
          toastError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Octicon icon={arrowUpIcon} />
      <span>{props.count}</span>
    </button>
  );
}
