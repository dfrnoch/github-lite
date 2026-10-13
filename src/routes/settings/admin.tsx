import { Title } from '@solidjs/meta';
import { createMemo } from 'solid-js';
import Octicon from '../../components/Octicon';
import Subhead from '../../features/settings/components/Subhead';
import { getViewer } from '../../features/user/api';
import { linkExternalIcon } from '../../icons/octicons';

const External = (p: { href: string; class?: string; children: any }) => (
  <a class={['btn inline-flex items-center gap-1', p.class]} href={p.href} target="_blank" rel="noreferrer">
    {p.children}
    <Octicon icon={linkExternalIcon} size={12} />
  </a>
);

/** /settings/admin — account-level actions. None are available through the API, so they link out. */
export default function AccountSettings() {
  const viewer = createMemo(() => getViewer());
  return (
    <>
      <Title>Account settings</Title>
      <Subhead title="Change username" />
      <p class="mb-2">
        Your username is <strong>{viewer().login}</strong>. Changing your username can have{' '}
        <a
          href="https://docs.github.com/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-personal-account-settings/changing-your-github-username"
          target="_blank"
          rel="noreferrer"
        >
          unintended side effects
        </a>
        .
      </p>
      <p class="text-sm text-fg-muted mb-4">The API can't rename accounts, so this is done on github.com.</p>
      <External href="https://github.com/settings/admin">Change username</External>

      <Subhead title="Export account data" small />
      <p class="mb-4">
        Export all repositories and profile metadata for <strong>@{viewer().login}</strong>. Exports will be available
        for 7 days.
      </p>
      <External href="https://github.com/settings/admin#export-account-data">Start export</External>

      <Subhead title="Delete account" small danger />
      <div class="Box Box--danger">
        <div class="Box-row flex flex-wrap items-center gap-4">
          <div class="flex-1 min-w-[240px]">
            <strong>Delete your account</strong>
            <p class="text-sm text-fg-muted">
              Once you delete your account, there is no going back. Please be certain. Account deletion is only
              possible on github.com.
            </p>
          </div>
          <External href="https://github.com/settings/admin" class="btn-danger">
            Delete your account
          </External>
        </div>
      </div>
    </>
  );
}
