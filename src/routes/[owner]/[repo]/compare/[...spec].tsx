import { Title } from '@solidjs/meta';
import { useAction, useNavigate, useParams, useSearchParams } from '@solidjs/router';
import { createMemo, createOptimistic, createSignal, For, Loading, Match, Show, Switch } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Blankslate, Dropdown, MarkdownEditor, PageSpinner, toastError } from '../../../../components/ui';
import {
  createPull,
  fetchRaw,
  getCompare,
  getForks,
  getOpenPullFor,
  getPullTemplate,
  restToHistoryCommit,
  type CompareResult,
} from '../../../../features/code/api';
import CommitList from '../../../../features/code/components/CommitList';
import DiffView from '../../../../features/diff/DiffView';
import RefPicker from '../../../../features/repo/components/RefPicker';
import { useRepo } from '../../../../features/repo/context';
import {
  arrowLeftIcon,
  checkIcon,
  fileDiffIcon,
  gitCommitIcon,
  gitCompareIcon,
  gitPullRequestIcon,
  organizationIcon,
  repoForkedIcon,
  triangleDownIcon,
} from '../../../../icons/octicons';
import { formatNumber } from '../../../../lib/format';
import { encodePath } from '../../../../lib/github';

/** Parse "base...head" / "base..head" / "head" (base = default branch). */
function parseSpec(spec: string, defaultBranch: () => string) {
  const s = decodeURIComponent(spec.replace(/\/$/, ''));
  const three = s.indexOf('...');
  if (three >= 0) return { base: s.slice(0, three), head: s.slice(three + 3) };
  const two = s.indexOf('..');
  if (two >= 0) return { base: s.slice(0, two), head: s.slice(two + 2) };
  return { base: defaultBranch(), head: s };
}

/** "feature/add-thing" → "Feature/add thing" (github.com's default PR title). */
const titleFromBranch = (branch: string) => {
  const name = branch.includes(':') ? branch.split(':').pop()! : branch;
  const t = name.replace(/[-_]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** /:owner/:repo/compare/:base...:head — compare refs and open a pull request. */
export default function ComparePage() {
  const ctx = useRepo();
  const params = useParams<{ spec?: string }>();
  const range = createMemo(() => (params.spec ? parseSpec(params.spec, () => ctx.repo().default_branch) : null));
  const hrefFor = (base: string, head: string) => `${ctx.base()}/compare/${encodePath(base)}...${encodePath(head)}`;

  return (
    <div class="container-lg px-4 py-6">
      <Title>{range() ? `Comparing ${range()!.base}...${range()!.head} · ${ctx.fullName()}` : `Compare · ${ctx.fullName()}`}</Title>
      <div class="pb-2 mb-4 border-b border-line-muted">
        <h1 class="text-2xl">{range() ? 'Comparing changes' : 'Compare changes'}</h1>
        <p class="text-sm text-fg-muted mt-1">
          Choose two branches to see what’s changed or to start a new pull request. If you need to, you can also compare
          across forks.
        </p>
      </div>
      <div class="Box bg-canvas-muted! px-3 py-2 flex flex-wrap items-center gap-2 mb-4">
        <Octicon icon={gitCompareIcon} class="text-fg-muted" />
        <RefPicker
          owner={ctx.owner()}
          repo={ctx.name()}
          prefix="base:"
          current={range()?.base ?? ctx.repo().default_branch}
          defaultBranch={ctx.repo().default_branch}
          hrefFor={(ref) => hrefFor(ref, range()?.head ?? ctx.repo().default_branch)}
        />
        <Octicon icon={arrowLeftIcon} class="text-fg-muted" />
        <HeadPicker
          base={range()?.base ?? ctx.repo().default_branch}
          head={range()?.head ?? ctx.repo().default_branch}
          hrefFor={hrefFor}
        />
      </div>
      <Show
        when={range()}
        fallback={
          <Blankslate icon={gitCompareIcon} title="Compare changes" class="Box">
            Compare changes across branches, commits, tags, and more. Pick a base and a compare ref above.
          </Blankslate>
        }
      >
        {(r) => (
          <Loading fallback={<PageSpinner />}>
            <CompareBody base={r().base} head={r().head} />
          </Loading>
        )}
      </Show>
    </div>
  );
}

/** "compare: branch" picker, with an optional head-repository (fork) switcher. */
function HeadPicker(props: { base: string; head: string; hrefFor: (base: string, head: string) => string }) {
  const ctx = useRepo();
  const headOwner = () => (props.head.includes(':') ? props.head.split(':')[0]! : ctx.owner());
  const headBranch = () => (props.head.includes(':') ? props.head.split(':').slice(1).join(':') : props.head);
  const isFork = () => headOwner() !== ctx.owner();
  const qualify = (owner: string, branch: string) => (owner === ctx.owner() ? branch : `${owner}:${branch}`);
  return (
    <>
      <Show when={isFork() || ctx.repo().forks_count > 0}>
        <Dropdown
          class="btn btn-sm max-w-[240px]"
          menuClass="w-72"
          header="Choose a head repository"
          button={
            <>
              <span class="text-fg-muted">head repository:</span>
              <span class="truncate font-semibold">
                {headOwner()}/{ctx.name()}
              </span>
              <Octicon icon={triangleDownIcon} />
            </>
          }
        >
          {(close) => (
            <div class="max-h-72 overflow-auto">
              <a class="SelectMenu-item" href={props.hrefFor(props.base, headBranch())} onClick={close}>
                <span class="w-4">
                  <Show when={!isFork()}>
                    <Octicon icon={checkIcon} />
                  </Show>
                </span>
                <Octicon icon={organizationIcon} />
                {ctx.fullName()}
              </a>
              <Loading fallback={<div class="px-4 py-2 text-sm text-fg-muted">Loading forks…</div>}>
                <ForkOptions current={headOwner()} branch={headBranch()} base={props.base} hrefFor={props.hrefFor} close={close} />
              </Loading>
            </div>
          )}
        </Dropdown>
      </Show>
      <RefPicker
        owner={headOwner()}
        repo={ctx.name()}
        prefix="compare:"
        current={headBranch()}
        hrefFor={(ref) => props.hrefFor(props.base, qualify(headOwner(), ref))}
      />
    </>
  );
}

function ForkOptions(props: { current: string; branch: string; base: string; hrefFor: (b: string, h: string) => string; close: () => void }) {
  const ctx = useRepo();
  const forks = createMemo(() => getForks(ctx.owner(), ctx.name()));
  return (
    <For each={forks()}>
      {(fork) => (
        <a class="SelectMenu-item" href={props.hrefFor(props.base, `${fork.owner.login}:${props.branch}`)} onClick={props.close}>
          <span class="w-4">
            <Show when={props.current === fork.owner.login}>
              <Octicon icon={checkIcon} />
            </Show>
          </span>
          <Octicon icon={repoForkedIcon} />
          {fork.full_name}
        </a>
      )}
    </For>
  );
}

function CompareBody(props: { base: string; head: string }) {
  const ctx = useRepo();
  const [search] = useSearchParams<{ expand?: string; quick_pull?: string; title?: string; body?: string }>();
  const cmp = createMemo(() => getCompare(ctx.owner(), ctx.name(), props.base, props.head));
  const openPull = createMemo(() => getOpenPullFor(ctx.owner(), ctx.name(), props.base, props.head).catch(() => null));
  // Started alongside the comparison (the form only shows once it lands).
  const template = createMemo(() => getPullTemplate(ctx.owner(), ctx.name()).catch(() => ''));
  const [tab, setTab] = createSignal<'commits' | 'files'>('commits');
  const [formOpen, setFormOpen] = createSignal(() => search.expand === '1' || search.quick_pull === '1');
  const commits = createMemo(() => (cmp()?.commits ?? []).map(restToHistoryCommit));
  const contributors = createMemo(() => new Set(commits().map((c) => c.authors[0]?.user?.login ?? c.authors[0]?.name)).size);

  return (
    <Show
      when={cmp()}
      fallback={
        <Blankslate icon={gitCompareIcon} title="There isn’t anything to compare." class="Box">
          We couldn’t figure out how to compare these references, do they point to valid commits?
        </Blankslate>
      }
    >
      {(c) => (
        <Switch>
          <Match when={c().status === 'identical' || c().total_commits === 0}>
            <Blankslate icon={gitCompareIcon} title="There isn’t anything to compare." class="Box">
              <Show
                when={c().status === 'identical'}
                fallback={
                  <>
                    <strong>{props.base}</strong> is up to date with all commits from <strong>{props.head}</strong>. Try{' '}
                    <a href={`${ctx.base()}/compare/${encodePath(props.head)}...${encodePath(props.base)}`}>switching the base</a> for
                    your comparison.
                  </>
                }
              >
                <strong>{props.base}</strong> and <strong>{props.head}</strong> are identical.
              </Show>
            </Blankslate>
          </Match>
          <Match when={true}>
            <Loading fallback={<div class="h-14" />}>
              <Show
                when={openPull()}
                fallback={
                  <Show
                    when={formOpen()}
                    fallback={
                      <div class="flash flash-success flex items-center gap-3 mb-4 bg-success-muted!">
                        <span class="flex-1 text-sm">
                          Discuss and review the changes in this comparison with others.
                        </span>
                        <button type="button" class="btn btn-primary btn-sm" onClick={() => setFormOpen(true)}>
                          Create pull request
                        </button>
                      </div>
                    }
                  >
                    <PullForm
                      template={template()}
                      base={props.base}
                      head={props.head}
                      cmp={c()}
                      defaultTitle={search.title}
                      defaultBody={search.body}
                    />
                  </Show>
                }
              >
                {(pr) => (
                  <div class="flash flex items-center gap-3 mb-4">
                    <Octicon icon={gitPullRequestIcon} class="text-fg-success" />
                    <a class="font-semibold flex-1 truncate" href={`${ctx.base()}/pull/${pr().number}`}>
                      {pr().title} <span class="text-fg-muted font-normal">#{pr().number}</span>
                    </a>
                    <a class="btn btn-sm" href={`${ctx.base()}/pull/${pr().number}`}>
                      View pull request
                    </a>
                  </div>
                )}
              </Show>
            </Loading>

            <div class="flex items-end border-b border-line mb-4">
              <nav class="flex -mb-px">
                <button
                  type="button"
                  class={[
                    'flex items-center gap-2 px-4 py-2 text-sm border border-transparent rounded-t-md',
                    { 'bg-canvas border-line! border-b-canvas!': tab() === 'commits', 'text-fg-muted': tab() !== 'commits' },
                  ]}
                  onClick={() => setTab('commits')}
                >
                  <Octicon icon={gitCommitIcon} /> Commits <span class="Counter">{formatNumber(c().total_commits)}</span>
                </button>
                <button
                  type="button"
                  class={[
                    'flex items-center gap-2 px-4 py-2 text-sm border border-transparent rounded-t-md',
                    { 'bg-canvas border-line! border-b-canvas!': tab() === 'files', 'text-fg-muted': tab() !== 'files' },
                  ]}
                  onClick={() => setTab('files')}
                >
                  <Octicon icon={fileDiffIcon} /> Files changed <span class="Counter">{formatNumber(c().files?.length ?? 0)}</span>
                </button>
              </nav>
              <div class="flex-1" />
              <span class="text-xs text-fg-muted pb-2 flex items-center gap-1">
                <Octicon icon={organizationIcon} /> {contributors()} {contributors() === 1 ? 'contributor' : 'contributors'}
              </span>
            </div>

            <Show
              when={tab() === 'files'}
              fallback={
                <>
                  <CommitList commits={commits()} base={ctx.base()} />
                  <Show when={c().total_commits > commits().length}>
                    <p class="text-sm text-fg-muted text-center my-4">
                      This comparison is big! Showing the first {formatNumber(commits().length)} of{' '}
                      {formatNumber(c().total_commits)} commits.
                    </p>
                  </Show>
                </>
              }
            >
              <Show when={(c().files?.length ?? 0) >= 300}>
                <div class="flash flash-warn mb-4 text-sm">
                  This comparison is big! GitHub's API returns at most 300 changed files.
                </div>
              </Show>
              <DiffView
                files={c().files ?? []}
                viewedKey={`${ctx.fullName()}:${props.base}...${props.head}`}
                fileHref={(f) => (f.status === 'removed' ? undefined : `${ctx.base()}/blob/${encodePath(props.head)}/${encodePath(f.filename)}`)}
                loadContent={(f) => fetchRaw(ctx.owner(), ctx.name(), c().commits[c().commits.length - 1]?.sha ?? props.head, f.filename)}
              />
            </Show>
          </Match>
        </Switch>
      )}
    </Show>
  );
}

function PullForm(props: { template: string; base: string; head: string; cmp: CompareResult; defaultTitle?: string; defaultBody?: string }) {
  const ctx = useRepo();
  const navigate = useNavigate();
  const create = useAction(createPull);
  const single = () => (props.cmp.commits.length === 1 ? props.cmp.commits[0]!.commit.message.split('\n') : null);
  const [title, setTitle] = createSignal(() => props.defaultTitle ?? (single() ? single()![0]! : titleFromBranch(props.head)));
  // Prefilled from ?body=, the single commit's message body, or the repo's PR template.
  const [body, setBody] = createSignal(() => props.defaultBody ?? (single() ? single()!.slice(1).join('\n').trim() : props.template));
  const [draft, setDraft] = createSignal(false);
  const [maintainerEdits, setMaintainerEdits] = createSignal(true);
  const [busy, setBusy] = createOptimistic(false);
  const crossRepo = () => props.head.includes(':');

  const submit = async () => {
    if (!title().trim()) return;
    setBusy(true);
    try {
      const pr = await create(ctx.owner(), ctx.name(), {
        title: title().trim(),
        body: body(),
        base: props.base,
        head: props.head,
        draft: draft(),
        ...(crossRepo() ? { maintainer_can_modify: maintainerEdits() } : {}),
      });
      navigate(`${ctx.base()}/pull/${pr.number}`);
    } catch (e) {
      toastError(e);
    }
  };
  return (
    <div class="flex gap-4 mb-6">
      <div class="flex-1 min-w-0 Box p-4">
        <h2 class="font-semibold mb-2">Open a pull request</h2>
        <p class="text-sm text-fg-muted mb-3">
          Create a new pull request by comparing changes across two branches.
        </p>
        <label class="form-label" for="pr-title">
          Add a title
        </label>
        <input
          id="pr-title"
          class="form-control w-full mb-3"
          value={title()}
          required
          onInput={(e) => setTitle(e.currentTarget.value)}
        />
        <label class="form-label" for="pr-body">
          Add a description
        </label>
        <Loading fallback={<div class="h-40 rounded-md border border-line" />}>
          <MarkdownEditor
            id="pr-body"
            value={body()}
            onInput={setBody}
            repo={ctx.fullName()}
            minHeight={200}
            placeholder="Add your description here..."
            onSubmit={() => void submit()}
          />
        </Loading>
        <div class="flex flex-wrap items-center gap-3 mt-3">
          <Show when={crossRepo()}>
            <label class="text-sm flex items-center gap-2">
              <input type="checkbox" checked={maintainerEdits()} onChange={(e) => setMaintainerEdits(e.currentTarget.checked)} />
              Allow edits by maintainers
            </label>
          </Show>
          <div class="flex-1" />
          <div class="BtnGroup">
            <button type="button" class="btn btn-primary" disabled={busy() || !title().trim()} onClick={() => void submit()}>
              {busy() ? 'Creating…' : draft() ? 'Draft pull request' : 'Create pull request'}
            </button>
            <Dropdown class="btn btn-primary px-2!" align="right" menuClass="w-80" title="Select type of pull request" button={<Octicon icon={triangleDownIcon} />}>
              {(close) => (
                <>
                  <button
                    type="button"
                    class="SelectMenu-item items-start!"
                    onClick={() => {
                      setDraft(false);
                      close();
                    }}
                  >
                    <span class="w-4 mt-0.5">
                      <Show when={!draft()}>
                        <Octicon icon={checkIcon} />
                      </Show>
                    </span>
                    <span>
                      <span class="block font-semibold">Create pull request</span>
                      <span class="block text-xs text-fg-muted">Open a pull request that is ready for review</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    class="SelectMenu-item items-start!"
                    onClick={() => {
                      setDraft(true);
                      close();
                    }}
                  >
                    <span class="w-4 mt-0.5">
                      <Show when={draft()}>
                        <Octicon icon={checkIcon} />
                      </Show>
                    </span>
                    <span>
                      <span class="block font-semibold">Create draft pull request</span>
                      <span class="block text-xs text-fg-muted">Cannot be merged until marked ready for review</span>
                    </span>
                  </button>
                </>
              )}
            </Dropdown>
          </div>
        </div>
      </div>
    </div>
  );
}
