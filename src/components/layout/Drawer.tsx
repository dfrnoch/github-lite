import type { JSX } from '@solidjs/web';
import { createEffect, Show } from 'solid-js';
import { xIcon } from '../../icons/octicons';
import Octicon from '../Octicon';

/** Slide-in side panel (GitHub's global nav / account menu). */
export default function Drawer(props: {
  open: boolean;
  onClose: () => void;
  side: 'left' | 'right';
  header: JSX.Element;
  children: JSX.Element;
}) {
  let el!: HTMLDialogElement;
  createEffect(
    () => props.open,
    (open) => {
      if (open && !el.open) el.showModal();
      else if (!open && el.open) el.close();
    },
  );
  return (
    <dialog
      ref={el}
      class={['Drawer', props.side === 'left' ? 'Drawer--left' : 'Drawer--right']}
      onClose={() => props.onClose()}
      onClick={(e) => {
        if (e.target === el) props.onClose();
        // Close after following a link inside the drawer.
        else if ((e.target as HTMLElement).closest('a')) props.onClose();
      }}
    >
      <Show when={props.open}>
        <div class="flex items-center gap-2 p-4">
          <div class="flex-1 min-w-0">{props.header}</div>
          <button type="button" class="btn-octicon" aria-label="Close" onClick={() => props.onClose()}>
            <Octicon icon={xIcon} />
          </button>
        </div>
        <nav class="px-4 pb-4">{props.children}</nav>
      </Show>
    </dialog>
  );
}
