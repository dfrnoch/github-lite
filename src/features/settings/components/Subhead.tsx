import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';

/** GitHub settings section heading: large title over a bottom border, optional actions on the right. */
export default function Subhead(props: {
  title: JSX.Element;
  actions?: JSX.Element;
  /** Smaller heading for sub-sections (e.g. "SSH signing keys", "Danger zone"). */
  small?: boolean;
  danger?: boolean;
  class?: string;
  id?: string;
}) {
  return (
    <div
      class={[
        'flex flex-wrap items-center gap-2 pb-2 mb-4 border-b border-line-muted',
        { 'mt-10': props.small },
        props.class,
      ]}
    >
      <h2
        id={props.id}
        class={['flex-1 font-normal', props.small ? 'text-xl' : 'text-2xl', { 'text-fg-danger': props.danger }]}
      >
        {props.title}
      </h2>
      <Show when={props.actions}>
        <div class="flex items-center gap-2">{props.actions}</div>
      </Show>
    </div>
  );
}
