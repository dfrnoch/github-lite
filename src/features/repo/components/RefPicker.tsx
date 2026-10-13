import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dropdown } from '../../../components/ui';
import { checkIcon, gitBranchIcon, tagIcon, triangleDownIcon } from '../../../icons/octicons';
import { getRefNames } from '../api';

/**
 * Branch/tag switcher ("main ▾"). `hrefFor(ref)` builds the destination for a
 * ref — e.g. the same path on another branch.
 */
export default function RefPicker(props: {
  owner: string;
  repo: string;
  current: string;
  hrefFor: (ref: string) => string;
  defaultBranch?: string;
  /** Text before the ref name, e.g. "base:" on the compare page. */
  prefix?: string;
  /** Hide the Tags tab (compare / PR pickers work on branches too, but this keeps them short). */
  branchesOnly?: boolean;
}) {
  const [tab, setTab] = createSignal<'branches' | 'tags'>('branches');
  const [filter, setFilter] = createSignal('');
  let input: HTMLInputElement | undefined;
  const isSha = () => /^[0-9a-f]{40}$/i.test(props.current);

  return (
    <Dropdown
      class="btn btn-sm max-w-[200px]"
      menuClass="w-80"
      onOpen={() => input?.focus()}
      button={
        <>
          <Show when={!props.prefix} fallback={<span class="text-fg-muted">{props.prefix}</span>}>
            <Octicon icon={gitBranchIcon} />
          </Show>
          <span class="truncate font-semibold">{isSha() ? props.current.slice(0, 7) : props.current}</span>
          <Octicon icon={triangleDownIcon} />
        </>
      }
      header="Switch branches/tags"
    >
      {(close) => (
        <>
          <div class="SelectMenu-filter">
            <input
              ref={(el) => (input = el)}
              class="form-control form-control-sm"
              placeholder={tab() === 'branches' ? 'Find a branch…' : 'Find a tag…'}
              value={filter()}
              onInput={(e) => setFilter(e.currentTarget.value)}
            />
            <div class={['flex gap-1 mt-2', { hidden: !!props.branchesOnly }]}>
              <button
                type="button"
                class={['btn btn-sm btn-invisible', { 'font-semibold!': tab() === 'branches' }]}
                onClick={() => setTab('branches')}
              >
                Branches
              </button>
              <button
                type="button"
                class={['btn btn-sm btn-invisible', { 'font-semibold!': tab() === 'tags' }]}
                onClick={() => setTab('tags')}
              >
                Tags
              </button>
            </div>
          </div>
          <Loading fallback={<div class="px-4 py-2 text-fg-muted">Loading…</div>}>
            <RefList {...props} tab={tab()} filter={filter()} close={close} />
          </Loading>
          <hr class="SelectMenu-divider" />
          <a class="SelectMenu-item" href={`/${props.owner}/${props.repo}/${tab() === 'branches' ? 'branches' : 'tags'}`} onClick={close}>
            View all {tab()}
          </a>
        </>
      )}
    </Dropdown>
  );
}

function RefList(props: {
  owner: string;
  repo: string;
  current: string;
  defaultBranch?: string;
  hrefFor: (ref: string) => string;
  tab: 'branches' | 'tags';
  filter: string;
  close: () => void;
}) {
  const refs = createMemo(() => getRefNames(props.owner, props.repo));
  const items = createMemo(() => {
    const list: string[] = props.tab === "branches" ? refs().branches : refs().tags;
    const f = props.filter.toLowerCase();
    return (f ? list.filter((n: string) => n.toLowerCase().includes(f)) : list).slice(0, 50);
  });
  return (
    <div class="max-h-80 overflow-auto">
      <For each={items()} fallback={<div class="px-4 py-2 text-fg-muted">Nothing to show</div>}>
        {(name) => (
          <a class="SelectMenu-item" href={props.hrefFor(name)} onClick={props.close} aria-checked={name === props.current ? "true" : "false"}>
            <span class="w-4">
              <Show when={name === props.current}>
                <Octicon icon={checkIcon} />
              </Show>
            </span>
            <Show when={props.tab === 'tags'}>
              <Octicon icon={tagIcon} />
            </Show>
            <span class="truncate flex-1">{name}</span>
            <Show when={name === props.defaultBranch}>
              <span class="Label">default</span>
            </Show>
          </a>
        )}
      </For>
    </div>
  );
}
