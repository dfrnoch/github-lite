import { useLocation } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createMemo, For, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Avatar, Blankslate } from '../../../../components/ui';
import {
  appsIcon,
  browserIcon,
  codescanIcon,
  creditCardIcon,
  gearIcon,
  idBadgeIcon,
  keyAsteriskIcon,
  linkExternalIcon,
  lockIcon,
  logIcon,
  type OcticonData,
  organizationIcon,
  packageIcon,
  peopleIcon,
  playIcon,
  repoIcon,
  reportIcon,
  shieldCheckIcon,
  shieldLockIcon,
  verifiedIcon,
  webhookIcon,
} from '../../../../icons/octicons';
import { getOrgMeta } from '../../api';
import { ScopeNotice, Section } from './Notices';

type Entry = { heading: string } | { href: string; label: string; icon: OcticonData; external?: boolean };

function navFor(org: string): Entry[] {
  const gh = `https://github.com/organizations/${org}/settings`;
  return [
    { href: `/orgs/${org}/settings/profile`, label: 'General', icon: gearIcon },
    { heading: 'Access' },
    { href: `${gh}/billing`, label: 'Billing and licensing', icon: creditCardIcon, external: true },
    { href: `${gh}/org_role_assignments`, label: 'Organization roles', icon: idBadgeIcon, external: true },
    { href: `${gh}/roles`, label: 'Repository roles', icon: peopleIcon, external: true },
    { href: `/orgs/${org}/settings/member_privileges`, label: 'Member privileges', icon: organizationIcon },
    { href: `${gh}/moderators`, label: 'Moderation', icon: reportIcon, external: true },
    { heading: 'Code, planning, and automation' },
    { href: `${gh}/repository-defaults`, label: 'Repository', icon: repoIcon, external: true },
    { href: `${gh}/actions`, label: 'Actions', icon: playIcon, external: true },
    { href: `${gh}/hooks`, label: 'Webhooks', icon: webhookIcon, external: true },
    { href: `${gh}/packages`, label: 'Packages', icon: packageIcon, external: true },
    { href: `${gh}/pages`, label: 'Pages', icon: browserIcon, external: true },
    { heading: 'Security' },
    { href: `${gh}/security`, label: 'Authentication security', icon: shieldLockIcon, external: true },
    { href: `${gh}/security_analysis`, label: 'Code security', icon: codescanIcon, external: true },
    { href: `${gh}/domains`, label: 'Verified and approved domains', icon: verifiedIcon, external: true },
    { href: `${gh}/secrets/actions`, label: 'Secrets and variables', icon: shieldCheckIcon, external: true },
    { heading: 'Third-party Access' },
    { href: `${gh}/installations`, label: 'GitHub Apps', icon: appsIcon, external: true },
    { href: `${gh}/oauth_application_policy`, label: 'OAuth application policy', icon: keyAsteriskIcon, external: true },
    { href: `${gh}/personal-access-tokens`, label: 'Personal access tokens', icon: keyAsteriskIcon, external: true },
    { heading: 'Archive' },
    { href: `${gh}/audit-log`, label: 'Logs', icon: logIcon, external: true },
  ];
}

/** Layout for /orgs/:org/settings/*: org header + GitHub's settings NavList (owners only). */
export default function OrgSettingsShell(props: { org: string; children: JSX.Element }) {
  const meta = createMemo(() => getOrgMeta(props.org));
  const location = useLocation();
  const path = () => location.pathname.replace(/\/+$/, '');

  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6 md:py-8">
      <ScopeNotice when={meta().viewerCanAdminister} scope="admin:org" what="settings changes" />
      <Show
        when={meta().viewerCanAdminister}
        fallback={
          <Blankslate icon={lockIcon} title="You don’t have access to this organization’s settings">
            Only organization owners can view and change settings.
          </Blankslate>
        }
      >
        <div class="flex flex-wrap items-center gap-3 mb-6">
          <Avatar src={meta().avatarUrl} size={48} square />
          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-semibold leading-tight">
              <a class="link-plain" href={`/${meta().login}`}>
                {meta().name || meta().login}
              </a>
              <Show when={meta().name}>
                <span class="text-fg-muted font-normal"> ({meta().login})</span>
              </Show>
            </h1>
            <p class="text-sm text-fg-muted">Organization account</p>
          </div>
          <a class="btn btn-sm" href={`/${meta().login}`}>
            Go to your organization profile
          </a>
        </div>
        <div class="flex flex-col md:flex-row gap-6">
          <nav class="md:w-[256px] shrink-0" aria-label="Organization settings">
            <ul class="NavList">
              <For each={navFor(props.org)}>
                {(e) =>
                  'heading' in e ? (
                    <li>
                      <hr class="NavList-divider" />
                      <h3 class="NavList-heading">{e.heading}</h3>
                    </li>
                  ) : (
                    <li>
                      <a
                        class="NavList-item"
                        href={e.href}
                        aria-current={!e.external && path() === e.href ? 'page' : undefined}
                        target={e.external ? '_blank' : undefined}
                        rel={e.external ? 'noreferrer' : undefined}
                      >
                        <Octicon icon={e.icon} />
                        <span class="flex-1">{e.label}</span>
                        <Show when={e.external}>
                          <Octicon icon={linkExternalIcon} size={12} />
                        </Show>
                      </a>
                    </li>
                  )
                }
              </For>
            </ul>
          </nav>
          <div class="flex-1 min-w-0">
            <Section>{props.children}</Section>
          </div>
        </div>
      </Show>
    </div>
  );
}
