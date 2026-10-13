import type { JSX } from '@solidjs/web';
import { createMemo, Errored, Loading, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { PageSpinner } from '../../../../components/ui';
import { alertIcon } from '../../../../icons/octicons';
import { newTokenUrl } from '../../../../lib/auth';
import { GitHubError } from '../../../../lib/github';
import { getTokenInfo, hasScope } from '../../../settings/api';

/**
 * Warns when the token can read but not change org data (classic tokens
 * without `admin:org` / `write:org`). Fine-grained tokens report no scopes,
 * so nothing is shown for them. Mount it unconditionally and gate with
 * `when` so the token lookup starts with the page's other requests.
 */
export function ScopeNotice(props: { scope: 'admin:org' | 'write:org'; what: string; when?: boolean; class?: string }) {
  const token = createMemo(() => getTokenInfo());
  const missing = () => {
    const scopes = token().scopes;
    return scopes != null && !hasScope(scopes, props.scope);
  };
  return (
    <Errored fallback={null}>
      <Loading fallback={null}>
        <Show when={props.when !== false && missing()}>
          <div class={['flash flash-warn', props.class ?? 'mb-4']}>
            <Octicon icon={alertIcon} />
            <p>
              Your token is missing the <code class="font-mono text-xs">{props.scope}</code> scope, so {props.what} will be
              rejected by GitHub.{' '}
              <a href={newTokenUrl()} target="_blank" rel="noreferrer">
                Generate a new token
              </a>
              .
            </p>
          </div>
        </Show>
      </Loading>
    </Errored>
  );
}

/** Inline error for an admin-only section (403/404 when the token lacks a scope). */
export function SectionError(props: { error: unknown; reset?: () => void }) {
  const status = () => (props.error instanceof GitHubError ? props.error.status : 0);
  return (
    <div class="flash flash-error">
      <Octicon icon={alertIcon} />
      <div class="flex-1 min-w-0">
        <strong>
          {status() === 403 || status() === 404
            ? 'GitHub refused this request — your token may lack the admin:org scope, or you are not an owner.'
            : 'Something went wrong'}
        </strong>
        <div class="mt-1 text-sm break-words">{props.error instanceof Error ? props.error.message : String(props.error)}</div>
      </div>
      <Show when={props.reset}>
        <button type="button" class="btn btn-sm" onClick={() => props.reset?.()}>
          Retry
        </button>
      </Show>
    </div>
  );
}

/** <Errored> + <Loading> pair for a section of a page. */
export function Section(props: { children: JSX.Element; fallback?: JSX.Element }) {
  return (
    <Errored fallback={(err, reset) => <SectionError error={err()} reset={reset} />}>
      <Loading fallback={props.fallback ?? <PageSpinner />}>{props.children}</Loading>
    </Errored>
  );
}
