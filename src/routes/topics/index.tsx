import { Title } from '@solidjs/meta';
import { useLocation, useSearchParams } from '@solidjs/router';
import { createMemo, For, Loading, Show } from 'solid-js';
import { Pagination, PageSpinner, pageHref } from '../../components/ui';
import { getCuratedTopics } from '../../features/explore/api';
import ExploreNav from '../../features/explore/components/ExploreNav';
import { TopicLogo } from '../../features/search/components/ResultCards';

/** /topics — featured topics grid and the list of curated ("popular") topics. */
export default function TopicsIndex() {
  const [sp] = useSearchParams();
  const location = useLocation();
  const page = () => Math.max(1, Number(sp.page) || 1);
  const featured = createMemo(() => getCuratedTopics('featured', 1, 30));
  const curated = createMemo(() => getCuratedTopics('curated', page(), 30));

  return (
    <>
      <Title>Topics on GitHub · GitHub</Title>
      <ExploreNav active="topics" />
      <div class="bg-canvas-muted border-b border-line-muted">
        <div class="container-lg px-4 py-10 text-center">
          <h1 class="text-4xl font-semibold">Topics</h1>
          <p class="text-fg-muted text-lg mt-2">Browse popular topics on GitHub.</p>
        </div>
      </div>
      <div class="container-lg px-4 py-6">
        <Show when={page() === 1}>
          <Loading fallback={<PageSpinner />}>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
              <For each={featured().items}>
                {(t) => (
                  <a class="Box p-4 flex flex-col items-center text-center gap-2 link-plain hover:bg-canvas-muted" href={`/topics/${t.name}`}>
                    <TopicLogo name={t.name} size={64} />
                    <span class="font-semibold text-base">{t.display_name || t.name}</span>
                    <Show when={t.short_description}>
                      <span class="text-xs text-fg-muted line-clamp-2">{t.short_description}</span>
                    </Show>
                  </a>
                )}
              </For>
            </div>
          </Loading>
        </Show>
        <h2 class="text-xl font-semibold mb-2">Popular topics</h2>
        <Loading fallback={<PageSpinner />}>
          <ul class="Box">
            <For each={curated().items}>
              {(t) => (
                <li class="Box-row flex items-start gap-4">
                  <TopicLogo name={t.name} size={48} />
                  <div class="min-w-0 flex-1">
                    <a class="text-lg font-semibold" href={`/topics/${t.name}`}>
                      {t.display_name || t.name}
                    </a>
                    <Show when={t.short_description}>
                      <p class="text-sm text-fg-muted mt-0.5">{t.short_description}</p>
                    </Show>
                  </div>
                </li>
              )}
            </For>
          </ul>
          <div class="mt-6">
            <Pagination pageInfo={curated().pageInfo} href={(p) => pageHref(location, p)} />
          </div>
        </Loading>
      </div>
    </>
  );
}
