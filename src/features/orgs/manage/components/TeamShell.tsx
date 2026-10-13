import { Title } from '@solidjs/meta';
import { useAction, useLocation, useNavigate } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, For, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Avatar, Dropdown, toast } from '../../../../components/ui';
import { gearIcon, kebabHorizontalIcon, peopleIcon, repoIcon, telescopeIcon } from '../../../../icons/octicons';
import { formatNumber } from '../../../../lib/format';
import { ConfirmDialog } from '../../../repo-settings/components/ui';
import { deleteTeam, getTeam } from '../api';
import { ScopeNotice, Section } from './Notices';
import TeamDialog from './TeamDialog';

/** Layout for /orgs/:org/teams/:team/*: breadcrumb, team header, tabs, edit/delete. */
export default function TeamShell(props: { org: string; slug: string; children: JSX.Element }) {
  const team = createMemo(() => getTeam(props.org, props.slug));
  const location = useLocation();
  const navigate = useNavigate();
  const remove = useAction(deleteTeam);
  const [editing, setEditing] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);

  async function confirmDelete() {
    const name = team().name;
    await remove(props.org, props.slug);
    toast(`Deleted team ${name}`, 'success');
    navigate(`/orgs/${props.org}/teams`, { replace: true });
  }

  const base = () => `/orgs/${props.org}/teams/${props.slug}`;
  const sub = () => location.pathname.replace(/\/+$/, '').slice(base().length);
  const tabs = () => [
    { href: base(), label: 'Overview', icon: telescopeIcon, active: sub() === '' },
    { href: `${base()}/members`, label: 'Members', icon: peopleIcon, count: team().members, active: sub() === '/members' },
    { href: `${base()}/repositories`, label: 'Repositories', icon: repoIcon, count: team().repositories, active: sub() === '/repositories' },
  ];

  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`${team().name} · ${props.org} Team`}</Title>
      <nav aria-label="Breadcrumb" class="text-sm mb-4">
        <a href={`/${props.org}`}>{props.org}</a>
        <span class="text-fg-muted mx-1">/</span>
        <a href={`/orgs/${props.org}/teams`}>Teams</a>
        <Show when={team().parent}>
          {(p) => (
            <>
              <span class="text-fg-muted mx-1">/</span>
              <a href={`/orgs/${props.org}/teams/${p().slug}`}>{p().name}</a>
            </>
          )}
        </Show>
        <span class="text-fg-muted mx-1">/</span>
        <span class="font-semibold">{team().name}</span>
      </nav>

      <div class="flex flex-wrap items-start gap-4 mb-4">
        <Avatar src={team().avatarUrl} size={64} square class="shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-2xl font-semibold break-words">{team().name}</h1>
            <span class="Label">{team().privacy === 'secret' ? 'Secret' : 'Visible'}</span>
          </div>
          <Show when={team().description} fallback={<p class="text-sm text-fg-muted mt-1 italic">No description</p>}>
            <p class="text-fg-muted mt-1">{team().description}</p>
          </Show>
          <p class="text-sm text-fg-muted mt-1">
            @{props.org}/{team().slug}
            <Show when={team().parent}>
              {(p) => (
                <>
                  {' · '}Child team of{' '}
                  <a class="font-semibold" href={`/orgs/${props.org}/teams/${p().slug}`}>
                    {p().name}
                  </a>
                </>
              )}
            </Show>
          </p>
        </div>
        <Show when={team().viewerCanAdminister}>
          <div class="flex items-center gap-2">
            <button type="button" class="btn btn-sm" onClick={() => setEditing(true)}>
              <Octicon icon={gearIcon} /> Edit team
            </button>
            <Dropdown class="btn btn-sm" align="right" title="More team actions" button={<Octicon icon={kebabHorizontalIcon} aria-label="More team actions" />}>
              {(close) => (
                <button
                  type="button"
                  class="SelectMenu-item danger"
                  onClick={() => {
                    close();
                    setDeleting(true);
                  }}
                >
                  Delete team…
                </button>
              )}
            </Dropdown>
          </div>
        </Show>
      </div>

      <ScopeNotice when={team().viewerCanAdminister} scope="write:org" what="team changes" />

      <nav class="UnderlineNav mb-6" aria-label="Team">
        <ul class="UnderlineNav-body">
          <For each={tabs()}>
            {(t) => (
              <li>
                <a class="UnderlineNav-item" href={t.href} aria-current={t.active ? 'page' : undefined}>
                  <Octicon icon={t.icon} />
                  {t.label}
                  <Show when={t.count != null}>
                    <span class="Counter">{formatNumber(t.count)}</span>
                  </Show>
                </a>
              </li>
            )}
          </For>
        </ul>
      </nav>

      <Section>{props.children}</Section>

      <Show when={editing()}>
        <TeamDialog org={props.org} team={team()} subpath={sub()} open={editing()} onClose={() => setEditing(false)} />
      </Show>
      <ConfirmDialog
        open={deleting()}
        onClose={() => setDeleting(false)}
        title={`Delete ${team().name}?`}
        confirmText={team().slug}
        button="I understand, delete this team"
        onConfirm={confirmDelete}
      >
        <div class="flash flash-warn mb-3">
          Deleting a team removes its members’ access to the team’s repositories
          <Show when={team().childTeams.length}> and also deletes its {team().childTeams.length} child teams</Show>. This
          can’t be undone.
        </div>
      </ConfirmDialog>
    </div>
  );
}
