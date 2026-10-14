import { useSearchParams } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createSignal, For, onSettled, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dropdown } from '../../../components/ui';
import { checkIcon, triangleDownIcon, xIcon } from '../../../icons/octicons';

export interface FilterOption {
  value: string;
  label: string;
}

/** A Primer select-menu button: "Type ▾" with a checked list of options. */
export function FilterMenu(props: {
  label: string;
  title: string;
  options: FilterOption[];
  value: string;
  onSelect: (value: string) => void;
  filterable?: boolean;
  align?: 'left' | 'right';
}) {
  const [filter, setFilter] = createSignal('');
  let input: HTMLInputElement | undefined;
  const visible = () => {
    const f = filter().toLowerCase();
    return f ? props.options.filter((o) => o.label.toLowerCase().includes(f)) : props.options;
  };
  return (
    <Dropdown
      class="btn"
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
      {(close) => (
        <>
          <Show when={props.filterable}>
            <div class="SelectMenu-filter">
              <input
                ref={(el) => (input = el)}
                class="form-control form-control-sm"
                placeholder={`Filter ${props.title.toLowerCase().replace(/^select /, '')}`}
                value={filter()}
                onInput={(e) => setFilter(e.currentTarget.value)}
              />
            </div>
          </Show>
          <For each={visible()}>
            {(o) => (
              <button
                type="button"
                class="SelectMenu-item"
                role="menuitemradio"
                aria-checked={props.value === o.value ? 'true' : 'false'}
                onClick={() => {
                  close();
                  props.onSelect(o.value);
                }}
              >
                <span class="w-4">
                  <Show when={props.value === o.value}>
                    <Octicon icon={checkIcon} />
                  </Show>
                </span>
                {o.label}
              </button>
            )}
          </For>
        </>
      )}
    </Dropdown>
  );
}

/**
 * "Find a repository…" + Type / Language / Sort menus. Everything lives in
 * the URL (`?q=&type=&language=&sort=`) exactly like github.com, so the
 * filtered list is shareable and survives reloads.
 */
export default function RepoFiltersBar(props: {
  placeholder: string;
  types: FilterOption[];
  languages: string[];
  sorts: FilterOption[];
  /** Extra controls (e.g. a "New" button) after the menus. */
  children?: JSX.Element;
}) {
  const [sp, setSp] = useSearchParams<{ q?: string; type?: string; language?: string; sort?: string; page?: string }>();
  const [text, setText] = createSignal(() => sp.q ?? '');
  let timer: ReturnType<typeof setTimeout> | undefined;
  onSettled(() => () => clearTimeout(timer));

  const commit = (value: string) => {
    clearTimeout(timer);
    setSp({ q: value.trim() || undefined, page: undefined }, { replace: true, scroll: false });
  };

  return (
    <div class="flex flex-wrap md:flex-nowrap items-center gap-2 pb-4 border-b border-line-muted">
      <input
        type="search"
        class="form-control flex-1 min-w-[200px]"
        placeholder={props.placeholder}
        aria-label={props.placeholder}
        value={text()}
        onInput={(e) => {
          const v = e.currentTarget.value;
          setText(v);
          clearTimeout(timer);
          timer = setTimeout(() => commit(v), 350);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(e.currentTarget.value);
          }
        }}
      />
      <div class="flex flex-wrap gap-2">
        <FilterMenu
          label="Type"
          title="Select type"
          options={props.types}
          value={sp.type ?? ''}
          onSelect={(v) => setSp({ type: v || undefined, page: undefined }, { scroll: false })}
        />
        <FilterMenu
          label="Language"
          title="Select language"
          filterable
          options={[{ value: '', label: 'All' }, ...props.languages.map((l) => ({ value: l.toLowerCase(), label: l }))]}
          value={sp.language ?? ''}
          onSelect={(v) => setSp({ language: v || undefined, page: undefined }, { scroll: false })}
        />
        <FilterMenu
          label="Sort"
          title="Select order"
          options={props.sorts}
          value={sp.sort ?? ''}
          onSelect={(v) => setSp({ sort: v || undefined, page: undefined }, { scroll: false })}
        />
        {props.children}
      </div>
    </div>
  );
}

/** "12 results for public repositories matching foo written in TypeScript sorted by stars · Clear filter" */
export function FilterSummary(props: {
  total: number | null;
  noun: string;
  types: FilterOption[];
  languages: string[];
  sorts: FilterOption[];
  clearHref: string;
}) {
  const [sp] = useSearchParams<{ q?: string; type?: string; language?: string; sort?: string }>();
  const active = () => !!(sp.q || sp.type || sp.language || sp.sort);
  const typeLabel = () => props.types.find((t) => t.value === sp.type)?.label.toLowerCase();
  const langLabel = () => props.languages.find((l) => l.toLowerCase() === sp.language) ?? sp.language;
  const sortLabel = () => props.sorts.find((s) => s.value === sp.sort)?.label.toLowerCase();
  return (
    <Show when={active()}>
      <div class="flex items-center justify-between gap-4 py-4 border-b border-line-muted text-sm">
        <div>
          <Show when={props.total != null}>
            <strong>{props.total}</strong> {props.total === 1 ? 'result' : 'results'} for{' '}
          </Show>
          <Show when={typeLabel() && sp.type}>
            <strong>{typeLabel()}</strong>{' '}
          </Show>
          {props.noun}
          <Show when={sp.q}>
            {' '}
            matching <strong>{sp.q}</strong>
          </Show>
          <Show when={sp.language}>
            {' '}
            written in <strong>{langLabel()}</strong>
          </Show>
          <Show when={sp.sort}>
            {' '}
            sorted by <strong>{sortLabel()}</strong>
          </Show>
        </div>
        <a class="link-muted inline-flex items-center gap-1 whitespace-nowrap font-semibold" href={props.clearHref}>
          <span class="inline-flex items-center justify-center w-[18px] h-[18px] rounded-md bg-[var(--fgColor-muted)] text-fg-on-emphasis">
            <Octicon icon={xIcon} size={14} />
          </span>
          Clear filter
        </a>
      </div>
    </Show>
  );
}
