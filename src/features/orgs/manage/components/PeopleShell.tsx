import { useLocation } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createMemo, For, Loading, Show } from 'solid-js';
import { formatNumber } from '../../../../lib/format';
import { getOrgMeta } from '../../api';
import { Section } from './Notices';

interface Item {
  href: string;
  label: string;
  count?: number;
}

/**
 * /orgs/:org/people/* and /orgs/:org/outside-collaborators: "People" heading
 * with GitHub's "Organization permissions" menu on the left, content right.
 */
export default function PeopleShell(props: { org: string; children: JSX.Element }) {
  const meta = createMemo(() => getOrgMeta(props.org));
  const location = useLocation();
  const path = () => location.pathname.replace(/\/+$/, '');
  const items = (): Item[] => {
    const base = `/orgs/${props.org}`;
    const list: Item[] = [{ href: `${base}/people`, label: 'Members', count: meta().members }];
    if (meta().viewerCanAdminister) {
      list.push(
        { href: `${base}/outside-collaborators`, label: 'Outside collaborators' },
        { href: `${base}/people/pending_invitations`, label: 'Invitations' },
        { href: `${base}/people/failed_invitations`, label: 'Failed invitations' },
      );
    }
    return list;
  };

  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <div class="flex flex-col md:flex-row gap-6">
        <aside class="md:w-[256px] shrink-0">
          <h2 class="text-2xl font-semibold mb-4 px-4 md:px-0 md:pl-4">People</h2>
          <nav class="Box overflow-hidden" aria-label="Organization permissions">
            <div class="px-4 py-2.5 border-b border-line text-sm font-semibold">Organization permissions</div>
            <Loading fallback={<div class="h-10" />}>
              <For each={items()}>
                {(item) => (
                  <a
                    class={[
                      'flex items-center gap-2 px-4 py-2 text-sm text-fg no-underline! border-b border-line-muted last:border-b-0 hover:bg-canvas-muted',
                      { 'font-semibold shadow-[inset_2px_0_0_var(--underlineNav-borderColor-active)]': path() === item.href },
                    ]}
                    href={item.href}
                    aria-current={path() === item.href ? 'page' : undefined}
                  >
                    <span class="flex-1">{item.label}</span>
                    <Show when={item.count != null}>
                      <span class="Counter">{formatNumber(item.count)}</span>
                    </Show>
                  </a>
                )}
              </For>
            </Loading>
          </nav>
        </aside>
        <div class="flex-1 min-w-0">
          <Section>{props.children}</Section>
        </div>
      </div>
    </div>
  );
}
