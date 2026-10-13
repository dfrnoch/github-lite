import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar } from '../../../components/ui';
import { arrowDownIcon, arrowUpIcon, grabberIcon, lockIcon, pinIcon, pinSlashIcon, xIcon } from '../../../icons/octicons';
import type { RepoSummary } from '../../profile/api';
import { getPinnedRepos } from '../api';
import { isPinned, movePin, pinned, pinnedFetchKey, reorderPins, togglePin, unpinRepo } from '../pins';

type Details = Record<string, RepoSummary>;

const ownerOf = (name: string) => name.split('/')[0]!;

/** "Pin" / "Unpin" toggle for the repository title row. */
export function PinButton(props: { name: string; class?: string }) {
  return (
    <button
      type="button"
      class={['btn btn-sm', props.class]}
      aria-pressed={isPinned(props.name) ? 'true' : 'false'}
      title={isPinned(props.name) ? 'Unpin from your dashboard' : 'Pin to your dashboard for quick access'}
      onClick={() => togglePin(props.name)}
    >
      <Octicon icon={isPinned(props.name) ? pinSlashIcon : pinIcon} />
      {isPinned(props.name) ? 'Unpin' : 'Pin'}
    </button>
  );
}

/**
 * Small icon button that pins / unpins (dashboard "Top repositories" rows).
 * `revealOnHover`: hidden until the surrounding `.group` is hovered (unless pinned).
 */
export function PinIconButton(props: { name: string; class?: string; revealOnHover?: boolean }) {
  return (
    <button
      type="button"
      class={[
        'btn-octicon',
        props.class,
        { 'opacity-0 group-hover:opacity-100 focus:opacity-100': !!props.revealOnHover && !isPinned(props.name), 'text-fg-accent!': isPinned(props.name) },
      ]}
      aria-label={isPinned(props.name) ? `Unpin ${props.name}` : `Pin ${props.name}`}
      title={isPinned(props.name) ? 'Pinned — click to unpin' : 'Pin to the top of your dashboard'}
      onClick={() => togglePin(props.name)}
    >
      <Octicon icon={pinIcon} />
    </button>
  );
}

/** Dashboard sidebar "Pinned" section: drag (or ↑/↓) to reorder, × to unpin. Hidden when nothing is pinned. */
export function PinnedSection() {
  const details = createMemo(() => getPinnedRepos(pinnedFetchKey()), { name: 'pinnedRepoDetails' });
  return (
    <Show when={pinned().length}>
      <section aria-labelledby="pinned-repos-heading">
        <h2 id="pinned-repos-heading" class="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Octicon icon={pinIcon} class="text-fg-muted" />
          Pinned
        </h2>
        <Loading fallback={<PinnedList />}>
          <PinnedList details={details()} />
        </Loading>
      </section>
    </Show>
  );
}

function PinnedList(props: { details?: Details }) {
  // `from` is read synchronously by drag handlers (signal reads lag until flush); the signals only style rows.
  let from: number | null = null;
  const [dragging, setDragging] = createSignal<number | null>(null);
  const [over, setOver] = createSignal<number | null>(null);
  const reset = () => {
    from = null;
    setDragging(null);
    setOver(null);
  };
  return (
    <ul>
      <For each={pinned()}>
        {(name, i) => {
          const d = () => props.details?.[name.toLowerCase()];
          return (
            <li
              draggable="true"
              class={[
                'group relative flex items-center gap-2 h-8 rounded-md min-w-0',
                { 'bg-accent-muted': over() === i() && dragging() !== i(), 'opacity-50': dragging() === i() },
              ]}
              onDragStart={(e) => {
                from = i();
                setDragging(from);
                if (e.dataTransfer) {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', name);
                }
              }}
              onDragOver={(e) => {
                if (from === null) return;
                e.preventDefault();
                if (over() !== i()) setOver(i());
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (from !== null) reorderPins(from, i());
                reset();
              }}
              onDragEnd={reset}
            >
              <span class="absolute -left-5 top-2 text-fg-muted cursor-grab opacity-0 group-hover:opacity-100" aria-hidden="true">
                <Octicon icon={grabberIcon} />
              </span>
              <a href={`/${ownerOf(name)}`} class="shrink-0" draggable="false">
                <Avatar src={d()?.owner.avatarUrl} login={ownerOf(name)} size={16} square={d()?.owner.isOrg} />
              </a>
              <a
                class="link-plain font-semibold text-sm truncate"
                href={`/${d()?.fullName ?? name}`}
                title={d()?.description ?? name}
                draggable="false"
              >
                {d()?.fullName ?? name}
              </a>
              <Show when={d()?.isPrivate}>
                <Octicon icon={lockIcon} class="text-fg-muted shrink-0" aria-label="Private" />
              </Show>
              <span class="absolute right-0 inset-y-0 flex items-center pl-2 bg-canvas opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                <button type="button" class="btn-octicon w-6! h-6!" aria-label={`Move ${name} up`} title="Move up" disabled={i() === 0} onClick={() => movePin(name, -1)}>
                  <Octicon icon={arrowUpIcon} size={12} />
                </button>
                <button
                  type="button"
                  class="btn-octicon w-6! h-6!"
                  aria-label={`Move ${name} down`}
                  title="Move down"
                  disabled={i() === pinned().length - 1}
                  onClick={() => movePin(name, 1)}
                >
                  <Octicon icon={arrowDownIcon} size={12} />
                </button>
                <button type="button" class="btn-octicon w-6! h-6!" aria-label={`Unpin ${name}`} title="Unpin" onClick={() => unpinRepo(name)}>
                  <Octicon icon={xIcon} size={12} />
                </button>
              </span>
            </li>
          );
        }}
      </For>
    </ul>
  );
}

/** "Pinned" block for the global navigation drawer (renders nothing when empty). */
export function PinnedNav() {
  const details = createMemo(() => getPinnedRepos(pinnedFetchKey()), { name: 'pinnedNavDetails' });
  return (
    <Show when={pinned().length}>
      <div class="NavList-heading">Pinned</div>
      <Loading fallback={<PinnedNavItems />}>
        <PinnedNavItems details={details()} />
      </Loading>
      <hr class="NavList-divider" />
    </Show>
  );
}

function PinnedNavItems(props: { details?: Details }) {
  return (
    <ul class="NavList">
      <For each={pinned()}>
        {(name) => (
          <li>
            <a class="NavList-item" href={`/${name}`}>
              <Avatar
                src={props.details?.[name.toLowerCase()]?.owner.avatarUrl}
                login={ownerOf(name)}
                size={16}
                square={props.details?.[name.toLowerCase()]?.owner.isOrg}
              />
              <span class="truncate">{props.details?.[name.toLowerCase()]?.fullName ?? name}</span>
            </a>
          </li>
        )}
      </For>
    </ul>
  );
}
