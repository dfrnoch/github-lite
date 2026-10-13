import { Title } from '@solidjs/meta';
import { useLocation, useParams, useSearchParams } from '@solidjs/router';
import { createMemo, For, isPending, Loading, Show } from 'solid-js';
import Octicon from '../../components/Octicon';
import { Blankslate, Dropdown, Pagination, PageSpinner, pageHref } from '../../components/ui';
import { checkIcon, linkExternalIcon, repoIcon, triangleDownIcon } from '../../icons/octicons';
import { formatNumber } from '../../lib/format';
import { getTopic, getTopicRepos, type TopicSort } from '../../features/explore/api';
import ExploreNav from '../../features/explore/components/ExploreNav';
import { TopicRepoCard } from '../../features/explore/components/RepoListItem';
import { TopicLogo } from '../../features/search/components/ResultCards';

const SORTS: { sort: TopicSort; label: string }[] = [
  { sort: 'stars', label: 'Most stars' },
  { sort: 'updated', label: 'Recently updated' },
];

/** /topics/:topic — topic header and the repositories tagged with it. */
export default function TopicPage() {
  const params = useParams<{ topic: string }>();
  const [sp] = useSearchParams();
  const location = useLocation();
  const name = () => params.topic.toLowerCase();
  const sort = (): TopicSort => (sp.o === 'updated' || sp.s === 'updated' ? 'updated' : 'stars');
  const page = () => Math.max(1, Number(sp.page) || 1);
  const topic = createMemo(() => getTopic(name()));
  const repos = createMemo(() => getTopicRepos(name(), sort(), page()));

  const sortHref = (s: TopicSort) => `/topics/${name()}${s === 'stars' ? '' : `?o=desc&s=${s}`}`;

  return (
    <>
      <Title>{`${name()} · GitHub Topics · GitHub`}</Title>
      <ExploreNav active="topics" />
      <div class="container-lg px-4 py-6">
        <Loading fallback={<TopicHeaderSkeleton name={name()} />}>
          <header class="flex items-start gap-4 pb-6 mb-6 border-b border-line-muted">
            <TopicLogo name={name()} size={64} />
            <div class="min-w-0 flex-1">
              <h1 class="text-3xl font-semibold leading-tight">{topic()?.display_name || name()}</h1>
              <Show when={topic()?.short_description}>
                <p class="mt-2 text-fg-muted text-base">{topic()!.short_description}</p>
              </Show>
              <Show when={topic()?.created_by || topic()?.released}>
                <ul class="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-fg-muted">
                  <Show when={topic()?.created_by}>
                    <li>
                      Created by <span class="text-fg">{topic()!.created_by}</span>
                    </li>
                  </Show>
                  <Show when={topic()?.released}>
                    <li>
                      Released <span class="text-fg">{topic()!.released}</span>
                    </li>
                  </Show>
                </ul>
              </Show>
              <Show when={(topic() as { wikipedia_url?: string } | null)?.wikipedia_url}>
                {(url) => (
                  <a class="inline-flex items-center gap-1 mt-2 text-sm" href={url()} target="_blank" rel="noreferrer">
                    Wikipedia <Octicon icon={linkExternalIcon} />
                  </a>
                )}
              </Show>
            </div>
          </header>
        </Loading>

        <div class="flex flex-col md:flex-row gap-8">
          <section class="flex-1 min-w-0">
            <Loading fallback={<PageSpinner />}>
              <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 class="text-xl font-semibold text-fg-muted">
                  Here are {formatNumber(repos().total ?? 0)} public repositories matching this topic...
                </h2>
                <Dropdown
                  class="btn btn-sm"
                  align="right"
                  header="Sort options"
                  button={
                    <>
                      <span class="text-fg-muted">Sort:</span> {SORTS.find((s) => s.sort === sort())!.label}
                      <Octicon icon={triangleDownIcon} />
                    </>
                  }
                >
                  {(close) => (
                    <For each={SORTS}>
                      {(s) => (
                        <a
                          class="SelectMenu-item"
                          role="menuitemradio"
                          aria-checked={s.sort === sort() ? 'true' : 'false'}
                          href={sortHref(s.sort)}
                          onClick={close}
                        >
                          <span class="w-4">
                            <Show when={s.sort === sort()}>
                              <Octicon icon={checkIcon} />
                            </Show>
                          </span>
                          {s.label}
                        </a>
                      )}
                    </For>
                  )}
                </Dropdown>
              </div>
              <Show
                when={repos().items.length}
                fallback={
                  <Blankslate icon={repoIcon} title="No repositories found" class="Box">
                    No public repositories are tagged with this topic yet.
                  </Blankslate>
                }
              >
                <div class={['flex flex-col gap-6', { 'opacity-50': isPending(() => repos()) }]}>
                  <For each={repos().items}>{(repo) => <TopicRepoCard repo={repo} topic={name()} />}</For>
                </div>
                <div class="mt-6">
                  <Pagination pageInfo={repos().pageInfo} href={(p) => pageHref(location, p)} />
                </div>
              </Show>
            </Loading>
          </section>
          <aside class="md:w-[256px] shrink-0 text-sm">
            <h2 class="text-base font-semibold mb-2">Add this topic to your repo</h2>
            <p class="text-fg-muted">
              To associate your repository with the <strong class="text-fg">{name()}</strong> topic, visit your repo's landing
              page and select "manage topics."
            </p>
          </aside>
        </div>
      </div>
    </>
  );
}

function TopicHeaderSkeleton(props: { name: string }) {
  return (
    <header class="flex items-center gap-4 pb-6 mb-6 border-b border-line-muted">
      <TopicLogo name={props.name} size={64} />
      <h1 class="text-3xl font-semibold">{props.name}</h1>
    </header>
  );
}
