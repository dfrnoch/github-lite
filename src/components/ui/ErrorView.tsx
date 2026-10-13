import { Show } from 'solid-js';
import { alertIcon } from '../../icons/octicons';
import { GitHubError } from '../../lib/github';
import Octicon from '../Octicon';

/**
 * Fallback for <Errored>: a GitHub-style 404 for missing resources (the API
 * also answers 404 for private things the token can't see), otherwise the
 * error message with a retry.
 */
export default function ErrorView(props: { error: unknown; reset?: () => void }) {
  const err = () => props.error;
  const status = () => (err() instanceof GitHubError ? (err() as GitHubError).status : 0);
  return (
    <Show
      when={status() !== 404}
      fallback={
        <div class="py-24 text-center">
          <div class="text-[120px] font-bold leading-none text-fg-muted opacity-30 select-none">404</div>
          <h1 class="mt-4 text-2xl">This is not the web page you are looking for.</h1>
          <p class="mt-2 text-fg-muted">
            It may not exist, or your token may not have access to it.{' '}
            <a href="/">Go to your dashboard</a>.
          </p>
        </div>
      }
    >
      <div class="container-lg p-4">
        <div class="flash flash-error">
          <Octicon icon={alertIcon} />
          <div class="flex-1">
            <strong>{status() === 403 ? 'Access denied or rate limited' : 'Something went wrong'}</strong>
            <div class="mt-1 break-words">{err() instanceof Error ? (err() as Error).message : String(err())}</div>
          </div>
          <Show when={props.reset}>
            <button type="button" class="btn btn-sm" onClick={() => props.reset?.()}>
              Retry
            </button>
          </Show>
        </div>
      </div>
    </Show>
  );
}
