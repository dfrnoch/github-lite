import { useLocation } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { For, Show } from 'solid-js';
import { useRepo } from '../../repo/context';

const ITEMS: { path: string; label: string; admin?: boolean }[] = [
  { path: '/pulse', label: 'Pulse' },
  { path: '/graphs/contributors', label: 'Contributors' },
  { path: '/graphs/traffic', label: 'Traffic', admin: true },
  { path: '/graphs/commit-activity', label: 'Commits' },
  { path: '/graphs/code-frequency', label: 'Code frequency' },
  { path: '/activity', label: 'Activity' },
  { path: '/forks', label: 'Forks' },
  { path: '/stargazers', label: 'Stargazers' },
  { path: '/watchers', label: 'Watchers' },
];

/** Left menu of the Insights tab (github.com's bordered "menu"). */
export default function InsightsLayout(props: { children: JSX.Element }) {
  const ctx = useRepo();
  const location = useLocation();
  const current = () => location.pathname.slice(ctx.base().length);
  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
      <nav class="w-full md:w-[296px] shrink-0" aria-label="Insights">
        <div class="Box overflow-hidden">
          <For each={ITEMS}>
            {(item) => (
              <Show when={!item.admin || ctx.repo().permissions?.push}>
                <a
                  class="block px-4 py-2 text-sm border-b border-line-muted last:border-b-0 link-plain hover:bg-canvas-muted rounded-md border-l-2"
                  style={{
                    'border-left-color': current().startsWith(item.path) ? 'var(--underlineNav-borderColor-active)' : 'transparent',
                  }}
                  href={`${ctx.base()}${item.path}`}
                  aria-current={current().startsWith(item.path) ? 'page' : undefined}
                >
                  {item.label}
                </a>
              </Show>
            )}
          </For>
        </div>
      </nav>
      <div class="flex-1 min-w-0">{props.children}</div>
    </div>
  );
}
