import { Title } from '@solidjs/meta';
import { useAction, useSearchParams } from '@solidjs/router';
import { createMemo, createOptimistic, createSignal, For, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Avatar, Blankslate, RelativeTime, toast, toastError } from '../../../../components/ui';
import { mailIcon, peopleIcon } from '../../../../icons/octicons';
import { formatNumber, pluralize } from '../../../../lib/format';
import { getOrgMeta } from '../../api';
import { cancelInvitation, getOrgInvitations, type OrgInvitation } from '../api';
import InviteDialog from './InviteDialog';
import { ScopeNotice, Section } from './Notices';
import SearchInput from './SearchInput';

const ROLE_LABEL: Record<string, string> = {
  direct_member: 'Member',
  admin: 'Owner',
  billing_manager: 'Billing manager',
  hiring_manager: 'Hiring manager',
  reinstate: 'Reinstated member',
};

/** /orgs/:org/people/pending_invitations and …/failed_invitations (owners only). */
export default function InvitationsPage(props: { org: string; which: 'pending' | 'failed' }) {
  const meta = createMemo(() => getOrgMeta(props.org));
  // Started with meta (not after it) so the two load in parallel.
  const invitations = createMemo(() => getOrgInvitations(props.org, props.which));
  const [inviteOpen, setInviteOpen] = createSignal(false);
  const title = () => (props.which === 'pending' ? 'Invitations' : 'Failed invitations');
  return (
    <>
      <Title>{`${title()} · ${props.org}`}</Title>
      <ScopeNotice when={meta().viewerCanAdminister} scope="admin:org" what="invitation changes" />
      <Show
        when={meta().viewerCanAdminister}
        fallback={
          <Blankslate icon={peopleIcon} title="Only organization owners can see invitations" />
        }
      >
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <SearchInput placeholder="Find an invitation…" param="query" class="flex-1 min-w-[200px] md:max-w-[320px]" />
          <div class="flex-1" />
          <button type="button" class="btn btn-primary" onClick={() => setInviteOpen(true)}>
            Invite member
          </button>
        </div>
        <Section>
          <InvitationList org={props.org} which={props.which} invitations={invitations()} />
        </Section>
        <InviteDialog org={props.org} open={inviteOpen()} onClose={() => setInviteOpen(false)} />
      </Show>
    </>
  );
}

function InvitationList(props: { org: string; which: 'pending' | 'failed'; invitations: OrgInvitation[] }) {
  const invitations = () => props.invitations;
  const [sp] = useSearchParams<{ query?: string }>();
  const filtered = () => {
    const q = (sp.query ?? '').trim().toLowerCase();
    return q
      ? invitations().filter((i) => (i.login ?? '').toLowerCase().includes(q) || (i.email ?? '').toLowerCase().includes(q))
      : invitations();
  };
  return (
    <div class="Box">
      <div class="Box-header py-3! text-sm font-semibold">
        {formatNumber(filtered().length)} {props.which === 'pending' ? 'pending' : 'failed'}{' '}
        {filtered().length === 1 ? 'invitation' : 'invitations'}
      </div>
      <ul>
        <For
          each={filtered()}
          fallback={
            <li class="Box-row">
              <Blankslate icon={mailIcon} title={props.which === 'pending' ? 'No pending invitations' : 'No failed invitations'}>
                {props.which === 'pending'
                  ? 'Invitations you send appear here until they are accepted.'
                  : 'Invitations that expired or could not be delivered appear here.'}
              </Blankslate>
            </li>
          }
        >
          {(inv) => <InvitationRow org={props.org} inv={inv} failed={props.which === 'failed'} />}
        </For>
      </ul>
    </div>
  );
}

function InvitationRow(props: { org: string; inv: OrgInvitation; failed: boolean }) {
  const cancel = useAction(cancelInvitation);
  const [busy, setBusy] = createOptimistic(false);
  const who = () => props.inv.login ?? props.inv.email ?? 'unknown';
  const doCancel = async () => {
    if (!confirm(`Cancel the invitation for ${who()}?`)) return;
    setBusy(true);
    try {
      await cancel(props.org, props.inv.id);
      toast(`Canceled the invitation for ${who()}`, 'success');
    } catch (e) {
      toastError(e);
    }
  };
  return (
    <li class="Box-row flex items-center gap-3">
      <Show
        when={props.inv.login}
        fallback={
          <span class="w-[44px] h-[44px] rounded-full bg-canvas-muted border border-line-muted flex items-center justify-center text-fg-muted shrink-0">
            <Octicon icon={mailIcon} size={20} />
          </span>
        }
      >
        {(login) => (
          <a href={`/${login()}`} class="shrink-0">
            <Avatar login={login()} size={44} />
          </a>
        )}
      </Show>
      <div class="flex-1 min-w-0">
        <Show when={props.inv.login} fallback={<span class="font-semibold">{props.inv.email}</span>}>
          {(login) => (
            <a class="font-semibold" href={`/${login()}`}>
              {login()}
            </a>
          )}
        </Show>
        <p class="text-xs text-fg-muted mt-0.5">
          <Show when={props.inv.inviter}>
            {(inviter) => (
              <>
                Invited by{' '}
                <a class="link-muted font-semibold" href={`/${inviter().login}`}>
                  {inviter().login}
                </a>{' '}
              </>
            )}
          </Show>
          <RelativeTime datetime={props.inv.created_at} />
          <Show when={props.failed && props.inv.failed_reason}>
            {' · '}
            <span class="text-fg-danger">{props.inv.failed_reason}</span>
          </Show>
        </p>
      </div>
      <span class="hidden md:block w-[120px] text-sm text-fg-muted">{ROLE_LABEL[props.inv.role] ?? props.inv.role}</span>
      <span class="hidden md:block w-[80px] text-sm text-fg-muted">{pluralize(props.inv.team_count, 'team')}</span>
      <Show when={!props.failed} fallback={<span class="w-[150px]" />}>
        <button type="button" class="btn btn-sm btn-danger w-[150px]" disabled={busy()} onClick={() => void doCancel()}>
          Cancel invitation
        </button>
      </Show>
    </li>
  );
}
