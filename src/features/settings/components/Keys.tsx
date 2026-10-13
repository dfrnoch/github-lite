import { useAction } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dialog, RelativeTime, toast, toastError } from '../../../components/ui';
import { keyIcon } from '../../../icons/octicons';
import { formatDate } from '../../../lib/format';
import { addKey, deleteKey, type GpgKey, type KeyKind, type SshKey } from '../api';

const NOUN: Record<KeyKind, string> = { ssh: 'SSH key', signing: 'SSH signing key', gpg: 'GPG key' };

/** Delete button with confirm() shared by every key row. */
function DeleteKey(props: { kind: KeyKind; id: number; title: string }) {
  const run = useAction(deleteKey);
  const [busy, setBusy] = createSignal(false);
  const onClick = async () => {
    if (!confirm(`Are you sure you want to delete the ${NOUN[props.kind]} "${props.title}"? This action cannot be undone.`)) return;
    setBusy(true);
    try {
      await run(props.kind, props.id);
      toast(`Deleted ${NOUN[props.kind]} "${props.title}"`, 'success');
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" class="btn btn-sm btn-danger" disabled={busy()} onClick={onClick}>
      {busy() ? 'Deleting…' : 'Delete'}
    </button>
  );
}

/** The key glyph with a small type badge under it, like GitHub's key rows. */
function KeyBadge(props: { label: string }) {
  return (
    <div class="flex flex-col items-center gap-1 w-14 shrink-0 text-fg-muted">
      <Octicon icon={keyIcon} size={32} />
      <span class="Label text-[10px]! px-1!">{props.label}</span>
    </div>
  );
}

const keyType = (key: string) => {
  const t = key.trim().split(/\s+/)[0] ?? '';
  return t.replace(/^ssh-/, '').replace(/^sk-/, '').replace(/@openssh\.com$/, '').toUpperCase();
};

export function SshKeyList(props: { kind: 'ssh' | 'signing'; keys: SshKey[]; heading: string }) {
  return (
    <div class="Box">
      <div class="Box-header Box-header--condensed">
        <h3 class="Box-title">{props.heading}</h3>
      </div>
      <ul>
        <For each={props.keys}>
          {(key) => (
            <li class="Box-row flex flex-wrap items-center gap-4">
              <KeyBadge label="SSH" />
              <div class="flex-1 min-w-[220px]">
                <strong class="block">{key.title}</strong>
                <code class="block font-mono text-xs break-all text-fg-muted">
                  {key.fingerprint || `${key.key.slice(0, 40)}…`}
                </code>
                <p class="text-xs text-fg-muted mt-1">
                  {keyType(key.key)} · Added on {formatDate(key.created_at)}
                </p>
                <p class="text-xs text-fg-muted">
                  <Show when={key.last_used} fallback="Never used">
                    {(t) => (
                      <>
                        Last used <RelativeTime datetime={t()} prefix={false} relative />
                      </>
                    )}
                  </Show>
                  <Show when={props.kind === 'ssh' && key.read_only != null}>
                    {' — '}
                    {key.read_only ? 'Read-only' : 'Read/write'}
                  </Show>
                </p>
              </div>
              <DeleteKey kind={props.kind} id={key.id} title={key.title} />
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}

export function GpgKeyList(props: { keys: GpgKey[] }) {
  return (
    <div class="Box">
      <ul>
        <For each={props.keys}>
          {(key) => (
            <li class="Box-row flex flex-wrap items-center gap-4">
              <KeyBadge label="GPG" />
              <div class="flex-1 min-w-[220px] text-sm">
                <Show when={key.name}>
                  <strong class="block">{key.name}</strong>
                </Show>
                <p>
                  <span class="text-fg-muted">Email address: </span>
                  <Show when={key.emails.length} fallback={<span class="text-fg-muted">none</span>}>
                    <For each={key.emails}>
                      {(e, i) => (
                        <>
                          <Show when={i() > 0}>, </Show>
                          <span>{e.email}</span>
                          <Show when={!e.verified}>
                            {' '}
                            <span class="Label Label--attention">Unverified</span>
                          </Show>
                        </>
                      )}
                    </For>
                  </Show>
                </p>
                <p>
                  <span class="text-fg-muted">Key ID: </span>
                  <code class="font-mono text-xs">{key.key_id}</code>
                </p>
                <p>
                  <span class="text-fg-muted">Subkeys: </span>
                  <Show when={key.subkeys.length} fallback="none">
                    <code class="font-mono text-xs">{key.subkeys.map((s) => s.key_id).join(', ')}</code>
                  </Show>
                </p>
                <p class="text-xs text-fg-muted mt-1">
                  Added on {formatDate(key.created_at)}
                  <Show when={key.expires_at} fallback=" · Never expires">
                    {(exp) => (
                      <>
                        {' · '}
                        <span class={{ 'text-fg-danger': new Date(exp()).getTime() < Date.now() }}>
                          {new Date(exp()).getTime() < Date.now() ? 'Expired' : 'Expires'} {formatDate(exp())}
                        </span>
                      </>
                    )}
                  </Show>
                  <Show when={key.revoked}>
                    {' · '}
                    <span class="text-fg-danger">Revoked</span>
                  </Show>
                </p>
              </div>
              <DeleteKey kind="gpg" id={key.id} title={key.name || key.key_id} />
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}

/** "New SSH key" / "New GPG key" button + dialog with the add form. */
export function AddKeyButton(props: { kind: KeyKind; label: string }) {
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <button type="button" class="btn btn-sm btn-primary" onClick={() => setOpen(true)}>
        {props.label}
      </button>
      <AddKeyDialog kind={props.kind} open={open()} onClose={() => setOpen(false)} />
    </>
  );
}

function AddKeyDialog(props: { kind: KeyKind; open: boolean; onClose: () => void }) {
  const run = useAction(addKey);
  const [title, setTitle] = createSignal('');
  const [key, setKey] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const isGpg = () => props.kind === 'gpg';

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await run(props.kind, title().trim(), key().trim());
      toast(`Added ${NOUN[props.kind]}`, 'success');
      setTitle('');
      setKey('');
      props.onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const placeholder: Record<KeyKind, string> = {
    ssh: "Begins with 'ssh-rsa', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-ed25519', 'sk-ecdsa-sha2-nistp256@openssh.com', or 'sk-ssh-ed25519@openssh.com'",
    signing: "Begins with 'ssh-rsa', 'ecdsa-sha2-nistp256', 'ssh-ed25519', 'sk-ecdsa-sha2-nistp256@openssh.com', or 'sk-ssh-ed25519@openssh.com'",
    gpg: "Begins with '-----BEGIN PGP PUBLIC KEY BLOCK-----'",
  };

  return (
    <Dialog open={props.open} onClose={props.onClose} title={`Add new ${NOUN[props.kind]}`} width="640px">
      <form onSubmit={submit}>
        <div class="form-group mt-0!">
          <label for={`key-title-${props.kind}`}>Title</label>
          <input
            id={`key-title-${props.kind}`}
            class="form-control"
            required={!isGpg()}
            placeholder={isGpg() ? 'Optional name for this key' : undefined}
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
          />
        </div>
        <Show when={props.kind === 'ssh'}>
          <p class="note">Key type: Authentication key. Add signing keys in the "SSH signing keys" section.</p>
        </Show>
        <div class="form-group">
          <label for={`key-body-${props.kind}`}>Key</label>
          <textarea
            id={`key-body-${props.kind}`}
            class="form-control font-mono text-xs! min-h-[180px]!"
            required
            spellcheck="false"
            placeholder={placeholder[props.kind]}
            value={key()}
            onInput={(e) => setKey(e.currentTarget.value)}
          />
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="btn" onClick={() => props.onClose()}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={busy() || !key().trim()}>
            {busy() ? 'Adding…' : `Add ${NOUN[props.kind]}`}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Small explanatory footer under a key section. */
export function KeyHelp(props: { children: JSX.Element }) {
  return <p class="text-sm text-fg-muted mt-3">{props.children}</p>;
}
