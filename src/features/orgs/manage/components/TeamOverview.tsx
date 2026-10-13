import { createMemo, For, Show } from 'solid-js';
import { Avatar, Blankslate } from '../../../../components/ui';
import { peopleIcon } from '../../../../icons/octicons';
import { formatNumber, pluralize } from '../../../../lib/format';
import { getTeam, getTeamMembers } from '../api';

/** /orgs/:org/teams/:team — child teams and a preview of the members. */
export default function TeamOverview(props: { org: string; slug: string }) {
  const team = createMemo(() => getTeam(props.org, props.slug));
  const members = createMemo(() => getTeamMembers(props.org, props.slug));
  const base = () => `/orgs/${props.org}/teams/${props.slug}`;
  const maintainers = () => members().filter((m) => m.role === 'MAINTAINER');

  return (
    <div class="flex flex-col lg:flex-row gap-6">
      <div class="flex-1 min-w-0">
        <div class="Box">
          <div class="Box-header py-3! flex items-center">
            <h2 class="Box-title flex-1">Child teams</h2>
            <span class="Counter">{formatNumber(team().childTeams.length)}</span>
          </div>
          <ul>
            <For
              each={team().childTeams}
              fallback={
                <li class="Box-row">
                  <Blankslate icon={peopleIcon} title="No child teams">
                    Nested teams inherit this team’s repository access and @mentions.
                  </Blankslate>
                </li>
              }
            >
              {(c) => (
                <li class="Box-row flex items-center gap-3">
                  <div class="flex-1 min-w-0">
                    <a class="font-semibold" href={`/orgs/${props.org}/teams/${c.slug}`}>
                      {c.name}
                    </a>
                    <Show when={c.description}>
                      <p class="text-sm text-fg-muted truncate">{c.description}</p>
                    </Show>
                  </div>
                  <a class="link-muted text-sm" href={`/orgs/${props.org}/teams/${c.slug}/members`}>
                    {pluralize(c.members, 'member')}
                  </a>
                </li>
              )}
            </For>
          </ul>
        </div>
      </div>

      <aside class="lg:w-[296px] shrink-0 text-sm">
        <section class="pb-4 mb-4 border-b border-line-muted">
          <h2 class="text-base font-semibold mb-2 flex items-center">
            <a class="link-plain flex-1" href={`${base()}/members`}>
              Members
            </a>
            <span class="Counter">{formatNumber(team().members)}</span>
          </h2>
          <div class="flex flex-wrap gap-1">
            <For each={members().slice(0, 24)}>
              {(m) => (
                <a href={`/${m.login}`} title={m.name ? `${m.name} (${m.login})` : m.login}>
                  <Avatar src={m.avatarUrl} login={m.login} size={32} />
                </a>
              )}
            </For>
          </div>
          <Show when={members().length > 24}>
            <a class="block mt-2 text-xs" href={`${base()}/members`}>
              View all {formatNumber(members().length)} members
            </a>
          </Show>
        </section>
        <Show when={maintainers().length}>
          <section class="pb-4 mb-4 border-b border-line-muted">
            <h2 class="text-base font-semibold mb-2">Maintainers</h2>
            <ul>
              <For each={maintainers()}>
                {(m) => (
                  <li class="flex items-center gap-2 py-1">
                    <Avatar src={m.avatarUrl} login={m.login} size={20} />
                    <a class="link-plain font-semibold" href={`/${m.login}`}>
                      {m.login}
                    </a>
                    <Show when={m.name}>
                      <span class="text-fg-muted truncate">{m.name}</span>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </section>
        </Show>
        <section class="pb-4 mb-4 border-b border-line-muted">
          <h2 class="text-base font-semibold mb-2 flex items-center">
            <a class="link-plain flex-1" href={`${base()}/repositories`}>
              Repositories
            </a>
            <span class="Counter">{formatNumber(team().repositories)}</span>
          </h2>
          <a class="text-xs" href={`${base()}/repositories`}>
            {team().repositories ? 'View repository access' : 'No repositories yet'}
          </a>
        </section>
        <section>
          <h2 class="text-base font-semibold mb-2">Notifications</h2>
          <p class="text-fg-muted">
            {team().notification_setting === 'notifications_enabled'
              ? 'Everyone is notified when this team is @mentioned.'
              : 'No one is notified when this team is @mentioned.'}
          </p>
        </section>
      </aside>
    </div>
  );
}
