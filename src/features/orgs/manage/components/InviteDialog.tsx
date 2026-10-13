import { useAction } from '@solidjs/router';
import { createMemo, createOptimistic, createSignal, For, Loading, Show } from 'solid-js';
import { Dialog, Spinner, toast, toastError } from '../../../../components/ui';
import { getTeamOptions, inviteMember, type InviteRole } from '../api';

const ROLES: { value: InviteRole; title: string; desc: string }[] = [
  { value: 'direct_member', title: 'Member', desc: 'Members can see all other members, and can be granted access to repositories. They can also create new teams and repositories.' },
  { value: 'admin', title: 'Owner', desc: 'Owners have full administrative rights to the organization and have complete access to all repositories and teams.' },
  { value: 'billing_manager', title: 'Billing manager', desc: 'Billing managers can manage billing settings and see payment history. They have no access to repositories.' },
];

/** "Invite member": username or email, role, optional teams → POST /orgs/:org/invitations. */
export default function InviteDialog(props: { org: string; open: boolean; onClose: () => void }) {
  const [invitee, setInvitee] = createSignal('');
  const [role, setRole] = createSignal<InviteRole>('direct_member');
  const [teams, setTeams] = createSignal<number[]>([]);
  const [busy, setBusy] = createOptimistic(false);
  const invite = useAction(inviteMember);

  const reset = () => {
    setInvitee('');
    setRole('direct_member');
    setTeams([]);
  };
  const close = () => {
    reset();
    props.onClose();
  };

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    const who = invitee().trim();
    if (!who) return;
    setBusy(true);
    try {
      await invite(props.org, who, role(), role() === 'billing_manager' ? [] : teams());
      toast(`Invitation sent to ${who}`, 'success');
      close();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open={props.open} onClose={close} title={`Invite a member to ${props.org}`} width="520px">
      <form onSubmit={submit}>
        <div class="form-group mt-0!">
          <label for="invite-who">Username or email address</label>
          <input
            id="invite-who"
            class="form-control"
            placeholder="Search by username, full name, or email"
            autocomplete="off"
            autofocus
            required
            value={invitee()}
            onInput={(e) => setInvitee(e.currentTarget.value)}
          />
        </div>
        <fieldset class="form-group">
          <legend class="form-label">Role in the organization</legend>
          <For each={ROLES}>
            {(r) => (
              <label class="flex! items-start gap-2 py-1.5 font-normal! cursor-pointer">
                <input type="radio" name="invite-role" class="mt-1" checked={role() === r.value} onChange={() => setRole(r.value)} />
                <span>
                  <span class="block font-semibold text-sm">{r.title}</span>
                  <span class="block text-xs text-fg-muted">{r.desc}</span>
                </span>
              </label>
            )}
          </For>
        </fieldset>
        <Show when={role() !== 'billing_manager'}>
          <div class="form-group">
            <span class="form-label">
              Teams <span class="font-normal text-fg-muted">(optional)</span>
            </span>
            <Loading
              fallback={
                <div class="py-2 text-fg-muted">
                  <Spinner size={16} />
                </div>
              }
            >
              <TeamPicker org={props.org} value={teams()} onChange={setTeams} />
            </Loading>
          </div>
        </Show>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="btn" onClick={close}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={busy() || !invitee().trim()}>
            {busy() ? 'Sending…' : 'Send invitation'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function TeamPicker(props: { org: string; value: number[]; onChange: (ids: number[]) => void }) {
  const options = createMemo(() => getTeamOptions(props.org));
  const [filter, setFilter] = createSignal('');
  const visible = () => {
    const f = filter().toLowerCase();
    return f ? options().filter((t) => t.name.toLowerCase().includes(f) || t.slug.includes(f)) : options();
  };
  return (
    <Show when={options().length} fallback={<p class="note">This organization has no teams yet.</p>}>
      <div class="Box">
        <div class="p-2 border-b border-line-muted">
          <input
            class="form-control form-control-sm"
            placeholder="Filter teams"
            aria-label="Filter teams"
            value={filter()}
            onInput={(e) => setFilter(e.currentTarget.value)}
          />
        </div>
        <div class="max-h-[200px] overflow-auto py-1">
          <For each={visible()}>
            {(t) => (
              <label class="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-canvas-muted">
                <input
                  type="checkbox"
                  checked={props.value.includes(t.id)}
                  onChange={(e) =>
                    props.onChange(
                      e.currentTarget.checked ? [...props.value, t.id] : props.value.filter((id) => id !== t.id),
                    )
                  }
                />
                <span class="flex-1 truncate">{t.name}</span>
                <Show when={t.privacy === 'secret'}>
                  <span class="Label">Secret</span>
                </Show>
              </label>
            )}
          </For>
        </div>
      </div>
      <Show when={props.value.length}>
        <p class="note">{props.value.length} selected</p>
      </Show>
    </Show>
  );
}
