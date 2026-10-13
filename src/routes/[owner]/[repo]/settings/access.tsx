import { Title } from '@solidjs/meta';
import { useAction } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Avatar, Blankslate, Dialog, RelativeTime, Spinner, toast, toastError } from '../../../../components/ui';
import {
  cancelInvitation,
  getCollaborators,
  getInvitations,
  getOrgTeams,
  getRepoTeams,
  removeCollaborator,
  removeTeamAccess,
  searchUsers,
  setCollaborator,
  setTeamAccess,
  updateInvitation,
} from '../../../../features/repo-settings/api';
import { ConfirmDialog, ROLES, roleLabel, roleValue, SectionHeading, Subhead } from '../../../../features/repo-settings/components/ui';
import { useRepo } from '../../../../features/repo/context';
import { lockIcon, peopleIcon, personAddIcon, trashIcon } from '../../../../icons/octicons';

/** /:owner/:repo/settings/access — collaborators, invitations and teams. */
export default function AccessSettings() {
  const ctx = useRepo();
  const collaborators = createMemo(() => getCollaborators(ctx.owner(), ctx.name()));
  const invitations = createMemo(() => getInvitations(ctx.owner(), ctx.name()));
  const isOrg = () => ctx.repo().owner.type === 'Organization';
  const [inviting, setInviting] = createSignal(false);
  const [filter, setFilter] = createSignal('');
  const set = useAction(setCollaborator);
  const remove = useAction(removeCollaborator);
  const updateInv = useAction(updateInvitation);
  const cancelInv = useAction(cancelInvitation);
  const [removing, setRemoving] = createSignal<string | null>(null);

  const visible = () => {
    const q = filter().trim().toLowerCase();
    return collaborators().filter((c) => c.login.toLowerCase() !== ctx.owner().toLowerCase() || isOrg()).filter((c) => !q || c.login.toLowerCase().includes(q));
  };

  return (
    <>
      <Title>{`Collaborators · ${ctx.fullName()}`}</Title>
      <Subhead title={isOrg() ? 'Collaborators and teams' : 'Collaborators'} />

      <div class="Box mb-6">
        <div class="Box-row flex items-center gap-3">
          <Octicon icon={ctx.repo().private ? lockIcon : peopleIcon} size={24} class="text-fg-muted" />
          <div>
            <p class="font-semibold">{ctx.repo().private ? 'Private repository' : 'Public repository'}</p>
            <p class="text-xs text-fg-muted">
              {ctx.repo().private
                ? 'Only those with access to this repository can view it.'
                : 'This repository is public and visible to anyone.'}
            </p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2 mb-3">
        <h3 class="text-xl font-normal flex-1">Manage access</h3>
        <button type="button" class="btn btn-primary" onClick={() => setInviting(true)}>
          Add people
        </button>
      </div>

      <div class="Box">
        <div class="Box-header flex items-center gap-2">
          <input
            class="form-control form-control-sm max-w-[260px]"
            placeholder="Find a collaborator…"
            value={filter()}
            onInput={(e) => setFilter(e.currentTarget.value)}
          />
        </div>
        <Loading fallback={<div class="Box-row flex justify-center"><Spinner size={20} /></div>}>
          <For each={invitations()}>
            {(inv) => (
              <div class="Box-row flex items-center gap-3">
                <Avatar src={inv.invitee?.avatar_url} size={32} />
                <div class="flex-1 min-w-0">
                  <a class="font-semibold" href={`/${inv.invitee?.login}`}>
                    {inv.invitee?.login ?? 'Email invitation'}
                  </a>
                  <p class="text-xs text-fg-muted">
                    {inv.expired ? 'Invitation expired' : 'Awaiting response'} · invited <RelativeTime datetime={inv.created_at} />
                  </p>
                </div>
                <RoleSelect
                  value={inv.permissions}
                  onChange={(role) => updateInv(ctx.owner(), ctx.name(), inv.id, role === 'pull' ? 'read' : role === 'push' ? 'write' : role).catch(toastError)}
                />
                <button
                  type="button"
                  class="btn-octicon btn-octicon-danger"
                  aria-label="Cancel invitation"
                  onClick={() => cancelInv(ctx.owner(), ctx.name(), inv.id).then(() => toast('Invitation cancelled')).catch(toastError)}
                >
                  <Octicon icon={trashIcon} />
                </button>
              </div>
            )}
          </For>
          <For
            each={visible()}
            fallback={
              <Show when={!invitations().length}>
                <Blankslate icon={peopleIcon} title="You haven't invited any collaborators yet" />
              </Show>
            }
          >
            {(c) => (
              <div class="Box-row flex items-center gap-3">
                <Avatar src={c.avatar_url} size={32} square={c.type === 'Organization'} />
                <div class="flex-1 min-w-0">
                  <a class="font-semibold" href={`/${c.login}`}>
                    {c.login}
                  </a>
                  <p class="text-xs text-fg-muted">
                    {c.login.toLowerCase() === ctx.owner().toLowerCase() ? 'Owner' : 'Collaborator'}
                  </p>
                </div>
                <RoleSelect
                  value={c.role_name}
                  disabled={c.login.toLowerCase() === ctx.owner().toLowerCase()}
                  onChange={(role) =>
                    set(ctx.owner(), ctx.name(), c.login, role)
                      .then(() => toast(`${c.login} is now ${roleLabel(role)}`, 'success'))
                      .catch(toastError)
                  }
                />
                <button
                  type="button"
                  class="btn-octicon btn-octicon-danger"
                  aria-label={`Remove ${c.login}`}
                  disabled={c.login.toLowerCase() === ctx.owner().toLowerCase()}
                  onClick={() => setRemoving(c.login)}
                >
                  <Octicon icon={trashIcon} />
                </button>
              </div>
            )}
          </For>
        </Loading>
      </div>

      <Show when={isOrg()}>
        <TeamsSection />
      </Show>

      <InviteDialog open={inviting()} onClose={() => setInviting(false)} />
      <ConfirmDialog
        open={removing() != null}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing()} from ${ctx.name()}?`}
        button="Remove access"
        onConfirm={() => {
          const login = removing()!;
          return remove(ctx.owner(), ctx.name(), login).then(() => toast(`Removed ${login}`));
        }}
      >
        <p>{removing()} will no longer have access to this repository.</p>
      </ConfirmDialog>
    </>
  );
}

function RoleSelect(props: { value: string; onChange: (role: string) => void; disabled?: boolean }) {
  return (
    <select
      class="form-select form-control-sm w-auto!"
      aria-label="Role"
      disabled={props.disabled}
      value={roleValue(props.value)}
      onChange={(e) => props.onChange(e.currentTarget.value)}
    >
      <For each={ROLES}>{(r) => <option value={r.value}>{r.label}</option>}</For>
    </select>
  );
}

function InviteDialog(props: { open: boolean; onClose: () => void }) {
  const ctx = useRepo();
  const [q, setQ] = createSignal('');
  const [debounced, setDebounced] = createSignal('');
  const [picked, setPicked] = createSignal<string | null>(null);
  const [role, setRole] = createSignal('push');
  const [busy, setBusy] = createSignal(false);
  const results = createMemo(() => searchUsers(debounced()));
  const invite = useAction(setCollaborator);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const close = () => {
    setQ('');
    setDebounced('');
    setPicked(null);
    props.onClose();
  };

  return (
    <Dialog open={props.open} onClose={close} title={`Add a collaborator to ${ctx.name()}`} width="480px">
      <Show
        when={picked()}
        fallback={
          <>
            <input
              class="form-control"
              placeholder="Search by username or full name"
              autofocus
              value={q()}
              onInput={(e) => {
                const v = e.currentTarget.value;
                setQ(v);
                clearTimeout(timer);
                timer = setTimeout(() => setDebounced(v), 300);
              }}
            />
            <Show when={debounced().trim().length >= 2}>
              <div class="mt-2 border border-line rounded-md overflow-hidden">
                <Loading fallback={<div class="p-3 flex justify-center"><Spinner size={20} /></div>}>
                  <For each={results()} fallback={<p class="p-3 text-sm text-fg-muted">No users found.</p>}>
                    {(u) => (
                      <button
                        type="button"
                        class="SelectMenu-item"
                        onClick={() => setPicked(u.login)}
                      >
                        <Avatar src={u.avatar_url} size={20} />
                        <span class="font-semibold">{u.login}</span>
                      </button>
                    )}
                  </For>
                </Loading>
              </div>
            </Show>
          </>
        }
      >
        {(login) => (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await invite(ctx.owner(), ctx.name(), login(), role());
                toast(`Invited ${login()}`, 'success');
                close();
              } catch (err) {
                toastError(err);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div class="flex items-center gap-2 mb-3">
              <Avatar login={login()} size={32} />
              <strong class="flex-1">{login()}</strong>
              <button type="button" class="btn btn-sm" onClick={() => setPicked(null)}>
                Change
              </button>
            </div>
            <p class="text-sm font-semibold mb-1">Choose a role</p>
            <For each={ROLES}>
              {(r) => (
                <label class="flex gap-2 py-1.5 text-sm">
                  <input type="radio" name="invite-role" class="mt-1" checked={role() === r.value} onChange={() => setRole(r.value)} />
                  <span>
                    <span class="font-semibold block">{r.label}</span>
                    <span class="text-xs text-fg-muted">{r.description}</span>
                  </span>
                </label>
              )}
            </For>
            <button type="submit" class="btn btn-primary btn-block mt-3" disabled={busy()}>
              <Octicon icon={personAddIcon} /> {busy() ? 'Adding…' : `Add ${login()} to this repository`}
            </button>
          </form>
        )}
      </Show>
    </Dialog>
  );
}

function TeamsSection() {
  const ctx = useRepo();
  const teams = createMemo(() => getRepoTeams(ctx.owner(), ctx.name()));
  const orgTeams = createMemo(() => getOrgTeams(ctx.owner()));
  const setAccess = useAction(setTeamAccess);
  const remove = useAction(removeTeamAccess);
  const [adding, setAdding] = createSignal('');
  return (
    <>
      <SectionHeading class="mt-8">Teams</SectionHeading>
      <Loading fallback={<Spinner size={20} />}>
        <Show when={teams()} fallback={<p class="text-sm text-fg-muted">Teams are not available for this repository.</p>}>
          {(list) => (
            <div class="Box">
              <div class="Box-header flex items-center gap-2">
                <select class="form-select form-control-sm w-auto!" value={adding()} onChange={(e) => setAdding(e.currentTarget.value)}>
                  <option value="">Add a team…</option>
                  <For each={orgTeams().filter((t) => !list().some((x) => x.id === t.id))}>
                    {(t) => <option value={t.slug}>{t.name}</option>}
                  </For>
                </select>
                <button
                  type="button"
                  class="btn btn-sm"
                  disabled={!adding()}
                  onClick={() =>
                    setAccess(ctx.owner(), adding(), ctx.owner(), ctx.name(), 'pull')
                      .then(() => setAdding(''))
                      .catch(toastError)
                  }
                >
                  Add team
                </button>
              </div>
              <For each={list()} fallback={<div class="Box-row text-sm text-fg-muted">No teams have access yet.</div>}>
                {(t) => (
                  <div class="Box-row flex items-center gap-3">
                    <Octicon icon={peopleIcon} class="text-fg-muted" />
                    <div class="flex-1 min-w-0">
                      <a class="font-semibold" href={`/orgs/${ctx.owner()}/teams/${t.slug}`}>
                        {t.name}
                      </a>
                      <Show when={t.description}>
                        <p class="text-xs text-fg-muted">{t.description}</p>
                      </Show>
                    </div>
                    <RoleSelect
                      value={t.permission}
                      onChange={(role) => setAccess(ctx.owner(), t.slug, ctx.owner(), ctx.name(), role).catch(toastError)}
                    />
                    <button
                      type="button"
                      class="btn-octicon btn-octicon-danger"
                      aria-label={`Remove ${t.name}`}
                      onClick={() => remove(ctx.owner(), t.slug, ctx.owner(), ctx.name()).catch(toastError)}
                    >
                      <Octicon icon={trashIcon} />
                    </button>
                  </div>
                )}
              </For>
            </div>
          )}
        </Show>
      </Loading>
    </>
  );
}
