import { useAction, useNavigate } from '@solidjs/router';
import { createMemo, createOptimistic, createSignal, For, Loading, Show } from 'solid-js';
import { Dialog, toast, toastError } from '../../../../components/ui';
import { createTeam, getTeamOptions, type TeamDetail, type TeamInput, updateTeam } from '../api';

/**
 * Create (no `team`) or edit a team: name, description, parent, visibility
 * and notifications. Navigates to the team afterwards (a rename changes
 * its slug, and so its URL).
 */
export default function TeamDialog(props: {
  org: string;
  open: boolean;
  onClose: () => void;
  team?: TeamDetail;
  /** Path after the team slug to keep when a rename changes the URL ("/members"). */
  subpath?: string;
}) {
  const navigate = useNavigate();
  const create = useAction(createTeam);
  const update = useAction(updateTeam);
  const [name, setName] = createSignal(() => props.team?.name ?? '');
  const [description, setDescription] = createSignal(() => props.team?.description ?? '');
  const [parent, setParent] = createSignal<number | null>(() => props.team?.parent?.id ?? null);
  const [privacy, setPrivacy] = createSignal<'closed' | 'secret'>(() => props.team?.privacy ?? 'closed');
  const [notify, setNotify] = createSignal(() => (props.team?.notification_setting ?? 'notifications_enabled') === 'notifications_enabled');
  const [busy, setBusy] = createOptimistic(false);

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!name().trim()) return;
    const input: TeamInput = {
      name: name().trim(),
      description: description().trim(),
      // Nested teams can't be secret.
      privacy: parent() != null ? 'closed' : privacy(),
      parent_team_id: parent(),
      notification_setting: notify() ? 'notifications_enabled' : 'notifications_disabled',
    };
    setBusy(true);
    try {
      if (props.team) {
        const slug = await update(props.org, props.team.slug, input);
        toast('Team settings saved', 'success');
        props.onClose();
        if (slug && slug !== props.team.slug) navigate(`/orgs/${props.org}/teams/${slug}${props.subpath ?? ''}`, { replace: true });
      } else {
        const slug = await create(props.org, input);
        toast(`Created team ${input.name}`, 'success');
        props.onClose();
        navigate(`/orgs/${props.org}/teams/${slug}`);
      }
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open={props.open} onClose={props.onClose} title={props.team ? `Edit ${props.team.name}` : 'Create new team'} width="560px">
      <form onSubmit={submit}>
        <div class="form-group mt-0!">
          <label for="team-name">Team name</label>
          <input
            id="team-name"
            class="form-control"
            required
            autofocus
            autocomplete="off"
            placeholder="e.g. core-maintainers"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
          <p class="note">You’ll use this name to mention this team in conversations.</p>
        </div>
        <div class="form-group">
          <label for="team-description">Description</label>
          <input
            id="team-description"
            class="form-control"
            placeholder="What is this team all about?"
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
          />
        </div>
        <div class="form-group">
          <label for="team-parent">Parent team</label>
          <Loading fallback={<select class="form-select" disabled />}>
            <ParentSelect org={props.org} team={props.team} value={parent()} disabled={privacy() === 'secret'} onChange={setParent} />
          </Loading>
          <p class="note">
            {privacy() === 'secret' ? 'Secret teams can’t be nested.' : 'Child teams inherit the parent’s access permissions.'}
          </p>
        </div>
        <fieldset class="form-group">
          <legend class="form-label">Team visibility</legend>
          <Radio
            name="team-privacy"
            checked={privacy() === 'closed' || parent() != null}
            onChange={() => setPrivacy('closed')}
            title="Visible"
            desc="Recommended. A visible team can be seen and @mentioned by every member of this organization."
          />
          <Radio
            name="team-privacy"
            checked={privacy() === 'secret' && parent() == null}
            disabled={parent() != null}
            onChange={() => setPrivacy('secret')}
            title="Secret"
            desc="A secret team can only be seen by its members and may not be nested."
          />
        </fieldset>
        <fieldset class="form-group">
          <legend class="form-label">Team notifications</legend>
          <Radio
            name="team-notify"
            checked={notify()}
            onChange={() => setNotify(true)}
            title="Enabled"
            desc="Everyone will be notified when the team is @mentioned."
          />
          <Radio
            name="team-notify"
            checked={!notify()}
            onChange={() => setNotify(false)}
            title="Disabled"
            desc="No one will receive notifications."
          />
        </fieldset>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="btn" onClick={() => props.onClose()}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={busy() || !name().trim()}>
            {busy() ? 'Saving…' : props.team ? 'Save changes' : 'Create team'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function Radio(props: { name: string; checked: boolean; disabled?: boolean; onChange: () => void; title: string; desc: string }) {
  return (
    <label class={['flex! items-start gap-2 py-1.5 font-normal! mb-0!', props.disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer']}>
      <input type="radio" name={props.name} class="mt-1" checked={props.checked} disabled={props.disabled} onChange={() => props.onChange()} />
      <span>
        <span class="block font-semibold text-sm">{props.title}</span>
        <span class="block text-xs text-fg-muted">{props.desc}</span>
      </span>
    </label>
  );
}

function ParentSelect(props: {
  org: string;
  team?: TeamDetail;
  value: number | null;
  disabled: boolean;
  onChange: (id: number | null) => void;
}) {
  const teams = createMemo(() => getTeamOptions(props.org));
  // A team can't be nested under itself or one of its descendants, nor under a secret team.
  const options = createMemo(() => {
    const all = teams();
    const self = props.team?.slug;
    const excluded = new Set<string>();
    if (self) {
      excluded.add(self);
      let grew = true;
      while (grew) {
        grew = false;
        for (const t of all) {
          if (t.parent && excluded.has(t.parent) && !excluded.has(t.slug)) {
            excluded.add(t.slug);
            grew = true;
          }
        }
      }
    }
    return all.filter((t) => !excluded.has(t.slug) && t.privacy !== 'secret');
  });
  return (
    <select
      id="team-parent"
      class="form-select"
      disabled={props.disabled}
      onChange={(e) => props.onChange(e.currentTarget.value ? Number(e.currentTarget.value) : null)}
    >
      <option value="" selected={props.value == null}>
        No parent team
      </option>
      <For each={options()}>
        {(t) => (
          <option value={String(t.id)} selected={props.value === t.id}>
            {t.name}
          </option>
        )}
      </For>
    </select>
  );
}

/** Convenience: the "New team" button + dialog. */
export function NewTeamButton(props: { org: string; class?: string }) {
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <button type="button" class={['btn btn-primary', props.class]} onClick={() => setOpen(true)}>
        New team
      </button>
      <Show when={open()}>
        <TeamDialog org={props.org} open={open()} onClose={() => setOpen(false)} />
      </Show>
    </>
  );
}
