import { useSearchParams } from '@solidjs/router';
import { createMemo, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Blankslate } from '../../../components/ui';
import { clockIcon, locationIcon, organizationIcon, starIcon } from '../../../icons/octicons';
import { formatDate, formatNumber } from '../../../lib/format';
import { useRepo } from '../../repo/context';
import { getRepoPeople } from '../api';

/** Stargazers / watchers: a grid of user cards, 48 per page (cursor pagination like github.com). */
export default function PeopleGrid(props: { kind: 'stargazers' | 'watchers' }) {
  const ctx = useRepo();
  const [search] = useSearchParams<{ after?: string; before?: string }>();
  const data = createMemo(() => getRepoPeople(ctx.owner(), ctx.name(), props.kind, search.after, search.before));
  const href = (key: string, cursor: string) => `${ctx.base()}/${props.kind}?${key}=${encodeURIComponent(cursor)}`;
  return (
    <>
      <div class="flex items-center gap-2 pb-2 mb-4 border-b border-line-muted">
        <h2 class="text-2xl font-normal flex-1">{props.kind === 'stargazers' ? 'Stargazers' : 'Watchers'}</h2>
        <span class="Counter">
          {formatNumber(props.kind === 'stargazers' ? Math.max(data().totalCount, ctx.repo().stargazers_count) : data().totalCount)}
        </span>
      </div>
      <Show
        when={data().people.length}
        fallback={
          <Show
            when={props.kind === 'stargazers' && ctx.repo().stargazers_count > 0}
            fallback={
              <Blankslate icon={starIcon} title={props.kind === 'stargazers' ? 'Be the first to star this repository' : 'No one’s watching this repository yet'} />
            }
          >
            <Blankslate icon={starIcon} title={`${formatNumber(ctx.repo().stargazers_count)} stargazers`}>
              GitHub only lists who starred a repository to people who administer it.
            </Blankslate>
          </Show>
        }
      >
        <ol class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-line-muted">
          <For each={data().people}>
            {(p) => (
              <li class="flex gap-3 p-4 border-b border-r border-line-muted min-w-0">
                <a href={`/${p.login}`} class="shrink-0">
                  <Avatar src={p.avatarUrl} size={75} />
                </a>
                <div class="min-w-0 text-sm">
                  <a class="font-semibold text-base block truncate" href={`/${p.login}`}>
                    {p.login}
                  </a>
                  <Show when={p.name}>
                    <p class="text-fg-muted truncate">{p.name}</p>
                  </Show>
                  <Show when={p.company}>
                    <p class="text-xs text-fg-muted truncate flex items-center gap-1">
                      <Octicon icon={organizationIcon} /> {p.company}
                    </p>
                  </Show>
                  <Show when={p.location}>
                    <p class="text-xs text-fg-muted truncate flex items-center gap-1">
                      <Octicon icon={locationIcon} /> {p.location}
                    </p>
                  </Show>
                  <p class="text-xs text-fg-muted flex items-center gap-1">
                    <Octicon icon={clockIcon} />
                    {p.starredAt ? `Starred ${formatDate(p.starredAt, { year: 'numeric' })}` : `Joined ${formatDate(p.createdAt, { year: 'numeric' })}`}
                  </p>
                </div>
              </li>
            )}
          </For>
        </ol>
      </Show>
      <Show when={data().pageInfo.hasNextPage || data().pageInfo.hasPreviousPage}>
        <nav class="pagination" aria-label="Pagination">
          <Show when={data().pageInfo.hasPreviousPage && data().pageInfo.startCursor} fallback={<span class="disabled">Previous</span>}>
            <a href={href('before', data().pageInfo.startCursor!)}>Previous</a>
          </Show>
          <Show when={data().pageInfo.hasNextPage && data().pageInfo.endCursor} fallback={<span class="disabled">Next</span>}>
            <a href={href('after', data().pageInfo.endCursor!)}>Next</a>
          </Show>
        </nav>
      </Show>
    </>
  );
}
