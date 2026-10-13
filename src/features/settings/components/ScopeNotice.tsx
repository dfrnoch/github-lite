import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { alertIcon } from '../../../icons/octicons';
import { newTokenUrl } from '../../../lib/auth';

/**
 * Shown in place of a list the token isn't allowed to read: GitHub answers
 * 404/403 when a classic token lacks the scope (or a fine-grained token the
 * permission).
 */
export default function ScopeNotice(props: { scope: string; what: string; children?: JSX.Element }) {
  return (
    <div class="flash flash-warn mb-4">
      <Octicon icon={alertIcon} />
      <div class="flex-1">
        <p>
          Your token can't read {props.what}. Classic tokens need the <code class="font-mono text-xs">{props.scope}</code>{' '}
          scope (or the matching permission on a fine-grained token).
        </p>
        <Show when={props.children}>
          <p class="mt-1">{props.children}</p>
        </Show>
        <p class="mt-2 flex flex-wrap gap-2">
          <a class="btn btn-sm" href={newTokenUrl()} target="_blank" rel="noreferrer">
            Generate a token with all scopes
          </a>
          <a class="btn btn-sm" href="/settings/tokens">
            Inspect current token
          </a>
        </p>
      </div>
    </div>
  );
}
