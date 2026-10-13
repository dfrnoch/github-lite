import { Title } from '@solidjs/meta';
import { createMemo, For, Show } from 'solid-js';
import Octicon from '../../components/Octicon';
import { getTokenInfo, hasScope, type TokenInfo } from '../../features/settings/api';
import Subhead from '../../features/settings/components/Subhead';
import { alertIcon, checkCircleIcon, infoIcon, keyAsteriskIcon, linkExternalIcon } from '../../icons/octicons';
import { getToken, newTokenUrl, SCOPES } from '../../lib/auth';
import { formatDateTime } from '../../lib/format';

const KIND_LABEL: Record<TokenInfo['kind'], string> = {
  classic: 'Personal access token (classic)',
  'fine-grained': 'Fine-grained personal access token',
  oauth: 'OAuth app token',
  app: 'GitHub App token',
  unknown: 'Token',
};

/** Only the token's type prefix (ghp_, gho_, github_pat_…) — never any secret characters. */
const masked = (token: string) => `${token.match(/^[a-z]+(?:_pat)?_/)?.[0] ?? ''}${'•'.repeat(16)}`;

/** The expiration header looks like "2026-12-31 23:59:59 UTC". */
function formatExpiration(raw: string) {
  const date = new Date(raw.replace(' UTC', 'Z').replace(/^(\S+) /, '$1T'));
  return Number.isNaN(date.getTime()) ? raw : formatDateTime(date);
}

export default function TokenSettings() {
  const info = createMemo(() => getTokenInfo());
  const missing = createMemo(() => {
    const scopes = info().scopes;
    return scopes ? SCOPES.filter((s) => !hasScope(scopes, s)) : [];
  });

  return (
    <>
      <Title>Personal Access Tokens</Title>
      <Subhead
        title="Personal access tokens"
        actions={
          <a class="btn btn-sm btn-primary inline-flex items-center gap-1" href={newTokenUrl()} target="_blank" rel="noreferrer">
            Generate new token (classic)
            <Octicon icon={linkExternalIcon} size={12} />
          </a>
        }
      />
      <p class="mb-2">
        Tokens you have generated that can be used to access the GitHub API. The API can't list, create or revoke
        personal access tokens, so manage them on github.com:
      </p>
      <ul class="list-disc pl-5 mb-6 text-sm">
        <li>
          <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">
            Tokens (classic)
          </a>
        </li>
        <li>
          <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noreferrer">
            Fine-grained tokens
          </a>
        </li>
      </ul>

      <Subhead title="Current token" small />
      <div class="Box">
        <div class="Box-row flex items-start gap-3">
          <Octicon icon={keyAsteriskIcon} size={24} class="text-fg-muted" />
          <div class="flex-1 min-w-0">
            <strong>{KIND_LABEL[info().kind]}</strong>
            <code class="block font-mono text-xs text-fg-muted mt-0.5">{masked(getToken() ?? '')}</code>
            <p class="text-sm text-fg-muted mt-1">
              The token GitHub Lite uses in this browser. It is stored in localStorage and only sent to api.github.com.
            </p>
          </div>
        </div>

        <div class="Box-row">
          <h3 class="text-sm font-semibold mb-2">Scopes</h3>
          <Show
            when={info().scopes}
            fallback={
              <p class="text-sm text-fg-muted">
                This is a fine-grained or OAuth token without classic scopes — the API doesn't report its permissions.
                Missing permissions show up as "not found" errors on the pages that need them.
              </p>
            }
          >
            {(scopes) => (
              <Show when={scopes().length} fallback={<p class="text-sm text-fg-muted">No scopes — read-only access to public data.</p>}>
                <div class="flex flex-wrap gap-1">
                  <For each={scopes()}>{(s) => <span class="Label Label--accent font-mono">{s}</span>}</For>
                </div>
              </Show>
            )}
          </Show>
        </div>

        <div class="Box-row text-sm">
          <h3 class="font-semibold mb-1">Expiration</h3>
          <Show when={info().expiration} fallback={<p class="text-fg-muted">No expiration date reported.</p>}>
            {(exp) => <p>Expires {formatExpiration(exp())}</p>}
          </Show>
        </div>

        <Show when={info().sso}>
          {(sso) => (
            <div class="Box-row text-sm">
              <h3 class="font-semibold mb-1">SAML single sign-on</h3>
              <p class="text-fg-muted break-all">
                Some organizations require this token to be authorized for SSO: <code class="font-mono">{sso()}</code>
              </p>
            </div>
          )}
        </Show>
      </div>

      <Show when={info().scopes}>
        <Subhead title="Recommended scopes" small />
        <Show
          when={missing().length}
          fallback={
            <div class="flash flash-success">
              <Octicon icon={checkCircleIcon} />
              <p>Your token has every scope GitHub Lite uses.</p>
            </div>
          }
        >
          <div class="flash flash-warn">
            <Octicon icon={alertIcon} />
            <div class="flex-1">
              <p>Some features (emails, keys, blocked users, profile editing, …) need scopes your token doesn't have:</p>
              <div class="flex flex-wrap gap-1 my-2">
                <For each={missing()}>{(s) => <span class="Label Label--attention font-mono">{s}</span>}</For>
              </div>
              <a class="btn btn-sm" href={newTokenUrl()} target="_blank" rel="noreferrer">
                Generate a token with all recommended scopes
              </a>
            </div>
          </div>
        </Show>
      </Show>

      <p class="text-sm text-fg-muted mt-6 flex items-start gap-2">
        <Octicon icon={infoIcon} class="mt-0.5" />
        <span>To switch tokens, sign out from the user menu and sign in again with the new token.</span>
      </p>
    </>
  );
}
