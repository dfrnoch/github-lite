import { Title } from '@solidjs/meta';
import { useNavigate } from '@solidjs/router';
import { createSignal } from 'solid-js';
import { toast, toastError } from '../../../../../components/ui';
import { addDeployKey } from '../../../../../features/repo-settings/api';
import { CheckboxSetting, Subhead } from '../../../../../features/repo-settings/components/ui';
import { useRepo } from '../../../../../features/repo/context';

/** /:owner/:repo/settings/keys/new */
export default function NewDeployKey() {
  const ctx = useRepo();
  const navigate = useNavigate();
  const [title, setTitle] = createSignal('');
  const [key, setKey] = createSignal('');
  const [write, setWrite] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  return (
    <>
      <Title>{`Add deploy key · ${ctx.fullName()}`}</Title>
      <Subhead title={<><a class="link-muted" href={`${ctx.base()}/settings/keys`}>Deploy keys</a> / Add new</>} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await addDeployKey(ctx.owner(), ctx.name(), { title: title().trim(), key: key().trim(), read_only: !write() });
            toast('Deploy key added', 'success');
            navigate(`${ctx.base()}/settings/keys`);
          } catch (err) {
            toastError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div class="form-group mt-0!">
          <label for="dk-title">Title</label>
          <input id="dk-title" class="form-control max-w-[440px]" required value={title()} onInput={(e) => setTitle(e.currentTarget.value)} />
        </div>
        <div class="form-group">
          <label for="dk-key">Key</label>
          <textarea
            id="dk-key"
            class="form-control font-mono text-xs! min-h-[180px]!"
            required
            placeholder="Begins with 'ssh-rsa', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'ssh-ed25519', 'sk-ecdsa-sha2-nistp256@openssh.com', or 'sk-ssh-ed25519@openssh.com'"
            value={key()}
            onInput={(e) => setKey(e.currentTarget.value)}
          />
        </div>
        <CheckboxSetting
          label="Allow write access"
          description="Can this key be used to push to this repository? Deploy keys always have pull access."
          checked={write()}
          onChange={setWrite}
        />
        <button type="submit" class="btn btn-primary mt-3" disabled={busy() || !title().trim() || !key().trim()}>
          {busy() ? 'Adding…' : 'Add key'}
        </button>
      </form>
    </>
  );
}
