import { For } from 'solid-js';
import Avatar from './Avatar';

export interface StackedAvatar {
  src?: string | null;
  login?: string | null;
  square?: boolean;
}

/**
 * Overlapping avatars (github.com's AvatarStack, e.g. co-authored commits).
 * Hovering the stack spreads the avatars apart so each one is visible; every
 * avatar keeps its own user hovercard. The stack stays in the text flow, so
 * whatever follows it ("3 people authored …") moves aside instead of being
 * covered.
 */
export default function AvatarStack(props: { avatars: StackedAvatar[]; size?: number; max?: number; class?: string }) {
  const items = () => props.avatars.slice(0, props.max ?? 3);
  return (
    <span
      class={['AvatarStack', { 'AvatarStack--multi': items().length > 1 }, props.class]}
      style={{ '--AvatarStack-size': `${props.size ?? 20}px` }}
    >
      <For each={items()}>
        {(a) => <Avatar src={a.src} login={a.login ?? undefined} size={props.size ?? 20} square={a.square} hovercard />}
      </For>
    </span>
  );
}
