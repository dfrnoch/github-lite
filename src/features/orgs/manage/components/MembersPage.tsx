import { Title } from '@solidjs/meta';
import { useAction, useLocation, useSearchParams } from '@solidjs/router';
import { createMemo, createOptimistic, createSignal, For, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Avatar, Blankslate, Dropdown, Pagination, pageHref, toast, toastError } from '../../../../components/ui';
import {
  alertIcon,
  globeIcon,
  kebabHorizontalIcon,
  lockIcon,
  personIcon,
  triangleDownIcon,
} from '../../../../icons/octicons';
import { formatNumber, pluralize } from '../../../../lib/format';
import FollowButton from '../../../profile/components/FollowButton';
import { FilterMenu } from '../../../profile/components/RepoFiltersBar';
import type { UserCard } from '../../../profile/api';
import { getOrgMeta, type OrgMeta } from '../../api';
import {
  convertToOutsideCollaborator,
  getOrgPeople,
  removeMembers,
  setMembershipVisibility,
  type OrgPeople,
} from '../api';
import ChangeRoleDialog from './ChangeRoleDialog';
import InviteDialog from './InviteDialog';
import { ScopeNotice } from './Notices';
import SearchInput from './SearchInput';

const PER_PAGE = 30;

type Params = { query?: string; role?: string; two_factor?: string; page?: string; invite?: string };

/** /orgs/:org/people — the member list (with owner tools for admins). */
export default function MembersPage(props: { org: string }) {
  const meta = createMemo(() => getOrgMeta(props.org));
  const people = createMemo(() => getOrgPeople(props.org));
  const [sp, setSp] = useSearchParams<Params>();
  const location = useLocation();

  const filtered = createMemo(() => {
    const p = people();
    const admins = new Set(p.admins);
    const noTwoFa = new Set(p.twoFaDisabled ?? []);
    const q = (sp.query ?? '').trim().toLowerCase();
    return p.members.filter((m) => {
      if (q && !m.login.toLowerCase().includes(q) && !(m.name ?? '').toLowerCase().includes(q)) return false;
      if (sp.role === 'owner' && !admins.has(m.login)) return false;
      if (sp.role === 'member' && admins.has(m.login)) return false;
      if (sp.two_factor === 'disabled' && !noTwoFa.has(m.login)) return false;
      if (sp.two_factor === 'enabled' && p.twoFaDisabled && noTwoFa.has(m.login)) return false;
      return true;
    });
  });
  const page = () => Math.max(1, Number(sp.page) || 1);
  const lastPage = () => Math.max(1, Math.ceil(filtered().length / PER_PAGE));
  const visible = () => filtered().slice((page() - 1) * PER_PAGE, page() * PER_PAGE);

  // Bulk selection (owners). Plain logins so revalidated lists keep it.
  const [selected, setSelected] = createSignal<string[]>([]);
  const toggle = (login: string, on: boolean) =>
    setSelected((s) => (on ? [...s.filter((l) => l !== login), login] : s.filter((l) => l !== login)));
  const allVisibleSelected = () => visible().length > 0 && visible().every((m) => selected().includes(m.login));

  const [roleFor, setRoleFor] = createSignal<string[] | null>(null);
  const [inviteOpen, setInviteOpen] = createSignal(() => sp.invite === '1');
  const closeInvite = () => {
    setInviteOpen(false);
    if (sp.invite) setSp({ invite: undefined }, { replace: true, scroll: false });
  };

  const remove = useAction(removeMembers);
  // "Working" affordance while a membership change is in flight (reverts when it settles).
  const [working, setWorking] = createOptimistic(false);
  const removeSelected = async (logins: string[]) => {
    if (!logins.length) return;
    const who = logins.length === 1 ? logins[0] : pluralize(logins.length, 'member');
    if (!confirm(`Remove ${who} from ${props.org}? They will lose access to the organization's private repositories.`)) return;
    setWorking(true);
    try {
      await remove(props.org, logins);
      setSelected((s) => s.filter((l) => !logins.includes(l)));
      toast(`Removed ${who} from ${props.org}`, 'success');
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <>
      <Title>{`People · ${props.org}`}</Title>
      <ScopeNotice when={meta().viewerCanAdminister} scope="admin:org" what="membership changes" />
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <SearchInput placeholder="Find a member…" param="query" class="flex-1 min-w-[200px] md:max-w-[320px]" />
        <div class="flex-1" />
        <Show when={meta().viewerIsAMember}>
          <FilterMenu
            label="Role"
            title="Filter by role"
            options={[
              { value: '', label: 'Everyone' },
              { value: 'owner', label: 'Owners' },
              { value: 'member', label: 'Members' },
            ]}
            value={sp.role ?? ''}
            onSelect={(v) => setSp({ role: v || undefined, page: undefined }, { scroll: false })}
          />
        </Show>
        <Show when={meta().viewerCanAdminister && people().twoFaDisabled}>
          <FilterMenu
            label="2FA"
            title="Filter by two-factor authentication"
            options={[
              { value: '', label: 'Everyone' },
              { value: 'enabled', label: 'Enabled' },
              { value: 'disabled', label: 'Disabled' },
            ]}
            value={sp.two_factor ?? ''}
            onSelect={(v) => setSp({ two_factor: v || undefined, page: undefined }, { scroll: false })}
          />
        </Show>
        <Show when={meta().viewerCanAdminister}>
          <button type="button" class="btn btn-primary" onClick={() => setInviteOpen(true)}>
            Invite member
          </button>
        </Show>
      </div>

      <div class={['Box transition-opacity', { 'opacity-60 pointer-events-none': working() }]} aria-busy={working() ? 'true' : undefined}>
        <div class="Box-header flex items-center gap-3 py-3!">
          <Show when={meta().viewerCanAdminister}>
            <input
              type="checkbox"
              aria-label="Select all members on this page"
              checked={allVisibleSelected()}
              onChange={(e) => {
                const on = e.currentTarget.checked;
                const logins = visible().map((m) => m.login);
                setSelected((s) => (on ? [...new Set([...s, ...logins])] : s.filter((l) => !logins.includes(l))));
              }}
            />
          </Show>
          <Show
            when={selected().length}
            fallback={
              <span class="text-sm font-semibold flex-1">
                {formatNumber(filtered().length)} {filtered().length === 1 ? 'member' : 'members'}
                <Show when={!meta().viewerIsAMember}>
                  <span class="font-normal text-fg-muted"> with public membership</span>
                </Show>
              </span>
            }
          >
            <span class="text-sm font-semibold flex-1">{formatNumber(selected().length)} selected</span>
            <Dropdown
              class="btn btn-sm"
              align="right"
              button={
                <>
                  Bulk actions <Octicon icon={triangleDownIcon} />
                </>
              }
            >
              {(close) => (
                <>
                  <button
                    type="button"
                    class="SelectMenu-item"
                    onClick={() => {
                      close();
                      setRoleFor(selected());
                    }}
                  >
                    Change role…
                  </button>
                  <button
                    type="button"
                    class="SelectMenu-item danger"
                    onClick={() => {
                      close();
                      void removeSelected(selected());
                    }}
                  >
                    Remove from organization…
                  </button>
                </>
              )}
            </Dropdown>
            <button type="button" class="btn btn-sm" onClick={() => setSelected([])}>
              Clear
            </button>
          </Show>
        </div>
        <ul>
          <For
            each={visible()}
            fallback={
              <li class="Box-row">
                <Blankslate icon={personIcon} title="No members matched your search">
                  Try a different name or remove the filters.
                </Blankslate>
              </li>
            }
          >
            {(m) => (
              <MemberRow
                org={props.org}
                user={m}
                meta={meta()}
                people={people()}
                selected={selected().includes(m.login)}
                onSelect={(on) => toggle(m.login, on)}
                onChangeRole={() => setRoleFor([m.login])}
                onRemove={() => void removeSelected([m.login])}
              />
            )}
          </For>
        </ul>
      </div>

      <Pagination
        pageInfo={{ page: page(), lastPage: lastPage(), hasNext: page() < lastPage(), hasPrev: page() > 1 }}
        href={(p) => pageHref(location, p)}
      />

      <ChangeRoleDialog
        org={props.org}
        logins={roleFor() ?? []}
        current={roleFor()?.length === 1 && people().admins.includes(roleFor()![0]!) ? 'admin' : 'member'}
        open={roleFor() != null}
        onClose={() => setRoleFor(null)}
      />
      <Show when={meta().viewerCanAdminister}>
        <InviteDialog org={props.org} open={inviteOpen()} onClose={closeInvite} />
      </Show>
    </>
  );
}

function MemberRow(props: {
  org: string;
  user: UserCard;
  meta: OrgMeta;
  people: OrgPeople;
  selected: boolean;
  onSelect: (on: boolean) => void;
  onChangeRole: () => void;
  onRemove: () => void;
}) {
  const isAdmin = () => props.meta.viewerCanAdminister;
  const isPublic = () => props.people.publicLogins.includes(props.user.login);
  const isOwner = () => props.people.admins.includes(props.user.login);
  const noTwoFa = () => !!props.people.twoFaDisabled?.includes(props.user.login);
  const convert = useAction(convertToOutsideCollaborator);
  const publicize = useAction(setMembershipVisibility);
  const [busy, setBusy] = createOptimistic(false);

  const doConvert = async () => {
    if (
      !confirm(
        `Convert ${props.user.login} to an outside collaborator? They will be removed from all teams and keep access only to repositories their team memberships granted.`,
      )
    )
      return;
    setBusy(true);
    try {
      await convert(props.org, props.user.login);
      toast(`${props.user.login} is now an outside collaborator`, 'success');
    } catch (e) {
      toastError(e);
    }
  };
  const setVisibility = async (pub: boolean) => {
    setBusy(true);
    try {
      await publicize(props.org, props.user.login, pub);
      toast(pub ? 'Your membership is now public' : 'Your membership is now private', 'success');
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <li class={['Box-row flex items-center gap-3', { 'bg-accent-muted': props.selected, 'opacity-60': busy() }]}>
      <Show when={isAdmin()}>
        <input
          type="checkbox"
          aria-label={`Select ${props.user.login}`}
          checked={props.selected}
          onChange={(e) => props.onSelect(e.currentTarget.checked)}
        />
      </Show>
      <a href={`/${props.user.login}`} class="shrink-0">
        <Avatar src={props.user.avatarUrl} login={props.user.login} size={44} />
      </a>
      <div class="flex-1 min-w-0">
        <a class="block text-base truncate" href={`/${props.user.login}`}>
          {props.user.name || props.user.login}
        </a>
        <Show when={props.user.name}>
          <span class="block text-sm text-fg-muted truncate">{props.user.login}</span>
        </Show>
      </div>

      <Show
        when={props.meta.viewerIsAMember}
        fallback={
          <Show when={!props.user.isViewer}>
            <FollowButton login={props.user.login} following={props.user.viewerIsFollowing} class="btn-sm" />
          </Show>
        }
      >
        <div class="hidden md:flex w-[110px] text-sm text-fg-muted">
          <Show
            when={props.user.isViewer}
            fallback={
              <span class="inline-flex items-center gap-1">
                <Octicon icon={isPublic() ? globeIcon : lockIcon} />
                {isPublic() ? 'Public' : 'Private'}
              </span>
            }
          >
            <Dropdown
              class="btn-link link-muted inline-flex items-center gap-1 text-sm"
              title="Change your membership visibility"
              button={
                <>
                  <Octicon icon={isPublic() ? globeIcon : lockIcon} />
                  {isPublic() ? 'Public' : 'Private'}
                  <Octicon icon={triangleDownIcon} />
                </>
              }
            >
              {(close) => (
                <>
                  <button
                    type="button"
                    class="SelectMenu-item items-start!"
                    role="menuitemradio"
                    aria-checked={isPublic() ? 'true' : 'false'}
                    onClick={() => {
                      close();
                      if (!isPublic()) void setVisibility(true);
                    }}
                  >
                    <Octicon icon={globeIcon} class="mt-0.5" />
                    <span>
                      <span class="block">Public</span>
                      <span class="block text-xs text-fg-muted font-normal">Visible to anyone on your profile</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    class="SelectMenu-item items-start!"
                    role="menuitemradio"
                    aria-checked={isPublic() ? 'false' : 'true'}
                    onClick={() => {
                      close();
                      if (isPublic()) void setVisibility(false);
                    }}
                  >
                    <Octicon icon={lockIcon} class="mt-0.5" />
                    <span>
                      <span class="block">Private</span>
                      <span class="block text-xs text-fg-muted font-normal">Only visible to other organization members</span>
                    </span>
                  </button>
                </>
              )}
            </Dropdown>
          </Show>
        </div>
        <div class="hidden sm:flex w-[24px] justify-center">
          <Show when={isAdmin() && noTwoFa()}>
            <span title="Two-factor authentication is not enabled" class="text-fg-attention inline-flex">
              <Octicon icon={alertIcon} aria-label="Two-factor authentication disabled" />
            </span>
          </Show>
        </div>
        <div class="w-[72px] text-sm text-fg-muted">{isOwner() ? 'Owner' : 'Member'}</div>
        <div class="w-[32px] flex justify-end">
          <Show when={isAdmin()}>
            <Dropdown class="btn-octicon" align="right" menuClass="w-64" title="Member settings" button={<Octicon icon={kebabHorizontalIcon} aria-label="Member settings" />}>
              {(close) => (
                <>
                  <button
                    type="button"
                    class="SelectMenu-item"
                    onClick={() => {
                      close();
                      props.onChangeRole();
                    }}
                  >
                    Change role…
                  </button>
                  <a class="SelectMenu-item" href={`/${props.user.login}`} onClick={() => close()}>
                    View profile
                  </a>
                  <Show when={!props.user.isViewer}>
                    <button
                      type="button"
                      class="SelectMenu-item"
                      onClick={() => {
                        close();
                        void doConvert();
                      }}
                    >
                      Convert to outside collaborator…
                    </button>
                  </Show>
                  <div class="SelectMenu-divider" />
                  <button
                    type="button"
                    class="SelectMenu-item danger"
                    onClick={() => {
                      close();
                      props.onRemove();
                    }}
                  >
                    {props.user.isViewer ? 'Leave organization…' : 'Remove from organization…'}
                  </button>
                </>
              )}
            </Dropdown>
          </Show>
        </div>
      </Show>
    </li>
  );
}
