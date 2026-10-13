import { createSignal, For } from 'solid-js';
import { alertIcon, checkCircleIcon, infoIcon, xIcon } from '../../icons/octicons';
import Octicon from '../Octicon';

type Variant = 'info' | 'success' | 'error';
interface ToastItem {
  id: number;
  message: string;
  variant: Variant;
}

// Module-level: toasts are app-wide. ownedWrite because toast() may be called
// from inside an action's async work.
const [toasts, setToasts] = createSignal<ToastItem[]>([], { ownedWrite: true });
let nextId = 1;

/** Show a transient notification in the bottom-left corner. */
export function toast(message: string, variant: Variant = 'info', timeout = 5000) {
  const id = nextId++;
  setToasts((list) => [...list, { id, message, variant }]);
  setTimeout(() => dismiss(id), timeout);
}
/** Shorthand for surfacing a failed mutation. */
export const toastError = (err: unknown) => toast(err instanceof Error ? err.message : String(err), 'error', 8000);

const dismiss = (id: number) => setToasts((list) => list.filter((t) => t.id !== id));

export function Toasts() {
  return (
    <div class="Toast-container" aria-live="polite">
      <For each={toasts()}>
        {(t) => (
          <div class={['Toast', { 'Toast--error': t.variant === 'error', 'Toast--success': t.variant === 'success' }]}>
            <Octicon
              icon={t.variant === 'error' ? alertIcon : t.variant === 'success' ? checkCircleIcon : infoIcon}
              class={t.variant === 'error' ? 'text-fg-danger' : t.variant === 'success' ? 'text-fg-success' : 'text-fg-accent'}
            />
            <span class="flex-1">{t.message}</span>
            <button type="button" class="btn-octicon w-6 h-6" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <Octicon icon={xIcon} />
            </button>
          </div>
        )}
      </For>
    </div>
  );
}
