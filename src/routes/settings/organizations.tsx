import { Title } from '@solidjs/meta';
import { useAction } from '@solidjs/router';
import { createMemo, createSignal, For, Show } from 'solid-js';
import Octicon from '../../components/Octicon';
import { Avatar, Blankslate, toast, toastError } from '../../components/ui';
import {
  acceptOrgInvitation,
  getOrgMemberships,
  leaveOrg,
  type OrgMembership,
  REQUIRED_SCOPES,
  setOrgMembershipPublic,
} from '../../features/settings/api';
import ScopeNotice from '../../features/settings/components/ScopeNotice';
import Subhead from '../../features/settings/components/Subhead';
import { eyeIcon, eyeClosedIcon, linkExternalIcon, organizationIcon } from '../../icons/octicons';

const roleLabel = (role: string) => (role === 'admin' ? 'Owner' : role === 'billing_manager' ? 'Billing manager' : 'Member');

export default function OrganizationSettings() {
  const memberships = createMemo(() => getOrgMemberships());
  const active = createMemo(() => memberships()?.filter((m) => m.state === 'active') ?? []);
  const pending = createMemo(() => memberships()?.filter((m) => m.state === 'pending') ?? []);

  return (
    <>
      <Title>Organizations</Title>
      <Subhead
        title="Organizations"
        actions={
          <a
            class="btn btn-sm inline-flex items-center gap-1"
            href="https://github.com/account/organizations/new"
            target="_blank"
            rel="noreferrer"
          >
            New organization
            <Octicon icon={linkExternalIcon} size={12} />
          </a>
        }
      />
      <Show when={memberships()} fallback={<ScopeNotice scope={REQUIRED_SCOPES.orgs} what="your organization memberships" />}>
        <Show when={pending().length}>
          <h3 class="text-base font-semibold mb-2">Pending invitations</h3>
          <ul class="Box mb-6">
            <For each={pending()}>{(m) => <PendingRow membership={m} />}</For>
          </ul>
        </Show>
        <Show
          when={active().length}
          fallback={
            <Blankslate icon={organizationIcon} title="You are not a member of any organizations." class="Box" />
          }
        >
          <ul class="Box">
            <For each={active()}>{(m) => <OrgRow membership={m} />}</For>
          </ul>
        </Show>
        <p class="text-sm text-fg-muted mt-3">
          Organizations can't be created through the API — the "New organization" button opens github.com.
        </p>
      </Show>
    </>
  );
}

function OrgRow(props: { membership: OrgMembership }) {
  const setPublic = useAction(setOrgMembershipPublic);
  const leave = useAction(leaveOrg);
  const [busy, setBusy] = createSignal(false);
  const org = () => props.membership.organization.login;

  const toggleVisibility = async () => {
    const makePublic = !props.membership.publicized;
    setBusy(true);
    try {
      await setPublic(org(), props.membership.user.login, makePublic);
      toast(makePublic ? `Your membership in ${org()} is now public` : `Your membership in ${org()} is now private`, 'success');
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const onLeave = async () => {
    if (!confirm(`Are you sure you want to leave ${org()}? You will lose access to all of its private repositories.`)) return;
    setBusy(true);
    try {
      await leave(org(), props.membership.user.login);
      toast(`You left ${org()}`, 'success');
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li class="Box-row flex flex-wrap items-center gap-3">
      <Avatar src={props.membership.organization.avatar_url} login={org()} size={32} square />
      <div class="flex-1 min-w-[160px]">
        <a class="font-semibold" href={`/${org()}`}>
          {org()}
        </a>
        <span class="text-sm text-fg-muted"> · {roleLabel(props.membership.role)}</span>
      </div>
      <span class="Label" title="Visibility of your membership on the organization's and your profile">
        {props.membership.publicized ? 'Public' : 'Private'}
      </span>
      <button type="button" class="btn btn-sm" disabled={busy()} onClick={toggleVisibility}>
        <Octicon icon={props.membership.publicized ? eyeClosedIcon : eyeIcon} />
        {props.membership.publicized ? 'Make private' : 'Make public'}
      </button>
      <button type="button" class="btn btn-sm btn-danger" disabled={busy()} onClick={onLeave}>
        Leave
      </button>
    </li>
  );
}

function PendingRow(props: { membership: OrgMembership }) {
  const accept = useAction(acceptOrgInvitation);
  const [busy, setBusy] = createSignal(false);
  const org = () => props.membership.organization.login;

  const onAccept = async () => {
    setBusy(true);
    try {
      await accept(org());
      toast(`You are now a member of ${org()}`, 'success');
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li class="Box-row flex flex-wrap items-center gap-3">
      <Avatar src={props.membership.organization.avatar_url} login={org()} size={32} square />
      <div class="flex-1 min-w-[160px]">
        <a class="font-semibold" href={`/${org()}`}>
          {org()}
        </a>
        <span class="text-sm text-fg-muted"> invited you to join as {roleLabel(props.membership.role).toLowerCase()}</span>
      </div>
      <button type="button" class="btn btn-sm btn-primary" disabled={busy()} onClick={onAccept}>
        Accept
      </button>
      <a class="btn btn-sm" href={`https://github.com/orgs/${org()}/invitation`} target="_blank" rel="noreferrer">
        Decline on GitHub
      </a>
    </li>
  );
}
