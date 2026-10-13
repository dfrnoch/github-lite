import { For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import type { OcticonData } from '../../../icons/octicons';
import { compactNumber } from '../../../lib/format';

/** Underline tab bar shared by the user profile (sits in the header band like github.com). */
export function ProfileTabs(props: {
  active: string;
  items: { tab: string; label: string; icon: OcticonData; href: string; count?: number | null }[];
  label?: string;
  /** Left offset so tabs line up with the main column. */
  offset?: boolean;
}) {
  return (
    <nav class={['AppHeader AppHeader--bordered', { 'px-4': !props.offset }]} aria-label={props.label ?? 'Profile'}>
      <div class={{ 'container-xl px-4 md:px-6 lg:px-8': !!props.offset }}>
        <div class={['UnderlineNav', { 'md:pl-[calc(25%+24px)] lg:pl-[320px]': !!props.offset }]} style={{ 'box-shadow': 'none' }}>
          <ul class="UnderlineNav-body">
            <For each={props.items}>
              {(item) => (
                <li>
                  <a
                    class={['UnderlineNav-item', { selected: props.active === item.tab }]}
                    href={item.href}
                    aria-current={props.active === item.tab ? 'page' : undefined}
                  >
                    <Octicon icon={item.icon} />
                    <span>{item.label}</span>
                    <Show when={item.count}>
                      <span class="Counter">{compactNumber(item.count)}</span>
                    </Show>
                  </a>
                </li>
              )}
            </For>
          </ul>
        </div>
      </div>
    </nav>
  );
}

