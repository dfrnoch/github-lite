import { Title } from '@solidjs/meta';
import { useAction, useSearchParams } from '@solidjs/router';
import { createMemo, createOptimistic, createSignal, For, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Avatar, Blankslate, Dialog, Dropdown, toast, toastError } from '../../../../components/ui';
import { kebabHorizontalIcon, peopleIcon } from '../../../../icons/octicons';
import { formatNumber } from '../../../../lib/format';
import { getTeam, getTeamMembers, removeTeamMember, setTeamMembership, type TeamMember } from '../api';
import { FilterMenu } from '../../../profile/components/RepoFiltersBar';
import SearchInput from './SearchInput';

/** /orgs/:org/teams/:team/members */
export default function TeamMembers(props: { org: string; slug: string }) {
  const team = createMemo(() => getTeam(props.org, props.slug));
  const members = createMemo(() => getTeamMembers(props.org, props.slug));
  const [sp, setSp] = useSearchParams<{ query?: string; role?: string }>();
  const [adding, setAdding] = createSignal(false);

  const filtered = () => {
    const q = (sp.query ?? '').trim().toLowerCase();
    return members().filter(
      (m) =>
        (!q || m.login.toLowerCase().includes(q) || (m.name ?? '').toLowerCase().includes(q)) &&
        (!sp.role || m.role.toLowerCase() === sp.role),
    );
  };

  return (
    <>
      <Title>{`Members · ${team().name} · ${props.org}`}</Title>
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <SearchInput placeholder="Find a member…" param="query" class="flex-1 min-w-[200px] md:max-w-[320px]" />
        <div class="flex-1" />
        <FilterMenu
          label="Role"
          title="Filter by role"
          options={[
            { value: '', label: 'Everyone' },
            { value: 'maintainer', label: 'Maintainers' },
            { value: 'member', label: 'Members' },
          ]}
          value={sp.role ?? ''}
          onSelect={(v) => setSp({ role: v || undefined }, { scroll: false })}
        />
        <Show when={team().viewerCanAdminister}>
          <button type="button" class="btn btn-primary" onClick={() => setAdding(true)}>
            Add a member
          </button>
        </Show>
      </div>
      <div class="Box">
        <div class="Box-header py-3! text-sm font-semibold">
          {formatNumber(filtered().length)} {filtered().length === 1 ? 'member' : 'members'}
        </div>
        <ul>
          <For
            each={filtered()}
            fallback={
              <li class="Box-row">
                <Blankslate icon={peopleIcon} title={members().length ? 'No members matched your search' : 'This team has no members'}>
                  <Show when={team().viewerCanAdminister && !members().length}>Add organization members to get started.</Show>
                </Blankslate>
              </li>
            }
          >
            {(m) => <MemberRow org={props.org} slug={props.slug} member={m} canAdmin={team().viewerCanAdminister} />}
          </For>
        </ul>
      </div>
      <Show when={adding()}>
        <AddMemberDialog org={props.org} slug={props.slug} teamName={team().name} open={adding()} onClose={() => setAdding(false)} />
      </Show>
    </>
  );
}

function MemberRow(props: { org: string; slug: string; member: TeamMember; canAdmin: boolean }) {
  const setRole = useAction(setTeamMembership);
  const remove = useAction(removeTeamMember);
  const [busy, setBusy] = createOptimistic(false);
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      toast(msg, 'success');
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <li class={['Box-row flex items-center gap-3', { 'opacity-60': busy() }]}>
      <a href={`/${props.member.login}`} class="shrink-0">
        <Avatar src={props.member.avatarUrl} login={props.member.login} size={44} />
      </a>
      <div class="flex-1 min-w-0">
        <a class="block text-base truncate" href={`/${props.member.login}`}>
          {props.member.name || props.member.login}
        </a>
        <Show when={props.member.name}>
          <span class="block text-sm text-fg-muted truncate">{props.member.login}</span>
        </Show>
      </div>
      <span class="w-[90px] text-sm text-fg-muted">{props.member.role === 'MAINTAINER' ? 'Maintainer' : 'Member'}</span>
      <div class="w-[32px] flex justify-end">
        <Show when={props.canAdmin}>
          <Dropdown class="btn-octicon" align="right" menuClass="w-56" disabled={busy()} title="Member settings" button={<Octicon icon={kebabHorizontalIcon} aria-label="Member settings" />}>
            {(close) => (
              <>
                <div class="SelectMenu-header">Change role</div>
                <For each={[['maintainer', 'Maintainer'], ['member', 'Member']] as const}>
                  {([value, label]) => (
                    <button
                      type="button"
                      class="SelectMenu-item"
                      role="menuitemradio"
                      aria-checked={props.member.role.toLowerCase() === value ? 'true' : 'false'}
                      onClick={() => {
                        close();
                        const login = props.member.login;
                        if (props.member.role.toLowerCase() !== value)
                          void run(() => setRole(props.org, props.slug, login, value), `${login} is now a ${value}`);
                      }}
                    >
                      {label}
                    </button>
                  )}
                </For>
                <div class="SelectMenu-divider" />
                <button
                  type="button"
                  class="SelectMenu-item danger"
                  onClick={() => {
                    close();
                    const login = props.member.login;
                    if (confirm(`Remove ${login} from this team?`))
                      void run(() => remove(props.org, props.slug, login), `Removed ${login} from the team`);
                  }}
                >
                  Remove from team…
                </button>
              </>
            )}
          </Dropdown>
        </Show>
      </div>
    </li>
  );
}

function AddMemberDialog(props: { org: string; slug: string; teamName: string; open: boolean; onClose: () => void }) {
  const add = useAction(setTeamMembership);
  const [login, setLogin] = createSignal('');
  const [role, setRole] = createSignal<'member' | 'maintainer'>('member');
  const [busy, setBusy] = createOptimistic(false);
  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    const who = login().trim().replace(/^@/, '');
    if (!who) return;
    setBusy(true);
    try {
      await add(props.org, props.slug, who, role());
      toast(`Added ${who} to ${props.teamName}`, 'success');
      props.onClose();
    } catch (err) {
      toastError(err);
    }
  };
  return (
    <Dialog open={props.open} onClose={props.onClose} title={`Add a member to ${props.teamName}`} width="440px">
      <form onSubmit={submit}>
        <div class="form-group mt-0!">
          <label for="team-add-login">Username</label>
          <input
            id="team-add-login"
            class="form-control"
            placeholder="Search by username"
            autocomplete="off"
            autofocus
            required
            value={login()}
            onInput={(e) => setLogin(e.currentTarget.value)}
          />
          <p class="note">People who aren’t members of {props.org} yet are sent an organization invitation.</p>
        </div>
        <div class="form-group">
          <label for="team-add-role">Role</label>
          <select id="team-add-role" class="form-select" onChange={(e) => setRole(e.currentTarget.value as 'member' | 'maintainer')}>
            <option value="member" selected={role() === 'member'}>
              Member
            </option>
            <option value="maintainer" selected={role() === 'maintainer'}>
              Maintainer
            </option>
          </select>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="btn" onClick={() => props.onClose()}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={busy() || !login().trim()}>
            {busy() ? 'Adding…' : 'Add member'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
