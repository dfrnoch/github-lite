import { createMemo, createSignal, For, Show } from 'solid-js';
import { feature } from '../../features/refined';
import { activeHotkeys, formatKeys, useHotkey } from '../../lib/hotkeys';
import { Dialog } from '../ui';

/** `?` — lists every keyboard shortcut active on the current page (GitHub's help modal). */
export default function ShortcutsDialog() {
  const [open, setOpen] = createSignal(false);
  useHotkey({ keys: '?', description: 'Show keyboard shortcuts', group: 'Site-wide', handler: () => setOpen(true) });

  const groups = createMemo(() => {
    // One line per action: shortcuts with the same description share it ("/ or s").
    const map = new Map<string, { description: string; keys: string[] }[]>();
    for (const h of activeHotkeys()) {
      if (h.feature && !feature(h.feature)) continue;
      const g = h.group === 'Repository' ? 'Repositories' : (h.group ?? 'This page');
      if (!map.has(g)) map.set(g, []);
      const rows = map.get(g)!;
      const row = rows.find((r) => r.description === h.description);
      if (!row) rows.push({ description: h.description, keys: [h.keys] });
      else if (!row.keys.includes(h.keys)) row.keys.push(h.keys);
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
                  {(row) => (
                    <li class="flex items-center justify-between gap-4 py-1 border-b border-line-muted">
                      <span>{row.description}</span>
                      <span class="flex items-center gap-1 shrink-0">
                        <For each={row.keys}>
                          {(combo, i) => (
                            <>
                              <Show when={i() > 0}>
                                <span class="text-xs text-fg-muted">or</span>
                              </Show>
                              <For each={formatKeys(combo)}>
                                {(k) => <kbd class="px-1.5 py-0.5 text-xs font-mono border border-line rounded-md bg-canvas-muted">{k}</kbd>}
                              </For>
                            </>
                          )}
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
      <p class="mt-4 text-xs text-fg-muted">
        Shortcuts from Refined GitHub features are included. Manage them in <a href="/settings/refined">Settings → Refined GitHub</a>.
      </p>
    </Dialog>
  );
}
