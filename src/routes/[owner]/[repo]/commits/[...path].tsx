import { Title } from '@solidjs/meta';
import { useLocation, useNavigate, useParams, useSearchParams } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Avatar, Blankslate, Dropdown, PageSpinner } from '../../../../components/ui';
import { getCommitHistory, getRecentAuthors } from '../../../../features/code/api';
import CommitList from '../../../../features/code/components/CommitList';
import { DefaultBranchButton } from '../../../../features/code/refined';
import { getBranchStatus, getCommitTags } from '../../../../features/code/refinedApi';
import { feature } from '../../../../features/refined';
import { resolveRefPath } from '../../../../features/repo/api';
import RefPicker from '../../../../features/repo/components/RefPicker';
import { useRepo } from '../../../../features/repo/context';
import {
  calendarIcon,
  checkIcon,
  gitCommitIcon,
  gitMergeIcon,
  gitPullRequestClosedIcon,
  gitPullRequestDraftIcon,
  gitPullRequestIcon,
  peopleIcon,
  triangleDownIcon,
} from '../../../../icons/octicons';
import { encodePath } from '../../../../lib/github';

type Search = { author?: string; since?: string; until?: string; after?: string; before?: string };

/** /:owner/:repo/commits/:ref?/:path* — commit history grouped by day. */
export default function CommitsPage() {
  const ctx = useRepo();
  const params = useParams<{ path?: string }>();
  const [search] = useSearchParams<Search>();
  const resolved = createMemo(() =>
    params.path
      ? resolveRefPath(ctx.owner(), ctx.name(), params.path, ctx.repo().default_branch)
      : { ref: ctx.repo().default_branch, path: '', kind: 'branch' as const },
  );
  const history = createMemo(() =>
    getCommitHistory(ctx.owner(), ctx.name(), resolved().ref, {
      path: resolved().path,
      author: search.author,
      since: search.since,
      until: search.until,
      after: search.after,
      before: search.before,
    }),
  );
  const location = useLocation();
  /** tags-on-commits-list: tags for the commits on this page (fetched only while the feature is on). */
  const commitTags = createMemo(() => {
    const commits = history()?.commits;
    const last = commits?.[commits.length - 1];
    if (!feature('tags-on-commits-list') || !last) return {} as Record<string, string[]>;
    return getCommitTags(ctx.owner(), ctx.name(), last.oid).catch(() => ({}) as Record<string, string[]>);
  });
  const pageHref = (key: 'after' | 'before', cursor: string | null) => {
    const sp = new URLSearchParams(location.search);
    sp.delete('after');
    sp.delete('before');
    if (cursor) sp.set(key, cursor);
    const qs = sp.toString();
    return `${location.pathname}${qs ? `?${qs}` : ''}`;
  };
  const crumbs = () => resolved().path.split('/').filter(Boolean);
  /** same-branch-author-commits: author links filter this branch + path instead of opening the profile. */
  const authorHref = (login: string) => withParams(location, { author: login });
  const isBranch = () => resolved().kind === 'branch' && resolved().ref !== ctx.repo().default_branch;

  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>
        {resolved().path ? `History for ${resolved().path} - ${ctx.fullName()}` : `Commits · ${ctx.fullName()}`}
      </Title>
      <h1 class="text-2xl pb-2 mb-4 border-b border-line-muted">
        <Show when={resolved().path} fallback="Commits">
          <span class="text-xl">
            History for{' '}
            <a href={`${ctx.base()}/tree/${encodePath(resolved().ref)}`}>{ctx.name()}</a>
            <For each={crumbs()}>
              {(part, i) => (
                <>
                  <span class="text-fg-muted px-1">/</span>
                  {i() === crumbs().length - 1 ? (
                    <strong class="font-semibold">{part}</strong>
                  ) : (
                    <a href={`${ctx.base()}/tree/${encodePath(resolved().ref)}/${encodePath(crumbs().slice(0, i() + 1).join('/'))}`}>
                      {part}
                    </a>
                  )}
                </>
              )}
            </For>
          </span>
        </Show>
      </h1>
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <DefaultBranchButton
          gitRef={resolved().ref}
          defaultBranch={ctx.repo().default_branch}
          href={`${ctx.base()}/commits/${encodePath(ctx.repo().default_branch)}${resolved().path ? `/${encodePath(resolved().path)}` : ''}`}
        />
        <RefPicker
          owner={ctx.owner()}
          repo={ctx.name()}
          current={resolved().ref}
          defaultBranch={ctx.repo().default_branch}
          hrefFor={(ref) => `${ctx.base()}/commits/${encodePath(ref)}${resolved().path ? `/${encodePath(resolved().path)}` : ''}`}
        />
        <Show when={feature('list-prs-for-branch') && isBranch()}>
          <Loading>
            <BranchPullButton branch={resolved().ref} />
          </Loading>
        </Show>
        <div class="flex-1" />
        <AuthorFilter gitRef={resolved().ref} current={search.author} />
        <DateFilter since={search.since} until={search.until} />
      </div>

      <Loading fallback={<PageSpinner />}>
        <Show
          when={history()?.commits.length}
          fallback={
            <Blankslate icon={gitCommitIcon} title="No commits found" class="Box">
              {search.author ? `No commits by ${search.author} match this view.` : 'There are no commits for this view.'}
            </Blankslate>
          }
        >
          <CommitList
            commits={history()!.commits}
            base={ctx.base()}
            browsePath={resolved().path ? encodePath(resolved().path) : undefined}
            authorHref={authorHref}
            tags={feature('tags-on-commits-list') ? commitTags() : undefined}
          />
          <div class="flex justify-center my-4">
            <div class="BtnGroup">
              <Show
                when={history()!.hasPrev}
                fallback={
                  <button type="button" class="btn btn-sm" disabled>
                    Previous
                  </button>
                }
              >
                <a class="btn btn-sm" href={pageHref('before', history()!.startCursor)} rel="prev">
                  Previous
                </a>
              </Show>
              <Show
                when={history()!.hasNext}
                fallback={
                  <button type="button" class="btn btn-sm" disabled>
                    Next
                  </button>
                }
              >
                <a class="btn btn-sm" href={pageHref('after', history()!.endCursor)} rel="next">
                  Next
                </a>
              </Show>
            </div>
          </div>
        </Show>
      </Loading>
    </div>
  );
}

function withParams(location: { pathname: string; search: string }, changes: Record<string, string | undefined>) {
  const sp = new URLSearchParams(location.search);
  sp.delete('after');
  sp.delete('before');
  for (const [k, v] of Object.entries(changes)) {
    if (v) sp.set(k, v);
    else sp.delete(k);
  }
  const qs = sp.toString();
  return `${location.pathname}${qs ? `?${qs}` : ''}`;
}

function AuthorFilter(props: { gitRef: string; current?: string }) {
  const ctx = useRepo();
  const location = useLocation();
  const navigate = useNavigate();
  const [filter, setFilter] = createSignal('');
  let input: HTMLInputElement | undefined;
  return (
    <Dropdown
      class="btn btn-sm"
      align="right"
      menuClass="w-72"
      header="Filter by author"
      onOpen={() => input?.focus()}
      button={
        <>
          <Octicon icon={peopleIcon} />
          <span class="max-w-40 truncate">{props.current ?? 'All users'}</span>
          <Octicon icon={triangleDownIcon} />
        </>
      }
    >
      {(close) => (
        <>
          <div class="SelectMenu-filter">
            <input
              ref={(el) => (input = el)}
              class="form-control form-control-sm w-full"
              placeholder="Find a user (Enter to filter)"
              value={filter()}
              onInput={(e) => setFilter(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filter().trim()) {
                  close();
                  navigate(withParams(location, { author: filter().trim() }));
                }
              }}
            />
          </div>
          <div class="max-h-72 overflow-auto">
            <a class="SelectMenu-item" href={withParams(location, { author: undefined })} onClick={close}>
              <span class="w-4">
                <Show when={!props.current}>
                  <Octicon icon={checkIcon} />
                </Show>
              </span>
              All users
            </a>
            <Loading fallback={<div class="px-4 py-2 text-fg-muted text-sm">Loading…</div>}>
              <AuthorOptions gitRef={props.gitRef} filter={filter()} current={props.current} close={close} owner={ctx.owner()} repo={ctx.name()} />
            </Loading>
          </div>
        </>
      )}
    </Dropdown>
  );
}

function AuthorOptions(props: { owner: string; repo: string; gitRef: string; filter: string; current?: string; close: () => void }) {
  const location = useLocation();
  const authors = createMemo(() => getRecentAuthors(props.owner, props.repo, props.gitRef));
  const shown = createMemo(() => {
    const f = props.filter.trim().toLowerCase();
    return authors().filter((a) => !f || a.login.toLowerCase().includes(f));
  });
  return (
    <For each={shown()}>
      {(a) => (
        <a class="SelectMenu-item" href={withParams(location, { author: a.login })} onClick={props.close}>
          <span class="w-4">
            <Show when={props.current === a.login}>
              <Octicon icon={checkIcon} />
            </Show>
          </span>
          <Avatar src={a.avatarUrl} size={20} />
          {a.login}
        </a>
      )}
    </For>
  );
}

function DateFilter(props: { since?: string; until?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [since, setSince] = createSignal(() => props.since ?? '');
  const [until, setUntil] = createSignal(() => props.until ?? '');
  const label = () =>
    props.since || props.until ? `${props.since ?? '…'} – ${props.until ?? 'now'}` : 'All time';
  return (
    <Dropdown
      class="btn btn-sm"
      align="right"
      menuClass="w-72"
      header="Filter by date"
      button={
        <>
          <Octicon icon={calendarIcon} />
          {label()}
          <Octicon icon={triangleDownIcon} />
        </>
      }
    >
      {(close) => (
        <form
          class="p-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            close();
            navigate(withParams(location, { since: since() || undefined, until: until() || undefined }));
          }}
        >
          <label class="text-sm">
            <span class="form-label">Since</span>
            <input type="date" class="form-control form-control-sm w-full" value={since()} onInput={(e) => setSince(e.currentTarget.value)} />
          </label>
          <label class="text-sm">
            <span class="form-label">Until</span>
            <input type="date" class="form-control form-control-sm w-full" value={until()} onInput={(e) => setUntil(e.currentTarget.value)} />
          </label>
          <div class="flex gap-2 justify-end">
            <a class="btn btn-sm" href={withParams(location, { since: undefined, until: undefined })} onClick={close}>
              Clear
            </a>
            <button type="submit" class="btn btn-sm btn-primary">
              Apply
            </button>
          </div>
        </form>
      )}
    </Dropdown>
  );
}

/** list-prs-for-branch: the PR whose head is this branch, next to the branch picker. */
function BranchPullButton(props: { branch: string }) {
  const ctx = useRepo();
  const status = createMemo(() => getBranchStatus(ctx.owner(), ctx.name(), props.branch, ctx.repo().default_branch));
  const look = (pr: { state: string; isDraft: boolean }) =>
    pr.state === 'MERGED'
      ? { icon: gitMergeIcon, cls: 'text-fg-done' }
      : pr.state === 'CLOSED'
        ? { icon: gitPullRequestClosedIcon, cls: 'text-fg-closed' }
        : pr.isDraft
          ? { icon: gitPullRequestDraftIcon, cls: 'text-fg-muted' }
          : { icon: gitPullRequestIcon, cls: 'text-fg-open' };
  return (
    <Show when={status()?.pull}>
      {(pr) => (
        <a class="btn btn-sm rgh-list-prs-for-branch" href={`/${pr().repo}/pull/${pr().number}`} title={pr().title}>
          <Octicon icon={look(pr()).icon} class={look(pr()).cls} />#{pr().number}
        </a>
      )}
    </Show>
  );
}
