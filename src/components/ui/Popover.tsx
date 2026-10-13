import { Portal, type JSX } from '@solidjs/web';
import { onSettled, Show } from 'solid-js';

export type PopoverSide = 'bottom' | 'top';
export type PopoverAlign = 'start' | 'center' | 'end';

export interface PopoverProps {
  /** Element the popover points at. Nothing renders while it is missing. */
  anchor: HTMLElement | null | undefined;
  open: boolean;
  /** Outside pointerdown, Escape, or the anchor leaving the document. */
  onClose: () => void;
  /** Preferred side; flips when the viewport has more room on the other one. */
  side?: PopoverSide;
  align?: PopoverAlign;
  /** Draw the little arrow pointing at the anchor (default true). */
  caret?: boolean;
  class?: string;
  role?: 'dialog' | 'tooltip' | 'menu';
  'aria-label'?: string;
  /** Hovercards keep themselves open while hovered. */
  onPointerEnter?: (e: PointerEvent) => void;
  onPointerLeave?: (e: PointerEvent) => void;
  /** Focus the panel when it opens (click-opened popovers; not hovercards). */
  focus?: boolean;
  children: JSX.Element;
}

const MARGIN = 8;

/**
 * Small anchored overlay (Primer's Overlay/Popover look): portalled to <body>,
 * positioned below (or above) its anchor with viewport clamping and a caret,
 * closed by outside clicks and Escape. Shared by hovercards, the checks
 * popover and the signature-verification popover.
 *
 *   <button ref={setAnchor} onClick={() => setOpen(!open())}>…</button>
 *   <Popover anchor={anchor()} open={open()} onClose={() => setOpen(false)}>…</Popover>
 */
export default function Popover(props: PopoverProps) {
  return (
    // Keyed: a new anchor mounts a fresh panel (and positions it from scratch).
    <Show when={props.open && props.anchor} keyed>
      {(anchor) => (
        <Portal>
          <PopoverPanel {...props} anchorEl={anchor} />
        </Portal>
      )}
    </Show>
  );
}

function PopoverPanel(props: PopoverProps & { anchorEl: HTMLElement }) {
  let panel!: HTMLDivElement;

  const place = () => {
    const anchor = props.anchorEl;
    if (!anchor.isConnected) {
      props.onClose();
      return;
    }
    const caret = props.caret !== false;
    const gap = caret ? 10 : 4;
    const a = anchor.getBoundingClientRect();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const below = vh - a.bottom - gap - MARGIN;
    const above = a.top - gap - MARGIN;
    let side: PopoverSide = props.side ?? 'bottom';
    if (side === 'bottom' && below < h && above > below) side = 'top';
    else if (side === 'top' && above < h && below > above) side = 'bottom';
    const top = side === 'bottom' ? a.bottom + gap : a.top - gap - h;

    const align = props.align ?? 'start';
    const inset = Math.min(a.width / 2, 16);
    const target = align === 'center' ? a.left + a.width / 2 : align === 'end' ? a.right - inset : a.left + inset;
    let left = align === 'center' ? target - w / 2 : align === 'end' ? target - w + 24 : target - 24;
    left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));
    const caretX = Math.max(16, Math.min(target - left, w - 16));

    panel.style.top = `${Math.round(top)}px`;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.setProperty('--caret-x', `${Math.round(caretX)}px`);
    panel.dataset.side = side;
    panel.style.visibility = '';
  };

  onSettled(() => {
    place();
    if (props.focus) panel.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.contains(t) && !props.anchorEl.contains(t)) props.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const hadFocus = panel.contains(document.activeElement);
      props.onClose();
      if (hadFocus) props.anchorEl.focus({ preventScroll: true });
    };
    const onMove = () => place();
    const ro = new ResizeObserver(onMove);
    ro.observe(panel);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, { capture: true, passive: true });
    window.addEventListener('resize', onMove);
    return () => {
      ro.disconnect();
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, { capture: true });
      window.removeEventListener('resize', onMove);
    };
  });

  return (
    <div
      ref={panel}
      class={['Popover-panel', { 'Popover-panel--caret': props.caret !== false }, props.class]}
      style={{ visibility: 'hidden' }}
      role={props.role ?? 'dialog'}
      aria-label={props['aria-label']}
      tabindex="-1"
      data-no-hovercard=""
      onPointerEnter={(e) => props.onPointerEnter?.(e)}
      onPointerLeave={(e) => props.onPointerLeave?.(e)}
    >
      {props.children}
    </div>
  );
}
