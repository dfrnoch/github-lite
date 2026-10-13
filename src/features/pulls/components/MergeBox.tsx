import { useAction } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, Match, Show, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Dropdown, toast, toastError } from '../../../components/ui';
import PrBaseCommit from '../../code/components/PrBaseCommit';
import { feature, featureOption } from '../../refined';
import { avoidAccidentalSubmissions, fitTextarea, monospaceField, oneKeyFormatting, tabToIndent } from '../../refined/editor';
import { useRepo } from '../../repo/context';
import {
  alertIcon,
  checkIcon,
  gitBranchIcon,
  gitMergeIcon,
  gitPullRequestClosedIcon,
  gitPullRequestDraftIcon,
  triangleDownIcon,
  xIcon,
} from '../../../icons/octicons';
import type { MergeMethod, PullDetail, PullRepoMeta } from '../../issues/types';
import { canPush } from '../../issues/types';
import {
  countPullsBasedOn,
  deleteBranch,
  getPullBranchUpdatable,
  getPullCommitMessages,
  mergePull,
  restoreBranch,
  setAutoMerge,
  setDraft,
  updatePull,
  updatePullBranch,
} from '../api';
import { cleanCommitMessage, cleanPrCommitTitle, DEFAULT_BRANCH_EXCEPTIONS, defaultSquashMessage, matchesBranchPattern } from '../refined';
import CommandLineInstructions from './CommandLineInstructions';
import MergeChecks, { checkOutcome } from './MergeChecks';
import MergeConflicts from './MergeConflicts';
import MergeReviews from './MergeReviews';
import { MergeSection, StatusCircle, TONE_BG, type Tone } from './MergeSection';


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
  viewerLogin?: string;
  /** Put text into the "Add a comment" box (quick-resolve-conflicts' Copilot button). */
  onInsertComment?: (text: string) => void;
}

const isConflicting = (p: PullDetail) => p.mergeable === 'CONFLICTING' || p.mergeStateStatus === 'DIRTY';

/**
 * The merge box at the bottom of a PR conversation (github.com's current
 * design): a status badge in the avatar column, and a box whose caret points
 * at it with reviews / checks / mergeability sections and the merge footer.
 */
export default function MergeBox(props: MergeBoxProps) {
  const headRepo = () => props.pull.headRepository?.nameWithOwner ?? `${props.owner}/${props.repo}`;
  const push = () => canPush(props.meta.viewerPermission);
  const draft = useAction(setDraft);
  const [converting, setConverting] = createSignal(false);
  const badge = (): { icon: typeof gitMergeIcon; tone: Tone } => {
    if (props.pull.merged) return { icon: gitMergeIcon, tone: 'done' };
    if (props.pull.state === 'CLOSED') return { icon: gitPullRequestClosedIcon, tone: 'closed' };
    if (props.pull.isDraft) return { icon: gitPullRequestDraftIcon, tone: 'neutral' };
    const ok = ['CLEAN', 'HAS_HOOKS', 'UNSTABLE'].includes(props.pull.mergeStateStatus) && !isConflicting(props.pull);
    return { icon: gitMergeIcon, tone: ok ? 'success' : 'neutral' };
  };
  const toDraft = async () => {
    setConverting(true);
    try {
      await draft(props.pull.id, true);
    } catch (e) {
      toastError(e);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div class="pb-4" id="partial-pull-merging">
      <div class="MergeBox">
        <div class={['MergeBox-badge', TONE_BG[badge().tone]]} aria-hidden="true">
          <Octicon icon={badge().icon} size={24} />
        </div>
        <div class={['MergeBox-box', { 'MergeBox-box--merged': props.pull.merged }]}>
          <Switch>
            <Match when={props.pull.merged}>
              <BranchSection {...props} headRepo={headRepo()} title="Pull request successfully merged and closed" icon={gitMergeIcon} tone="done" />
            </Match>
            <Match when={props.pull.state === 'CLOSED'}>
              <BranchSection {...props} headRepo={headRepo()} title="Closed with unmerged commits" icon={gitPullRequestClosedIcon} tone="closed" />
            </Match>
            <Match when={true}>
              <OpenBox {...props} push={push()} />
            </Match>
          </Switch>
        </div>
      </div>
      <Show when={props.pull.state === 'OPEN' && !props.pull.isDraft && props.pull.viewerCanUpdate}>
        <div class="text-right text-xs text-fg-muted mt-2">
          Still in progress?{' '}
          <button type="button" class="btn-link text-xs" disabled={converting()} onClick={toDraft}>
            {converting() ? 'Converting…' : 'Convert to draft'}
          </button>
        </div>
      </Show>
    </div>
  );
}

/** Merged / closed: offer to delete (or restore) the head branch. */
function BranchSection(props: MergeBoxProps & { headRepo: string; title: string; icon: typeof gitMergeIcon; tone: Tone }) {
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
    <MergeSection
      icon={<StatusCircle tone={props.tone} icon={props.icon} />}
      title={props.title}
      desc={
        <Show
          when={props.pull.headRef}
          fallback={
            <>
              The{' '}
              <code
                class="font-mono rgh-deleted-branch"
                title="This branch has been deleted"
              >
                {head()}
              </code>{' '}
              branch has been deleted.
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
      }
      action={
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
      }
    />
  );
}

function OpenBox(props: MergeBoxProps & { push: boolean }) {
  const draft = useAction(setDraft);
  const updateBranch = useAction(updatePullBranch);
  const [busy, setBusy] = createSignal(false);
  const [cli, setCli] = createSignal(false);
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
  const conflicting = () => isConflicting(props.pull);
  const showCli = () => {
    setCli(true);
    requestAnimationFrame(() => document.getElementById('merge-cli')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };

  // "Update branch | Rebase" whenever the branch is behind its base and you
  // can push to it — GitHub (and viewerCanUpdateBranch) only offer it when branch protection requires it.
  const updatable = createMemo(
    () =>
      props.pull.state === 'OPEN' && props.pull.headRef
        ? getPullBranchUpdatable(
            props.owner,
            props.repo,
            props.pull.number,
            props.pull.isCrossRepository ? `${props.owner}:${props.pull.baseRefName}` : props.pull.baseRefName,
          ).catch(() => false)
        : false,
    { name: 'mergeUpdatable' },
  );
  const updateButtons = () => (
    <div class="BtnGroup">
      <button
        type="button"
        class="btn btn-sm"
        title="Update branch with a merge commit"
        disabled={busy()}
        onClick={() => run(() => updateBranch(props.pull.id, props.pull.headRefOid, 'MERGE'), 'Updating branch…')}
      >
        Update branch
      </button>
      <button
        type="button"
        class="btn btn-sm"
        title="Update branch by rebasing it on the base branch"
        disabled={busy()}
        onClick={() => run(() => updateBranch(props.pull.id, props.pull.headRefOid, 'REBASE'), 'Rebasing branch…')}
      >
        Rebase
      </button>
    </div>
  );
  const updateAction = () => (
    <Loading>
      <Show when={updatable()}>{updateButtons()}</Show>
    </Loading>
  );

  /** Why a BLOCKED pull request can't be merged yet. */
  const blockedReason = () => {
    const rollup = props.pull.commits.nodes[0]?.commit.statusCheckRollup;
    const failingRequired = rollup?.contexts.nodes.some((c) => c.isRequired && checkOutcome(c) !== 'success' && checkOutcome(c) !== 'neutral');
    if (props.pull.reviewDecision === 'REVIEW_REQUIRED') return 'At least 1 approving review is required by reviewers with write access.';
    if (props.pull.reviewDecision === 'CHANGES_REQUESTED') return 'Changes were requested by reviewers with write access.';
    if (failingRequired) return 'Required status checks have not succeeded yet.';
    return 'The base branch requires all requirements to be met before merging.';
  };

  const conflictsSection = () => (
    <MergeConflicts owner={props.owner} repo={props.repo} pull={props.pull} onCommandLine={showCli} onInsertComment={props.onInsertComment} />
  );

  return (
    <>
      <Show when={!props.pull.isDraft}>
        <MergeReviews pull={props.pull} owner={props.owner} />
      </Show>

      <MergeChecks pull={props.pull} owner={props.owner} repo={props.repo} conflicting={conflicting()} canPush={props.push} />

      <Show
        when={!props.pull.isDraft}
        fallback={
          <>
            <MergeSection
              icon={<StatusCircle tone="neutral" icon={gitPullRequestDraftIcon} />}
              title="This pull request is still a work in progress"
              desc="Draft pull requests cannot be merged."
              action={
                <Show when={props.pull.viewerCanUpdate}>
                  <button type="button" class="btn btn-sm" disabled={busy()} onClick={() => run(() => draft(props.pull.id, false))}>
                    Ready for review
                  </button>
                </Show>
              }
            />
            <Show when={conflicting()}>{conflictsSection()}</Show>
          </>
        }
      >
        <Switch>
          <Match when={conflicting()}>{conflictsSection()}</Match>
          <Match when={state() === 'UNKNOWN' || props.pull.mergeable === 'UNKNOWN'}>
            <MergeSection
              icon={<StatusCircle tone="neutral" icon={alertIcon} spinner />}
              title="Checking for the ability to merge automatically…"
              desc="Hang in there while we check the branch’s status."
            />
          </Match>
          <Match when={state() === 'BEHIND'}>
            <MergeSection
              icon={<StatusCircle tone="neutral" icon={alertIcon} />}
              title="This branch is out-of-date with the base branch"
              desc={
                <>
                  Merge the latest changes from <code class="font-mono">{props.pull.baseRefName}</code> into this branch.
                </>
              }
              action={
                <Show when={props.pull.viewerCanUpdateBranch}>
                  {updateButtons()}
                </Show>
              }
            />
          </Match>
          <Match when={true}>
            <MergeSection
              icon={<StatusCircle tone="success" icon={checkIcon} />}
              title="This branch has no conflicts with the base branch"
              desc={
                <>
                  <PrBaseCommit owner={props.owner} repo={props.repo} baseRef={props.pull.baseRefName} baseRefOid={props.pull.baseRefOid} headSha={props.pull.headRefOid} />
                  Merging can be performed automatically.
                </>
              }
              action={updateAction()}
            />
          </Match>
        </Switch>
        <Show when={state() === 'BLOCKED' && !conflicting()}>
          <MergeSection icon={<StatusCircle tone="danger" icon={xIcon} />} title="Merging is blocked" desc={blockedReason()} />
        </Show>
      </Show>

      <div class="MergeBox-footer">
        <Show
          when={props.push}
          fallback={<p class="text-xs text-fg-muted">Only those with write access to this repository can merge pull requests.</p>}
        >
          <Show when={!props.pull.isDraft} fallback={<p class="text-xs text-fg-muted">Mark this pull request as ready for review to merge it.</p>}>
            <MergeControls {...props} cliOpen={cli()} onCommandLine={() => (cli() ? setCli(false) : showCli())} />
          </Show>
        </Show>
        <Show when={cli()}>
          <div id="merge-cli">
            <CommandLineInstructions owner={props.owner} repo={props.repo} pull={props.pull} conflicting={conflicting()} />
          </div>
        </Show>
      </div>
    </>
  );
}

function MergeControls(props: MergeBoxProps & { cliOpen: boolean; onCommandLine: () => void }) {
  const repoCtx = useRepo();
  const merge = useAction(mergePull);
  const auto = useAction(setAutoMerge);
  const renamePull = useAction(updatePull);
  const del = useAction(deleteBranch);
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

  // clear-pr-merge-commit-message: squash messages keep only co-author / sign-off trailers
  // (not for 1-commit PRs, whose message is usually meaningful).
  const clearMessage = () => method() === 'SQUASH' && feature('clear-pr-merge-commit-message') && props.pull.commits.totalCount > 1;
  const squashMessages = () => {
    // Read reactive values before the await so a memo tracks them.
    const opts = { setting: props.meta.squashMergeCommitMessage, body: props.pull.body, title: props.pull.title, prAuthor: props.pull.author?.login ?? null };
    const closingKeywords = props.pull.baseRefName !== repoCtx.repo().default_branch;
    return getPullCommitMessages(props.owner, props.repo, props.pull.number).then((commits) => {
      const original = defaultSquashMessage(commits, opts);
      const cleaned = cleanCommitMessage(original, closingKeywords, opts.prAuthor ? [opts.prAuthor] : []);
      return { original, cleaned: cleaned ? `${cleaned}\n` : '' };
    });
  };
  const squash = createMemo(() => (confirming() && clearMessage() ? squashMessages() : null));

  // sync-pr-commit-title: an edited squash title also becomes the PR title.
  const [syncCancelled, setSyncCancelled] = createSignal(false);
  const syncTitle = () => {
    const t = title()?.trim();
    return method() === 'SQUASH' && feature('sync-pr-commit-title') && !syncCancelled() && !!t && t !== defaultTitle();
  };

  /** pr-branch-auto-delete: delete the head branch right after merging, like the repo setting would. */
  const autoDeleteBranch = async () => {
    const branch = props.pull.headRefName;
    const headRepo = props.pull.headRepository?.nameWithOwner;
    if (!headRepo || props.meta.deleteBranchOnMerge) return;
    if (matchesBranchPattern(branch, featureOption<string>('pr-branch-auto-delete', 'exceptions') ?? DEFAULT_BRANCH_EXCEPTIONS)) return;
    const mayDelete = props.pull.isCrossRepository ? props.pull.headRepositoryOwner?.login === props.viewerLogin : canPush(props.meta.viewerPermission);
    if (!mayDelete) return;
    const [headOwner, headName] = headRepo.split('/') as [string, string];
    try {
      // Deleting a branch that other open PRs are based on would close them.
      if ((await countPullsBasedOn(headOwner, headName, branch)) > 0) return;
      await del(headRepo, branch);
      toast(`Deleted branch ${branch} (pr-branch-auto-delete)`, 'success');
    } catch (err) {
      toastError(err);
    }
  };

  const state = () => props.pull.mergeStateStatus;
  const blocked = () => state() === 'BLOCKED' || state() === 'DIRTY' || props.pull.mergeable === 'CONFLICTING' || state() === 'UNKNOWN';
  const canMerge = () => !blocked() || (bypass() && state() === 'BLOCKED');
  const green = () => ['CLEAN', 'HAS_HOOKS'].includes(state()) || (bypass() && state() === 'BLOCKED');

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      let msg = method() === 'REBASE' ? undefined : (message() ?? undefined);
      if (msg === undefined && clearMessage()) msg = (await squashMessages()).cleaned;
      if (syncTitle()) await renamePull(props.owner, props.repo, props.pull.number, { title: cleanPrCommitTitle(title()!.trim(), props.pull.number) });
      await merge(props.owner, props.repo, props.pull.number, {
        method: method(),
        sha: props.pull.headRefOid,
        title: method() === 'REBASE' ? undefined : (title() ?? undefined),
        message: msg,
      });
      setConfirming(false);
      toast('Pull request successfully merged', 'success');
      if (feature('pr-branch-auto-delete')) void autoDeleteBranch();
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
              You can also merge this with the command line.{' '}
              <button type="button" class="btn-link text-xs" aria-expanded={props.cliOpen ? 'true' : 'false'} onClick={() => props.onCommandLine()}>
                {props.cliOpen ? 'Hide command line instructions.' : 'View command line instructions.'}
              </button>
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
              ref={[oneKeyFormatting, monospaceField, avoidAccidentalSubmissions]}
              class="form-control w-full font-semibold mb-2"
              aria-label="Commit title"
              value={title() ?? defaultTitle()}
              onInput={(e) => setTitle(e.currentTarget.value)}
            />
            <Show when={syncTitle()}>
              <p class="note mt-0! mb-2">
                The title of this PR will be updated to match this title.{' '}
                <button type="button" class="btn-link text-xs underline" onClick={() => setSyncCancelled(true)}>
                  Cancel
                </button>
              </p>
            </Show>
            <Loading fallback={<textarea class="form-control w-full min-h-[120px]" aria-label="Commit message" disabled />}>
              <textarea
                ref={[tabToIndent, oneKeyFormatting, fitTextarea, monospaceField]}
                class="form-control w-full min-h-[120px]"
                aria-label="Commit message"
                placeholder={method() === 'SQUASH' && props.meta.squashMergeCommitMessage === 'COMMIT_MESSAGES' ? 'Defaults to the list of commit messages' : 'Add an optional extended description…'}
                value={message() ?? squash()?.cleaned ?? defaultMessage()}
                onInput={(e) => setMessage(e.currentTarget.value)}
              />
              <Show when={squash() && squash()!.cleaned.trim() !== squash()!.original.trim() && squash()}>
                {(sq) => (
                  <p class="note mt-1!">
                    The description field was{' '}
                    <a href="https://github.com/refined-github/refined-github/wiki/Extended-feature-descriptions#clear-pr-merge-commit-message" target="_blank" rel="noreferrer">
                      cleared
                    </a>{' '}
                    by Refined GitHub.{' '}
                    <button
                      type="button"
                      class="btn-link text-xs"
                      onClick={() => setMessage(message() === sq().original ? sq().cleaned : sq().original)}
                    >
                      {message() === sq().original ? 'Redo' : 'Undo'}
                    </button>
                  </p>
                )}
              </Show>
            </Loading>
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

