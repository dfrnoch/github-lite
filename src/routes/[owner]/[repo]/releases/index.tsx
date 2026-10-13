import { Title } from '@solidjs/meta';
import { type RouteDefinition, useLocation, useSearchParams } from '@solidjs/router';
import { createEffect, createMemo, createSignal, For, Loading, onSettled, Show } from 'solid-js';
import { Blankslate, PageSpinner, Pagination, pageHref } from '../../../../components/ui';
import { feature } from '../../../../features/refined';
import { getLatestReleaseId, getReleases, getTagCommits, searchReleases } from '../../../../features/releases/api';
import ReleaseCard from '../../../../features/releases/components/ReleaseCard';
import ReleaseListNav from '../../../../features/releases/components/ReleaseListNav';
import ReleasesSubnav, { ReleasesActions } from '../../../../features/releases/components/ReleasesSubnav';
import { useCreateReleaseHotkey } from '../../../../features/releases/components/RefinedReleases';
import { previousTag } from '../../../../features/releases/versions';
import { useRepo } from '../../../../features/repo/context';
import { tagIcon } from '../../../../icons/octicons';
import { pluralize } from '../../../../lib/format';

const HIDE_PRERELEASES = 'prerelease:false';

/** Anchor id of a release on the list page (github.com's `#release-<tag>`). */
const anchorId = (tag: string) => `release-${tag}`;

// Start the page's requests with the navigation (tag-changes-link's tag list
// doesn't depend on the releases, so it shouldn't wait for them).
export const route = {
  preload: ({ params, location }) => {
    const search = new URLSearchParams(location.search);
    const q = search.get('q');
    const page = Math.max(1, Number(search.get('page')) || 1);
    if (!q) void getReleases(params.owner!, params.repo!, page);
    void getLatestReleaseId(params.owner!, params.repo!);
    if (feature('tag-changes-link')) void getTagCommits(params.owner!, params.repo!, tagDepth(page, !!q));
  },
} satisfies RouteDefinition;

/** tag-changes-link: how many tags to look through (older pages and searches reach further back). */
const tagDepth = (page: number, searching: boolean) => (page > 1 || searching ? 1000 : 100);

/** /:owner/:repo/releases — the release list column + the page's releases stacked. */
export default function ReleasesPage() {
  const ctx = useRepo();
  const location = useLocation();
  const [search, setSearch] = useSearchParams<{ page?: string; q?: string }>();
  const page = () => Math.max(1, Number(search.page) || 1);
  // releases-dropdown: `prerelease:false` hides pre-releases (on the current page).
  const hidePrereleases = () => feature('releases-dropdown') && !!search.q?.includes(HIDE_PRERELEASES);
  const text = () => (feature('releases-dropdown') ? (search.q ?? '').replace(HIDE_PRERELEASES, '') : (search.q ?? '')).trim();
  const releases = createMemo(() => (text() ? searchReleases(ctx.owner(), ctx.name(), text()) : getReleases(ctx.owner(), ctx.name(), page())));
  const latestId = createMemo(() => getLatestReleaseId(ctx.owner(), ctx.name()));
  const canEdit = () => !!ctx.repo().permissions?.push;
  const items = createMemo(() => (hidePrereleases() ? releases().items.filter((r) => !r.prerelease) : releases().items));
  // tag-changes-link: one tag list for every card, started alongside the releases.
  const tags = createMemo(() =>
    feature('tag-changes-link') ? getTagCommits(ctx.owner(), ctx.name(), tagDepth(page(), !!text())) : null,
  );
  /** The tag before `tag` (undefined: not in the list we have — the link looks further itself). */
  const previousFor = (tag: string) => {
    const list = tags();
    if (!list) return null;
    return previousTag(tag, list) ?? (list.length >= 100 && list.length < 1000 ? undefined : null);
  };
  useCreateReleaseHotkey();

  // Scroll spy: the release list marks the card at the top of the viewport.
  const [active, setActive] = createSignal<string | null>(null, { name: 'releases.active' });
  let pinnedUntil = 0;
  onSettled(() => {
    const onScroll = () => {
      if (Date.now() < pinnedUntil) return;
      const sections = [...document.querySelectorAll<HTMLElement>('[data-release-anchor]')];
      let current = sections[0]?.dataset.releaseAnchor ?? null;
      for (const s of sections) if (s.getBoundingClientRect().top <= 120) current = s.dataset.releaseAnchor!;
      setActive(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  });
  // Deep links (#release-<tag>) land before the cards exist; scroll once they render.
  createEffect(
    () => [items().length, decodeURIComponent(location.hash.slice(1))] as const,
    ([count, hash]) => {
      if (count && hash.startsWith('release-')) document.getElementById(hash)?.scrollIntoView();
    },
  );
  const current = () => {
    const a = active();
    return a && items().some((r) => r.tag_name === a) ? a : (items()[0]?.tag_name ?? null);
  };

  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`Releases · ${ctx.fullName()}`}</Title>
      <div class="lg:w-11/12 mx-auto">
        <ReleasesSubnav base={ctx.base()} active="releases">
          <ReleasesActions
            query={search.q}
            unreleased={page() === 1 && !search.q}
            onSearch={(q) => setSearch({ q, page: undefined })}
          />
        </ReleasesSubnav>
        <Loading fallback={<PageSpinner />}>
          <Show when={text()}>
            <p class="text-sm text-fg-muted mb-2">
              {releases().items.length ? `${pluralize(releases().items.length, 'release')} matching ` : 'No releases match '}
              <strong class="text-fg">“{text()}”</strong>
              {' · '}
              <a href={`${ctx.base()}/releases`}>Clear search</a>
            </p>
          </Show>
          <Show
            when={items().length}
            fallback={
              <Show when={!text()}>
                <Blankslate
                  icon={tagIcon}
                  title="There aren’t any releases here"
                  action={
                    <Show when={canEdit()}>
                      <a class="btn btn-primary" href={`${ctx.base()}/releases/new`}>
                        Create a new release
                      </a>
                    </Show>
                  }
                >
                  You can create a release to package software, along with release notes and links to binary files, for
                  other people to use.
                </Blankslate>
              </Show>
            }
          >
            <div class="flex">
              <ReleaseListNav
                items={items().map((r) => ({ key: r.tag_name, label: r.name || r.tag_name, href: `#${anchorId(r.tag_name)}` }))}
                current={current()}
                onItemClick={(item, e) => {
                  e.preventDefault();
                  pinnedUntil = Date.now() + 400;
                  setActive(item.key);
                  document.getElementById(anchorId(item.key))?.scrollIntoView();
                  history.replaceState(history.state, '', `#${anchorId(item.key)}`);
                }}
                prev={releases().pageInfo.hasPrev ? { href: pageHref(location, page() - 1) } : null}
                next={releases().pageInfo.hasNext ? { href: pageHref(location, page() + 1) } : null}
              />
              <div class="flex-1 min-w-0">
                <For each={items()}>
                  {(release) => (
                    <section
                      id={anchorId(release.tag_name)}
                      data-release-anchor={release.tag_name}
                      aria-label={release.name || release.tag_name}
                      class="my-8 scroll-mt-6"
                    >
                      <ReleaseCard
                        release={release}
                        base={ctx.base()}
                        owner={ctx.owner()}
                        repo={ctx.name()}
                        latest={release.id === latestId()}
                        canEdit={canEdit()}
                        clampNotes
                        commit={releases().commits[release.tag_name] ?? null}
                        previousTag={previousFor(release.tag_name)}
                      />
                    </section>
                  )}
                </For>
              </div>
            </div>
          </Show>
          <Pagination pageInfo={releases().pageInfo} href={(p) => pageHref(location, p)} />
        </Loading>
      </div>
    </div>
  );
}
