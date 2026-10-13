import { type RouteDefinition, useLocation, useParams } from '@solidjs/router';
import type { ParentProps } from 'solid-js';
import { createMemo, Errored, Loading, Show } from 'solid-js';
import { ErrorView, PageSpinner } from '../../components/ui';
import Octicon from '../../components/Octicon';
import { getRepo, getRepoOverview } from '../../features/repo/api';
import { RepoContext, type RepoContextValue } from '../../features/repo/context';
import {
  codeIcon,
  commentDiscussionIcon,
  gearIcon,
  gitPullRequestIcon,
  graphIcon,
  issueOpenedIcon,
  playIcon,
  shieldIcon,
  tableIcon,
} from '../../icons/octicons';
import { compactNumber } from '../../lib/format';

type Tab = 'code' | 'issues' | 'pulls' | 'discussions' | 'actions' | 'projects' | 'security' | 'insights' | 'settings';

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
  },
} satisfies RouteDefinition;

/** Layout for every /:owner/:repo/* page: provides the repo and draws the tab bar. */
export default function RepoLayout(props: ParentProps) {
  const params = useParams<{ owner: string; repo: string }>();
  const location = useLocation();
  const repo = createMemo(() => getRepo(params.owner, params.repo));
  const ctx: RepoContextValue = {
    owner: () => params.owner,
    name: () => params.repo,
    fullName: () => `${params.owner}/${params.repo}`,
    repo,
    base: () => `/${params.owner}/${params.repo}`,
  };
  const active = createMemo(() => tabFor(location.pathname.split('/')[3]));

  return (
    <RepoContext value={ctx}>
      <nav class="AppHeader AppHeader--bordered px-4" aria-label="Repository">
        <div class="UnderlineNav" style={{ 'box-shadow': 'none' }}>
          <ul class="UnderlineNav-body">
            <RepoTabs active={active()} />
          </ul>
        </div>
      </nav>
      <Errored fallback={(err, reset) => <ErrorView error={err()} reset={reset} />}>
        <Loading fallback={<PageSpinner />}>{props.children}</Loading>
      </Errored>
    </RepoContext>
  );
}

function RepoTabs(props: { active: Tab }) {
  const params = useParams<{ owner: string; repo: string }>();
  const base = () => `/${params.owner}/${params.repo}`;
  const repo = createMemo(() => getRepo(params.owner, params.repo));
  const overview = createMemo(() => getRepoOverview(params.owner, params.repo));

  const Item = (p: { tab: Tab; href: string; icon: typeof codeIcon; label: string; count?: () => number | undefined }) => (
    <li>
      <a class={['UnderlineNav-item', { selected: props.active === p.tab }]} href={p.href}>
        <Octicon icon={p.icon} />
        <span>{p.label}</span>
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

  return (
    <>
      <Item tab="code" href={base()} icon={codeIcon} label="Code" />
      <Item tab="issues" href={`${base()}/issues`} icon={issueOpenedIcon} label="Issues" count={() => overview().openIssues} />
      <Item tab="pulls" href={`${base()}/pulls`} icon={gitPullRequestIcon} label="Pull requests" count={() => overview().openPulls} />
      <Loading>
        <Show when={overview().hasDiscussions}>
          <Item tab="discussions" href={`${base()}/discussions`} icon={commentDiscussionIcon} label="Discussions" />
        </Show>
      </Loading>
      <Item tab="actions" href={`${base()}/actions`} icon={playIcon} label="Actions" />
      <Loading>
        <Show when={overview().hasProjects}>
          <Item tab="projects" href={`${base()}/projects`} icon={tableIcon} label="Projects" />
        </Show>
      </Loading>
      <Item tab="security" href={`${base()}/security`} icon={shieldIcon} label="Security" />
      <Item tab="insights" href={`${base()}/graphs/contributors`} icon={graphIcon} label="Insights" />
      <Loading>
        <Show when={repo().permissions?.admin}>
          <Item tab="settings" href={`${base()}/settings`} icon={gearIcon} label="Settings" />
        </Show>
      </Loading>
    </>
  );
}

