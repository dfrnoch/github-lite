import { useLocation } from '@solidjs/router';
import type { ParentProps } from 'solid-js';
import { For } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { useRepo } from '../../../features/repo/context';
import { dependabotIcon, eyeIcon, lawIcon, shieldIcon } from '../../../icons/octicons';

const NAV = [
  { href: '', label: 'Overview', icon: eyeIcon },
  { href: '/policy', label: 'Security policy', icon: lawIcon },
  { href: '/advisories', label: 'Security advisories', icon: shieldIcon },
  { href: '/dependabot', label: 'Dependabot alerts', icon: dependabotIcon },
];

/** /:owner/:repo/security/* — Security tab with its side menu. */
export default function SecurityLayout(props: ParentProps) {
  const ctx = useRepo();
  const location = useLocation();
  const sub = () => location.pathname.slice(`${ctx.base()}/security`.length).replace(/\/$/, '');
  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
      <nav class="w-full md:w-[256px] shrink-0" aria-label="Security">
        <ul class="NavList">
          <li>
            <h3 class="NavList-heading">Reporting</h3>
          </li>
          <For each={NAV}>
            {(item) => (
              <li>
                <a
                  class="NavList-item"
                  href={`${ctx.base()}/security${item.href}`}
                  aria-current={(item.href === '' ? sub() === '' : sub().startsWith(item.href)) ? 'page' : undefined}
                >
                  <Octicon icon={item.icon} />
                  {item.label}
                </a>
              </li>
            )}
          </For>
        </ul>
      </nav>
      <div class="flex-1 min-w-0">{props.children}</div>
    </div>
  );
}
