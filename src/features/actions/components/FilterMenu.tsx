import { createMemo, createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dropdown } from '../../../components/ui';
import { checkIcon, triangleDownIcon, xIcon } from '../../../icons/octicons';

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * One of the "Event ▾ / Status ▾ / Branch ▾ / Actor ▾" menus above a runs list.
 * `allowCustom` lets the typed text be used as the value (branches, actors).
 */
export default function FilterMenu(props: {
  label: string;
  title: string;
  options: FilterOption[];
  selected?: string;
  onSelect: (value: string | undefined) => void;
  filterable?: boolean;
  allowCustom?: boolean;
  placeholder?: string;
  align?: 'left' | 'right';
}) {
  const [text, setText] = createSignal('');
  let input: HTMLInputElement | undefined;
  const visible = createMemo(() => {
    const t = text().trim().toLowerCase();
    const list = t ? props.options.filter((o) => o.label.toLowerCase().includes(t)) : props.options;
    return list.slice(0, 100);
  });
  const custom = createMemo(() => {
    const t = text().trim();
    return props.allowCustom && t && !props.options.some((o) => o.value === t) ? t : '';
  });

  return (
    <Dropdown
      class="btn btn-invisible text-fg-muted! font-normal!"
      align={props.align ?? 'right'}
      menuClass="w-[300px]"
      header={props.title}
      onOpen={() => input?.focus()}
      button={
        <>
          {props.label}
          <Octicon icon={triangleDownIcon} />
        </>
      }
    >
      {(close) => {
        const pick = (value: string | undefined) => {
          close();
          setText('');
          props.onSelect(value);
        };
        return (
          <>
            <Show when={props.filterable}>
              <div class="SelectMenu-filter">
                <input
                  ref={(el) => (input = el)}
                  class="form-control form-control-sm w-full"
                  placeholder={props.placeholder ?? `Filter ${props.label.toLowerCase()}`}
                  value={text()}
                  onInput={(e) => setText(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const first = custom() || visible()[0]?.value;
                      if (first) pick(first);
                    }
                  }}
                />
              </div>
            </Show>
            <Show when={props.selected}>
              <button type="button" class="SelectMenu-item" onClick={() => pick(undefined)}>
                <Octicon icon={xIcon} />
                Clear filter
              </button>
              <hr class="SelectMenu-divider" />
            </Show>
            <Show when={custom()}>
              <button type="button" class="SelectMenu-item" onClick={() => pick(custom())}>
                <span class="w-4" />
                <span class="truncate">
                  {props.label}: <strong>{custom()}</strong>
                </span>
              </button>
            </Show>
            <For each={visible()} fallback={<Show when={!custom()}><div class="px-4 py-2 text-sm text-fg-muted">Nothing to show</div></Show>}>
              {(o) => (
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={props.selected === o.value ? 'true' : 'false'}
                  class="SelectMenu-item"
                  onClick={() => pick(o.value)}
                >
                  <span class="w-4 shrink-0">
                    <Show when={props.selected === o.value}>
                      <Octicon icon={checkIcon} />
                    </Show>
                  </span>
                  <span class="truncate">{o.label}</span>
                </button>
              )}
            </For>
          </>
        );
      }}
    </Dropdown>
  );
}
