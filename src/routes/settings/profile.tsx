import { Title } from '@solidjs/meta';
import { createMemo, Show } from 'solid-js';
import Octicon from '../../components/Octicon';
import { Avatar } from '../../components/ui';
import { getEmails, getSocialAccounts, getTokenInfo, hasScope } from '../../features/settings/api';
import ProfileForm, { type ProfileUser } from '../../features/settings/components/ProfileForm';
import Subhead from '../../features/settings/components/Subhead';
import { getViewer } from '../../features/user/api';
import { alertIcon, linkExternalIcon } from '../../icons/octicons';
import { newTokenUrl } from '../../lib/auth';

export default function ProfileSettings() {
  const viewer = createMemo(() => getViewer() as Promise<ProfileUser>);
  const emails = createMemo(() => getEmails());
  const social = createMemo(() => getSocialAccounts());
  const token = createMemo(() => getTokenInfo());
  const cannotWrite = () => {
    const scopes = token().scopes;
    return scopes != null && !hasScope(scopes, 'user');
  };

  return (
    <>
      <Title>Your profile</Title>
      <Subhead title="Public profile" />
      <Show when={cannotWrite()}>
        <div class="flash flash-warn mb-4">
          <Octicon icon={alertIcon} />
          <p>
            Your token is missing the <code class="font-mono text-xs">user</code> scope, so profile changes will be
            rejected.{' '}
            <a href={newTokenUrl()} target="_blank" rel="noreferrer">
              Generate a new token
            </a>
            .
          </p>
        </div>
      </Show>
      <div class="flex flex-col-reverse md:flex-row gap-8">
        <div class="flex-1 min-w-0">
          <ProfileForm user={viewer()} emails={emails()} socialAccounts={social()} />
        </div>
        <div class="md:w-[200px] shrink-0">
          <h3 class="text-sm font-semibold mb-2">Profile picture</h3>
          <Avatar src={viewer().avatar_url} login={viewer().login} size={200} class="block" />
          <a
            class="btn btn-sm mt-3 inline-flex items-center gap-1"
            href="https://github.com/settings/profile"
            target="_blank"
            rel="noreferrer"
          >
            Edit on GitHub
            <Octicon icon={linkExternalIcon} size={12} />
          </a>
          <p class="note">The API can't upload avatars — change your picture on github.com.</p>
        </div>
      </div>
    </>
  );
}
