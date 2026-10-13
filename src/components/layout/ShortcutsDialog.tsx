import { createMemo, createSignal, For, Show } from 'solid-js';
import { feature } from '../../features/refined';
import { activeHotkeys, formatKeys, type Hotkey, useHotkey } from '../../lib/hotkeys';
import { Dialog } from '../ui';

/** `?` — lists every keyboard shortcut active on the current page (GitHub's help modal). */
export default function ShortcutsDialog() {
  const [open, setOpen] = createSignal(false);
  useHotkey({ keys: '?', description: 'Show keyboard shortcuts', group: 'Site-wide', handler: () => setOpen(true) });

  const groups = createMemo(() => {
    const map = new Map<string, Hotkey[]>();
    for (const h of activeHotkeys()) {
      if (h.feature && !feature(h.feature)) continue;
      const g = h.group ?? 'This page';
      if (!map.has(g)) map.set(g, []);
      if (!map.get(g)!.some((x) => x.keys === h.keys)) map.get(g)!.push(h);
    }
    return [...map.entries()];
  });

  return (
    <Dialog open={open()} onClose={() => setOpen(false)} title="Keyboard shortcuts" width="720px">
      <div class="grid gap-x-8 gap-y-6 md:grid-cols-2">
        <For each={groups()}>
          {([group, keys]) => (
            <section>
              <h2 class="font-semibold mb-2">{group}</h2>
              <ul class="text-sm">
                <For each={keys}>
                  {(h) => (
                    <li class="flex items-center justify-between gap-4 py-1 border-b border-line-muted">
                      <span>{h.description}</span>
                      <span class="flex gap-1 shrink-0">
                        <For each={formatKeys(h.keys)}>
                          {(k) => <kbd class="px-1.5 py-0.5 text-xs font-mono border border-line rounded-md bg-canvas-muted">{k}</kbd>}
                        </For>
                      </span>
                    </li>
                  )}
                </For>
              </ul>
            </section>
          )}
        </For>
      </div>
      <Show when={feature('improve-shortcut-help')}>
        <p class="mt-4 text-xs text-fg-muted">
          Shortcuts from Refined GitHub features are included. Manage them in <a href="/settings/refined">Settings → Refined GitHub</a>.
        </p>
      </Show>
    </Dialog>
  );
}
