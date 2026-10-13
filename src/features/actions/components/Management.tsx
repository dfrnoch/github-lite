import { action, query, useAction, useLocation, useNavigate } from '@solidjs/router';
import { createMemo, createSignal, Errored, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Blankslate, Dropdown, ErrorView, PageSpinner, Pagination, RelativeTime, pageHref, toastError } from '../../../components/ui';
import { cacheIcon, checkIcon, gitBranchIcon, searchIcon, serverIcon, trashIcon, triangleDownIcon } from '../../../icons/octicons';
import { gh, ghPage, GitHubError } from '../../../lib/github';
import { formatBytes, formatNumber } from '../../../lib/format';
import { useRepo } from '../../repo/context';

interface ActionsCache {
  id: number;
  ref: string;
  key: string;
  version: string;
  last_accessed_at: string;
  created_at: string;
  size_in_bytes: number;
}

const getCaches = query(
  (owner: string, repo: string, opts: { page: number; key: string; sort: string; direction: string }) =>
    ghPage<ActionsCache>(`/repos/${owner}/${repo}/actions/caches`, {
      page: opts.page,
      perPage: 30,
      pick: (d) => d.actions_caches,
      query: { key: opts.key, sort: opts.sort, direction: opts.direction },
    }),
  'actions-caches',
);

const getCacheUsage = query(
  (owner: string, repo: string) =>
    gh<{ active_caches_size_in_bytes: number; active_caches_count: number }>(`/repos/${owner}/${repo}/actions/cache/usage`),
  'actions-cache-usage',
);

const deleteCache = action(async (owner: string, repo: string, id: number) => {
  await gh(`/repos/${owner}/${repo}/actions/caches/${id}`, { method: 'DELETE' });
}, 'actions-delete-cache');

const SORTS = [
  { value: 'last_accessed_at', label: 'Last used' },
  { value: 'created_at', label: 'Created' },
  { value: 'size_in_bytes', label: 'Size' },
];

/** /actions/caches — the repo's Actions caches, with delete. */
export function CachesView() {
  const ctx = useRepo();
  const location = useLocation();
  const navigate = useNavigate();
  const opts = createMemo(() => ({
    page: Math.max(1, Number(location.query.page) || 1),
    key: String(location.query.query ?? ''),
    sort: String(location.query.sort ?? 'last_accessed_at'),
    direction: 'desc',
  }));
  const caches = createMemo(() => getCaches(ctx.owner(), ctx.name(), opts()));
  const usage = createMemo(() => getCacheUsage(ctx.owner(), ctx.name()));
  const remove = useAction(deleteCache);
  const [busy, setBusy] = createSignal<number | null>(null);
  const canWrite = () => !!ctx.repo().permissions?.push;
  const setParam = (key: string, value: string) => {
    const p = new URLSearchParams(location.search);
    if (value) p.set(key, value);
    else p.delete(key);
    p.delete('page');
    const qs = p.toString();
    navigate(`${location.pathname}${qs ? `?${qs}` : ''}`);
  };

  return (
    <>
      <h2 class="text-xl">Caches</h2>
      <p class="text-sm text-fg-muted mt-1 mb-4">
        Showing caches from all workflows.{' '}
        <a href="https://docs.github.com/actions/using-workflows/caching-dependencies-to-speed-up-workflows" target="_blank" rel="noreferrer">
          Learn more about managing caches.
        </a>
      </p>
      <form
        class="relative mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          setParam('query', String(new FormData(e.currentTarget).get('query') ?? '').trim());
        }}
      >
        <Octicon icon={searchIcon} class="absolute left-2 top-2 text-fg-muted" />
        <input name="query" class="form-control w-full pl-8!" placeholder="Filter caches by key prefix" value={opts().key} />
      </form>
      <div class="Box">
        <Loading fallback={<PageSpinner />}>
          <div class="Box-header flex items-center gap-2 py-2!">
            <h3 class="flex-1 font-semibold py-1">
              {formatNumber(caches().total ?? caches().items.length)} caches
              <Loading>
                <span class="text-fg-muted font-normal"> · {formatBytes(usage().active_caches_size_in_bytes)} used</span>
              </Loading>
            </h3>
            <Dropdown
              class="btn btn-invisible text-fg-muted! font-normal!"
              align="right"
              header="Sort by"
              button={
                <>
                  Sort <Octicon icon={triangleDownIcon} />
                </>
              }
            >
              {(close) => (
                <For each={SORTS}>
                  {(s) => (
                    <button type="button" class="SelectMenu-item" onClick={() => (close(), setParam('sort', s.value))}>
                      <span class="w-4">
                        <Show when={opts().sort === s.value}>
                          <Octicon icon={checkIcon} />
                        </Show>
                      </span>
                      {s.label}
                    </button>
                  )}
                </For>
              )}
            </Dropdown>
          </div>
          <Show when={caches().items.length} fallback={<Blankslate icon={cacheIcon} title="No caches">Caches created by workflow runs show up here.</Blankslate>}>
            <ul>
              <For each={caches().items}>
                {(c) => (
                  <li class="Box-row flex items-center gap-3">
                    <Octicon icon={cacheIcon} class="text-fg-muted shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="font-semibold font-mono text-sm break-all">{c.key}</div>
                      <div class="text-xs text-fg-muted flex flex-wrap items-center gap-x-3 mt-1">
                        <span class="flex items-center gap-1">
                          <Octicon icon={gitBranchIcon} />
                          <span class="branch-name">{c.ref.replace(/^refs\/heads\//, '')}</span>
                        </span>
                        <span>{formatBytes(c.size_in_bytes)}</span>
                        <span>
                          Created <RelativeTime datetime={c.created_at} />
                        </span>
                        <span>
                          Last used <RelativeTime datetime={c.last_accessed_at} />
                        </span>
                      </div>
                    </div>
                    <Show when={canWrite()}>
                      <button
                        type="button"
                        class="btn-octicon btn-octicon-danger"
                        title="Delete cache"
                        aria-label={`Delete cache ${c.key}`}
                        disabled={busy() === c.id}
                        onClick={async () => {
                          if (!confirm(`Delete the cache "${c.key}"?`)) return;
                          setBusy(c.id);
                          try {
                            await remove(ctx.owner(), ctx.name(), c.id);
                          } catch (e) {
                            toastError(e);
                          } finally {
                            setBusy(null);
                          }
                        }}
                      >
                        <Octicon icon={trashIcon} />
                      </button>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <Show when={caches().pageInfo.hasNext || opts().page > 1}>
            <div class="Box-footer flex justify-center py-2!">
              <Pagination pageInfo={caches().pageInfo} href={(p) => pageHref(location, p)} />
            </div>
          </Show>
        </Loading>
      </div>
    </>
  );
}

interface Runner {
  id: number;
  name: string;
  os: string;
  status: 'online' | 'offline';
  busy: boolean;
  labels: { name: string; type: string }[];
}

const getRunners = query(
  async (owner: string, repo: string) => {
    const data = await gh<{ total_count: number; runners: Runner[] }>(`/repos/${owner}/${repo}/actions/runners`, {
      query: { per_page: 100 },
    });
    return data.runners;
  },
  'actions-runners',
);

/** /actions/runners — self-hosted runners (needs admin access). */
export function RunnersView() {
  const ctx = useRepo();
  return (
    <>
      <h2 class="text-xl">Runners</h2>
      <p class="text-sm text-fg-muted mt-1 mb-4">Self-hosted runners registered to this repository. GitHub-hosted runners are not listed.</p>
      <Errored
        fallback={(err, reset) =>
          err() instanceof GitHubError && (err() as GitHubError).status === 403 ? (
            <Blankslate icon={serverIcon} title="You don’t have access to this repository’s runners">
              Listing self-hosted runners requires admin access to the repository.
            </Blankslate>
          ) : (
            <ErrorView error={err()} reset={reset} />
          )
        }
      >
        <Loading fallback={<PageSpinner />}>
          <RunnersList owner={ctx.owner()} repo={ctx.name()} />
        </Loading>
      </Errored>
    </>
  );
}

function RunnersList(props: { owner: string; repo: string }) {
  const runners = createMemo(() => getRunners(props.owner, props.repo));
  return (
    <Show when={runners().length} fallback={<Blankslate icon={serverIcon} title="No self-hosted runners">This repository has no self-hosted runners.</Blankslate>}>
      <div class="Box">
        <ul>
          <For each={runners()}>
            {(r) => (
              <li class="Box-row flex items-center gap-3">
                <span class={['w-2 h-2 rounded-full shrink-0', r.status === 'online' ? (r.busy ? 'bg-attention-emphasis' : 'bg-success-emphasis') : 'bg-neutral-emphasis']} />
                <div class="flex-1 min-w-0">
                  <div class="font-semibold">{r.name}</div>
                  <div class="flex flex-wrap gap-1 mt-1">
                    <For each={r.labels}>{(l) => <span class="Label">{l.name}</span>}</For>
                  </div>
                </div>
                <span class="text-sm text-fg-muted">{r.status === 'online' ? (r.busy ? 'Active' : 'Idle') : 'Offline'}</span>
              </li>
            )}
          </For>
        </ul>
      </div>
    </Show>
  );
}
