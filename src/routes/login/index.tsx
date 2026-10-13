import { Title } from '@solidjs/meta';
import { useLocation, useNavigate } from '@solidjs/router';
import { createMemo, createSignal, Loading, Show } from 'solid-js';
import Octicon from '../../components/Octicon';
import { alertIcon, keyIcon, markGithubIcon } from '../../icons/octicons';
import { newTokenUrl, rememberReturnTo, SCOPES, signIn, takeReturnTo } from '../../lib/auth';
import { API_URL } from '../../lib/github';
import { getOAuthClientId } from '../../lib/oauth';

const STATE_KEY = 'gh-lite:oauth-state';

/** Rendered at /login, and in place of any page while signed out. */
export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token, setToken] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  // null when the server has no OAuth app configured (or there is no server).
  const clientId = createMemo(() => getOAuthClientId().catch(() => null));

  const finish = () => {
    if (location.pathname.startsWith('/login')) navigate(takeReturnTo(), { replace: true });
  };

  const submitToken = async (e: SubmitEvent) => {
    e.preventDefault();
    const value = token().trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/user`, { headers: { Authorization: `Bearer ${value}` } });
      if (!res.ok) throw new Error(res.status === 401 ? 'That token is not valid.' : `GitHub answered ${res.status}.`);
      signIn(value);
      finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const startOAuth = (id: string) => {
    const state = crypto.randomUUID();
    sessionStorage.setItem(STATE_KEY, state);
    if (!location.pathname.startsWith('/login')) rememberReturnTo(location.pathname + location.search);
    const params = new URLSearchParams({
      client_id: id,
      redirect_uri: `${window.location.origin}/login/callback`,
      scope: SCOPES.join(' '),
      state,
      allow_signup: 'false',
    });
    window.location.href = `https://github.com/login/oauth/authorize?${params}`;
  };

  return (
    <div class="min-h-screen bg-canvas-inset flex flex-col items-center px-4 pt-12">
      <Title>Sign in · GitHub Lite</Title>
      <Octicon icon={markGithubIcon} size={48} />
      <h1 class="mt-6 mb-4 text-2xl font-light">Sign in to GitHub Lite</h1>
      <div class="w-full max-w-[340px]">
        <Show when={error()}>
          <div class="flash flash-error mb-4">
            <Octicon icon={alertIcon} />
            <span>{error()}</span>
          </div>
        </Show>
        <div class="Box p-4 bg-canvas-muted">
          <Loading>
            <Show when={clientId()}>
              {(id) => (
                <>
                  <button type="button" class="btn btn-primary btn-block" onClick={() => startOAuth(id())}>
                    <Octicon icon={markGithubIcon} /> Sign in with GitHub
                  </button>
                  <div class="flex items-center gap-2 my-4 text-xs text-fg-muted">
                    <hr class="flex-1 border-line" /> or <hr class="flex-1 border-line" />
                  </div>
                </>
              )}
            </Show>
          </Loading>
          <form onSubmit={submitToken}>
            <label class="form-label" for="token">
              Personal access token
            </label>
            <input
              id="token"
              class="form-control font-mono"
              type="password"
              autocomplete="off"
              placeholder="ghp_…"
              value={token()}
              onInput={(e) => setToken(e.currentTarget.value)}
              autofocus
            />
            <button type="submit" class="btn btn-primary btn-block mt-4" disabled={busy() || !token().trim()}>
              {busy() ? 'Signing in…' : 'Sign in with token'}
            </button>
          </form>
        </div>
        <div class="Box p-4 mt-4 text-sm">
          <p>
            <Octicon icon={keyIcon} class="text-fg-muted mr-1" />
            <a href={newTokenUrl()} target="_blank" rel="noreferrer">
              Generate a classic token
            </a>{' '}
            with the scopes pre-selected — it allows everything the API can do (repos, orgs, workflows, settings).
          </p>
          <p class="mt-2 text-fg-muted text-xs">
            Fine-grained tokens work too, limited to what you grant them. The token is stored only in this
            browser and sent only to api.github.com.
          </p>
        </div>
      </div>
    </div>
  );
}
