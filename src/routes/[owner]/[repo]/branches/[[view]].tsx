import { Title } from '@solidjs/meta';
import { useAction, useLocation, useNavigate, useParams, useSearchParams } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createMemo, createOptimistic, createSignal, For, Loading, Match, Show, Switch } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Avatar, Blankslate, CopyButton, Dialog, Dropdown, PageSpinner, Pagination, pageHref, RelativeTime, toast, toastError } from '../../../../components/ui';
import {
  createBranch,
  deleteBranch,
  getDefaultBranch,
  getAllBranches,
  getBranchExtras,
  getProtectedBranches,
  renameBranch,
  restoreBranch,
  type BranchExtra,
  type BranchRow,
} from '../../../../features/code/api';
import { ChecksBadge } from '../../../../features/code/components/CommitList';
import { getRefNames } from '../../../../features/repo/api';
import { useRepo } from '../../../../features/repo/context';
import { feature } from '../../../../features/refined';
import { getViewer } from '../../../../features/user/api';
import {
  chevronRightIcon,
  gitBranchIcon,
  gitMergeIcon,
  gitPullRequestClosedIcon,
  gitPullRequestDraftIcon,
  gitPullRequestIcon,
  kebabHorizontalIcon,
  repoForkedIcon,
  searchIcon,
  shieldLockIcon,
  trashIcon,
  undoIcon,
} from '../../../../icons/octicons';
import { encodePath } from '../../../../lib/github';

type View = 'overview' | 'yours' | 'active' | 'stale' | 'all';
const VIEWS: { id: View; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'yours', label: 'Yours' },
  { id: 'active', label: 'Active' },
  { id: 'stale', label: 'Stale' },
  { id: 'all', label: 'All' },
];
/** github.com calls a branch stale after three months without commits. */
const STALE_MS = 90 * 24 * 3600 * 1000;
const isStale = (b: BranchRow) => Date.now() - new Date(b.committedDate).getTime() > STALE_MS;

/** /:owner/:repo/branches[/yours|active|stale|all] */
export default function BranchesPage() {
  const ctx = useRepo();
  const params = useParams<{ view?: string }>();
  const [search, setSearch] = useSearchParams<{ query?: string; page?: string }>();
  const view = (): View => (VIEWS.some((v) => v.id === params.view) ? (params.view as View) : 'overview');
  const listView = (): Exclude<View, 'overview'> => {
    const v = view();
    return v === 'overview' ? 'all' : v;
  };
  const canPush = () => !!ctx.repo().permissions?.push;
  const [creating, setCreating] = createSignal(false);
  const [query, setQuery] = createSignal(() => search.query ?? '');
  const protectedSet = createMemo(() => getProtectedBranches(ctx.owner(), ctx.name()));

  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`Branches · ${ctx.fullName()}`}</Title>
      <div class="flex items-center gap-2 mb-4">
        <h1 class="text-2xl flex-1">Branches</h1>
        <Show when={canPush()}>
          <button type="button" class="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
            New branch
          </button>
        </Show>
      </div>
      <nav class="UnderlineNav mb-4" aria-label="Branch views">
        <ul class="UnderlineNav-body">
          <For each={VIEWS}>
            {(v) => (
              <li>
                <a
                  class={['UnderlineNav-item', { selected: view() === v.id }]}
                  href={`${ctx.base()}/branches${v.id === 'overview' ? '' : `/${v.id}`}`}
                  aria-current={view() === v.id ? 'page' : undefined}
                >
                  {v.label}
                </a>
              </li>
            )}
          </For>
        </ul>
      </nav>
      <form
        class="relative mb-4"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch({ query: query() || undefined, page: undefined });
        }}
      >
        <Octicon icon={searchIcon} class="absolute left-3 top-2.5 text-fg-muted" />
        <input
          class="form-control w-full pl-9!"
          type="search"
          placeholder="Search branches..."
          aria-label="Search branches"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
      </form>

      <Loading fallback={<PageSpinner />}>
        <Switch>
          <Match when={view() === 'overview' && !search.query}>
            <Overview protectedNames={protectedSet()} />
          </Match>
          <Match when={true}>
            <BranchListView view={listView()} query={search.query} page={Math.max(1, Number(search.page) || 1)} protectedNames={protectedSet()} />
          </Match>
        </Switch>
      </Loading>

      <Show when={canPush()}>
        <CreateBranchDialog open={creating()} onClose={() => setCreating(false)} />
      </Show>
    </div>
  );
}

function Overview(props: { protectedNames: Set<string> }) {
  const ctx = useRepo();
  // One flight for everything the overview needs.
  const data = createMemo(() =>
    Promise.all([
      getDefaultBranch(ctx.owner(), ctx.name()),
      getAllBranches(ctx.owner(), ctx.name()),
      getViewer().catch(() => null),
    ]),
  );
  const others = createMemo(() => data()[1].branches.filter((b) => b.name !== data()[0]?.name && !isStale(b)));
  const yours = createMemo(() => others().filter((b) => b.author.login === data()[2]?.login).slice(0, 5));
  const active = createMemo(() => others().slice(0, 5));
  return (
    <>
      <Show when={data()[0]}>{(b) => <BranchTable title="Default" branches={[b()]} protectedNames={props.protectedNames} />}</Show>
      <Show when={yours().length}>
        <BranchTable title="Your branches" branches={yours()} moreHref={`${ctx.base()}/branches/yours`} protectedNames={props.protectedNames} />
      </Show>
      <Show
        when={active().length}
        fallback={
          <Show when={data()[1].branches.length > 1}>
            <p class="text-sm text-fg-muted">
              No active branches. <a href={`${ctx.base()}/branches/all`}>View all branches</a>
            </p>
          </Show>
        }
      >
        <BranchTable title="Active branches" branches={active()} moreHref={`${ctx.base()}/branches/active`} protectedNames={props.protectedNames} />
      </Show>
    </>
  );
}

const PER_PAGE = 20;

function BranchListView(props: { view: Exclude<View, 'overview'>; query?: string; page: number; protectedNames: Set<string> }) {
  const ctx = useRepo();
  const location = useLocation();
  const data = createMemo(() =>
    Promise.all([getAllBranches(ctx.owner(), ctx.name(), props.query), props.view === 'yours' ? getViewer() : null]),
  );
  const rows = createMemo(() => {
    const [{ branches }, viewer] = data();
    switch (props.view) {
      case 'yours':
        return branches.filter((b) => b.author.login === viewer?.login);
      case 'active':
        return branches.filter((b) => !isStale(b));
      case 'stale':
        return branches.filter(isStale);
      default:
        return branches;
    }
  });
  const pageRows = createMemo(() => rows().slice((props.page - 1) * PER_PAGE, props.page * PER_PAGE));
  const lastPage = () => Math.max(1, Math.ceil(rows().length / PER_PAGE));
  const title = () =>
    props.query
      ? 'Search results'
      : ({ yours: 'Your branches', active: 'Active branches', stale: 'Stale branches', all: 'All branches' } as const)[props.view];
  return (
    <Show
      when={pageRows().length}
      fallback={
        <Blankslate icon={gitBranchIcon} title={props.query ? `No branches match “${props.query}”` : 'No branches here'} class="Box" />
      }
    >
      <BranchTable title={title()} branches={pageRows()} protectedNames={props.protectedNames} />
      <Pagination
        pageInfo={{ page: props.page, lastPage: lastPage(), hasNext: props.page < lastPage(), hasPrev: props.page > 1 }}
        href={(n) => pageHref(location, n)}
      />
      <Show when={data()[0].truncated}>
        <p class="text-xs text-fg-muted text-center mt-2">Showing the 1,000 most recently fetched branches. Search to narrow down.</p>
      </Show>
    </Show>
  );
}

function BranchTable(props: { title: string; branches: BranchRow[]; moreHref?: string; protectedNames: Set<string> }) {
  const ctx = useRepo();
  const names = createMemo(() => props.branches.map((b) => b.name));
  const extras = createMemo(() => getBranchExtras(ctx.owner(), ctx.name(), ctx.repo().default_branch, names()));
  return (
    <section class="mb-6">
      <h2 class="text-base font-semibold mb-2">{props.title}</h2>
      <div class="Box overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-canvas-muted text-xs text-fg-muted text-left">
              <th class="font-semibold px-4 py-2.5 rounded-tl-md">Branch</th>
              <th class="font-semibold px-2 py-2.5 w-40 hidden md:table-cell">Updated</th>
              <th class="font-semibold px-2 py-2.5 w-28 hidden lg:table-cell">Check status</th>
              <th class="font-semibold px-2 py-2.5 w-32 text-center hidden md:table-cell">
                <span class="inline-block w-12 text-right pr-1 border-r border-line">Behind</span>
                <span class="inline-block w-12 text-left pl-1">Ahead</span>
              </th>
              <th class="font-semibold px-2 py-2.5 w-28 hidden md:table-cell">Pull request</th>
              <th class="w-24 rounded-tr-md" />
            </tr>
          </thead>
          <tbody>
            <For each={props.branches}>
              {(b) => (
                <BranchTableRow branch={b} extra={extras()[b.name]} isProtected={props.protectedNames.has(b.name)} />
              )}
            </For>
          </tbody>
        </table>
        <Show when={props.moreHref}>
          <div class="border-t border-line-muted py-2.5 text-center text-sm">
            <a href={props.moreHref}>
              View more branches <Octicon icon={chevronRightIcon} />
            </a>
          </div>
        </Show>
      </div>
    </section>
  );
}

function PullBadge(props: { pull: NonNullable<BranchExtra['pull']> }) {
  const ctx = useRepo();
  const upstream = () => props.pull.repo.toLowerCase() !== ctx.fullName().toLowerCase();
  const look = () =>
    props.pull.state === 'MERGED'
      ? { icon: gitMergeIcon, cls: 'text-fg-done' }
      : props.pull.state === 'CLOSED'
        ? { icon: gitPullRequestClosedIcon, cls: 'text-fg-closed' }
        : props.pull.isDraft
          ? { icon: gitPullRequestDraftIcon, cls: 'text-fg-muted' }
          : { icon: gitPullRequestIcon, cls: 'text-fg-open' };
  return (
    <a
      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-line text-xs link-plain hover:bg-canvas-muted"
      href={`/${props.pull.repo}/pull/${props.pull.number}`}
      title={upstream() ? `${props.pull.title} (${props.pull.repo})` : props.pull.title}
    >
      <span class={['inline-flex', look().cls]}>
        <Octicon icon={look().icon} size={12} />
      </span>
      <Show when={upstream()}>
        <span class={['inline-flex', look().cls]}>
          <Octicon icon={repoForkedIcon} size={12} />
        </span>
      </Show>
      #{props.pull.number}
    </a>
  );
}

function BranchTableRow(props: {
  branch: BranchRow;
  extra: BranchExtra | undefined;
  isProtected: boolean;
}) {
  const ctx = useRepo();
  const [deleted, setDeleted] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [renaming, setRenaming] = createSignal(false);
  const isDefault = () => props.branch.name === ctx.repo().default_branch;
  const canPush = () => !!ctx.repo().permissions?.push;

  const Cell = (p: { class?: string; children: JSX.Element }) => <td class={['px-2 py-3 align-middle', p.class]}>{p.children}</td>;

  return (
    <tr class={['border-t border-line-muted', { 'opacity-60': deleted() }]}>
      <td class="px-4 py-3 align-middle">
        <div class="flex items-center gap-1 min-w-0">
          <a
            class={[
              'font-mono text-xs px-1.5 py-0.5 rounded-md bg-accent-muted text-fg-accent truncate max-w-[420px]',
              { 'line-through': deleted() },
            ]}
            href={`${ctx.base()}/tree/${encodePath(props.branch.name)}`}
            title={props.branch.name}
          >
            {props.branch.name}
          </a>
          <CopyButton value={props.branch.name} label="Copy branch name to clipboard" class="btn-octicon w-7 h-7" />
          <Loading>
            <Show when={props.isProtected}>
              <span class="text-fg-muted inline-flex" title="This branch is protected">
                <Octicon icon={shieldLockIcon} />
              </span>
            </Show>
          </Loading>
        </div>
      </td>
      <Cell class="hidden md:table-cell whitespace-nowrap">
        <span class="inline-flex items-center gap-2 text-fg-muted text-xs">
          <Show when={props.branch.author.avatarUrl}>
            <Avatar src={props.branch.author.avatarUrl} size={16} login={props.branch.author.login ?? undefined} hovercard />
          </Show>
          <RelativeTime datetime={props.branch.committedDate} relative />
        </span>
      </Cell>
      <Cell class="hidden lg:table-cell">
        <Loading>
          <ChecksBadge
            checks={props.extra?.checks ?? null}
            href={`${ctx.base()}/commit/${props.branch.oid}`}
            owner={ctx.owner()}
            repo={ctx.name()}
            sha={props.branch.oid}
          />
        </Loading>
      </Cell>
      <Cell class="hidden md:table-cell text-xs text-fg-muted text-center whitespace-nowrap">
        <Show when={!isDefault()} fallback={<span class="Label">Default</span>}>
          <Loading fallback={<span class="Skeleton w-16 mx-auto" />}>
            <Show when={props.extra}>
              {(x) => (
                <a class="link-muted" href={`${ctx.base()}/compare/${encodePath(props.branch.name)}`}>
                  <span class="inline-block w-12 text-right pr-1 border-r border-line">{x().behind}</span>
                  <span class="inline-block w-12 text-left pl-1">{x().ahead}</span>
                </a>
              )}
            </Show>
          </Loading>
        </Show>
      </Cell>
      <Cell class="hidden md:table-cell">
        <Loading>
          <Show
            when={feature('show-associated-branch-prs-on-fork') && ctx.repo().fork ? props.extra?.anyPull : props.extra?.pull}
          >
            {(pr) => <PullBadge pull={pr()} />}
          </Show>
        </Loading>
      </Cell>
      <td class="pr-3 py-2 align-middle text-right whitespace-nowrap">
        <Show when={canPush() && !isDefault()}>
          <Show
            when={!deleted()}
            fallback={
              <button
                type="button"
                class="btn btn-sm"
                disabled={busy()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await restoreBranch(ctx.owner(), ctx.name(), props.branch.name, props.branch.oid);
                    setDeleted(false);
                    toast(`Restored ${props.branch.name}`, 'success');
                  } catch (e) {
                    toastError(e);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Octicon icon={undoIcon} /> Restore
              </button>
            }
          >
            <Loading>
              <button
                type="button"
                class="btn-octicon btn-octicon-danger w-8 h-8"
                aria-label={`Delete branch ${props.branch.name}`}
                title={props.isProtected ? 'Protected branches cannot be deleted' : 'Delete this branch'}
                disabled={busy() || props.isProtected}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await deleteBranch(ctx.owner(), ctx.name(), props.branch.name);
                    setDeleted(true);
                  } catch (e) {
                    toastError(e);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Octicon icon={trashIcon} />
              </button>
            </Loading>
          </Show>
        </Show>
        <Dropdown class="btn-octicon w-8 h-8" align="right" title="Branch menu" button={<Octicon icon={kebabHorizontalIcon} />}>
          {(close) => (
            <>
              <a class="SelectMenu-item" href={`${ctx.base()}/commits/${encodePath(props.branch.name)}`} onClick={close}>
                View commits
              </a>
              <a class="SelectMenu-item" href={`${ctx.base()}/compare/${encodePath(props.branch.name)}?expand=1`} onClick={close}>
                New pull request
              </a>
              <Show when={canPush() && !deleted()}>
                <button
                  type="button"
                  class="SelectMenu-item"
                  onClick={() => {
                    close();
                    setRenaming(true);
                  }}
                >
                  Rename branch
                </button>
              </Show>
            </>
          )}
        </Dropdown>
        <Show when={canPush()}>
          <RenameBranchDialog open={renaming()} name={props.branch.name} isDefault={isDefault()} onClose={() => setRenaming(false)} />
        </Show>
      </td>
    </tr>
  );
}

function RenameBranchDialog(props: { open: boolean; name: string; isDefault: boolean; onClose: () => void }) {
  const ctx = useRepo();
  const rename = useAction(renameBranch);
  const [value, setValue] = createSignal(() => props.name);
  const [busy, setBusy] = createOptimistic(false);
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title="Rename this branch"
      width="480px"
      footer={
        <>
          <button type="button" class="btn" onClick={() => props.onClose()}>
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled={busy() || !value().trim() || value().trim() === props.name}
            onClick={async () => {
              setBusy(true);
              try {
                await rename(ctx.owner(), ctx.name(), props.name, value().trim());
                toast(`Renamed ${props.name} to ${value().trim()}`, 'success');
                props.onClose();
              } catch (e) {
                toastError(e);
              }
            }}
          >
            {busy() ? 'Renaming…' : 'Rename branch'}
          </button>
        </>
      }
    >
      <div class="text-left whitespace-normal">
        <label class="form-label" for="rename-branch">
          Rename <code class="font-mono">{props.name}</code> to:
        </label>
        <input id="rename-branch" class="form-control w-full" value={value()} onInput={(e) => setValue(e.currentTarget.value)} />
        <p class="text-xs text-fg-muted mt-3">
          Most projects will be unaffected: open pull requests, draft releases and branch protection rules will be retargeted,
          and web links to the old name will redirect.{props.isDefault ? ' This is the default branch.' : ''}
        </p>
      </div>
    </Dialog>
  );
}

function CreateBranchDialog(props: { open: boolean; onClose: () => void }) {
  const ctx = useRepo();
  const navigate = useNavigate();
  const create = useAction(createBranch);
  const [name, setName] = createSignal('');
  const [source, setSource] = createSignal(() => ctx.repo().default_branch);
  const [busy, setBusy] = createOptimistic(false);
  const valid = () => /^[^\s~^:?*[\\]+$/.test(name().trim()) && !name().includes('..') && !name().endsWith('/');
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title="Create a branch"
      width="480px"
      footer={
        <>
          <button type="button" class="btn" onClick={() => props.onClose()}>
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled={busy() || !valid()}
            onClick={async () => {
              setBusy(true);
              try {
                await create(ctx.owner(), ctx.name(), name().trim(), source());
                toast(`Branch ${name().trim()} created`, 'success');
                props.onClose();
                navigate(`${ctx.base()}/tree/${encodePath(name().trim())}`);
              } catch (e) {
                toastError(e);
              }
            }}
          >
            {busy() ? 'Creating…' : 'Create new branch'}
          </button>
        </>
      }
    >
      <label class="form-label" for="new-branch-name">
        New branch name
      </label>
      <input
        id="new-branch-name"
        class="form-control w-full mb-3"
        value={name()}
        placeholder="feature/my-change"
        onInput={(e) => setName(e.currentTarget.value)}
      />
      <label class="form-label" for="new-branch-source">
        Source
      </label>
      <Loading fallback={<select class="form-select w-full" disabled />}>
        <SourceSelect value={source()} onChange={setSource} />
      </Loading>
    </Dialog>
  );
}

function SourceSelect(props: { value: string; onChange: (v: string) => void }) {
  const ctx = useRepo();
  const refs = createMemo(() => getRefNames(ctx.owner(), ctx.name()));
  return (
    <select id="new-branch-source" class="form-select w-full" value={props.value} onChange={(e) => props.onChange(e.currentTarget.value)}>
      <optgroup label="Branches">
        <For each={refs().branches}>{(b) => <option value={b} selected={b === props.value}>{b}</option>}</For>
      </optgroup>
      <optgroup label="Tags">
        <For each={refs().tags}>{(t) => <option value={t} selected={t === props.value}>{t}</option>}</For>
      </optgroup>
    </select>
  );
}
