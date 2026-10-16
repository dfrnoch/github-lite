import { useLocation, useNavigate } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, Match, Show, Switch } from 'solid-js';
import { openUnreadNotifications } from '../../features/notifications/openTabs';
import { userReposHref } from '../../features/profile/links';
import { feature } from '../../features/refined';
import { RepoHeaderAvatar, RepoHeaderInfo } from '../../features/repo/refined/HeaderInfo';
import { getTopRepos, getUnreadNotifications, getViewer } from '../../features/user/api';
import { PinnedNav } from '../../features/user/components/PinnedRepos';
import {
  arrowUpRightIcon,
  bookIcon,
  codeIcon,
  gearIcon,
  gitPullRequestIcon,
  homeIcon,
  inboxIcon,
  issueOpenedIcon,
  markGithubIcon,
  deviceDesktopIcon,
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
import { useHotkey } from '../../lib/hotkeys';
import { isDarkTheme, themeSettings, themeSummary } from '../../lib/theme';
import Octicon from '../Octicon';
import { Avatar, Dropdown, Popover, QUERY_KEYS, QueryInput } from '../ui';
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
  const [userButton, setUserButton] = createSignal<HTMLButtonElement>();
  // Repo and org pages continue the header's background into their tab bar.
  const bordered = () => ctx().kind !== 'repo' && ctx().kind !== 'org' && ctx().kind !== 'owner';

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
                  {/* The owner crumb includes its avatar, so the hover highlight covers both (like github.com). */}
                  <a class="AppHeader-context-item inline-flex! items-center gap-2 min-w-0" href={`/${c().owner}`}>
                    <RepoHeaderAvatar owner={c().owner} repo={c().repo} />
                    <span class="truncate">{c().owner}</span>
                  </a>
                  <span class="text-fg-muted px-0.5">/</span>
                  <a class="AppHeader-context-item font-semibold truncate" href={`/${c().owner}/${c().repo}`}>
                    {c().repo}
                  </a>
                  <RepoHeaderInfo owner={c().owner} repo={c().repo} />
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
        <div class="flex">
          <a
            class={['AppHeader-button', { 'rgh-unread-anywhere-inbox': feature('unread-anywhere') }]}
            href="/notifications"
            title="Notifications"
            aria-label="Notifications"
          >
            <Octicon icon={inboxIcon} />
            <Loading>
              <Show when={hasUnread()}>
                <span class="unread-dot" />
              </Show>
            </Loading>
          </a>
          <Show when={feature('unread-anywhere')}>
            <UnreadAnywhereButton />
          </Show>
        </div>
        <button
          ref={setUserButton}
          type="button"
          class="ml-1 rounded-full"
          aria-label="Open user navigation menu"
          aria-haspopup="dialog"
          aria-expanded={userOpen() ? 'true' : 'false'}
          onClick={() => setUserOpen(!userOpen())}
        >
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
        <PinnedNav />
        <div class="NavList-heading">Repositories</div>
        <Loading fallback={<div class="px-2 text-fg-muted text-sm">Loading…</div>}>
          <TopRepos />
        </Loading>
      </Drawer>

      <Popover
        anchor={userButton()}
        open={userOpen()}
        onClose={() => setUserOpen(false)}
        align="end"
        caret={false}
        focus
        aria-label="User navigation"
        class="w-[320px] max-w-[calc(100vw-16px)] p-2"
      >
        <Loading>
          {/* Following a link inside closes the menu. */}
          <nav onClick={(e) => (e.target as HTMLElement).closest('a') && setUserOpen(false)}>
            <div class="flex items-center gap-2 px-2 pt-1 pb-2">
              <Avatar src={viewer().avatar_url} size={32} />
              <div class="min-w-0 leading-tight">
                <div class="font-semibold truncate">{viewer().login}</div>
                <div class="text-fg-muted text-sm truncate">{viewer().name}</div>
              </div>
            </div>
            <hr class="NavList-divider" />
            <ul class="NavList">
              <li>
                <a class="NavList-item" href={`/${viewer().login}`}>
                  <Octicon icon={personIcon} /> Your profile
                </a>
              </li>
              <li>
                <a class="NavList-item" href={userReposHref(viewer().login)}>
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
                <a class="NavList-item" href="/settings/appearance">
                  <Octicon icon={themeSettings().mode === 'sync' ? deviceDesktopIcon : isDarkTheme(themeSettings().single) ? moonIcon : sunIcon} />
                  <span class="flex-1">Appearance</span>
                  <span class="text-xs text-fg-muted truncate">{themeSummary()}</span>
                </a>
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
          </nav>
        </Loading>
      </Popover>
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
  const [value, setValue] = createSignal('');
  let input!: HTMLInputElement;

  const focus = () => input.focus();
  useHotkey({ keys: '/', description: 'Focus the search bar', group: 'Site-wide', handler: focus });
  useHotkey({ keys: 's', description: 'Focus the search bar', group: 'Site-wide', handler: focus });

  return (
    <form
      class="AppHeader-search hidden sm:flex w-60 lg:w-80"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value().trim();
        if (!q) return;
        const type = location.pathname.includes('/pull') ? 'pullrequests' : location.pathname.includes('/issues') ? 'issues' : '';
        navigate(`/search?q=${encodeURIComponent(q)}${type && props.repo ? `&type=${type}` : ''}`);
        input.blur();
      }}
    >
      <Octicon icon={searchIcon} />
      <QueryInput
        class="flex-1 min-w-0"
        inputRef={(el) => (input = el)}
        placeholder="Type / to search"
        label="Search GitHub"
        value={value()}
        onInput={setValue}
        suggestions={QUERY_KEYS}
        onFocus={() => {
          if (props.repo && !value()) setValue(`repo:${props.repo} `);
        }}
        onBlur={() => {
          if (props.repo && value().trim() === `repo:${props.repo}`) setValue('');
        }}
      />
      <kbd>/</kbd>
    </form>
  );
}

/**
 * Refined GitHub's `unread-anywhere`: a narrow button joined to the inbox
 * icon that opens the newest unread notifications in new tabs (also `g u`).
 */
function UnreadAnywhereButton() {
  const [busy, setBusy] = createSignal(false);
  return (
    <button
      type="button"
      class="AppHeader-button rgh-unread-anywhere"
      title="Open unread notifications (g u)"
      aria-label="Open unread notifications"
      disabled={busy()}
      onClick={async (e) => {
        e.currentTarget.blur();
        setBusy(true);
        try {
          await openUnreadNotifications();
        } finally {
          setBusy(false);
        }
      }}
    >
      <Octicon icon={arrowUpRightIcon} size={12} />
    </button>
  );
}
