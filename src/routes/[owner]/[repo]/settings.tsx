import { useLocation } from '@solidjs/router';
import type { ParentProps } from 'solid-js';
import { For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Blankslate } from '../../../components/ui';
import { useRepo } from '../../../features/repo/context';
import {
  browserIcon,
  gearIcon,
  gitBranchIcon,
  keyIcon,
  lockIcon,
  peopleIcon,
  playIcon,
  repoPushIcon,
  shieldLockIcon,
  webhookIcon,
} from '../../../icons/octicons';

type NavEntry = { href: string; label: string; icon: typeof gearIcon; exact?: boolean; match?: string[] } | { heading: string };

const NAV: NavEntry[] = [
  { href: '', label: 'General', icon: gearIcon, exact: true },
  { heading: 'Access' },
  { href: '/access', label: 'Collaborators', icon: peopleIcon },
  { heading: 'Code and automation' },
  { href: '/branches', label: 'Branches', icon: gitBranchIcon, match: ['/branches', '/branch_protection_rules'] },
  { href: '/rules', label: 'Rules', icon: repoPushIcon },
  { href: '/actions', label: 'Actions', icon: playIcon },
  { href: '/hooks', label: 'Webhooks', icon: webhookIcon },
  { href: '/pages', label: 'Pages', icon: browserIcon },
  { heading: 'Security' },
  { href: '/keys', label: 'Deploy keys', icon: keyIcon },
  { href: '/secrets/actions', label: 'Secrets and variables', icon: shieldLockIcon, match: ['/secrets', '/variables'] },
];

/** /:owner/:repo/settings/* — left NavList + section content (admins only). */
export default function RepoSettingsLayout(props: ParentProps) {
  const ctx = useRepo();
  const location = useLocation();
  const base = () => `${ctx.base()}/settings`;
  const sub = () => location.pathname.slice(base().length).replace(/\/$/, '');
  const isActive = (e: { href: string; exact?: boolean; match?: string[] }) =>
    e.exact ? sub() === '' : (e.match ?? [e.href]).some((m) => sub() === m || sub().startsWith(`${m}/`));

  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Show
        when={ctx.repo().permissions?.admin}
        fallback={
          <Blankslate icon={lockIcon} title="You don’t have access to this repository’s settings">
            Only repository administrators can view settings.
          </Blankslate>
        }
      >
        <div class="flex flex-col md:flex-row gap-6">
          <nav class="w-full md:w-[256px] shrink-0" aria-label="Repository settings">
            <ul class="NavList">
              <For each={NAV}>
                {(entry) =>
                  'heading' in entry ? (
                    <li>
                      <div class="NavList-divider" />
                      <h3 class="NavList-heading">{entry.heading}</h3>
                    </li>
                  ) : (
                    <li>
                      <a
                        class="NavList-item"
                        href={`${base()}${entry.href}`}
                        aria-current={isActive(entry) && !entry.match?.includes('/secrets') ? 'page' : undefined}
                      >
                        <Octicon icon={entry.icon} />
                        {entry.label}
                      </a>
                      <Show when={entry.href === '/secrets/actions' && isActive(entry)}>
                        <ul class="ml-6">
                          <li>
                            <a
                              class="NavList-item"
                              href={`${base()}/secrets/actions`}
                              aria-current={sub().startsWith('/secrets/actions') ? 'page' : undefined}
                            >
                              Actions secrets
                            </a>
                          </li>
                          <li>
                            <a
                              class="NavList-item"
                              href={`${base()}/variables/actions`}
                              aria-current={sub().startsWith('/variables/actions') ? 'page' : undefined}
                            >
                              Actions variables
                            </a>
                          </li>
                        </ul>
                      </Show>
                    </li>
                  )
                }
              </For>
            </ul>
          </nav>
          <div class="flex-1 min-w-0">{props.children}</div>
        </div>
      </Show>
    </div>
  );
}
