import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, RelativeTime, StateIcon, itemState } from '../../../components/ui';
import { repoIcon } from '../../../icons/octicons';
import { getTopRepos } from '../api';
import { getRecentActivity } from '../feed';

const COLLAPSED = 7;

/** Left column of the dashboard: "Top repositories" (filterable) and "Recent activity". */
export default function DashboardSidebar(props: { login: string }) {
  const repos = createMemo(() => getTopRepos(100));
  const recent = createMemo(() => getRecentActivity(props.login));
  const [filter, setFilter] = createSignal('');
  const [expanded, setExpanded] = createSignal(false);
  const matches = createMemo(() => {
    const f = filter().trim().toLowerCase();
    return f ? repos().filter((r) => r.full_name.toLowerCase().includes(f)) : repos();
  });
  const visible = () => (expanded() || filter() ? matches() : matches().slice(0, COLLAPSED));

  return (
    <div class="flex flex-col gap-8">
      <section>
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold">Top repositories</h2>
          <a class="btn btn-sm btn-primary" href="/new">
            <Octicon icon={repoIcon} class="text-fg-on-emphasis!" />
            New
          </a>
        </div>
        <input
          type="search"
          class="form-control form-control-sm mb-2"
          placeholder="Find a repository…"
          aria-label="Find a repository…"
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
        />
        <Loading
          fallback={
            <ul>
              <For each={[1, 2, 3, 4, 5]}>
                {() => (
                  <li class="flex items-center gap-2 py-1.5">
                    <span class="w-4 h-4 rounded-full Skeleton" />
                    <span class="h-3 w-40 rounded Skeleton" />
                  </li>
                )}
              </For>
            </ul>
          }
        >
          <ul>
            <For each={visible()} fallback={<li class="text-xs text-fg-muted py-2">No repositories match.</li>}>
              {(repo) => (
                <li class="flex items-center gap-2 py-1.5 min-w-0">
                  <a href={`/${repo.owner.login}`} class="shrink-0">
                    <Avatar src={repo.owner.avatar_url} size={16} square={repo.owner.type === 'Organization'} />
                  </a>
                  <a class="link-plain font-semibold text-sm truncate" href={`/${repo.full_name}`}>
                    {repo.full_name}
                  </a>
                </li>
              )}
            </For>
          </ul>
          <Show when={!filter() && !expanded() && matches().length > COLLAPSED}>
            <button type="button" class="btn-link text-xs text-fg-muted mt-1 hover:text-fg-accent" onClick={() => setExpanded(true)}>
              Show more
            </button>
          </Show>
        </Loading>
      </section>

      <section>
        <h2 class="text-sm font-semibold mb-2">Recent activity</h2>
        <Loading fallback={<div class="h-20 rounded-md Skeleton" />}>
          <Show
            when={recent().length}
            fallback={<p class="text-xs text-fg-muted">When you take actions across GitHub, we’ll provide links to that activity here.</p>}
          >
            <ul class="flex flex-col gap-1">
              <For each={recent()}>
                {(item) => (
                  <li>
                    <a
                      class="flex items-start gap-2 p-2 -mx-2 rounded-md hover:bg-canvas-muted no-underline! text-fg"
                      href={`/${item.repo}/${item.kind === 'pull' ? 'pull' : 'issues'}/${item.number}`}
                    >
                      <StateIcon
                        class="mt-0.5"
                        state={itemState({
                          isPull: item.kind === 'pull',
                          state: item.state,
                          stateReason: item.stateReason,
                          merged: item.merged,
                          draft: item.isDraft,
                        })}
                      />
                      <span class="min-w-0">
                        <span class="block text-xs text-fg-muted truncate">
                          {item.repo} · <RelativeTime datetime={item.updatedAt} />
                        </span>
                        <span class="block text-sm font-semibold break-words">{item.title}</span>
                      </span>
                    </a>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Loading>
      </section>
    </div>
  );
}
