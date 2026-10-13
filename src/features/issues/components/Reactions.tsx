import { useAction } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dropdown, toastError } from '../../../components/ui';
import { smileyIcon } from '../../../icons/octicons';
import { feature, featureOption } from '../../refined';
import { toggleReaction } from '../api';
import { reactorsOf } from '../refined';
import type { ReactionContent, ReactionGroup } from '../types';

export const REACTIONS: { content: ReactionContent; emoji: string; label: string }[] = [
  { content: 'THUMBS_UP', emoji: '👍', label: '+1' },
  { content: 'THUMBS_DOWN', emoji: '👎', label: '-1' },
  { content: 'LAUGH', emoji: '😄', label: 'laugh' },
  { content: 'HOORAY', emoji: '🎉', label: 'hooray' },
  { content: 'CONFUSED', emoji: '😕', label: 'confused' },
  { content: 'HEART', emoji: '❤️', label: 'heart' },
  { content: 'ROCKET', emoji: '🚀', label: 'rocket' },
  { content: 'EYES', emoji: '👀', label: 'eyes' },
];

const emojiOf = (c: ReactionContent) => REACTIONS.find((r) => r.content === c)?.emoji ?? '';

/**
 * Reaction pills under a comment (count + whether the viewer reacted) and the
 * smiley picker. Toggling is optimistic: the pill updates at once and the
 * page data catches up when the action's revalidation lands.
 */
export function useReactions(props: { subjectId: string; groups: ReactionGroup[] | null }) {
  const run = useAction(toggleReaction);
  // Local overrides until fresh data arrives: content → viewerHasReacted.
  const [pending, setPending] = createSignal<Partial<Record<ReactionContent, boolean>>>({});
  const groups = () =>
    (props.groups ?? []).map((g) => {
      const override = pending()[g.content];
      if (override === undefined || override === g.viewerHasReacted) return g;
      return {
        ...g,
        viewerHasReacted: override,
        reactors: { totalCount: g.reactors.totalCount + (override ? 1 : -1) },
      };
    });
  const toggle = async (content: ReactionContent) => {
    const current = groups().find((g) => g.content === content)?.viewerHasReacted ?? false;
    setPending((p) => ({ ...p, [content]: !current }));
    try {
      await run(props.subjectId, content, !current);
    } catch (e) {
      toastError(e);
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[content];
        return next;
      });
    }
  };
  return { groups, toggle };
}

export function ReactionPicker(props: { onPick: (c: ReactionContent) => void; reacted: (c: ReactionContent) => boolean; class?: string }) {
  return (
    <Dropdown
      class={props.class ?? 'btn-octicon'}
      title="Add or remove reactions"
      align="right"
      menuClass="w-auto! min-w-0!"
      button={<Octicon icon={smileyIcon} />}
    >
      {(close) => (
        <div class="flex gap-1 px-2">
          <For each={REACTIONS}>
            {(r) => (
              <button
                type="button"
                class={['w-8 h-8 rounded-md text-base hover:bg-canvas-muted', { 'bg-accent-muted': props.reacted(r.content) }]}
                aria-label={r.label}
                title={r.label}
                onClick={() => {
                  close();
                  props.onPick(r.content);
                }}
              >
                {r.emoji}
              </button>
            )}
          </For>
        </div>
      )}
    </Dropdown>
  );
}

export type ReactionsState = ReturnType<typeof useReactions>;

/** The pills row; `state` comes from useReactions (shared with the header's smiley picker). */
export default function Reactions(props: { state: ReactionsState; canReact?: boolean; subjectId?: string }) {
  const visible = () => props.state.groups().filter((g) => g.reactors.totalCount > 0);
  // reactions-avatars: who reacted (one batched request for every comment on the page).
  const reactors = () => {
    if (!props.subjectId || !feature('reactions-avatars') || !visible().length) return null;
    return reactorsOf(`${props.subjectId}|${visible().map((g) => `${g.content}${g.reactors.totalCount}`).join()}`) ?? null;
  };
  const who = (g: ReactionGroup) => reactors()?.[g.content] ?? [];
  const maxAvatars = () => Math.max(1, Math.min(10, featureOption<number>('reactions-avatars', 'max') ?? 3));
  const tooltip = (g: ReactionGroup) => {
    const names = who(g).map((r) => r.login);
    if (!names.length) return undefined;
    const others = g.reactors.totalCount - names.length;
    const list = others > 0 ? `${names.join(', ')} and ${others} more` : names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
    return `${list} reacted with ${REACTIONS.find((r) => r.content === g.content)?.label ?? ''} emoji`;
  };
  return (
    <Show when={visible().length}>
      <div class="flex flex-wrap items-center gap-2 px-4 pb-4">
        <For each={visible()}>
          {(g) => (
            <button
              type="button"
              class={[
                'inline-flex items-center gap-1.5 h-7 px-2 rounded-full border text-xs font-medium',
                g.viewerHasReacted
                  ? 'bg-accent-muted border-line-accent text-fg-accent'
                  : 'border-line bg-canvas hover:bg-canvas-muted text-fg-muted',
              ]}
              disabled={props.canReact === false}
              aria-pressed={g.viewerHasReacted ? 'true' : 'false'}
              onClick={() => props.state.toggle(g.content)}
              title={tooltip(g)}
            >
              <span class="text-sm">{emojiOf(g.content)}</span>
              {g.reactors.totalCount}
              <Show when={who(g).length}>
                <span class="rgh-reactions-avatars inline-flex items-center ml-0.5">
                  <For each={who(g).slice(0, maxAvatars())}>
                    {(r) => <img class="avatar avatar-user w-4 h-4 -mr-1 last:mr-0 ring-1 ring-[var(--bgColor-default)]" src={`${r.avatarUrl}${r.avatarUrl.includes('?') ? '&' : '?'}s=32`} alt={`@${r.login}`} loading="lazy" />}
                  </For>
                </span>
              </Show>
            </button>
          )}
        </For>
        <Show when={props.canReact !== false}>
          <ReactionPicker
            class="btn-octicon w-7 h-7 rounded-full! border border-line"
            onPick={(c) => props.state.toggle(c)}
            reacted={(c) => !!props.state.groups().find((g) => g.content === c)?.viewerHasReacted}
          />
        </Show>
      </div>
    </Show>
  );
}
