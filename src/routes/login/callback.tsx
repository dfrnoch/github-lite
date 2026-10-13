import { Title } from '@solidjs/meta';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { createSignal, onSettled, Show } from 'solid-js';
import Octicon from '../../components/Octicon';
import { Spinner } from '../../components/ui';
import { alertIcon } from '../../icons/octicons';
import { signIn, takeReturnTo } from '../../lib/auth';
import { exchangeOAuthCode } from '../../lib/oauth';

/** OAuth redirect target: trades ?code for a token on the server, then signs in. */
export default function OAuthCallback() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = createSignal<string | null>(null);

  onSettled(() => {
    const code = search.code as string | undefined;
    const state = search.state as string | undefined;
    const expected = sessionStorage.getItem('gh-lite:oauth-state');
    sessionStorage.removeItem('gh-lite:oauth-state');
    if (search.error) {
      setError(String(search.error_description ?? search.error));
      return;
    }
    if (!code || !state || state !== expected) {
      setError('Invalid OAuth state. Please try signing in again.');
      return;
    }
    exchangeOAuthCode(code)
      .then(({ token }) => {
        signIn(token);
        navigate(takeReturnTo(), { replace: true });
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  });

  return (
    <div class="min-h-screen bg-canvas-inset flex flex-col items-center pt-24 px-4">
      <Title>Signing in · GitHub Lite</Title>
      <Show
        when={error()}
        fallback={
          <div class="flex items-center gap-3 text-fg-muted">
            <Spinner size={24} /> Signing you in…
          </div>
        }
      >
        <div class="flash flash-error max-w-md">
          <Octicon icon={alertIcon} />
          <div>
            {error()} <a href="/login">Back to sign in</a>
          </div>
        </div>
      </Show>
    </div>
  );
}
