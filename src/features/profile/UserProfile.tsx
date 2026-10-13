import { Title } from '@solidjs/meta';
import { useLocation, useNavigate, useSearchParams } from '@solidjs/router';
import { createMemo, For, Loading, Match, Show, Switch } from 'solid-js';
import Octicon from '../../components/Octicon';
import { Blankslate, Markdown, PageSpinner, Pagination, pageHref } from '../../components/ui';
import { bookIcon, packageIcon, pencilIcon, repoIcon, starIcon, tableIcon } from '../../icons/octicons';
import {
  contributionRange,
  getContributions,
  getDayContributions,
  getFollows,
  getOwnerRepos,
  getProfileReadme,
  getStarred,
  getStarredLanguages,
  type UserProfile as UserProfileData,
} from './api';
import ContributionCalendar, { ContributionActivity, DayActivity } from './components/ContributionCalendar';
import { PackagesList, ProjectsList } from './components/LinkOutLists';
import PinnedCard from './components/PinnedCard';
import { ProfileTabs } from './components/ProfileTabs';
import RepoFiltersBar, { FilterSummary, type FilterOption } from './components/RepoFiltersBar';
import { listPageInfo, page, REPO_SORTS, RepoList } from './components/RepoList';
import UserListItem from './components/UserListItem';
import UserSidebar from './components/UserSidebar';
import { userReposHref } from './links';

type Tab = 'overview' | 'repositories' | 'projects' | 'packages' | 'stars' | 'followers' | 'following';
const TABS: Tab[] = ['overview', 'repositories', 'projects', 'packages', 'stars', 'followers', 'following'];

/** /:user — profile with tabs (`?tab=repositories|projects|packages|stars|followers|following`). */
export default function UserProfile(props: { user: UserProfileData }) {
  const [sp] = useSearchParams<{ tab?: string }>();
  const tab = (): Tab => (TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : 'overview');
  const login = () => props.user.login;
  const title = () => {
    const base = props.user.name ? `${login()} (${props.user.name})` : login();
    const t = tab();
    if (t === 'overview') return `${base} · GitHub`;
    if (t === 'followers' || t === 'following') return `${base} / ${t[0]!.toUpperCase()}${t.slice(1)} · GitHub`;
    return `${login()} (${props.user.name ?? login()}) / ${t[0]!.toUpperCase()}${t.slice(1)} · GitHub`;
  };

  return (
    <>
      <Title>{title()}</Title>
      <ProfileTabs
        label="User profile"
        active={tab()}
        offset
        items={[
          { tab: 'overview', label: 'Overview', icon: bookIcon, href: `/${login()}` },
          { tab: 'repositories', label: 'Repositories', icon: repoIcon, href: userReposHref(login()), count: props.user.repositories },
          { tab: 'projects', label: 'Projects', icon: tableIcon, href: `/${login()}?tab=projects`, count: props.user.projects },
          { tab: 'packages', label: 'Packages', icon: packageIcon, href: `/${login()}?tab=packages`, count: props.user.packages },
          { tab: 'stars', label: 'Stars', icon: starIcon, href: `/${login()}?tab=stars`, count: props.user.stars },
        ]}
      />
      <div class="container-xl px-4 md:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
        <aside class="w-full md:w-1/4 lg:w-[296px] shrink-0 md:-mt-[56px] relative z-1">
          <UserSidebar user={props.user} />
        </aside>
        <div class="flex-1 min-w-0">
          <Loading fallback={<PageSpinner />}>
            <Switch>
              <Match when={tab() === 'overview'}>
                <Overview user={props.user} />
              </Match>
              <Match when={tab() === 'repositories'}>
                <Repositories user={props.user} />
              </Match>
              <Match when={tab() === 'projects'}>
                <ProjectsList login={login()} isOrg={false} />
              </Match>
              <Match when={tab() === 'packages'}>
                <PackagesList login={login()} isOrg={false} />
              </Match>
              <Match when={tab() === 'stars'}>
                <Stars user={props.user} />
              </Match>
              <Match when={tab() === 'followers' || tab() === 'following'}>
                <Follows user={props.user} which={tab() as 'followers' | 'following'} />
              </Match>
            </Switch>
          </Loading>
        </div>
      </div>
    </>
  );
}

/* ------------------------------ Overview ------------------------------ */

function Overview(props: { user: UserProfileData }) {
  const [sp] = useSearchParams<{ from?: string; to?: string }>();
  const navigate = useNavigate();
  const range = () => contributionRange(sp.from, sp.to);
  /** A single selected day: `?from=D&to=D` (github.com's URL for a clicked square). */
  const day = () => range().day;
  const year = () => range().year;
  const yearHref = (y?: number) => (y ? `/${props.user.login}?tab=overview&from=${y}-01-01&to=${y}-12-31` : `/${props.user.login}`);
  const readme = createMemo(() => getProfileReadme(props.user.login, false));
  const contributions = createMemo(() => getContributions(props.user.login, year()));
  const dayData = createMemo(() => (day() ? getDayContributions(props.user.login, day()!) : null));
  const pinned = () => (props.user.pinned.length ? props.user.pinned : props.user.popular.map((r) => ({ kind: 'repo' as const, ...r })));

  return (
    <div class="flex flex-col gap-6">
      <Loading fallback={<div class="Box h-40 Skeleton" />}>
        <Show when={readme()}>
          {(r) => (
            <div class="Box p-6">
              <div class="flex items-center justify-between text-xs font-mono mb-4">
                <a class="link-plain" href={`/${r().repo}`}>
                  {r().repo}/<span class="font-semibold">README</span>.md
                </a>
                <Show when={props.user.isViewer}>
                  <a class="btn-octicon" href={`/${r().repo}/edit/HEAD/README.md`} aria-label="Edit README">
                    <Octicon icon={pencilIcon} />
                  </a>
                </Show>
              </div>
              <Markdown html={r().html} file={{ owner: r().repo.split('/')[0]!, repo: r().repo.split('/')[1]!, gitRef: 'HEAD', path: r().path }} />
            </div>
          )}
        </Show>
      </Loading>

      <Show when={pinned().length}>
        <section>
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-base font-normal">
              {props.user.pinned.length ? 'Pinned' : 'Popular repositories'}
              {' / '}
              {/* No type=source on purpose: forks can be popular too. */}
              <a href={`/${props.user.login}?tab=repositories&sort=stargazers`}>Top repositories</a>
            </h2>
            <Show when={props.user.isViewer}>
              <a class="text-xs link-muted" href={`https://github.com/${props.user.login}`} target="_blank" rel="noreferrer">
                Customize your pins
              </a>
            </Show>
          </div>
          <ol class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <For each={pinned()}>{(item) => <PinnedCard item={item} owner={props.user.login} />}</For>
          </ol>
        </section>
      </Show>

      <Loading fallback={<div class="Box h-[180px] Skeleton" />}>
        <Show when={contributions()}>
          {(c) => (
            <>
              <ContributionCalendar
                data={c()}
                year={year()}
                yearHref={yearHref}
                selected={day()}
                onDay={(d) => navigate(d ? `/${props.user.login}?tab=overview&from=${d}&to=${d}` : yearHref(year()), { scroll: false })}
              >
                <Show when={day()} fallback={<ContributionActivity data={c()} />}>
                  {(d) => (
                    <Loading fallback={<div class="mt-6 Box h-24 Skeleton" />}>
                      <DayActivity login={props.user.login} date={d()} data={dayData()} clearHref={yearHref(year())} />
                    </Loading>
                  )}
                </Show>
              </ContributionCalendar>
            </>
          )}
        </Show>
      </Loading>
    </div>
  );
}

/* ---------------------------- Repositories ---------------------------- */

const userTypes = (isViewer: boolean): FilterOption[] => [
  { value: '', label: 'All' },
  { value: 'public', label: 'Public' },
  ...(isViewer ? [{ value: 'private', label: 'Private' }] : []),
  { value: 'source', label: 'Sources' },
  { value: 'forks', label: 'Forks' },
  { value: 'archived', label: 'Archived' },
  { value: 'mirror', label: 'Mirrors' },
  { value: 'template', label: 'Templates' },
];

function Repositories(props: { user: UserProfileData }) {
  const [sp] = useSearchParams<{ q?: string; type?: string; language?: string; sort?: string; page?: string }>();
  const filters = () => ({ q: sp.q, type: sp.type, language: sp.language, sort: sp.sort });
  const result = createMemo(() => getOwnerRepos(props.user.login, false, props.user.isViewer, filters(), page(sp.page)));
  const languages = () => props.user.languages.map((l) => l.name);
  return (
    <div>
      <RepoFiltersBar placeholder="Find a repository…" types={userTypes(props.user.isViewer)} languages={languages()} sorts={REPO_SORTS}>
        <Show when={props.user.isViewer}>
          <a class="btn btn-primary" href="/new">
            <Octicon icon={repoIcon} class="text-fg-on-emphasis!" />
            New
          </a>
        </Show>
      </RepoFiltersBar>
      <Loading fallback={<PageSpinner />}>
        <FilterSummary
          total={result().total}
          noun="repositories"
          types={userTypes(props.user.isViewer)}
          languages={languages()}
          sorts={REPO_SORTS}
          clearHref={`/${props.user.login}?tab=repositories`}
        />
        <RepoList
          result={result()}
          conversationLinks
          empty={`${props.user.login} doesn’t have any repositories that match.`}
        />
      </Loading>
    </div>
  );
}

/* -------------------------------- Stars ------------------------------- */

const STAR_TYPES: FilterOption[] = [
  { value: '', label: 'All' },
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'source', label: 'Sources' },
  { value: 'forks', label: 'Forks' },
  { value: 'template', label: 'Templates' },
];
const STAR_SORTS: FilterOption[] = [
  { value: '', label: 'Recently starred' },
  { value: 'updated', label: 'Recently active' },
  { value: 'stars', label: 'Most stars' },
];

function Stars(props: { user: UserProfileData }) {
  const [sp] = useSearchParams<{ q?: string; type?: string; language?: string; sort?: string; page?: string }>();
  const filters = () => ({ q: sp.q, type: sp.type, language: sp.language, sort: sp.sort });
  const result = createMemo(() => getStarred(props.user.login, filters(), page(sp.page)));
  const languages = createMemo(() => getStarredLanguages(props.user.login));
  return (
    <div>
      <h2 class="text-xl font-normal mb-4">Starred repositories</h2>
      <Loading fallback={<PageSpinner />}>
        <RepoFiltersBar placeholder="Search stars" types={STAR_TYPES} languages={languages()} sorts={STAR_SORTS} />
        <FilterSummary
          total={result().total}
          noun="starred repositories"
          types={STAR_TYPES}
          languages={languages()}
          sorts={STAR_SORTS}
          clearHref={`/${props.user.login}?tab=stars`}
        />
        <RepoList
          result={result()}
          showOwner
          empty={props.user.isViewer ? 'You don’t have any starred repositories yet.' : `${props.user.login} doesn’t have any starred repositories yet.`}
        />
      </Loading>
    </div>
  );
}

/* ----------------------------- Followers ------------------------------ */

function Follows(props: { user: UserProfileData; which: 'followers' | 'following' }) {
  const [sp] = useSearchParams<{ page?: string }>();
  const location = useLocation();
  const result = createMemo(() => getFollows(props.user.login, props.which, page(sp.page)));
  return (
    <div>
      <Show
        when={result().items.length}
        fallback={
          <Blankslate
            title={
              props.which === 'followers'
                ? `${props.user.login} doesn’t have any followers yet.`
                : `${props.user.login} isn’t following anybody.`
            }
          />
        }
      >
        <ul class="border-t border-line-muted">
          <For each={result().items}>{(u) => <UserListItem user={u} />}</For>
        </ul>
      </Show>
      <div class="mt-4">
        <Pagination pageInfo={listPageInfo(result())} href={(n) => pageHref(location, n)} />
      </div>
    </div>
  );
}
