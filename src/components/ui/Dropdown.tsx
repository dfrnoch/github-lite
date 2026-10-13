import type { JSX } from '@solidjs/web';
import { createSignal, onSettled, Show } from 'solid-js';

/**
 * Button + popover menu (GitHub's ActionMenu). Closes on outside click,
 * Escape, or when the menu calls `close`. Menu content uses the
 * .SelectMenu-* classes:
 *
 *   <Dropdown button={<>Sort <Octicon icon={triangleDownIcon} /></>} class="btn btn-sm">
 *     {(close) => <button class="SelectMenu-item" onClick={() => { pick(); close(); }}>Newest</button>}
 *   </Dropdown>
 */
export default function Dropdown(props: {
  button: JSX.Element;
  /** Classes for the trigger button (defaults to "btn"). */
  class?: string;
  align?: 'left' | 'right';
  /** Extra classes for the menu (e.g. width). */
  menuClass?: string;
  title?: string;
  header?: JSX.Element;
  disabled?: boolean;
  /** Called when the menu opens (e.g. to focus a filter input). */
  onOpen?: () => void;
  children: (close: () => void) => JSX.Element;
}) {
  const [open, setOpen] = createSignal(false);
  let root!: HTMLDivElement;
  const close = () => setOpen(false);

  onSettled(() => {
    const onDown = (e: PointerEvent) => {
      if (open() && !root.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open()) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  });

  return (
    <div ref={root} class="relative inline-block">
      <button
        type="button"
        class={props.class ?? 'btn'}
        aria-haspopup="menu"
        aria-expanded={open() ? "true" : "false"}
        title={props.title}
        disabled={props.disabled}
        onClick={() => {
          const next = !open();
          setOpen(next);
          if (next) queueMicrotask(() => props.onOpen?.());
        }}
      >
        {props.button}
      </button>
      <Show when={open()}>
        <div
          role="menu"
          class={['SelectMenu mt-1', props.align === 'right' ? 'right-0' : 'left-0', props.menuClass]}
        >
          <Show when={props.header}>
            <div class="SelectMenu-header">{props.header}</div>
          </Show>
          {props.children(close)}
        </div>
      </Show>
    </div>
  );
}
