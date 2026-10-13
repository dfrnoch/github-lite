import { createSignal } from 'solid-js';

/**
 * Pinned ("favorite") repositories for the dashboard and the navigation
 * drawer. Local to this browser: an ordered list of "owner/name" in
 * localStorage, kept in sync across tabs through the `storage` event.
 */
const KEY = 'gh-lite:pinned-repos';

const load = (): string[] => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((n): n is string => typeof n === 'string' && /^[^/\s]+\/[^/\s]+$/.test(n)) : [];
  } catch {
    return [];
  }
};

const sortedUnion = (a: string[], b: string[]) => {
  const seen = new Map<string, string>();
  for (const n of [...a, ...b]) if (!seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
  return [...seen.values()].sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase()));
};

const initial = load();
const [pinned, setPinnedSignal] = createSignal<string[]>(initial, { name: 'pinnedRepos' });
/**
 * Names whose details the UI fetches (one batched request, see getPinnedRepos):
 * sorted, and only ever grows within a page session, so unpinning or reordering
 * never waits for a refetch.
 */
const [pinnedFetchKey, setFetchKey] = createSignal<string[]>(sortedUnion(initial, []), {
  name: 'pinnedReposFetchKey',
  equals: (a, b) => a.length === b.length && a.every((n, i) => n === b[i]),
});

export { pinned, pinnedFetchKey };

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    const next = load();
    setPinnedSignal(next);
    setFetchKey((k) => sortedUnion(k, next));
  });
}

const save = (next: string[]) => {
  localStorage.setItem(KEY, JSON.stringify(next));
  setPinnedSignal(next);
  setFetchKey((k) => sortedUnion(k, next));
};

const indexOf = (list: string[], name: string) => list.findIndex((n) => n.toLowerCase() === name.toLowerCase());

/** Whether `owner/name` is pinned (case-insensitive). Reactive. */
export const isPinned = (name: string) => indexOf(pinned(), name) !== -1;

/** Pin a repository (appended at the end). */
export function pinRepo(name: string) {
  const list = pinned();
  if (indexOf(list, name) === -1) save([...list, name]);
}

export function unpinRepo(name: string) {
  const list = pinned();
  const i = indexOf(list, name);
  if (i !== -1) save(list.filter((_, j) => j !== i));
}

export function togglePin(name: string) {
  if (isPinned(name)) unpinRepo(name);
  else pinRepo(name);
}

/** Move the pin at `from` to index `to` (drag-and-drop). */
export function reorderPins(from: number, to: number) {
  const list = [...pinned()];
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item!);
  save(list);
}

/** Move a pin one place up (-1) or down (+1). */
export function movePin(name: string, delta: -1 | 1) {
  const i = indexOf(pinned(), name);
  if (i !== -1) reorderPins(i, i + delta);
}
