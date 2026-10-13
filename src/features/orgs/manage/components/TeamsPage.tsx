import { Title } from '@solidjs/meta';
import { useSearchParams } from '@solidjs/router';
import { createMemo, For, Show } from 'solid-js';
import { Avatar, Blankslate } from '../../../../components/ui';
import { peopleIcon } from '../../../../icons/octicons';
import { formatNumber, pluralize } from '../../../../lib/format';
import { getOrgMeta } from '../../api';
import { getOrgTeams, type TeamSummary } from '../api';
import { ScopeNotice, Section } from './Notices';
import SearchInput from './SearchInput';
import { NewTeamButton } from './TeamDialog';

/** /orgs/:org/teams — searchable list of the organization's teams. */
export default function TeamsPage(props: { org: string }) {
  const meta = createMemo(() => getOrgMeta(props.org));
  const [sp] = useSearchParams<{ query?: string }>();
  // Started alongside meta (not after it) so both load in parallel.
  const teams = createMemo(() => getOrgTeams(props.org, sp.query ?? ''));
  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`Teams · ${props.org}`}</Title>
      <ScopeNotice when={meta().viewerIsAMember} scope="write:org" what="team changes" />
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <SearchInput placeholder="Find a team…" param="query" class="flex-1 min-w-[200px] md:max-w-[480px]" />
        <div class="flex-1" />
        <Show when={meta().viewerIsAMember}>
          <NewTeamButton org={props.org} />
        </Show>
      </div>
      <Show
        when={meta().viewerIsAMember}
        fallback={
          <Blankslate icon={peopleIcon} title="Teams are only visible to organization members">
            Ask an owner of {props.org} to add you to the organization.
          </Blankslate>
        }
      >
        <Section>
          <TeamList org={props.org} teams={teams()} />
        </Section>
      </Show>
    </div>
  );
}

function TeamList(props: { org: string; teams: { totalCount: number; teams: TeamSummary[] } }) {
  const [sp] = useSearchParams<{ query?: string }>();
  const teams = () => props.teams;
  return (
    <div class="Box">
      <div class="Box-header py-3! text-sm font-semibold">
        <Show when={sp.query} fallback={<>{pluralize(teams().totalCount, 'team')} in the {props.org} organization</>}>
          {pluralize(teams().totalCount, 'team')} matching <span class="font-normal">“{sp.query}”</span>
        </Show>
      </div>
      <ul>
        <For
          each={teams().teams}
          fallback={
            <li class="Box-row">
              <Blankslate icon={peopleIcon} title={sp.query ? 'No teams matched your search' : 'No teams yet'}>
                Teams are groups of organization members that reflect your company or group’s structure, with cascading
                access permissions and mentions.
              </Blankslate>
            </li>
          }
        >
          {(t) => <TeamRow org={props.org} team={t} />}
        </For>
      </ul>
    </div>
  );
}

function TeamRow(props: { org: string; team: TeamSummary }) {
  const href = () => `/orgs/${props.org}/teams/${props.team.slug}`;
  return (
    <li class="Box-row flex items-center gap-3">
      <a href={href()} class="shrink-0">
        <Avatar src={props.team.avatarUrl} size={32} square />
      </a>
      <div class="flex-1 min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <Show when={props.team.parentTeam}>
            {(p) => (
              <>
                <a class="link-muted text-sm" href={`/orgs/${props.org}/teams/${p().slug}`}>
                  {p().name}
                </a>
                <span class="text-fg-muted">/</span>
              </>
            )}
          </Show>
          <a class="font-semibold" href={href()}>
            {props.team.name}
          </a>
          <Show when={props.team.privacy === 'SECRET'}>
            <span class="Label">Secret</span>
          </Show>
        </div>
        <Show when={props.team.description}>
          <p class="text-sm text-fg-muted mt-0.5 truncate">{props.team.description}</p>
        </Show>
      </div>
      <a class="hidden md:flex items-center gap-2 link-muted text-sm w-[180px]" href={`${href()}/members`}>
        <span class="AvatarStack">
          <For each={props.team.memberAvatars}>{(m) => <Avatar src={m.avatarUrl} login={m.login} size={20} />}</For>
        </span>
        {formatNumber(props.team.members)} {props.team.members === 1 ? 'member' : 'members'}
      </a>
      <span class="hidden md:block text-sm text-fg-muted w-[90px] text-right">
        <Show when={props.team.childTeams}>{pluralize(props.team.childTeams, 'team')}</Show>
      </span>
    </li>
  );
}
