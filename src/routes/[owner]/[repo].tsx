import { type RouteDefinition, useLocation, useNavigate, useParams } from '@solidjs/router';
import type { ParentProps } from 'solid-js';
import { createMemo, Errored, For, Loading, Show } from 'solid-js';
import { Dropdown, ErrorView, PageSpinner } from '../../components/ui';
import Octicon from '../../components/Octicon';
import RepoFileFinderHotkey from '../../features/code/components/RepoFileFinderHotkey';
import { feature } from '../../features/refined';
import { getProjectsCount, getRepo, getRepoHeaderInfo, getRepoOverview, getRepoTabExtras, isBugLabel } from '../../features/repo/api';
import { RepoContext, type RepoContextValue } from '../../features/repo/context';
import {
  archiveIcon,
  bugIcon,
  codeIcon,
  commentDiscussionIcon,
  gearIcon,
  gitPullRequestIcon,
  graphIcon,
  issueOpenedIcon,
  kebabHorizontalIcon,
  playIcon,
  shieldIcon,
  tableIcon,
  tagIcon,
} from '../../icons/octicons';
import { compactNumber } from '../../lib/format';
import { useHotkey } from '../../lib/hotkeys';

type Tab = 'code' | 'issues' | 'bugs' | 'pulls' | 'discussions' | 'actions' | 'projects' | 'security' | 'insights' | 'settings' | 'releases';

/** Which repo tab a sub-path belongs to (github.com groups them the same way). */
function tabFor(section: string | undefined): Tab {
  switch (section) {
    case 'issues':
    case 'labels':
    case 'milestones':
    case 'milestone':
      return 'issues';
    case 'pulls':
    case 'pull':
    case 'compare':
      return 'pulls';
    case 'discussions':
      return 'discussions';
    case 'actions':
      return 'actions';
    case 'projects':
      return 'projects';
    case 'security':
      return 'security';
    case 'pulse':
    case 'graphs':
    case 'network':
    case 'forks':
    case 'stargazers':
    case 'watchers':
    case 'activity':
      return 'insights';
    case 'settings':
      return 'settings';
    case 'releases':
    case 'tags':
      return 'releases';
    default:
      return 'code';
  }
}

// Start the repo + tab counters as soon as navigation (or a link hover) begins,
// so pages below don't wait on them before issuing their own requests.
export const route = {
  preload: ({ params }) => {
    void getRepo(params.owner!, params.repo!);
    void getRepoOverview(params.owner!, params.repo!);
    if (feature('bugs-tab') || feature('extend-repo-tabs')) {
      void getRepoTabExtras(params.owner!, params.repo!, feature('bugs-tab'), feature('extend-repo-tabs'));
    }
    if (feature('repo-header-info')) void getRepoHeaderInfo(params.owner!, params.repo!);
  },
} satisfies RouteDefinition;

/** Layout for every /:owner/:repo/* page: provides the repo and draws the tab bar. */
export default function RepoLayout(props: ParentProps) {
  const params = useParams<{ owner: string; repo: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const repo = createMemo(() => getRepo(params.owner, params.repo));
  const ctx: RepoContextValue = {
    owner: () => params.owner,
    name: () => params.repo,
    fullName: () => `${params.owner}/${params.repo}`,
    repo,
    base: () => `/${params.owner}/${params.repo}`,
  };
  const section = createMemo(() => location.pathname.split('/')[3]);

  // releases-tab
  useHotkey({
    keys: 'g r',
    description: 'Go to Releases',
    group: 'Repository',
    feature: 'releases-tab',
    handler: () => navigate(`${ctx.base()}/releases`),
  });

  return (
    <RepoContext value={ctx}>
      <RepoFileFinderHotkey />
      <nav class={['AppHeader AppHeader--bordered px-4 flex items-center', { 'rgh-mobile-tabs': feature('mobile-tabs') }]} aria-label="Repository">
        <div class="UnderlineNav flex-1 min-w-0" style={{ 'box-shadow': 'none' }}>
          <ul class="UnderlineNav-body">
            <RepoTabs section={section()} query={String(location.query.q ?? '')} />
          </ul>
        </div>
        <Show when={feature('extend-repo-tabs')}>
          <MoreTabs section={section()} />
        </Show>
      </nav>
      <Loading>
        <Show when={repo().archived}>
          <div class="container-xl px-4 md:px-6 lg:px-8 pt-4">
            <div class="flash flash-warn flex items-center gap-2 text-sm">
              <Octicon icon={archiveIcon} />
              <span>
                This repository has been archived by the owner. It is now read-only.
                <Show when={feature('archive-forks-link')}>
                  {' '}
                  You can check out <a href={`${ctx.base()}/forks`}>its forks</a>.
                </Show>
              </span>
            </div>
          </div>
        </Show>
      </Loading>
      <Errored fallback={(err, reset) => <ErrorView error={err()} reset={reset} />}>
        <Loading fallback={<PageSpinner />}>
          <div class={['contents', { 'rgh-clean-filelist': feature('clean-repo-filelist-actions') }]}>{props.children}</div>
        </Loading>
      </Errored>
    </RepoContext>
  );
}

function TabItem(p: {
  selected: boolean;
  href: string;
  icon: typeof codeIcon;
  label: string;
  title?: string;
  count?: () => number | null | undefined;
}) {
  return (
    <li>
      <a class={['UnderlineNav-item', { selected: p.selected }]} href={p.href} title={p.title}>
        <Octicon icon={p.icon} />
        <span data-content={p.label}>{p.label}</span>
        <Show when={p.count}>
          {(count) => (
            <Loading>
              <Show when={count()()}>{(n) => <span class="Counter">{compactNumber(n())}</span>}</Show>
            </Loading>
          )}
        </Show>
      </a>
    </li>
  );
}

/** Tab counters / demotions that need extra data (bugs-tab, extend-repo-tabs). */
function useTabExtras() {
  const params = useParams<{ owner: string; repo: string }>();
  const overview = createMemo(() => getRepoOverview(params.owner, params.repo));
  const extras = createMemo(() =>
    feature('bugs-tab') || feature('extend-repo-tabs')
      ? getRepoTabExtras(params.owner, params.repo, feature('bugs-tab'), feature('extend-repo-tabs'))
      : null,
  );
  const projects = createMemo(() =>
    feature('extend-repo-tabs') && overview().hasProjects ? getProjectsCount(params.owner, params.repo) : null,
  );
  /** Actions never ran on the default branch head. */
  const actionsUnused = () => feature('extend-repo-tabs') && extras()?.checkSuites === 0;
  /** Projects are enabled but none is linked (unknown without the read:project scope). */
  const projectsEmpty = () => feature('extend-repo-tabs') && projects() === 0;
  return { overview, extras, projects, actionsUnused, projectsEmpty };
}

function RepoTabs(props: { section: string | undefined; query: string }) {
  const params = useParams<{ owner: string; repo: string }>();
  const base = () => `/${params.owner}/${params.repo}`;
  const repo = createMemo(() => getRepo(params.owner, params.repo));
  const { overview, extras, projects, actionsUnused, projectsEmpty } = useTabExtras();
  const extend = () => feature('extend-repo-tabs');

  // A bugs listing: the issue query filters on a bug label or the Bug issue type.
  const bugsSelected = () =>
    feature('bugs-tab') &&
    props.section === 'issues' &&
    [...props.query.matchAll(/\b(label|type):(?:"([^"]*)"|([^\s)]+))/gi)].some((m) => isBugLabel(m[2] ?? m[3] ?? ''));
  const active = createMemo<Tab>(() => {
    const tab = tabFor(props.section);
    if (tab === 'releases') return feature('releases-tab') ? 'releases' : 'code';
    if (tab === 'issues' && bugsSelected()) return 'bugs';
    return tab;
  });

  return (
    <>
      <TabItem selected={active() === 'code'} href={base()} icon={codeIcon} label="Code" />
      <TabItem selected={active() === 'issues'} href={`${base()}/issues`} icon={issueOpenedIcon} label="Issues" count={() => overview().openIssues} />
      <Show when={feature('bugs-tab')}>
        <Loading>
          <Show when={extras()?.bugs?.count || bugsSelected() ? extras()?.bugs : null}>
            {(bugs) => (
              <TabItem
                selected={active() === 'bugs'}
                href={`${base()}/issues?q=${encodeURIComponent(bugs().query)}`}
                icon={bugIcon}
                label="Bugs"
                count={() => bugs().count}
              />
            )}
          </Show>
        </Loading>
      </Show>
      <TabItem
        selected={active() === 'pulls'}
        href={`${base()}/pulls`}
        icon={gitPullRequestIcon}
        label={extend() ? 'PRs' : 'Pull requests'}
        title={extend() ? 'Pull requests' : undefined}
        count={() => overview().openPulls}
      />
      <Loading>
        <Show when={overview().hasDiscussions}>
          <TabItem selected={active() === 'discussions'} href={`${base()}/discussions`} icon={commentDiscussionIcon} label="Discussions" />
        </Show>
      </Loading>
      <Loading fallback={<TabItem selected={active() === 'actions'} href={`${base()}/actions`} icon={playIcon} label="Actions" />}>
        <Show when={!actionsUnused() || active() === 'actions'}>
          <TabItem selected={active() === 'actions'} href={`${base()}/actions`} icon={playIcon} label="Actions" />
        </Show>
      </Loading>
      <Loading>
        <Show when={overview().hasProjects && (!projectsEmpty() || active() === 'projects')}>
          <TabItem
            selected={active() === 'projects'}
            href={`${base()}/projects`}
            icon={tableIcon}
            label="Projects"
            count={extend() ? () => projects() : undefined}
          />
        </Show>
      </Loading>
      <Show when={!extend() || active() === 'security'}>
        <TabItem selected={active() === 'security'} href={`${base()}/security`} icon={shieldIcon} label="Security" />
      </Show>
      <Show when={!extend() || active() === 'insights'}>
        <TabItem selected={active() === 'insights'} href={`${base()}/graphs/contributors`} icon={graphIcon} label="Insights" />
      </Show>
      <Loading>
        <Show when={repo().permissions?.admin}>
          <TabItem selected={active() === 'settings'} href={`${base()}/settings`} icon={gearIcon} label="Settings" />
        </Show>
      </Loading>
      <Show when={feature('releases-tab')}>
        <Loading>
          <Show when={overview().releases.totalCount || overview().tags}>
            <TabItem
              selected={active() === 'releases'}
              href={`${base()}/${overview().releases.totalCount ? 'releases' : 'tags'}`}
              icon={tagIcon}
              label={overview().releases.totalCount ? 'Releases' : 'Tags'}
              count={() => overview().releases.totalCount || overview().tags}
            />
          </Show>
        </Loading>
      </Show>
    </>
  );
}

/** extend-repo-tabs: rarely used / empty tabs, collapsed into a "…" menu at the end of the bar. */
function MoreTabs(props: { section: string | undefined }) {
  const params = useParams<{ owner: string; repo: string }>();
  const base = () => `/${params.owner}/${params.repo}`;
  const { overview, actionsUnused, projectsEmpty } = useTabExtras();
  const tab = () => tabFor(props.section);
  const items = () =>
    [
      { tab: 'actions', show: () => actionsUnused(), href: `${base()}/actions`, icon: playIcon, label: 'Actions', reason: 'unused' },
      { tab: 'projects', show: () => overview().hasProjects && projectsEmpty(), href: `${base()}/projects`, icon: tableIcon, label: 'Projects', reason: 'none' },
      { tab: 'security', show: () => true, href: `${base()}/security`, icon: shieldIcon, label: 'Security', reason: '' },
      { tab: 'insights', show: () => true, href: `${base()}/graphs/contributors`, icon: graphIcon, label: 'Insights', reason: '' },
    ] as const;
  return (
    <Dropdown class="btn-octicon ml-1" align="right" menuClass="w-56" title="More repository tabs" button={<Octicon icon={kebabHorizontalIcon} />}>
      {(close) => (
        <For each={items()}>
          {(item) => (
            <Loading>
              <Show when={item.show() && tab() !== item.tab}>
                <a class="SelectMenu-item" href={item.href} onClick={close}>
                  <Octicon icon={item.icon} class="text-fg-muted" />
                  <span class="flex-1">{item.label}</span>
                  <Show when={item.reason}>
                    <span class="text-xs text-fg-muted">{item.reason}</span>
                  </Show>
                </a>
              </Show>
            </Loading>
          )}
        </For>
      )}
    </Dropdown>
  );
}
