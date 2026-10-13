import { Title } from '@solidjs/meta';
import { useAction } from '@solidjs/router';
import { createMemo, createSignal, For, Show } from 'solid-js';
import Octicon from '../../../../../components/Octicon';
import { Blankslate, RelativeTime } from '../../../../../components/ui';
import { deleteDeployKey, getDeployKeys } from '../../../../../features/repo-settings/api';
import { ConfirmDialog, Subhead } from '../../../../../features/repo-settings/components/ui';
import { useRepo } from '../../../../../features/repo/context';
import { keyIcon } from '../../../../../icons/octicons';

/** SHA256 fingerprint of an OpenSSH public key, like `ssh-keygen -l`. */
async function fingerprint(key: string) {
  try {
    const b64 = key.trim().split(/\s+/)[1] ?? '';
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return `SHA256:${btoa(String.fromCharCode(...hash)).replace(/=+$/, '')}`;
  } catch {
    return '';
  }
}

/** /:owner/:repo/settings/keys — deploy keys. */
export default function DeployKeys() {
  const ctx = useRepo();
  const keys = createMemo(() => getDeployKeys(ctx.owner(), ctx.name()));
  const remove = useAction(deleteDeployKey);
  const [deleting, setDeleting] = createSignal<{ id: number; title: string } | null>(null);
  return (
    <>
      <Title>{`Deploy keys · ${ctx.fullName()}`}</Title>
      <Subhead
        title="Deploy keys"
        actions={
          <a class="btn btn-sm" href={`${ctx.base()}/settings/keys/new`}>
            Add deploy key
          </a>
        }
      />
      <div class="Box">
        <For
          each={keys()}
          fallback={
            <Blankslate icon={keyIcon} title="There are no deploy keys for this repository">
              Deploy keys are SSH keys that grant access to a single repository.
            </Blankslate>
          }
        >
          {(k) => {
            const fp = createMemo(() => fingerprint(k.key));
            return (
              <div class="Box-row flex items-center gap-4">
                <div class="flex flex-col items-center w-16 shrink-0">
                  <Octicon icon={keyIcon} size={32} class={k.verified ? 'text-fg-success' : 'text-fg-muted'} />
                  <span class="Label mt-1">SSH</span>
                </div>
                <div class="flex-1 min-w-0">
                  <strong class="block">{k.title}</strong>
                  <code class="text-xs font-mono text-fg-muted break-all">{fp()}</code>
                  <p class="text-xs text-fg-muted">
                    Added <RelativeTime datetime={k.created_at} />
                    <Show when={k.added_by}> by {k.added_by}</Show>
                  </p>
                  <p class="text-xs text-fg-muted">
                    <Show when={k.last_used} fallback="Never used">
                      Last used <RelativeTime datetime={k.last_used} />
                    </Show>
                    {' — '}
                    {k.read_only ? 'Read-only' : 'Read/write'}
                  </p>
                </div>
                <button type="button" class="btn btn-sm btn-danger" onClick={() => setDeleting({ id: k.id, title: k.title })}>
                  Delete
                </button>
              </div>
            );
          }}
        </For>
      </div>
      <p class="note mt-2">
        Read-only deploy keys can clone; keys with write access can also push to this repository.
      </p>
      <ConfirmDialog
        open={deleting() != null}
        onClose={() => setDeleting(null)}
        title="Are you sure you want to delete this SSH key?"
        button="I understand, delete this SSH key"
        onConfirm={() => remove(ctx.owner(), ctx.name(), deleting()!.id)}
      >
        <p>This action cannot be undone. This will permanently delete the SSH key “{deleting()?.title}”.</p>
      </ConfirmDialog>
    </>
  );
}
