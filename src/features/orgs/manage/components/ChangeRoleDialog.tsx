import { useAction } from '@solidjs/router';
import { createOptimistic, createSignal, Show } from 'solid-js';
import { Dialog, toast, toastError } from '../../../../components/ui';
import { pluralize } from '../../../../lib/format';
import { setMemberRole } from '../api';

/** "Change role" for one or more org members: Owner / Member. */
export default function ChangeRoleDialog(props: {
  org: string;
  logins: string[];
  current: 'admin' | 'member';
  open: boolean;
  onClose: () => void;
}) {
  const [role, setRole] = createSignal<'admin' | 'member'>(() => props.current);
  const [busy, setBusy] = createOptimistic(false);
  const save = useAction(setMemberRole);
  const who = () => (props.logins.length === 1 ? props.logins[0] : pluralize(props.logins.length, 'member'));

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await save(props.org, props.logins, role());
      toast(`Changed the role of ${who()} to ${role() === 'admin' ? 'Owner' : 'Member'}`, 'success');
      props.onClose();
    } catch (err) {
      toastError(err);
    }
  };

  const Option = (p: { value: 'admin' | 'member'; title: string; desc: string }) => (
    <label class="flex items-start gap-2 p-3 border border-line rounded-md mb-2 cursor-pointer has-[:checked]:border-line-accent has-[:checked]:bg-accent-muted">
      <input type="radio" name="org-role" class="mt-1" checked={role() === p.value} onChange={() => setRole(p.value)} />
      <span>
        <span class="block font-semibold text-sm">{p.title}</span>
        <span class="block text-xs text-fg-muted">{p.desc}</span>
      </span>
    </label>
  );

  return (
    <Dialog open={props.open} onClose={props.onClose} title={<>Change the role of {who()}?</>} width="480px">
      <form onSubmit={submit}>
        <Option value="member" title="Member" desc="Members can see all other members, and can be granted access to repositories. They can also create new teams and repositories." />
        <Option value="admin" title="Owner" desc="Owners have full administrative rights to the organization and have complete access to all repositories and teams." />
        <Show when={role() === 'admin'}>
          <p class="note mb-2">Owners can remove other owners, change billing and delete the organization.</p>
        </Show>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="btn" onClick={() => props.onClose()}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={busy()}>
            {busy() ? 'Changing…' : 'Change role'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
