import type { JSX } from '@solidjs/web';
import { createMemo, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { RelativeTime } from '../../../components/ui';
import { cacheIcon, playIcon, serverIcon, stopIcon } from '../../../icons/octicons';
import { useRepo } from '../../repo/context';
import { getWorkflows, getWorkflowSources } from '../api';
import { nextCronDate, workflowCrons } from '../cron';
import { workflowDispatch } from '../yaml';
import '../actions.css';

/** File name of a workflow path (`.github/workflows/ci.yml` → `ci.yml`); dynamic workflows keep their id. */
export const workflowFile = (path: string) => path.split('/').pop() ?? path;

/**
 * Two-column frame of the Actions pages: workflows sidebar on the left,
 * page content on the right. `active` is the selected workflow file, '' for
 * "All workflows", or a management page key.
 */
export default function ActionsShell(props: { active: string; children: JSX.Element }) {
  const ctx = useRepo();
  const workflows = createMemo(() => getWorkflows(ctx.owner(), ctx.name()));
  const sorted = createMemo(() =>
    [...workflows()].filter((w) => w.state !== 'deleted').sort((a, b) => a.name.localeCompare(b.name)),
  );
  const href = (path: string) => `${ctx.base()}/actions${path}`;
  const canDispatch = () => !!ctx.repo().permissions?.push;
  // Manual trigger + next scheduled run per workflow file.
  const indicators = createMemo(() => {
    const files = getWorkflowSources(ctx.owner(), ctx.name());
    const out: Record<string, { manual: boolean; next: Date | null }> = {};
    for (const [file, source] of Object.entries(files)) {
      let next: Date | null = null;
      for (const cron of workflowCrons(source)) {
        const t = nextCronDate(cron);
        if (t && (!next || t < next)) next = t;
      }
      out[file] = { manual: workflowDispatch(source).dispatchable, next };
    }
    return out;
  });

  return (
    <div class="flex flex-col md:flex-row min-h-[calc(100vh-200px)]">
      <aside class="md:w-[336px] shrink-0 border-b md:border-b-0 md:border-r border-line-muted px-2 py-4">
        <h2 class="text-xl font-semibold px-2 mb-3">Actions</h2>
        <nav aria-label="Actions Workflows">
          <ul class="NavList">
            <li>
              <a class="NavList-item" href={href('')} aria-current={props.active === '' ? 'page' : undefined}>
                All workflows
              </a>
            </li>
          </ul>
          <hr class="NavList-divider" />
          <Loading fallback={<div class="px-2 py-1 text-sm text-fg-muted">Loading workflows…</div>}>
            <ul class="NavList max-h-[60vh] overflow-auto">
              <For each={sorted()}>
                {(w) => (
                  <li class="relative group">
                    <a
                      class="NavList-item"
                      href={href(`/workflows/${workflowFile(w.path)}`)}
                      aria-current={props.active === workflowFile(w.path) ? 'page' : undefined}
                      title={w.name}
                    >
                      <span class="truncate flex-1">
                        {w.name}
                        <Loading>
                          <Show when={indicators()[workflowFile(w.path)]?.next}>
                            {(next) => (
                              <em class="text-fg-muted font-normal">
                                {' '}
                                (<RelativeTime datetime={next().toISOString()} relative />)
                              </em>
                            )}
                          </Show>
                        </Loading>
                      </span>
                      <Show when={w.state.startsWith('disabled')}>
                        <Octicon icon={stopIcon} aria-label="Disabled" />
                      </Show>
                      <Loading>
                        <Show when={indicators()[workflowFile(w.path)]?.manual && !canDispatch()}>
                          <span class="inline-flex text-fg-muted" title="This workflow can be triggered manually">
                            <Octicon icon={playIcon} />
                          </span>
                        </Show>
                      </Loading>
                    </a>
                    <Loading>
                    <Show
                      when={
                        indicators()[workflowFile(w.path)]?.manual &&
                        canDispatch() &&
                        !w.state.startsWith('disabled') &&
                        props.active !== workflowFile(w.path)
                      }
                    >
                      <a
                        class="btn-octicon absolute right-1 top-1/2 -translate-y-1/2 bg-canvas!"
                        href={`${href(`/workflows/${workflowFile(w.path)}`)}#rgh-run-workflow`}
                        title="Trigger manually"
                        aria-label={`Run ${w.name}`}
                      >
                        <Octicon icon={playIcon} />
                      </a>
                    </Show>
                    </Loading>
                  </li>
                )}
              </For>
            </ul>
            <Show when={!sorted().length}>
              <p class="px-2 py-1 text-sm text-fg-muted">No workflows yet.</p>
            </Show>
          </Loading>
          <hr class="NavList-divider" />
          <div class="NavList-heading">Management</div>
          <ul class="NavList">
            <li>
              <a class="NavList-item" href={href('/caches')} aria-current={props.active === ':caches' ? 'page' : undefined}>
                <Octicon icon={cacheIcon} />
                Caches
              </a>
            </li>
            <li>
              <a class="NavList-item" href={href('/runners')} aria-current={props.active === ':runners' ? 'page' : undefined}>
                <Octicon icon={serverIcon} />
                Runners
              </a>
            </li>
          </ul>
        </nav>
      </aside>
      <div class="flex-1 min-w-0 px-4 md:px-6 lg:px-8 py-4">{props.children}</div>
    </div>
  );
}
