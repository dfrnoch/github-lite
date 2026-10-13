import { useAction } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { toast, toastError } from '../../../components/ui';
import { linkIcon, xIcon } from '../../../icons/octicons';
import { addSocialAccount, removeSocialAccount, type SocialAccount } from '../api';

const LIMIT = 4;

// Brand marks GitHub shows next to social links (16px viewBox); others get the link icon.
const PROVIDER_PATHS: Record<string, string> = {
  twitter:
    'M9.294 6.928 14.357 1h-1.2L8.762 6.147 5.25 1H1.2l5.31 7.784L1.2 15h1.2l4.642-5.436L10.751 15h4.05L9.294 6.928ZM7.651 8.852l-.538-.775L2.832 1.91h1.843l3.454 4.977.538.775 4.491 6.47h-1.843l-3.664-5.28Z',
  linkedin:
    'M13.632 13.635h-2.37V9.922c0-.886-.018-2.025-1.234-2.025-1.235 0-1.424.964-1.424 1.96v3.778h-2.37V6H8.51v1.04h.03c.318-.6 1.092-1.233 2.247-1.233 2.4 0 2.845 1.58 2.845 3.637v4.188zM3.558 4.955c-.762 0-1.376-.617-1.376-1.377 0-.758.614-1.375 1.376-1.375.76 0 1.376.617 1.376 1.375 0 .76-.617 1.377-1.376 1.377zm1.188 8.68H2.37V6h2.376v7.635zM14.816 0H1.18C.528 0 0 .516 0 1.153v13.694C0 15.484.528 16 1.18 16h13.635c.652 0 1.185-.516 1.185-1.153V1.153C16 .516 15.467 0 14.815 0z',
};

export function ProviderIcon(props: { provider: string }) {
  return (
    <Show when={PROVIDER_PATHS[props.provider]} fallback={<Octicon icon={linkIcon} class="text-fg-muted" />}>
      {(d) => (
        <svg class="octicon text-fg-muted" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d={d()} />
        </svg>
      )}
    </Show>
  );
}

/**
 * "Social accounts" field of the public profile: existing links with a remove
 * button, plus an input to add one (POST/DELETE /user/social_accounts).
 * Lives inside the profile <form>, so it uses buttons + Enter handling
 * instead of a nested form.
 */
export default function SocialAccounts(props: { accounts: SocialAccount[] | null }) {
  const add = useAction(addSocialAccount);
  const remove = useAction(removeSocialAccount);
  const [url, setUrl] = createSignal('');
  const [busy, setBusy] = createSignal(false);

  const submit = async () => {
    const value = url().trim();
    if (!value) return;
    setBusy(true);
    try {
      await add(value);
      setUrl('');
      toast('Social account added', 'success');
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const del = async (account: SocialAccount) => {
    if (!confirm(`Remove ${account.url} from your profile?`)) return;
    setBusy(true);
    try {
      await remove(account.url);
      toast('Social account removed', 'success');
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="form-group">
      <label for="profile-social">Social accounts</label>
      <ul class="flex flex-col gap-2">
        <For each={props.accounts ?? []}>
          {(account) => (
            <li class="flex items-center gap-2 text-sm">
              <ProviderIcon provider={account.provider} />
              <a class="flex-1 min-w-0 truncate" href={account.url} target="_blank" rel="noreferrer me">
                {account.url.replace(/^https?:\/\//, '')}
              </a>
              <button
                type="button"
                class="btn-octicon btn-octicon-danger"
                aria-label={`Remove ${account.url}`}
                disabled={busy()}
                onClick={() => del(account)}
              >
                <Octicon icon={xIcon} />
              </button>
            </li>
          )}
        </For>
      </ul>
      <Show when={(props.accounts?.length ?? 0) < LIMIT}>
        <div class="flex items-center gap-2 mt-2">
          <Octicon icon={linkIcon} class="text-fg-muted" />
          <input
            id="profile-social"
            class="form-control flex-1"
            type="url"
            placeholder="Link to social profile"
            value={url()}
            onInput={(e) => setUrl(e.currentTarget.value)}
            onKeyDown={(e) => {
              // Enter would submit the surrounding profile form.
              if (e.key === 'Enter') {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <button type="button" class="btn" disabled={busy() || !url().trim()} onClick={() => submit()}>
            Add
          </button>
        </div>
      </Show>
      <p class="note">Up to {LIMIT} links to your profiles on other sites, e.g. X, LinkedIn, Mastodon.</p>
    </div>
  );
}
