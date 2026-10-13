import type { JSX } from '@solidjs/web';
import { fitInViewport } from '../../../lib/viewport';
import { createMemo, createSignal, For, Loading, onSettled, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Spinner } from '../../../components/ui';
import { checkIcon, xIcon } from '../../../icons/octicons';

export interface SelectPanelProps<T> {
  /** Trigger button content. */
  trigger: JSX.Element;
  triggerClass?: string;
  triggerLabel?: string;
  /** Panel heading ("Assign up to 10 people to this issue"). */
  title: string;
  /** Items to choose from — may return a router query's promise (read under <Loading>). */
  load: () => T[] | Promise<T[]>;
  key: (item: T) => string;
  /** Text matched by the filter box. */
  text: (item: T) => string;
  render: (item: T) => JSX.Element;
  /** Currently selected keys. */
  selected: string[];
  multiple?: boolean;
  /** Multi: called on close when the selection changed. Single: called on pick. */
  onApply: (keys: string[]) => void;
  /** Entry for a typed value that is not in the list (e.g. any user login). */
  custom?: (text: string) => T | undefined;
  /** Single-select: a "Clear" entry that applies an empty selection. */
  clearLabel?: string;
  placeholder?: string;
  align?: 'left' | 'right';
  disabled?: boolean;
  footer?: JSX.Element;
  /** Max selectable items (GitHub: 10 assignees). */
  max?: number;
  class?: string;
  width?: number;
}

/**
 * GitHub's filterable select menu (the sidebar pickers and list filters):
 * a filter box, a checkmarked list, selected items first. Multi-select
 * changes are applied when the menu closes, like on github.com.
 */
export default function SelectPanel<T>(props: SelectPanelProps<T>) {
  const [open, setOpen] = createSignal(false);
  const [draft, setDraft] = createSignal<string[]>([]);
  // The selection when the panel opened: keeps the list order stable while toggling.
  const [initial, setInitial] = createSignal<string[]>([]);
  let root!: HTMLDivElement;

  const show = () => {
    setDraft([...props.selected]);
    setInitial([...props.selected]);
    setOpen(true);
  };
  const close = (apply = true) => {
    setOpen(false);
    if (!apply || !props.multiple) return;
    const before = [...props.selected].sort().join('\n');
    const after = [...draft()].sort().join('\n');
    if (before !== after) props.onApply(draft());
  };

  onSettled(() => {
    const onDown = (e: PointerEvent) => {
      if (open() && !root.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open()) close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  });

  const toggle = (key: string) => {
    if (!props.multiple) {
      setOpen(false);
      props.onApply(props.selected.includes(key) ? [] : [key]);
      return;
    }
    setDraft((d) => (d.includes(key) ? d.filter((k) => k !== key) : props.max && d.length >= props.max ? d : [...d, key]));
  };

  return (
    <div ref={root} class={['relative', props.class ?? 'inline-block']}>
      <button
        type="button"
        class={props.triggerClass ?? 'btn btn-sm'}
        aria-haspopup="listbox"
        aria-expanded={open() ? 'true' : 'false'}
        aria-label={props.triggerLabel}
        disabled={props.disabled}
        onClick={() => (open() ? close() : show())}
      >
        {props.trigger}
      </button>
      <Show when={open()}>
        <div
          ref={fitInViewport}
          class={['SelectMenu mt-1 py-0!', props.align === 'right' ? 'right-0' : 'left-0']}
          style={{ width: `${props.width ?? 300}px`, 'max-width': 'calc(100vw - 32px)' }}
          role="dialog"
          aria-label={props.title}
        >
          <div class="flex items-center justify-between px-4 pt-3 pb-2">
            <span class="text-sm font-semibold">{props.title}</span>
            <button type="button" class="btn-octicon w-6 h-6" aria-label="Close" onClick={() => close()}>
              <Octicon icon={xIcon} />
            </button>
          </div>
          <PanelBody
            {...props}
            draft={draft()}
            initial={initial()}
            onToggle={toggle}
            onClear={() => {
              setOpen(false);
              props.onApply([]);
            }}
          />
          <Show when={props.footer}>
            <div class="border-t border-line-muted px-4 py-2 text-xs">{props.footer}</div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

function PanelBody<T>(
  props: SelectPanelProps<T> & { draft: string[]; initial: string[]; onToggle: (key: string) => void; onClear: () => void },
) {
  const [filter, setFilter] = createSignal('');
  const items = createMemo(() => props.load());
  const visible = createMemo(() => {
    const f = filter().trim().toLowerCase();
    const list = items().filter((i) => !f || props.text(i).toLowerCase().includes(f));
    // Selected (at open time) first, like GitHub.
    const sel = list.filter((i) => props.initial.includes(props.key(i)));
    const rest = list.filter((i) => !props.initial.includes(props.key(i)));
    const out = [...sel, ...rest];
    if (f && props.custom && !list.some((i) => props.key(i).toLowerCase() === f)) {
      const extra = props.custom(filter().trim());
      if (extra) out.push(extra);
    }
    return out.slice(0, 100);
  });

  return (
    <>
      <div class="px-3 pb-2 border-b border-line-muted">
        <input
          class="form-control form-control-sm w-full"
          placeholder={props.placeholder ?? 'Filter'}
          aria-label={props.placeholder ?? 'Filter'}
          value={filter()}
          ref={(el) => queueMicrotask(() => el.focus())}
          onInput={(e) => setFilter(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const first = visible()[0];
              if (first) props.onToggle(props.key(first));
            }
          }}
        />
      </div>
      <div class="overflow-auto py-2" style={{ 'max-height': '320px' }} role="listbox" aria-multiselectable={props.multiple ? 'true' : undefined}>
        <Loading
          fallback={
            <div class="flex justify-center py-4 text-fg-muted">
              <Spinner size={20} />
            </div>
          }
        >
          <Show when={props.clearLabel && props.selected.length && !props.multiple}>
            <button type="button" class="SelectMenu-item" onClick={() => props.onClear()}>
              <span class="w-4" />
              <span class="text-fg-muted">{props.clearLabel}</span>
            </button>
          </Show>
          <For each={visible()} fallback={<p class="px-4 py-2 text-sm text-fg-muted">No matches</p>}>
            {(item) => (
              <button
                type="button"
                role="option"
                class="SelectMenu-item items-start!"
                aria-selected={props.draft.includes(props.key(item)) ? 'true' : 'false'}
                onClick={() => props.onToggle(props.key(item))}
              >
                <span
                  class={[
                    'mt-0.5 w-4 h-4 shrink-0 flex items-center justify-center',
                    { 'rounded border border-line': !!props.multiple },
                    {
                      'bg-accent-emphasis border-line-accent! text-fg-on-emphasis!':
                        !!props.multiple && props.draft.includes(props.key(item)),
                    },
                  ]}
                >
                  <Show when={props.draft.includes(props.key(item))}>
                    <Octicon icon={checkIcon} size={props.multiple ? 12 : 16} class={props.multiple ? 'text-fg-on-emphasis!' : undefined} />
                  </Show>
                </span>
                <span class="min-w-0 flex-1">{props.render(item)}</span>
              </button>
            )}
          </For>
        </Loading>
      </div>
    </>
  );
}
