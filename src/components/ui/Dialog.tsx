import type { JSX } from '@solidjs/web';
import { createEffect, Show } from 'solid-js';
import { xIcon } from '../../icons/octicons';
import Octicon from '../Octicon';

/**
 * Modal dialog on the native <dialog> element (focus trap, Escape and
 * backdrop for free). Controlled: render it always and toggle `open`.
 */
export default function Dialog(props: {
  open: boolean;
  onClose: () => void;
  title: JSX.Element;
  children: JSX.Element;
  footer?: JSX.Element;
  /** CSS width, e.g. "480px". */
  width?: string;
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
      class="Dialog"
      style={props.width ? { width: `min(${props.width}, calc(100vw - 32px))` } : undefined}
      onClose={() => props.onClose()}
      onClick={(e) => {
        // A click on the backdrop targets the <dialog> itself.
        if (e.target === el) props.onClose();
      }}
    >
      <Show when={props.open}>
        <div class="Dialog-header">
          <h1 class="Dialog-title">{props.title}</h1>
          <button type="button" class="btn-octicon" aria-label="Close" onClick={() => props.onClose()}>
            <Octicon icon={xIcon} />
          </button>
        </div>
        <div class="Dialog-body">{props.children}</div>
        <Show when={props.footer}>
          <div class="Dialog-footer">{props.footer}</div>
        </Show>
      </Show>
    </dialog>
  );
}
