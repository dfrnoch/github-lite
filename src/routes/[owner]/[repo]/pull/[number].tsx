import { Title } from '@solidjs/meta';
import { useAction, useLocation, useNavigate, useParams } from '@solidjs/router';
import type { ParentProps } from 'solid-js';
import { createEffect, createMemo, For, Loading, onSettled, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { CopyButton, itemState, PageSpinner, RelativeTime, StateBadge, toastError } from '../../../../components/ui';
import { updateIssue } from '../../../../features/issues/api';
import { userHref } from '../../../../features/issues/components/Comment';
import IssueHeader from '../../../../features/issues/components/IssueHeader';
import { getFirstTag, getPull, getPullChecksCount, getPullDeployments, type PullDeployment, updatePull } from '../../../../features/pulls/api';
import SelectPanel from '../../../../features/issues/components/SelectPanel';
import { getRefNames } from '../../../../features/repo/api';
import { PullContext, type PullContextValue } from '../../../../features/pulls/context';
import { useRepo } from '../../../../features/repo/context';
import { getViewer } from '../../../../features/user/api';
import { checklistIcon, commentDiscussionIcon, fileDiffIcon, gitCommitIcon, rocketIcon, tagIcon, triangleDownIcon } from '../../../../icons/octicons';
import type { OcticonData } from '../../../../icons/octicons';
import { formatNumber } from '../../../../lib/format';
import { useHotkey } from '../../../../lib/hotkeys';
import type { PullRequest, PullRequestRef } from '../../../../lib/types';

/**
 * Pull request layout: /:owner/:repo/pull/:number[/commits|/checks|/files].
 * Title, state, branches and the tab bar; the tab content renders below.
 */
export default function PullLayout(props: ParentProps) {
  const ctx = useRepo();
  const params = useParams<{ number: string }>();
  const navigate = useNavigate();
  const number = () => Number(params.number);
  const pullOrNull = createMemo(() => getPull(ctx.owner(), ctx.name(), number()));
  // Started together with the pull request (not after it) so they don't waterfall.
  const checks = createMemo(() => getPullChecksCount(ctx.owner(), ctx.name(), number()));
  const deployments = createMemo(() => getPullDeployments(ctx.owner(), ctx.name(), number()).catch((): PullDeployment[] => []));
  const firstTag = createMemo(() => getFirstTag(ctx.owner(), ctx.name(), number()).catch(() => null));
  // Not a pull request: github.com redirects to the issue.
  createEffect(
    () => (pullOrNull() === null ? `${ctx.base()}/issues/${params.number}` : null),
    (to) => {
      if (to) navigate(to, { replace: true });
    },
  );
  const value: PullContextValue = {
    owner: ctx.owner,
    repo: ctx.name,
    number,
    pull: () => pullOrNull() as PullRequest,
    base: () => `${ctx.base()}/pull/${params.number}`,
  };

  return (
    <PullContext value={value}>
      <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
        <Show when={pullOrNull()}>
          {(pull) => (
            <>
              <Title>{`${pull().title} by ${pull().user.login} · Pull Request #${pull().number} · ${ctx.fullName()}`}</Title>
              <PullHeader pull={pull()} checks={checks()} deployments={deployments()} firstTag={firstTag()} />
              <PullTabs pull={pull()} checks={checks()} />
            </>
          )}
        </Show>
        {/* Outside the Show so tab data loads in parallel with the header's. */}
        <Loading fallback={<PageSpinner />}>{props.children}</Loading>
      </div>
    </PullContext>
  );
}

function BranchLabel(props: { gitRef: PullRequestRef; base: PullRequestRef; deleted?: boolean }) {
  const repo = () => props.gitRef.repo?.full_name ?? props.base.repo?.full_name ?? '';
  const crossRepo = () => props.gitRef.repo?.full_name !== props.base.repo?.full_name;
  return (
    <a
      class={['font-mono text-xs px-1.5 py-0.5 rounded-md bg-accent-muted text-fg-accent hover:underline break-all', { 'rgh-deleted-branch': props.deleted }]}
      href={props.gitRef.repo && !props.deleted ? `/${repo()}/tree/${props.gitRef.ref}` : undefined}
      title={props.deleted ? 'This branch has been deleted' : props.gitRef.label}
    >
      {crossRepo() ? props.gitRef.label : props.gitRef.ref}
    </a>
  );
}

/** Rocket button opening the latest successful deployment. */
function LastDeployment(props: { deployments: PullDeployment[] }) {
  const url = () => {
    const list = props.deployments.filter((d) => d.url);
    return (list.findLast((d) => d.state === 'ACTIVE') ?? list.at(-1))?.url;
  };
  return (
    <Show when={url()}>
      {(href) => (
        <a class="btn btn-sm hidden! md:inline-flex! items-center" href={href()} target="_blank" rel="noopener noreferrer" title="View last deployment" aria-label="View last deployment">
          <Octicon icon={rocketIcon} />
        </a>
      )}
    </Show>
  );
}

type ChecksInfo = { count: number; state: string | null; headDeleted: boolean };

function PullHeader(props: {
  pull: PullRequest;
  checks: ChecksInfo;
  deployments: PullDeployment[];
  firstTag: { tag: string | null } | null;
}) {
  const ctx = useRepo();
  const viewer = createMemo(() => getViewer());
  // The head branch is struck through when gone (only closed PRs wait for this; forks with a deleted repo are known right away).
  const headDeleted = () => !props.pull.head.repo || (props.pull.state === 'closed' && props.checks.headDeleted);
  const update = useAction(updateIssue);
  const changeBase = useAction(updatePull);
  const state = () => itemState({ isPull: true, state: props.pull.state, merged: props.pull.merged, draft: props.pull.draft });
  const commits = () => `${formatNumber(props.pull.commits)} commit${props.pull.commits === 1 ? '' : 's'}`;
  return (
    <Loading fallback={<div class="h-[110px]" />}>
      <IssueHeader
        title={props.pull.title}
        number={props.pull.number}
        canEdit={!!ctx.repo().permissions?.push || viewer().login === props.pull.user.login}
        bordered={false}
        locked={props.pull.locked}
        onSave={(title) => update(ctx.owner(), ctx.name(), props.pull.number, { title })}
        actions={
          <Loading>
            <LastDeployment deployments={props.deployments} />
          </Loading>
        }
      >
        <StateBadge state={state()} />
        <span class="flex flex-wrap items-center gap-1">
          <a class="link-muted font-semibold" href={userHref(props.pull.user.login)}>
            {props.pull.user.login}
          </a>
          <Show
            when={props.pull.merged}
            fallback={
              <span>
                {props.pull.state === 'open' ? 'wants to merge' : 'wanted to merge'} {commits()} into
              </span>
            }
          >
            <span>merged {commits()} into</span>
          </Show>
          <Show
            when={props.pull.state === 'open' && (!!ctx.repo().permissions?.push || viewer().login === props.pull.user.login)}
            fallback={<BranchLabel gitRef={props.pull.base} base={props.pull.base} />}
          >
            <SelectPanel
              triggerClass="font-mono text-xs px-1.5 py-0.5 rounded-md bg-accent-muted text-fg-accent hover:underline inline-flex items-center gap-1 border-0 cursor-pointer"
              triggerLabel="Change base branch"
              trigger={
                <>
                  {props.pull.base.ref}
                  <Octicon icon={triangleDownIcon} size={12} />
                </>
              }
              title="Choose a base branch"
              placeholder="Find a branch"
              load={(): Promise<string[]> => {
                // Read before the await so these stay dependencies.
                const head = props.pull.head.repo?.full_name === ctx.fullName() ? props.pull.head.ref : null;
                return getRefNames(ctx.owner(), ctx.name()).then((r: { branches: string[] }) => r.branches.filter((b) => b !== head));
              }}
              key={(b: string) => b}
              text={(b: string) => b}
              render={(b: string) => <span class="font-mono text-xs break-all">{b}</span>}
              selected={[props.pull.base.ref]}
              onApply={(keys) => {
                if (keys[0] && keys[0] !== props.pull.base.ref)
                  changeBase(ctx.owner(), ctx.name(), props.pull.number, { base: keys[0] }).catch(toastError);
              }}
            />
          </Show>
          <span>from</span>
          <BranchLabel gitRef={props.pull.head} base={props.pull.base} deleted={headDeleted()} />
          <CopyButton value={props.pull.head.ref} class="btn-octicon w-6 h-6" label="Copy head branch name to clipboard" />
          <Show when={props.pull.merged && props.pull.merged_at}>
            <RelativeTime datetime={props.pull.merged_at} />
          </Show>
          {/* The first release tag next to the merge time. */}
          <Show when={props.pull.merged}>
            <Loading>
              <Show when={props.firstTag?.tag}>
                {(tag) => (
                  <a class="Label inline-flex items-center gap-1 link-muted" href={`${ctx.base()}/releases/tag/${encodeURIComponent(tag())}`} title={`First released in ${tag()}`}>
                    <Octicon icon={tagIcon} size={12} />
                    {tag()}
                  </a>
                )}
              </Show>
            </Loading>
          </Show>
        </span>
      </IssueHeader>
    </Loading>
  );
}

function DiffStat(props: { additions: number; deletions: number }) {
  // Five boxes, like github.com: green / red share by line count.
  const boxes = () => {
    const total = props.additions + props.deletions;
    if (!total) return ['n', 'n', 'n', 'n', 'n'];
    const add = Math.round((props.additions / total) * 5);
    const del = Math.min(5 - add, Math.round((props.deletions / total) * 5));
    return [...Array(add).fill('a'), ...Array(del).fill('d'), ...Array(5 - add - del).fill('n')];
  };
  return (
    <span class="hidden md:inline-flex items-center gap-1 text-xs font-semibold">
      <span class="text-fg-success">+{formatNumber(props.additions)}</span>
      <span class="text-fg-danger">−{formatNumber(props.deletions)}</span>
      <span class="inline-flex gap-px ml-1">
        <For each={boxes()}>
          {(b) => (
            <span
              class={[
                'inline-block w-2 h-2 rounded-[2px]',
                b === 'a' ? 'bg-success-emphasis' : b === 'd' ? 'bg-danger-emphasis' : 'bg-[var(--bgColor-neutral-muted)] border border-line-muted',
              ]}
            />
          )}
        </For>
      </span>
    </span>
  );
}

const TABS = ['', 'commits', 'checks', 'files'] as const;

function PullTabs(props: { pull: PullRequest; checks: ChecksInfo }) {
  const ctx = useRepo();
  const location = useLocation();
  const navigate = useNavigate();
  const base = () => `${ctx.base()}/pull/${props.pull.number}`;
  const active = () => {
    const rest = location.pathname.slice(base().length).replace(/^\//, '').split('/')[0];
    return rest === 'commits' || rest === 'checks' || rest === 'files' ? rest : '';
  };

  // g ← / g → cycle through the tabs, g 1…g 4 jump to one.
  const goTo = (i: number) => {
    const tab = TABS[(i + TABS.length) % TABS.length];
    navigate(tab ? `${base()}/${tab}` : base());
  };
  const current = () => TABS.indexOf(active() as (typeof TABS)[number]);
  const tabHotkey = { group: 'Pull requests' };
  useHotkey({ ...tabHotkey, keys: 'g ArrowLeft', description: 'Go to previous PR tab', handler: () => goTo(current() - 1) });
  useHotkey({ ...tabHotkey, keys: 'g ArrowRight', description: 'Go to next PR tab', handler: () => goTo(current() + 1) });
  for (const [i, label] of ['Conversation', 'Commits', 'Checks', 'Files changed'].entries())
    useHotkey({ ...tabHotkey, keys: `g ${i + 1}`, description: `Go to PR tab ${i + 1} (${label})`, handler: () => goTo(i) });

  // v opens the review menu (from any tab), focusing its textarea.
  const REVIEW_HASH = '#review-changes-modal';
  const reviewButton = () =>
    [...document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="menu"]')].find((b) => /Review changes|Finish your review/.test(b.textContent ?? ''));
  const focusReviewBox = () => setTimeout(() => document.querySelector<HTMLTextAreaElement>('[aria-label="Submit review"] textarea')?.focus(), 50);
  const openReviewMenu = () => {
    const button = reviewButton();
    if (!button) return false;
    if (button.getAttribute('aria-expanded') !== 'true') button.click();
    focusReviewBox();
    return true;
  };
  useHotkey({
    keys: 'v',
    description: 'Review pull request',
    group: 'Pull requests',
    handler: () => {
      if (active() !== 'files' || !openReviewMenu()) navigate(`${base()}/files${REVIEW_HASH}`);
    },
  });
  // Arriving on Files changed via "review now": open the menu once the diff has loaded.
  createEffect(
    () => (active() === 'files' && location.hash === REVIEW_HASH ? location.pathname : null),
    (path) => {
      if (!path) return;
      const started = Date.now();
      const timer = setInterval(() => {
        if (openReviewMenu() || Date.now() - started > 10_000) clearInterval(timer);
      }, 200);
      return () => clearInterval(timer);
    },
  );
  // Opening the review menu by clicking also focuses its textarea.
  onSettled(() => {
    const onClick = (e: MouseEvent) => {
      if (reviewButton()?.contains(e.target as Node)) focusReviewBox();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  });
  const Tab = (p: { tab: string; icon: OcticonData; label: string; count: () => number | undefined }) => (
    <a
      class={['UnderlineNav-item', { selected: active() === p.tab }]}
      href={p.tab ? `${base()}/${p.tab}` : base()}
      aria-current={active() === p.tab ? 'page' : undefined}
    >
      <Octicon icon={p.icon} class="text-fg-muted" />
      <span>{p.label}</span>
      <Loading>
        <span class="Counter">{formatNumber(p.count())}</span>
      </Loading>
    </a>
  );
  return (
    <nav class="UnderlineNav mb-4 rgh-mobile-tabs-pr" aria-label="Pull request tabs">
      <div class="UnderlineNav-body overflow-x-auto">
        <Tab tab="" icon={commentDiscussionIcon} label="Conversation" count={() => props.pull.comments + props.pull.review_comments} />
        <Tab tab="commits" icon={gitCommitIcon} label="Commits" count={() => props.pull.commits} />
        <Tab tab="checks" icon={checklistIcon} label="Checks" count={() => props.checks.count} />
        <Tab tab="files" icon={fileDiffIcon} label="Files changed" count={() => props.pull.changed_files} />
      </div>
      <div class="flex-1" />
      <DiffStat additions={props.pull.additions} deletions={props.pull.deletions} />
    </nav>
  );
}
