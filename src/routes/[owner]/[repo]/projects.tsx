import { Title } from '@solidjs/meta';
import { useSearchParams } from '@solidjs/router';
import { createMemo, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Blankslate, RelativeTime } from '../../../components/ui';
import { getRepoProjects } from '../../../features/insights/api';
import { useRepo } from '../../../features/repo/context';
import { linkExternalIcon, lockIcon, tableIcon } from '../../../icons/octicons';
import { pluralize } from '../../../lib/format';

/** /:owner/:repo/projects — Projects linked to the repo (the project UI itself lives on github.com). */
export default function ProjectsPage() {
  const ctx = useRepo();
  const [search, setSearch] = useSearchParams<{ query?: string; closed?: string }>();
  const closed = () => search.closed === '1';
  const projects = createMemo(() => getRepoProjects(ctx.owner(), ctx.name(), search.query ?? '', closed()));
  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`Projects · ${ctx.fullName()}`}</Title>
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <input
          class="form-control max-w-[400px]"
          placeholder="Search projects"
          value={search.query ?? ''}
          onChange={(e) => setSearch({ query: e.currentTarget.value || undefined })}
        />
      </div>
      <div class="Box">
        <div class="Box-header flex gap-4 text-sm">
          <a class={['link-plain flex items-center gap-1', { 'font-semibold': !closed() }]} href={`${ctx.base()}/projects`}>
            <Octicon icon={tableIcon} /> Open
          </a>
          <a class={['link-plain', { 'font-semibold': closed() }]} href={`${ctx.base()}/projects?closed=1`}>
            Closed
          </a>
        </div>
        <For
          each={projects().projects}
          fallback={
            <Show
              when={!projects().missingScope}
              fallback={
                <Blankslate icon={tableIcon} title="Projects need the read:project scope">
                  Sign in again with a token that includes <code class="font-mono">read:project</code> (or{' '}
                  <code class="font-mono">project</code>) to list linked projects.
                </Blankslate>
              }
            >
            <Blankslate icon={tableIcon} title={closed() ? 'No closed projects' : 'Provide quick access to relevant projects.'}>
              Add projects to view them here. Projects are created and linked on github.com.
            </Blankslate>
            </Show>
          }
        >
          {(p) => (
            <div class="Box-row flex items-start gap-3">
              <Octicon icon={tableIcon} class="text-fg-muted mt-1" />
              <div class="flex-1 min-w-0">
                <a class="font-semibold link-plain" href={p.url} target="_blank" rel="noreferrer">
                  {p.title} <Octicon icon={linkExternalIcon} class="text-fg-muted" />
                </a>
                <Show when={!p.public}>
                  <Octicon icon={lockIcon} class="text-fg-muted ml-1" aria-label="Private" />
                </Show>
                <Show when={p.shortDescription}>
                  <p class="text-sm text-fg-muted">{p.shortDescription}</p>
                </Show>
                <p class="text-xs text-fg-muted mt-1">
                  #{p.number} · {p.owner.login} · {pluralize(p.items.totalCount, 'item')} · updated <RelativeTime datetime={p.updatedAt} />
                </p>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
