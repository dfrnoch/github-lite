import { useAction } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, For, Match, Show, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Dropdown, Spinner, toast, toastError } from '../../../components/ui';
import type { OcticonData } from '../../../icons/octicons';
import {
  alertFillIcon,
  checkCircleFillIcon,
  checkIcon,
  dotFillIcon,
  gitBranchIcon,
  gitMergeIcon,
  gitPullRequestClosedIcon,
  gitPullRequestDraftIcon,
  skipIcon,
  triangleDownIcon,
  xCircleFillIcon,
  xIcon,
} from '../../../icons/octicons';
import { toAppUrl } from '../../../lib/markdown';
import type { CheckContext, MergeMethod, PullDetail, PullRepoMeta } from '../../issues/types';
import { canPush } from '../../issues/types';
import { deleteBranch, mergePull, restoreBranch, setAutoMerge, setDraft, updatePullBranch } from '../api';

const FAIL = ['FAILURE', 'ERROR', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE'];
const NEUTRAL = ['CANCELLED', 'SKIPPED', 'NEUTRAL', 'STALE'];

/** success | failure | neutral | pending for a check run or commit status. */
export function checkOutcome(c: CheckContext): 'success' | 'failure' | 'neutral' | 'pending' {
  if (c.__typename === 'StatusContext') {
    if (c.state === 'SUCCESS') return 'success';
    if (c.state === 'FAILURE' || c.state === 'ERROR') return 'failure';
    return 'pending';
  }
  if (c.status !== 'COMPLETED') return 'pending';
  if (c.conclusion === 'SUCCESS') return 'success';
  if (FAIL.includes(c.conclusion ?? '')) return 'failure';
  if (NEUTRAL.includes(c.conclusion ?? '')) return 'neutral';
  return 'pending';
}

export function CheckIcon(props: { outcome: ReturnType<typeof checkOutcome> }) {
  return (
    <Switch>
      <Match when={props.outcome === 'success'}>
        <Octicon icon={checkIcon} class="text-fg-success" aria-label="Successful" />
      </Match>
      <Match when={props.outcome === 'failure'}>
        <Octicon icon={xIcon} class="text-fg-danger" aria-label="Failing" />
      </Match>
      <Match when={props.outcome === 'neutral'}>
        <Octicon icon={skipIcon} class="text-fg-muted" aria-label="Skipped or cancelled" />
      </Match>
      <Match when={props.outcome === 'pending'}>
        <Octicon icon={dotFillIcon} class="text-fg-attention" aria-label="Pending" />
      </Match>
    </Switch>
  );
}

/** One row of the merge box: status icon, title, description, optional action. */
function Section(props: { icon: OcticonData; iconClass: string; title: string; children?: JSX.Element; action?: JSX.Element; spinner?: boolean }) {
  return (
    <div class="flex items-start gap-3 px-4 py-3 border-b border-line">
      <span class="mt-0.5 shrink-0 flex">
        <Show when={!props.spinner} fallback={<Spinner size={20} class="text-fg-muted" />}>
          <Octicon icon={props.icon} size={20} class={props.iconClass} />
        </Show>
      </span>
      <div class="flex-1 min-w-0">
        <div class="font-semibold">{props.title}</div>
        <Show when={props.children}>
          <div class="text-xs text-fg-muted mt-0.5">{props.children}</div>
        </Show>
      </div>
      <Show when={props.action}>
        <div class="shrink-0">{props.action}</div>
      </Show>
    </div>
  );
}

const METHOD_LABEL: Record<MergeMethod, { button: string; confirm: string; desc: string }> = {
  MERGE: {
    button: 'Merge pull request',
    confirm: 'Confirm merge',
    desc: 'All commits from this branch will be added to the base branch via a merge commit.',
  },
  SQUASH: {
    button: 'Squash and merge',
    confirm: 'Confirm squash and merge',
    desc: 'The commits from this branch will be combined into one commit in the base branch.',
  },
  REBASE: {
    button: 'Rebase and merge',
    confirm: 'Confirm rebase and merge',
    desc: 'The commits from this branch will be rebased and added to the base branch.',
  },
};

export interface MergeBoxProps {
  owner: string;
  repo: string;
  pull: PullDetail;
  meta: PullRepoMeta;
  /** Signed-in user's avatar (shown on the merge form). */
  viewerAvatar?: string;
}

/** The merge box at the bottom of a PR conversation. */
export default function MergeBox(props: MergeBoxProps) {
  const headRepo = () => props.pull.headRepository?.nameWithOwner ?? `${props.owner}/${props.repo}`;
  const push = () => canPush(props.meta.viewerPermission);
  const badge = () => {
    if (props.pull.merged) return { icon: gitMergeIcon, class: 'bg-done-emphasis' };
    if (props.pull.state === 'CLOSED') return { icon: gitPullRequestClosedIcon, class: 'bg-closed-emphasis' };
    if (props.pull.isDraft) return { icon: gitPullRequestDraftIcon, class: 'bg-neutral-emphasis' };
    const ok = ['CLEAN', 'HAS_HOOKS', 'UNSTABLE'].includes(props.pull.mergeStateStatus);
    return { icon: gitMergeIcon, class: ok ? 'bg-success-emphasis' : 'bg-neutral-emphasis' };
  };

  return (
    <div class="relative pl-14 pb-4" id="partial-pull-merging">
      <div class={['absolute left-0 top-0 w-10 h-10 rounded-md flex items-center justify-center text-fg-on-emphasis', badge().class]}>
        <Octicon icon={badge().icon} size={24} />
      </div>
      <div class="Box timeline-comment--caret overflow-visible">
        <Switch>
          <Match when={props.pull.merged}>
            <BranchFooter {...props} headRepo={headRepo()} title="Pull request successfully merged and closed" icon={gitMergeIcon} iconClass="text-fg-done" />
          </Match>
          <Match when={props.pull.state === 'CLOSED'}>
            <BranchFooter
              {...props}
              headRepo={headRepo()}
              title="Closed with unmerged commits"
              icon={gitPullRequestClosedIcon}
              iconClass="text-fg-closed"
            />
          </Match>
          <Match when={true}>
            <OpenBox {...props} push={push()} />
          </Match>
        </Switch>
      </div>
    </div>
  );
}

/** Merged / closed: offer to delete (or restore) the head branch. */
function BranchFooter(props: MergeBoxProps & { headRepo: string; title: string; icon: OcticonData; iconClass: string }) {
  const del = useAction(deleteBranch);
  const restore = useAction(restoreBranch);
  const [busy, setBusy] = createSignal(false);
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast(done, 'success');
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  const head = () => props.pull.headRefName;
  return (
    <div class="flex items-center gap-3 px-4 py-3">
      <Octicon icon={props.icon} size={20} class={props.iconClass} />
      <div class="flex-1 min-w-0">
        <div class="font-semibold">{props.title}</div>
        <div class="text-xs text-fg-muted mt-0.5">
          <Show
            when={props.pull.headRef}
            fallback={
              <>
                The <code class="font-mono">{head()}</code> branch has been deleted.
              </>
            }
          >
            <Show
              when={props.pull.merged}
              fallback={
                <>
                  This pull request is closed, but the <code class="font-mono">{head()}</code> branch has unmerged commits.
                </>
              }
            >
              You’re all set — the <code class="font-mono">{head()}</code> branch can be safely deleted.
            </Show>
          </Show>
        </div>
      </div>
      <Show
        when={props.pull.headRef}
        fallback={
          <Show when={props.pull.headRepository && canPush(props.meta.viewerPermission)}>
            <button
              type="button"
              class="btn btn-sm"
              disabled={busy()}
              onClick={() => run(() => restore(props.headRepo, head(), props.pull.headRefOid), 'Branch restored')}
            >
              <Octicon icon={gitBranchIcon} /> Restore branch
            </button>
          </Show>
        }
      >
        <Show when={props.pull.viewerCanDeleteHeadRef}>
          <button type="button" class="btn btn-sm" disabled={busy()} onClick={() => run(() => del(props.headRepo, head()), 'Branch deleted')}>
            Delete branch
          </button>
        </Show>
      </Show>
    </div>
  );
}

function ChecksSection(props: { pull: PullDetail; owner: string; repo: string }) {
  const rollup = () => props.pull.commits.nodes[0]?.commit.statusCheckRollup ?? null;
  const contexts = () => rollup()?.contexts.nodes ?? [];
  const [open, setOpen] = createSignal(() => rollup()?.state !== 'SUCCESS');
  const counts = createMemo(() => {
    const c = { success: 0, failure: 0, neutral: 0, pending: 0 };
    for (const ctx of contexts()) c[checkOutcome(ctx)]++;
    return c;
  });
  const summary = () => {
    const c = counts();
    const parts = [
      c.failure && `${c.failure} failing`,
      c.pending && `${c.pending} in progress`,
      c.neutral && `${c.neutral} skipped`,
      c.success && `${c.success} successful`,
    ].filter(Boolean);
    return `${parts.join(', ')} check${contexts().length === 1 ? '' : 's'}`;
  };
  const look = () => {
    switch (rollup()?.state) {
      case 'SUCCESS':
        return { icon: checkCircleFillIcon, class: 'text-fg-success', title: 'All checks have passed' };
      case 'FAILURE':
      case 'ERROR':
        return { icon: xCircleFillIcon, class: 'text-fg-danger', title: 'Some checks were not successful' };
      default:
        return { icon: dotFillIcon, class: 'text-fg-attention', title: 'Some checks haven’t completed yet' };
    }
  };
  return (
    <Show when={rollup()}>
      <Section
        icon={look().icon}
        iconClass={look().class}
        title={look().title}
        action={
          <button type="button" class="btn-link text-xs" onClick={() => setOpen(!open())}>
            {open() ? 'Hide all checks' : 'Show all checks'}
          </button>
        }
      >
        {summary()}
      </Section>
      <Show when={open()}>
        <div class="max-h-[340px] overflow-auto border-b border-line bg-canvas-muted">
          <For each={contexts()}>
            {(c) => (
              <div class="flex items-center gap-2 px-4 py-2 text-xs border-b border-line-muted last:border-b-0">
                <CheckIcon outcome={checkOutcome(c)} />
                <Show when={c.checkSuite?.app?.logoUrl ?? c.avatarUrl}>
                  {(src) => <Avatar src={src()} size={20} square />}
                </Show>
                <span class="min-w-0 flex-1 truncate">
                  <strong class="text-fg">
                    {c.__typename === 'CheckRun' ? (c.checkSuite?.workflowRun ? `${c.checkSuite.workflowRun.workflow.name} / ${c.name}` : c.name) : c.context}
                  </strong>
                  <span class="text-fg-muted">
                    {' '}
                    {c.__typename === 'CheckRun'
                      ? c.title ?? (c.status === 'COMPLETED' ? (c.conclusion ?? '').toLowerCase() : c.status?.toLowerCase().replace(/_/g, ' '))
                      : c.description}
                  </span>
                </span>
                <Show when={c.isRequired}>
                  <span class="Label">Required</span>
                </Show>
                <Show when={c.detailsUrl ?? c.targetUrl}>
                  {(url) => (
                    <a class="font-semibold" href={toAppUrl(url())}>
                      Details
                    </a>
                  )}
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </Show>
  );
}

function OpenBox(props: MergeBoxProps & { push: boolean }) {
  const draft = useAction(setDraft);
  const update = useAction(updatePullBranch);
  const [busy, setBusy] = createSignal(false);
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try {
      await fn();
      if (done) toast(done, 'success');
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  const state = () => props.pull.mergeStateStatus;
  const reviewCount = (s: string) => props.pull.latestOpinionatedReviews.nodes.filter((r) => r.state === s).length;

  return (
    <>
      <Show when={!props.pull.isDraft && props.pull.reviewDecision}>
        {(d) => (
          <Switch>
            <Match when={d() === 'APPROVED'}>
              <Section icon={checkCircleFillIcon} iconClass="text-fg-success" title="Changes approved">
                {reviewCount('APPROVED')} approving review{reviewCount('APPROVED') === 1 ? '' : 's'} by reviewers with write access.
              </Section>
            </Match>
            <Match when={d() === 'CHANGES_REQUESTED'}>
              <Section icon={xCircleFillIcon} iconClass="text-fg-danger" title="Changes requested">
                {reviewCount('CHANGES_REQUESTED')} review{reviewCount('CHANGES_REQUESTED') === 1 ? '' : 's'} requesting changes by reviewers with write
                access.
              </Section>
            </Match>
            <Match when={d() === 'REVIEW_REQUIRED'}>
              <Section icon={alertFillIcon} iconClass="text-fg-danger" title="Review required">
                At least 1 approving review is required by reviewers with write access.
              </Section>
            </Match>
          </Switch>
        )}
      </Show>

      <ChecksSection pull={props.pull} owner={props.owner} repo={props.repo} />

      <Show
        when={!props.pull.isDraft}
        fallback={
          <Section
            icon={gitPullRequestDraftIcon}
            iconClass="text-fg-muted"
            title="This pull request is still a work in progress"
            action={
              <Show when={props.pull.viewerCanUpdate}>
                <button type="button" class="btn btn-sm" disabled={busy()} onClick={() => run(() => draft(props.pull.id, false))}>
                  Ready for review
                </button>
              </Show>
            }
          >
            Draft pull requests cannot be merged.
          </Section>
        }
      >
        <Switch>
          <Match when={props.pull.mergeable === 'CONFLICTING' || state() === 'DIRTY'}>
            <Section icon={alertFillIcon} iconClass="text-fg-danger" title="This branch has conflicts that must be resolved">
              Use the command line to resolve conflicts before continuing.
            </Section>
          </Match>
          <Match when={state() === 'UNKNOWN' || props.pull.mergeable === 'UNKNOWN'}>
            <Section icon={dotFillIcon} iconClass="" spinner title="Checking for the ability to merge automatically…">
              Hang in there while we check the branch’s status.
            </Section>
          </Match>
          <Match when={state() === 'BEHIND'}>
            <Section
              icon={alertFillIcon}
              iconClass="text-fg-attention"
              title="This branch is out-of-date with the base branch"
              action={
                <Show when={props.pull.viewerCanUpdateBranch}>
                  <button
                    type="button"
                    class="btn btn-sm"
                    disabled={busy()}
                    onClick={() => run(() => update(props.owner, props.repo, props.pull.number, props.pull.headRefOid), 'Updating branch…')}
                  >
                    Update branch
                  </button>
                </Show>
              }
            >
              Merge the latest changes from <code class="font-mono">{props.pull.baseRefName}</code> into this branch.
            </Section>
          </Match>
          <Match when={state() === 'BLOCKED'}>
            <Section icon={xCircleFillIcon} iconClass="text-fg-danger" title="Merging is blocked">
              The base branch requires all requirements to be met before merging.
            </Section>
          </Match>
          <Match when={true}>
            <Section icon={checkCircleFillIcon} iconClass="text-fg-success" title="No conflicts with base branch">
              Merging can be performed automatically.
            </Section>
          </Match>
        </Switch>
      </Show>

      <div class="px-4 py-3">
        <Show
          when={props.push}
          fallback={<p class="text-xs text-fg-muted">Only those with write access to this repository can merge pull requests.</p>}
        >
          <Show when={!props.pull.isDraft} fallback={<p class="text-xs text-fg-muted">Mark this pull request as ready for review to merge it.</p>}>
            <MergeControls {...props} />
          </Show>
        </Show>
      </div>
    </>
  );
}

function MergeControls(props: MergeBoxProps) {
  const merge = useAction(mergePull);
  const auto = useAction(setAutoMerge);
  const allowed = () =>
    (['MERGE', 'SQUASH', 'REBASE'] as MergeMethod[]).filter((m) =>
      m === 'MERGE' ? props.meta.mergeCommitAllowed : m === 'SQUASH' ? props.meta.squashMergeAllowed : props.meta.rebaseMergeAllowed,
    );
  const [method, setMethod] = createSignal<MergeMethod>(() =>
    allowed().includes(props.meta.viewerDefaultMergeMethod) ? props.meta.viewerDefaultMergeMethod : (allowed()[0] ?? 'MERGE'),
  );
  const [confirming, setConfirming] = createSignal(false);
  const [bypass, setBypass] = createSignal(false);
  const [busy, setBusy] = createSignal(false);

  const defaultTitle = () => {
    const p = props.pull;
    if (method() === 'SQUASH' || props.meta.mergeCommitTitle === 'PR_TITLE') return `${p.title} (#${p.number})`;
    return `Merge pull request #${p.number} from ${p.headRepositoryOwner?.login ?? props.owner}/${p.headRefName}`;
  };
  const defaultMessage = () => {
    const setting = method() === 'SQUASH' ? props.meta.squashMergeCommitMessage : props.meta.mergeCommitMessage;
    if (setting === 'PR_BODY') return props.pull.body;
    if (setting === 'PR_TITLE') return props.pull.title;
    return '';
  };
  // Edited values (null = use the default, which is also what GitHub would pick).
  const [title, setTitle] = createSignal<string | null>(null);
  const [message, setMessage] = createSignal<string | null>(null);

  const state = () => props.pull.mergeStateStatus;
  const blocked = () => state() === 'BLOCKED' || state() === 'DIRTY' || props.pull.mergeable === 'CONFLICTING' || state() === 'UNKNOWN';
  const canMerge = () => !blocked() || (bypass() && state() === 'BLOCKED');
  const green = () => ['CLEAN', 'HAS_HOOKS'].includes(state()) || (bypass() && state() === 'BLOCKED');

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await merge(props.owner, props.repo, props.pull.number, {
        method: method(),
        sha: props.pull.headRefOid,
        title: method() === 'REBASE' ? undefined : (title() ?? undefined),
        message: method() === 'REBASE' ? undefined : (message() ?? undefined),
      });
      setConfirming(false);
      toast('Pull request successfully merged', 'success');
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const toggleAuto = async () => {
    setBusy(true);
    try {
      await auto(props.pull.id, props.pull.autoMergeRequest ? null : method());
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Show
      when={confirming()}
      fallback={
        <div class="flex flex-col gap-3">
          <Show when={props.pull.autoMergeRequest}>
            {(a) => (
              <div class="flex items-center gap-2 text-sm">
                <Octicon icon={gitMergeIcon} class="text-fg-success" />
                <span class="flex-1">
                  Auto-merge ({a().mergeMethod.toLowerCase()}) enabled by <strong>{a().enabledBy?.login}</strong> — this pull request will be merged
                  automatically when all requirements are met.
                </span>
                <Show when={props.pull.viewerCanDisableAutoMerge}>
                  <button type="button" class="btn btn-sm" disabled={busy()} onClick={toggleAuto}>
                    Disable auto-merge
                  </button>
                </Show>
              </div>
            )}
          </Show>
          <Show when={state() === 'BLOCKED' && props.pull.viewerCanMergeAsAdmin}>
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={bypass()} onChange={(e) => setBypass(e.currentTarget.checked)} />
              Merge without waiting for requirements to be met (bypass rules)
            </label>
          </Show>
          <div class="flex flex-wrap items-center gap-2">
            <Show when={allowed().length} fallback={<p class="text-xs text-fg-muted">Merging is disabled in this repository’s settings.</p>}>
              <div class="BtnGroup">
                <button
                  type="button"
                  class={['btn', { 'btn-primary': green() }]}
                  disabled={!canMerge()}
                  onClick={() => {
                    setTitle(null);
                    setMessage(null);
                    setConfirming(true);
                  }}
                >
                  {METHOD_LABEL[method()].button}
                </button>
                <Dropdown
                  class={green() ? 'btn btn-primary px-2!' : 'btn px-2!'}
                  align="left"
                  menuClass="w-96"
                  title="Select merge method"
                  disabled={!canMerge()}
                  button={<Octicon icon={triangleDownIcon} />}
                >
                  {(close) => (
                    <For each={allowed()}>
                      {(m) => (
                        <button
                          type="button"
                          class="SelectMenu-item items-start!"
                          onClick={() => {
                            setMethod(m);
                            close();
                          }}
                        >
                          <span class="w-4 mt-0.5">
                            <Show when={method() === m}>
                              <Octicon icon={checkIcon} />
                            </Show>
                          </span>
                          <span>
                            <span class="block font-semibold">{METHOD_LABEL[m].button}</span>
                            <span class="block text-xs text-fg-muted font-normal whitespace-normal">{METHOD_LABEL[m].desc}</span>
                          </span>
                        </button>
                      )}
                    </For>
                  )}
                </Dropdown>
              </div>
            </Show>
            <Show when={!props.pull.autoMergeRequest && props.pull.viewerCanEnableAutoMerge && props.meta.autoMergeAllowed && blocked()}>
              <button type="button" class="btn" disabled={busy()} onClick={toggleAuto}>
                Enable auto-merge
              </button>
            </Show>
            <span class="text-xs text-fg-muted">
              You can also merge this with the command line.
            </span>
          </div>
        </div>
      }
    >
      <form onSubmit={submit} class="flex gap-3">
        <Avatar src={props.viewerAvatar} size={40} class="shrink-0 hidden sm:block self-start" />
        <div class="flex-1 min-w-0">
          <Show when={method() !== 'REBASE'}>
            <input
              class="form-control w-full font-semibold mb-2"
              aria-label="Commit title"
              value={title() ?? defaultTitle()}
              onInput={(e) => setTitle(e.currentTarget.value)}
            />
            <textarea
              class="form-control w-full min-h-[120px]"
              aria-label="Commit message"
              placeholder={method() === 'SQUASH' && props.meta.squashMergeCommitMessage === 'COMMIT_MESSAGES' ? 'Defaults to the list of commit messages' : 'Add an optional extended description…'}
              value={message() ?? defaultMessage()}
              onInput={(e) => setMessage(e.currentTarget.value)}
            />
          </Show>
          <div class="flex items-center gap-2 mt-2">
            <button type="submit" class="btn btn-primary" disabled={busy()}>
              {busy() ? 'Merging…' : METHOD_LABEL[method()].confirm}
            </button>
            <button type="button" class="btn" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </Show>
  );
}

