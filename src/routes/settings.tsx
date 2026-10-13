import { useIsRouting, useLocation } from '@solidjs/router';
import type { ParentProps } from 'solid-js';
import { createMemo, Errored, Loading, Show } from 'solid-js';
import Octicon from '../components/Octicon';
import { Avatar, ErrorView, PageSpinner } from '../components/ui';
import { getViewer } from '../features/user/api';
import {
  bellIcon,
  blockedIcon,
  gearIcon,
  keyAsteriskIcon,
  keyIcon,
  linkExternalIcon,
  mailIcon,
  organizationIcon,
  type OcticonData,
  paintbrushIcon,
  personIcon,
  reportIcon,
  shieldLockIcon,
} from '../icons/octicons';

/** Layout for /settings/*: account header + side navigation, like github.com/settings. */
export default function SettingsLayout(props: ParentProps) {
  const viewer = createMemo(() => getViewer());
  const isRouting = useIsRouting();
  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6 md:py-8">
      <Loading fallback={<div class="h-12 mb-6" />}>
        <div class="flex flex-wrap items-center gap-3 mb-6">
          <Avatar src={viewer().avatar_url} login={viewer().login} size={48} />
          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-semibold leading-tight">
              <a class="link-plain" href={`/${viewer().login}`}>
                {viewer().name || viewer().login}
              </a>
              <Show when={viewer().name}>
                <span class="text-fg-muted font-normal"> ({viewer().login})</span>
              </Show>
            </h1>
            <p class="text-sm text-fg-muted">Your personal account</p>
          </div>
          <a class="btn btn-sm" href={`/${viewer().login}`}>
            Go to your personal profile
          </a>
        </div>
      </Loading>

      <div class="flex flex-col md:flex-row gap-6">
        <nav class="md:w-[256px] shrink-0" aria-label="Settings">
          <SettingsNav />
        </nav>
        <div class={['flex-1 min-w-0 transition-opacity', { 'opacity-60': isRouting() }]} aria-busy={isRouting() ? 'true' : undefined}>
          <Errored fallback={(err, reset) => <ErrorView error={err()} reset={reset} />}>
            <Loading fallback={<PageSpinner />}>{props.children}</Loading>
          </Errored>
        </div>
      </div>
    </div>
  );
}

function SettingsNav() {
  const location = useLocation();
  const path = createMemo(() => location.pathname.replace(/\/+$/, ''));

  const Item = (p: { href: string; icon: OcticonData; label: string; external?: boolean; indent?: boolean }) => (
    <li>
      <a
        class={['NavList-item', { 'pl-9!': p.indent }]}
        href={p.href}
        aria-current={!p.external && (path() === p.href || path().startsWith(`${p.href}/`)) ? 'page' : undefined}
        target={p.external ? '_blank' : undefined}
        rel={p.external ? 'noreferrer' : undefined}
      >
        <Show when={!p.indent}>
          <Octicon icon={p.icon} />
        </Show>
        <span class="flex-1">{p.label}</span>
        <Show when={p.external}>
          <Octicon icon={linkExternalIcon} size={12} />
        </Show>
      </a>
    </li>
  );

  return (
    <ul class="NavList">
      <Item href="/settings/profile" icon={personIcon} label="Public profile" />
      <Item href="/settings/admin" icon={gearIcon} label="Account" />
      <Item href="/settings/appearance" icon={paintbrushIcon} label="Appearance" />
      <Item href="/settings/notifications" icon={bellIcon} label="Notifications" />
      <li role="presentation">
        <hr class="NavList-divider" />
      </li>
      <li class="NavList-heading">Access</li>
      <Item href="/settings/emails" icon={mailIcon} label="Emails" />
      <Item href="https://github.com/settings/security" icon={shieldLockIcon} label="Password and authentication" external />
      <Item href="/settings/keys" icon={keyIcon} label="SSH and GPG keys" />
      <Item href="/settings/organizations" icon={organizationIcon} label="Organizations" />
      <li>
        <div class="NavList-item cursor-default! hover:bg-transparent!">
          <Octicon icon={reportIcon} />
          <span>Moderation</span>
        </div>
      </li>
      <Item href="/settings/blocked_users" icon={blockedIcon} label="Blocked users" indent />
      <li role="presentation">
        <hr class="NavList-divider" />
      </li>
      <li class="NavList-heading">Developer settings</li>
      <Item href="/settings/tokens" icon={keyAsteriskIcon} label="Personal access tokens" />
    </ul>
  );
}
