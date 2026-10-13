import { useNavigate } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';
import { toast, toastError } from '../../../components/ui';
import { putActionsSecret, saveActionsVariable } from '../api';
import { Subhead } from './ui';

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * New/update form for an Actions secret (`kind="secret"`, value is sealed
 * with the repo public key) or variable (plain value, renameable).
 */
export default function SecretForm(props: {
  kind: 'secret' | 'variable';
  owner: string;
  repo: string;
  base: string;
  /** Existing name when updating. */
  name?: string;
  value?: string;
}) {
  const navigate = useNavigate();
  const [name, setName] = createSignal(() => props.name ?? '');
  const [value, setValue] = createSignal(() => props.value ?? '');
  const [busy, setBusy] = createSignal(false);
  const listHref = () => `${props.base}/settings/${props.kind === 'secret' ? 'secrets' : 'variables'}/actions`;
  const label = () => (props.kind === 'secret' ? 'Secret' : 'Variable');
  const nameError = () => {
    const n = name().trim();
    if (!n) return '';
    if (!NAME_RE.test(n)) return 'Names can only contain alphanumeric characters ([a-z], [A-Z], [0-9]) or underscores (_), and cannot start with a number.';
    if (n.toUpperCase().startsWith('GITHUB_')) return 'Names must not start with GITHUB_.';
    return '';
  };

  return (
    <>
      <Subhead
        title={
          <>
            <a class="link-muted" href={listHref()}>
              Actions {props.kind === 'secret' ? 'secrets' : 'variables'}
            </a>{' '}
            / {props.name ? `Update ${props.kind}` : `New ${props.kind}`}
          </>
        }
      />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (nameError()) return;
          setBusy(true);
          try {
            const n = name().trim().toUpperCase();
            if (props.kind === 'secret') await putActionsSecret(props.owner, props.repo, n, value());
            else await saveActionsVariable(props.owner, props.repo, props.name ?? null, n, value());
            toast(`${label()} ${props.name ? 'updated' : 'added'}`, 'success');
            navigate(listHref());
          } catch (err) {
            toastError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div class="form-group mt-0!">
          <label for="secret-name">Name *</label>
          <input
            id="secret-name"
            class="form-control max-w-[440px] font-mono"
            required
            disabled={props.kind === 'secret' && !!props.name}
            placeholder={props.kind === 'secret' ? 'YOUR_SECRET_NAME' : 'YOUR_VARIABLE_NAME'}
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
          <Show when={nameError()}>
            <p class="note text-fg-danger!">{nameError()}</p>
          </Show>
        </div>
        <div class="form-group">
          <label for="secret-value">{props.kind === 'secret' ? 'Secret *' : 'Value *'}</label>
          <textarea
            id="secret-value"
            class="form-control font-mono text-xs! min-h-[160px]!"
            required
            placeholder={props.name && props.kind === 'secret' ? 'Enter a new value' : ''}
            value={value()}
            onInput={(e) => setValue(e.currentTarget.value)}
          />
          <Show when={props.kind === 'secret'}>
            <p class="note">The value is encrypted in your browser before it is sent to GitHub.</p>
          </Show>
        </div>
        <button type="submit" class="btn btn-primary" disabled={busy() || !name().trim() || !value() || !!nameError()}>
          {busy() ? 'Saving…' : props.name ? `Update ${props.kind}` : `Add ${props.kind}`}
        </button>
      </form>
    </>
  );
}
