import { Title } from '@solidjs/meta';
import { useAction } from '@solidjs/router';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { Avatar, Blankslate, toast, toastError } from '../../components/ui';
import { blockUser, getBlockedUsers, REQUIRED_SCOPES, unblockUser } from '../../features/settings/api';
import ScopeNotice from '../../features/settings/components/ScopeNotice';
import Subhead from '../../features/settings/components/Subhead';
import { blockedIcon } from '../../icons/octicons';
import type { SimpleUser } from '../../lib/types';

export default function BlockedUsersSettings() {
  const blocks = createMemo(() => getBlockedUsers());
  return (
    <>
      <Title>Blocked users</Title>
      <Subhead title="Block a user" />
      <p class="mb-4">
        Blocking a user prevents the following on all your repositories: opening or commenting on issues or pull
        requests, starring, forking, or watching, adding or editing wiki pages.{' '}
        <a
          href="https://docs.github.com/communities/maintaining-your-safety-on-github/blocking-a-user-from-your-personal-account"
          target="_blank"
          rel="noreferrer"
        >
          Learn more about blocking a user
        </a>
        .
      </p>
      <Show when={blocks()} fallback={<ScopeNotice scope={REQUIRED_SCOPES.blocks} what="your blocked users" />}>
        {(list) => <Blocked users={list()} />}
      </Show>
    </>
  );
}

function Blocked(props: { users: SimpleUser[] }) {
  const block = useAction(blockUser);
  const unblock = useAction(unblockUser);
  const [login, setLogin] = createSignal('');
  const [busy, setBusy] = createSignal(false);

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    const user = login().trim().replace(/^@/, '');
    if (!user) return;
    if (!confirm(`Block @${user}? They won't be able to interact with your repositories.`)) return;
    setBusy(true);
    try {
      await block(user);
      setLogin('');
      toast(`Blocked @${user}`, 'success');
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const onUnblock = async (user: string) => {
    setBusy(true);
    try {
      await unblock(user);
      toast(`Unblocked @${user}`, 'success');
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form class="flex gap-2 max-w-[440px] mb-6" onSubmit={submit}>
        <input
          class="form-control flex-1"
          aria-label="Username to block"
          placeholder="Enter a username"
          value={login()}
          onInput={(e) => setLogin(e.currentTarget.value)}
        />
        <button type="submit" class="btn" disabled={busy() || !login().trim()}>
          Block user
        </button>
      </form>

      <h3 class="text-base font-semibold mb-2">Blocked users</h3>
      <Show
        when={props.users.length}
        fallback={<Blankslate icon={blockedIcon} title="You have not blocked any users." class="Box" />}
      >
        <ul class="Box">
          <For each={props.users}>
            {(user) => (
              <li class="Box-row flex items-center gap-3">
                <Avatar src={user.avatar_url} login={user.login} size={32} square={user.type === 'Organization'} />
                <a class="flex-1 font-semibold" href={`/${user.login}`}>
                  {user.login}
                </a>
                <button type="button" class="btn btn-sm" disabled={busy()} onClick={() => onUnblock(user.login)}>
                  Unblock
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </>
  );
}
