import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Blankslate, Dropdown } from '../../../components/ui';
import { filterIcon, flameIcon, rssIcon, xIcon } from '../../../icons/octicons';
import type { RepoSummary } from '../../profile/api';
import { getFeedPage, getFeedTrending } from '../feed';
import { eventVisible, FEED_FILTERS, feedFilterOn, feedFiltersOff, hiddenFeedRepos, hideFeedRepo, setFeedFilter } from '../feedPrefs';
import EventCard, { groupEvents, RepoRow } from './FeedCard';

/** The "Trending repositories" card is slotted in after this many feed cards. */
const TRENDING_AFTER = 3;

/** "Filter" menu: event categories (persisted locally) and repositories hidden via a card's ⋯ menu. */
function FeedFilter() {
  return (
    <Dropdown
      class="btn btn-sm"
      align="right"
      menuClass="w-80"
      header="Show in your feed"
      button={
        <>
          <Octicon icon={filterIcon} />
          Filter
          <Show when={feedFiltersOff() + hiddenFeedRepos().length}>
            {(n) => <span class="Counter">{n()}</span>}
          </Show>
        </>
      }
    >
      {() => (
        <>
          <For each={FEED_FILTERS}>
            {(f) => (
              <label class="SelectMenu-item items-start! cursor-pointer">
                <input
                  type="checkbox"
                  class="mt-0.5 shrink-0"
                  checked={feedFilterOn(f.id)}
                  onChange={(e) => setFeedFilter(f.id, e.currentTarget.checked)}
                />
                <span class="min-w-0">
                  <span class="block font-semibold">{f.label}</span>
                  <span class="block text-xs text-fg-muted font-normal">{f.description}</span>
                </span>
              </label>
            )}
          </For>
          <Show when={hiddenFeedRepos().length}>
            <hr class="SelectMenu-divider" />
            <div class="SelectMenu-header">Hidden repositories</div>
            <For each={hiddenFeedRepos()}>
              {(name) => (
                <div class="SelectMenu-item">
                  <span class="flex-1 truncate">{name}</span>
                  <button type="button" class="btn-octicon w-6! h-6!" aria-label={`Show events from ${name}`} title="Show again" onClick={() => hideFeedRepo(name, false)}>
                    <Octicon icon={xIcon} size={12} />
                  </button>
                </div>
              )}
            </For>
          </Show>
        </>
      )}
    </Dropdown>
  );
}

/** "Trending repositories · See more" card (new repos with the most stars this week). */
function TrendingCard(props: { repos: RepoSummary[] }) {
  return (
    <Loading fallback={<div class="Box rounded-xl! h-40 Skeleton" />}>
      <Show when={props.repos.length}>
        <section class="Box rounded-xl! p-4 sm:p-5" aria-labelledby="feed-trending-heading">
          <header class="flex items-center gap-2 mb-1">
            <Octicon icon={flameIcon} class="text-fg-severe" />
            <h3 id="feed-trending-heading" class="text-base font-semibold">
              Trending repositories
            </h3>
            <span class="text-fg-muted">·</span>
            <a class="text-sm" href="/explore">
              See more
            </a>
          </header>
          <ul>
            <For each={props.repos}>
              {(repo) => (
                <li class="py-4 border-b border-line-muted last:border-b-0 last:pb-0">
                  <RepoRow repo={repo} />
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>
    </Loading>
  );
}

function FeedPageView(props: { page: number; isLast: boolean; trending: RepoSummary[]; onMore: () => void }) {
  const data = createMemo(() => getFeedPage(props.page), { name: 'feedPage' });
  const groups = createMemo(() => groupEvents(data().events.filter(eventVisible)), { name: 'feedGroups' });
  return (
    <>
      <Show
        when={groups().length || props.page > 1}
        fallback={
          <Show
            when={data().events.length}
            fallback={
              <Blankslate icon={rssIcon} title="Your feed is empty" class="Box rounded-xl!">
                Follow people and star repositories to see their activity here.
              </Blankslate>
            }
          >
            <Blankslate icon={filterIcon} title="Nothing to show" class="Box rounded-xl!">
              Recent events are all hidden by your filters. Load more, or change them from the Filter menu.
            </Blankslate>
          </Show>
        }
      >
        <For each={groups()}>
          {(g, i) => (
            <>
              <EventCard group={g} extras={data().extras} />
              <Show when={props.page === 1 && i() === Math.min(TRENDING_AFTER, groups().length) - 1}>
                <TrendingCard repos={props.trending} />
              </Show>
            </>
          )}
        </For>
      </Show>
      <Show when={props.isLast}>
        <Show
          when={data().hasNext}
          fallback={
            <Show when={props.page > 1}>
              <p class="text-center text-xs text-fg-muted py-4">That’s all the recent activity GitHub keeps (90 days).</p>
            </Show>
          }
        >
          <button type="button" class="btn btn-block" onClick={() => props.onMore()}>
            More
          </button>
        </Show>
      </Show>
    </>
  );
}

/** The dashboard feed: events received by the viewer as github.com-style cards, paged with "More". */
export default function Feed() {
  const [pages, setPages] = createSignal(1, { name: 'feedPages' });
  // Started here (not in the card) so it loads alongside the first page.
  const trending = createMemo(() => getFeedTrending(), { name: 'feedTrending' });
  const list = () => Array.from({ length: pages() }, (_, i) => i + 1);
  return (
    <div>
      <div class="flex items-center justify-between gap-4 mb-4">
        <h2 class="text-2xl font-semibold">Feed</h2>
        <FeedFilter />
      </div>
      <div class="flex flex-col gap-4">
        <For each={list()}>
          {(n) => (
            <Loading fallback={<FeedSkeleton />}>
              <FeedPageView page={n} isLast={n === pages()} trending={trending()} onMore={() => setPages((p) => p + 1)} />
            </Loading>
          )}
        </For>
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <For each={[1, 2, 3]}>
      {() => (
        <div class="Box rounded-xl! p-5">
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-full Skeleton" />
            <div class="flex-1 flex flex-col gap-2">
              <span class="h-3 w-1/2 rounded Skeleton" />
              <span class="h-3 w-24 rounded Skeleton" />
            </div>
          </div>
          <div class="mt-4 h-5 w-3/4 rounded Skeleton" />
          <div class="mt-3 h-20 rounded-md Skeleton" />
        </div>
      )}
    </For>
  );
}
