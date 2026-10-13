import { useLocation, useNavigate } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, Match, onSettled, Show, Switch } from 'solid-js';
import { getTopRepos, getUnreadNotifications, getViewer } from '../../features/user/api';
import {
  bookIcon,
  codeIcon,
  gearIcon,
  gitPullRequestIcon,
  homeIcon,
  inboxIcon,
  issueOpenedIcon,
  markGithubIcon,
  moonIcon,
  organizationIcon,
  personIcon,
  plusIcon,
  repoIcon,
  searchIcon,
  signOutIcon,
  starIcon,
  sunIcon,
  telescopeIcon,
  threeBarsIcon,
  triangleDownIcon,
} from '../../icons/octicons';
import { signOut } from '../../lib/auth';
import { colorMode, setColorMode } from '../../lib/theme';
import Octicon from '../Octicon';
import { Avatar, Dropdown } from '../ui';
import Drawer from './Drawer';
import { headerContext } from './headerContext';

export default function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const ctx = createMemo(() => headerContext(location.pathname));
  const viewer = createMemo(() => getViewer());
  const hasUnread = createMemo(() => getUnreadNotifications());
  const [navOpen, setNavOpen] = createSignal(false);
  const [userOpen, setUserOpen] = createSignal(false);
  // Repo and org pages continue the header's background into their tab bar.
  const bordered = () => ctx().kind !== 'repo' && ctx().kind !== 'org';

  return (
    <header class={['AppHeader', { 'AppHeader--bordered': bordered() }]}>
      <div class="flex items-center gap-2 px-4 h-16">
        <button type="button" class="AppHeader-button" aria-label="Open global navigation menu" onClick={() => setNavOpen(true)}>
          <Octicon icon={threeBarsIcon} />
        </button>
        <a href="/" class="ml-2 text-fg hover:text-fg" aria-label="Homepage">
          <Octicon icon={markGithubIcon} size={32} />
        </a>
        <nav class="flex items-center min-w-0 ml-1" aria-label="Page context">
          <Switch>
            <Match when={ctx().kind === 'dashboard'}>
              <a class="AppHeader-context-item font-semibold" href="/">
                Dashboard
              </a>
            </Match>
            <Match when={ctx().kind === 'page' && (ctx() as { title: string; href: string })}>
              {(page) => (
                <a class="AppHeader-context-item font-semibold" href={page().href}>
                  {page().title}
                </a>
              )}
            </Match>
            <Match when={ctx().kind === 'owner' && (ctx() as { owner: string })}>
              {(c) => (
                <a class="AppHeader-context-item font-semibold" href={`/${c().owner}`}>
                  {c().owner}
                </a>
              )}
            </Match>
            <Match when={ctx().kind === 'org' && (ctx() as { org: string })}>
              {(c) => (
                <a class="AppHeader-context-item font-semibold" href={`/${c().org}`}>
                  {c().org}
                </a>
              )}
            </Match>
            <Match when={ctx().kind === 'repo' && (ctx() as { owner: string; repo: string })}>
              {(c) => (
                <>
                  <a class="AppHeader-context-item truncate" href={`/${c().owner}`}>
                    {c().owner}
                  </a>
                  <span class="text-fg-muted px-0.5">/</span>
                  <a class="AppHeader-context-item font-semibold truncate" href={`/${c().owner}/${c().repo}`}>
                    {c().repo}
                  </a>
                </>
              )}
            </Match>
          </Switch>
        </nav>
        <div class="flex-1" />
        <SearchBox repo={ctx().kind === 'repo' ? `${(ctx() as any).owner}/${(ctx() as any).repo}` : undefined} />
        <div class="hidden md:block w-px h-5 bg-line mx-1" />
        <Dropdown
          class="AppHeader-button AppHeader-button--wide"
          title="Create new…"
          align="right"
          button={
            <>
              <Octicon icon={plusIcon} />
              <Octicon icon={triangleDownIcon} />
            </>
          }
        >
          {(close) => (
            <>
              <a class="SelectMenu-item" href="/new" onClick={close}>
                <Octicon icon={repoIcon} /> New repository
              </a>
              <Show when={ctx().kind === 'repo' && (ctx() as { owner: string; repo: string })}>
                {(c) => (
                  <a class="SelectMenu-item" href={`/${c().owner}/${c().repo}/issues/new`} onClick={close}>
                    <Octicon icon={issueOpenedIcon} /> New issue
                  </a>
                )}
              </Show>
              <a class="SelectMenu-item" href="https://github.com/account/organizations/new" target="_blank" rel="noreferrer" onClick={close}>
                <Octicon icon={organizationIcon} /> New organization
              </a>
            </>
          )}
        </Dropdown>
        <a class="AppHeader-button hidden md:inline-flex" href="/issues" title="Your issues" aria-label="Your issues">
          <Octicon icon={issueOpenedIcon} />
        </a>
        <a class="AppHeader-button hidden md:inline-flex" href="/pulls" title="Your pull requests" aria-label="Your pull requests">
          <Octicon icon={gitPullRequestIcon} />
        </a>
        <a class="AppHeader-button" href="/notifications" title="Notifications" aria-label="Notifications">
          <Octicon icon={inboxIcon} />
          <Loading>
            <Show when={hasUnread()}>
              <span class="unread-dot" />
            </Show>
          </Loading>
        </a>
        <button type="button" class="ml-1 rounded-full" aria-label="Open user navigation menu" onClick={() => setUserOpen(true)}>
          <Loading fallback={<span class="inline-block w-8 h-8 rounded-full bg-canvas-muted" />}>
            <Avatar src={viewer().avatar_url} login={viewer().login} size={32} />
          </Loading>
        </button>
      </div>

      <Drawer
        side="left"
        open={navOpen()}
        onClose={() => setNavOpen(false)}
        header={<Octicon icon={markGithubIcon} size={32} />}
      >
        <ul class="NavList">
          <li>
            <a class="NavList-item" href="/">
              <Octicon icon={homeIcon} /> Home
            </a>
          </li>
          <li>
            <a class="NavList-item" href="/issues">
              <Octicon icon={issueOpenedIcon} /> Issues
            </a>
          </li>
          <li>
            <a class="NavList-item" href="/pulls">
              <Octicon icon={gitPullRequestIcon} /> Pull requests
            </a>
          </li>
          <li>
            <a class="NavList-item" href="/explore">
              <Octicon icon={telescopeIcon} /> Explore
            </a>
          </li>
        </ul>
        <hr class="NavList-divider" />
        <div class="NavList-heading">Repositories</div>
        <Loading fallback={<div class="px-2 text-fg-muted text-sm">Loading…</div>}>
          <TopRepos />
        </Loading>
      </Drawer>

      <Drawer
        side="right"
        open={userOpen()}
        onClose={() => setUserOpen(false)}
        header={
          <Loading>
            <div class="flex items-center gap-2">
              <Avatar src={viewer().avatar_url} size={32} />
              <div class="min-w-0 leading-tight">
                <div class="font-semibold truncate">{viewer().login}</div>
                <div class="text-fg-muted text-sm truncate">{viewer().name}</div>
              </div>
            </div>
          </Loading>
        }
      >
        <Loading>
          <ul class="NavList">
            <li>
              <a class="NavList-item" href={`/${viewer().login}`}>
                <Octicon icon={personIcon} /> Your profile
              </a>
            </li>
            <li>
              <a class="NavList-item" href={`/${viewer().login}?tab=repositories`}>
                <Octicon icon={repoIcon} /> Your repositories
              </a>
            </li>
            <li>
              <a class="NavList-item" href={`/${viewer().login}?tab=stars`}>
                <Octicon icon={starIcon} /> Your stars
              </a>
            </li>
            <li>
              <a class="NavList-item" href="/settings/organizations">
                <Octicon icon={organizationIcon} /> Your organizations
              </a>
            </li>
          </ul>
          <hr class="NavList-divider" />
          <ul class="NavList">
            <li>
              <a class="NavList-item" href="/settings/profile">
                <Octicon icon={gearIcon} /> Settings
              </a>
            </li>
            <li>
              <button
                type="button"
                class="NavList-item w-full"
                onClick={() => setColorMode(colorMode() === 'dark' ? 'light' : colorMode() === 'light' ? 'auto' : 'dark')}
              >
                <Octicon icon={colorMode() === 'light' ? sunIcon : moonIcon} />
                Theme: {colorMode() === 'auto' ? 'Sync with system' : colorMode() === 'dark' ? 'Dark' : 'Light'}
              </button>
            </li>
            <li>
              <a class="NavList-item" href="https://docs.github.com" target="_blank" rel="noreferrer">
                <Octicon icon={bookIcon} /> GitHub Docs
              </a>
            </li>
            <li>
              <a class="NavList-item" href="https://github.com" target="_blank" rel="noreferrer">
                <Octicon icon={codeIcon} /> Open github.com
              </a>
            </li>
          </ul>
          <hr class="NavList-divider" />
          <button
            type="button"
            class="NavList-item w-full"
            onClick={() => {
              setUserOpen(false);
              signOut();
              navigate('/login');
            }}
          >
            <Octicon icon={signOutIcon} /> Sign out
          </button>
        </Loading>
      </Drawer>
    </header>
  );
}

function TopRepos() {
  const repos = createMemo(() => getTopRepos(10));
  return (
    <ul class="NavList">
      <For each={repos()}>
        {(repo) => (
          <li>
            <a class="NavList-item" href={`/${repo.full_name}`}>
              <Avatar src={repo.owner.avatar_url} size={16} square={repo.owner.type === 'Organization'} />
              <span class="truncate">{repo.full_name}</span>
            </a>
          </li>
        )}
      </For>
    </ul>
  );
}

/** "Type / to search" — Enter opens /search; on repo pages scoped to the repo. */
function SearchBox(props: { repo?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  let input!: HTMLInputElement;

  onSettled(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== '/' || e.metaKey || e.ctrlKey || t.closest('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      input.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <form
      class="AppHeader-search hidden sm:flex w-60 lg:w-80"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = input.value.trim();
        if (!q) return;
        const type = location.pathname.includes('/pull') ? 'pullrequests' : location.pathname.includes('/issues') ? 'issues' : '';
        navigate(`/search?q=${encodeURIComponent(q)}${type && props.repo ? `&type=${type}` : ''}`);
        input.blur();
      }}
    >
      <Octicon icon={searchIcon} />
      <input
        ref={input}
        type="text"
        placeholder="Type / to search"
        aria-label="Search GitHub"
        onFocus={() => {
          if (props.repo && !input.value) input.value = `repo:${props.repo} `;
        }}
        onBlur={() => {
          if (props.repo && input.value.trim() === `repo:${props.repo}`) input.value = '';
        }}
      />
      <kbd>/</kbd>
    </form>
  );
}
