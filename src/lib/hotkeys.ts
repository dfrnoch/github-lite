import { createSignal, onSettled } from 'solid-js';
import { feature as featureEnabled } from '../features/refined';

/**
 * Keyboard shortcuts. Keys are written like GitHub's docs:
 * - single keys: `t`, `?`, `Escape`, `O` (= shift+o; printable keys match by character)
 * - modifiers: `mod+Enter` (ctrl on Windows/Linux, cmd on macOS), `alt+r`
 * - sequences: `g m`, `g i` (second key within 1.5s)
 *
 * Register from components with `useHotkey(...)` — it unregisters on unmount
 * and shows up in the `?` shortcuts dialog while active.
 */
export interface Hotkey {
  keys: string;
  description: string;
  /** Group heading in the shortcuts dialog, e.g. "Pull requests". */
  group?: string;
  /** Refined GitHub feature id, if the shortcut belongs to one. */
  feature?: string;
  /** Fire even while typing in an input/textarea. */
  inInputs?: boolean;
  /** Extra condition checked at keypress time. */
  when?: () => boolean;
  handler: (e: KeyboardEvent) => void;
}

const [active, setActive] = createSignal<Hotkey[]>([], { ownedWrite: true });
/** Currently registered shortcuts (for the help dialog). */
export const activeHotkeys = active;

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

function keyName(e: KeyboardEvent) {
  const mods: string[] = [];
  if (isMac ? e.metaKey : e.ctrlKey) mods.push('mod');
  if (e.altKey) mods.push('alt');
  // Printable keys match by produced character (so `?` and `O` imply shift).
  const key = e.key.length === 1 ? (e.altKey ? e.code.replace(/^Key/, '').toLowerCase() : e.key) : e.key;
  if (e.shiftKey && e.key.length !== 1) mods.push('shift');
  return [...mods, key].join('+');
}

let pending: { first: string; at: number } | null = null;

function onKeyDown(e: KeyboardEvent) {
  if (e.isComposing || e.defaultPrevented) return;
  const target = e.target as HTMLElement | null;
  const typing = !!target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
  const name = keyName(e);
  const candidates = active().filter(
    (h) => (!typing || h.inInputs) && (!h.when || h.when()) && (!h.feature || featureEnabled(h.feature)),
  );

  if (pending && Date.now() - pending.at < 1500) {
    const seq = `${pending.first} ${name}`;
    const hit = candidates.find((h) => h.keys === seq);
    pending = null;
    if (hit) {
      e.preventDefault();
      hit.handler(e);
      return;
    }
  }
  const hit = candidates.find((h) => h.keys === name);
  if (hit) {
    e.preventDefault();
    hit.handler(e);
    return;
  }
  if (candidates.some((h) => h.keys.startsWith(`${name} `))) pending = { first: name, at: Date.now() };
}

if (typeof document !== 'undefined') document.addEventListener('keydown', onKeyDown);

/** Register a shortcut until `unregister()` is called. */
export function registerHotkey(hotkey: Hotkey) {
  setActive((list) => [...list, hotkey]);
  return () => setActive((list) => list.filter((h) => h !== hotkey));
}

/** Register a shortcut for the lifetime of the calling component. */
export function useHotkey(hotkey: Hotkey) {
  onSettled(() => registerHotkey(hotkey));
}

/** Render "mod+Enter" as "⌘ Enter" / "Ctrl Enter" for display. */
export function formatKeys(keys: string) {
  return keys
    .split(' ')
    .map((part) =>
      part
        .split('+')
        .map((k) => (k === 'mod' ? (isMac ? '⌘' : 'Ctrl') : k === 'alt' ? (isMac ? '⌥' : 'Alt') : k === 'shift' ? '⇧' : k))
        .join(' '),
    );
}
