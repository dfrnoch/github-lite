import { Title } from '@solidjs/meta';
import { useSearchParams } from '@solidjs/router';
import { createMemo, For, isPending, Loading, Show } from 'solid-js';
import Octicon from '../components/Octicon';
import { PageSpinner } from '../components/ui';
import { flameIcon, hashIcon } from '../icons/octicons';
import { getCuratedTopics, getTrendingRepos, type Since } from '../features/explore/api';
import ExploreNav from '../features/explore/components/ExploreNav';
import { TrendingRow } from '../features/explore/components/RepoListItem';
import { TopicLogo } from '../features/search/components/ResultCards';

const RANGES: { since: Since; label: string; period: string }[] = [
  { since: 'daily', label: 'Today', period: 'today' },
  { since: 'weekly', label: 'This week', period: 'this week' },
  { since: 'monthly', label: 'This month', period: 'this month' },
];

/** /explore — trending repositories (approximated with search) and featured topics. */
export default function ExplorePage() {
  const [sp] = useSearchParams();
  const range = () => RANGES.find((r) => r.since === sp.since) ?? RANGES[1]!;
  const trending = createMemo(() => getTrendingRepos(range().since));
  const topics = createMemo(() => getCuratedTopics('featured', 1, 30));

  return (
    <>
      <Title>Explore GitHub</Title>
      <ExploreNav active="explore" />
      <div class="container-xl px-4 py-6 flex flex-col lg:flex-row gap-6">
        <section class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h1 class="text-xl font-semibold text-fg-muted">Here's what's popular on GitHub {range().period}...</h1>
            <div class="SegmentedControl" role="group" aria-label="Date range">
              <For each={RANGES}>
                {(r) => (
                  <a class="SegmentedControl-item" href={`/explore?since=${r.since}`} aria-current={r === range() ? 'true' : undefined}>
                    {r.label}
                  </a>
                )}
              </For>
            </div>
          </div>
          <div class="Box">
            <div class="Box-header flex items-center gap-2">
              <Octicon icon={flameIcon} class="text-fg-severe" />
              <h2 class="Box-title">Trending repositories</h2>
              <span class="text-xs text-fg-muted ml-auto">Most starred repositories created {range().period}</span>
            </div>
            <Loading fallback={<PageSpinner />}>
              <div class={{ 'opacity-50': isPending(() => trending()) }}>
                <Show when={trending().length} fallback={<div class="Box-row text-fg-muted">No repositories found.</div>}>
                  <For each={trending()}>{(repo) => <TrendingRow repo={repo} periodLabel={range().period} />}</For>
                </Show>
              </div>
            </Loading>
          </div>
        </section>

        <aside class="lg:w-[320px] shrink-0">
          <div class="Box">
            <div class="Box-header flex items-center gap-2">
              <Octicon icon={hashIcon} class="text-fg-muted" />
              <h2 class="Box-title flex-1">Featured topics</h2>
              <a class="text-xs" href="/topics">
                See all
              </a>
            </div>
            <Loading fallback={<PageSpinner />}>
              <For each={topics().items}>
                {(t) => (
                  <a class="Box-row Box-row--hover flex items-start gap-3 link-plain" href={`/topics/${t.name}`}>
                    <TopicLogo name={t.name} size={32} />
                    <span class="min-w-0">
                      <span class="block font-semibold">{t.display_name || t.name}</span>
                      <Show when={t.short_description}>
                        <span class="block text-xs text-fg-muted line-clamp-2">{t.short_description}</span>
                      </Show>
                    </span>
                  </a>
                )}
              </For>
            </Loading>
          </div>
        </aside>
      </div>
    </>
  );
}
