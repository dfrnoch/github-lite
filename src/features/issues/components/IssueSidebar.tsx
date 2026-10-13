import { useAction, useNavigate } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Dialog, IssueLabel, itemState, StateIcon, toastError } from '../../../components/ui';
import { hexToVars } from '../../../components/ui/IssueLabel';
import {
  arrowRightIcon,
  bellIcon,
  bellSlashIcon,
  gearIcon,
  gitBranchIcon,
  lockIcon,
  pinIcon,
  trashIcon,
  unlockIcon,
  xIcon,
} from '../../../icons/octicons';
import { feature } from '../../refined';
import { getViewer } from '../../user/api';
import {
  deleteIssue,
  getAssignableUsers,
  getMilestones,
  getRepoLabels,
  removeLabel,
  setLocked,
  setPinned,
  setSubscription,
  transferIssue,
  updateIssue,
  type IssuePatch,
  type ProjectItem,
} from '../api';
import type { IssueBase, LinkedPull, ViewerPermission } from '../types';
import { canTriage } from '../types';
import { RichText } from '../refined';
import { userHref } from './Comment';
import SelectPanel from './SelectPanel';

/** A sidebar block: heading (or picker trigger) and content. */
export function SidebarSection(props: {
  title: string;
  /** Picker shown instead of the plain heading when `canEdit`. */
  picker?: JSX.Element;
  canEdit?: boolean;
  children: JSX.Element;
  last?: boolean;
  /**
   * The section has nothing to show (clean-conversation-sidebar hides it, or
   * just its "None yet" text when it can be edited).
   */
  empty?: boolean;
  /** Hide the heading too when not editable (clean-conversation-sidebar, labels). */
  bare?: boolean;
}) {
  const clean = () => feature('clean-conversation-sidebar');
  const editable = () => !!(props.canEdit && props.picker);
  return (
    <Show when={!(clean() && props.empty && !editable())}>
      <div class={['py-4', { 'border-b border-line-muted': !props.last, 'rgh-clean-sidebar pb-2!': clean() && !!props.empty }]}>
        <Show
          when={editable()}
          fallback={
            <Show when={!(clean() && props.bare)}>
              <h3 class="text-xs font-semibold text-fg-muted mb-2">{props.title}</h3>
            </Show>
          }
        >
          {props.picker}
        </Show>
        <Show when={!(clean() && props.empty)}>
          <div class="text-xs">{props.children}</div>
        </Show>
      </div>
    </Show>
  );
}

/** Heading-styled trigger for a sidebar picker ("Labels ⚙"). */
export const pickerTrigger = (title: string) => (
  <>
    <span class="flex-1 text-left">{title}</span>
    <Octicon icon={gearIcon} />
  </>
);
export const PICKER_TRIGGER_CLASS =
  'flex w-full items-center mb-2 text-xs font-semibold text-fg-muted hover:text-fg-accent cursor-pointer bg-transparent border-0 p-0';

export interface IssueSidebarProps {
  owner: string;
  repo: string;
  number: number;
  isPull: boolean;
  item: IssueBase;
  permission: ViewerPermission;
  /** Issues only. */
  issueType?: { name: string; color: string; description: string | null } | null;
  isPinned?: boolean;
  viewerCanDelete?: boolean;
  /** Development: linked PRs (issue) or closing issues (PR). */
  linked: LinkedPull[];
  branches?: string[];
  /** Project items — pass the async value (started by the page, read under Loading here). */
  projects: ProjectItem[] | null;
  /** Extra sections above Assignees (PR reviewers). */
  before?: JSX.Element;
}

/** The right column of an issue / PR: assignees, labels, type, projects, milestone, development, notifications, participants. */
export default function IssueSidebar(props: IssueSidebarProps) {
  const update = useAction(updateIssue);
  const dropLabel = useAction(removeLabel);
  const viewer = createMemo(() => getViewer());
  const editable = () => canTriage(props.permission);
  const apply = async (patch: IssuePatch) => {
    try {
      await update(props.owner, props.repo, props.number, patch);
    } catch (e) {
      toastError(e);
    }
  };
  const thing = () => (props.isPull ? 'pull request' : 'issue');

  return (
    <div class="text-sm">
      {props.before}

      <SidebarSection
        title="Assignees"
        canEdit={editable()}
        empty={!props.item.assignees.nodes.length && !editable()}
        picker={
            <SelectPanel
              class="block"
              triggerClass={PICKER_TRIGGER_CLASS}
              trigger={pickerTrigger('Assignees')}
              title={`Assign up to 10 people to this ${thing()}`}
              align="right"
              multiple
              max={10}
              load={() => getAssignableUsers(props.owner, props.repo)}
              key={(u) => u.login}
              text={(u) => `${u.login} ${u.name ?? ''}`}
              render={(u) => (
                <span class="flex items-center gap-2">
                  <Avatar src={u.avatarUrl} size={20} />
                  <span class="font-semibold">{u.login}</span>
                  <span class="text-fg-muted truncate">{u.name}</span>
                </span>
              )}
              selected={props.item.assignees.nodes.map((a) => a.login)}
              onApply={(assignees) => apply({ assignees })}
            />
        }
      >
        <Show
          when={props.item.assignees.nodes.length}
          fallback={
            <span class="text-fg-muted">
              {feature('clean-conversation-sidebar') && editable() ? '' : 'No one '}
              <Show when={editable()} fallback="assigned">
                <Loading fallback="assigned">
                  {feature('clean-conversation-sidebar') ? '' : '— '}
                  <button type="button" class="btn-link text-xs" onClick={() => apply({ assignees: [viewer().login] })}>
                    assign yourself
                  </button>
                </Loading>
              </Show>
            </span>
          }
        >
          <ul class="flex flex-col gap-2">
            <For each={props.item.assignees.nodes}>
              {(a) => (
                <li>
                  <a class="link-plain flex items-center gap-2 font-semibold" href={userHref(a.login)}>
                    <Avatar src={a.avatarUrl} size={20} />
                    {a.login}
                  </a>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </SidebarSection>

      <SidebarSection
        title="Labels"
        canEdit={editable() || props.item.viewerCanLabel}
        empty={!props.item.labels.nodes.length}
        bare
        picker={
            <SelectPanel
              class="block"
              triggerClass={PICKER_TRIGGER_CLASS}
              trigger={pickerTrigger('Labels')}
              title={`Apply labels to this ${thing()}`}
              align="right"
              multiple
              load={() => getRepoLabels(props.owner, props.repo)}
              key={(l) => l.name}
              text={(l) => `${l.name} ${l.description ?? ''}`}
              render={(l) => (
                <span class="flex items-start gap-2">
                  <span class="mt-1 w-3.5 h-3.5 rounded-full shrink-0" style={{ 'background-color': `#${l.color}` }} />
                  <span class="min-w-0">
                    <span class="block font-semibold">{l.name}</span>
                    <Show when={l.description}>
                      <span class="block text-xs text-fg-muted font-normal">{l.description}</span>
                    </Show>
                  </span>
                </span>
              )}
              selected={props.item.labels.nodes.map((l) => l.name)}
              onApply={(labels) => apply({ labels })}
              footer={<a href={`/${props.owner}/${props.repo}/labels`}>Edit labels</a>}
            />
        }
      >
        <Show when={props.item.labels.nodes.length} fallback={<span class="text-fg-muted">None yet</span>}>
          <div class="flex flex-wrap gap-1">
            <For each={props.item.labels.nodes}>
              {(l) => (
                <Show
                  when={feature('quick-label-removal') && (editable() || props.item.viewerCanLabel)}
                  fallback={
                    <IssueLabel
                      name={l.name}
                      color={l.color}
                      title={l.description}
                      href={`/${props.owner}/${props.repo}/${props.isPull ? 'pulls' : 'issues'}?q=${encodeURIComponent(`label:"${l.name}"`)}`}
                    />
                  }
                >
                  <span class="IssueLabel rgh-quick-label-removal pr-0.5!" style={hexToVars(l.color)} title={l.description ?? l.name}>
                    <a
                      class="text-inherit! no-underline!"
                      href={`/${props.owner}/${props.repo}/${props.isPull ? 'pulls' : 'issues'}?q=${encodeURIComponent(`label:"${l.name}"`)}`}
                    >
                      {l.name}
                    </a>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center ml-0.5 w-4 h-4 rounded-full bg-transparent border-0 p-0 text-inherit cursor-pointer opacity-70 hover:opacity-100"
                      aria-label={`Remove label ${l.name}`}
                      title={`Remove label ${l.name}`}
                      onClick={async () => {
                        try {
                          await dropLabel(props.owner, props.repo, props.number, l.name);
                        } catch (e) {
                          toastError(e);
                        }
                      }}
                    >
                      <Octicon icon={xIcon} size={12} />
                    </button>
                  </span>
                </Show>
              )}
            </For>
          </div>
        </Show>
      </SidebarSection>

      <Show when={!props.isPull}>
        <SidebarSection title="Type" empty={!props.issueType}>
          <Show when={props.issueType} fallback={<span class="text-fg-muted">No type</span>}>
            {(t) => (
              <span class="Label" title={t().description ?? undefined}>
                {t().name}
              </span>
            )}
          </Show>
        </SidebarSection>
      </Show>

      <Loading
        fallback={
          <SidebarSection title="Projects">
            <span class="text-fg-muted">…</span>
          </SidebarSection>
        }
      >
        <SidebarSection title="Projects" empty={!props.projects?.length}>
          <Projects items={props.projects} />
        </SidebarSection>
      </Loading>

      <SidebarSection
        title="Milestone"
        canEdit={editable()}
        empty={!props.item.milestone}
        picker={
            <SelectPanel
              class="block"
              triggerClass={PICKER_TRIGGER_CLASS}
              trigger={pickerTrigger('Milestone')}
              title="Set milestone"
              align="right"
              clearLabel="Clear this milestone"
              load={() => getMilestones(props.owner, props.repo, 'open')}
              key={(m) => String(m.number)}
              text={(m) => m.title}
              render={(m) => (
                <span class="min-w-0">
                  <span class="block font-semibold">{m.title}</span>
                  <span class="block text-xs text-fg-muted font-normal">
                    {m.due_on ? `Due by ${new Date(m.due_on).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : 'No due date'}
                  </span>
                </span>
              )}
              selected={props.item.milestone ? [String(props.item.milestone.number)] : []}
              onApply={(keys) => apply({ milestone: keys[0] ? Number(keys[0]) : null })}
            />
        }
      >
        <Show when={props.item.milestone} fallback={<span class="text-fg-muted">No milestone</span>}>
          {(m) => (
            <>
              <div class="h-2 rounded-full bg-canvas-inset border border-line-muted overflow-hidden mb-1">
                <div class="h-full bg-success-emphasis" style={{ width: `${m().progressPercentage}%` }} />
              </div>
              <a class="link-plain font-semibold" href={`/${props.owner}/${props.repo}/milestone/${m().number}`}>
                {m().title}
              </a>
            </>
          )}
        </Show>
      </SidebarSection>

      <SidebarSection title="Development" empty={!props.linked.length && !props.branches?.length}>
        <Show when={props.isPull && !feature('clean-conversation-sidebar')}>
          <p class="text-fg-muted mb-1">Successfully merging this pull request may close these issues.</p>
        </Show>
        <Show
          when={props.linked.length || props.branches?.length}
          fallback={<span class="text-fg-muted">{props.isPull ? 'None yet' : 'No branches or pull requests'}</span>}
        >
          <ul class="flex flex-col gap-1.5">
            <For each={props.branches ?? []}>
              {(b) => (
                <li class="flex items-center gap-1.5">
                  <Octicon icon={gitBranchIcon} class="text-fg-muted" />
                  <a class="link-plain font-mono" href={`/${props.owner}/${props.repo}/tree/${b}`}>
                    {b}
                  </a>
                </li>
              )}
            </For>
            <For each={props.linked}>
              {(l) => (
                <li class="flex items-start gap-1.5">
                  <StateIcon
                    class="mt-0.5"
                    state={itemState({ isPull: !props.isPull, state: l.state, stateReason: l.stateReason, merged: l.merged, draft: l.isDraft })}
                  />
                  <a class="link-plain font-semibold break-words min-w-0" href={new URL(l.url).pathname}>
                    <RichText text={l.title} links={false} />
                    <span class="text-fg-muted font-normal">
                      {' '}
                      {l.repository.nameWithOwner === `${props.owner}/${props.repo}` ? '' : l.repository.nameWithOwner}#{l.number}
                    </span>
                  </a>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </SidebarSection>

      <Show when={props.item.viewerCanSubscribe}>
        <SidebarSection title="Notifications">
          <SubscribeButton id={props.item.id} subscribed={props.item.viewerSubscription === 'SUBSCRIBED'} thing={thing()} />
        </SidebarSection>
      </Show>

      <SidebarSection title={`${props.item.participants.totalCount} participant${props.item.participants.totalCount === 1 ? '' : 's'}`} last={props.isPull}>
        <div class="flex flex-wrap gap-1">
          <For each={props.item.participants.nodes}>
            {(p) => (
              <a href={userHref(p.login)} title={p.login}>
                <Avatar src={p.avatarUrl} login={p.login} size={26} />
              </a>
            )}
          </For>
        </div>
      </SidebarSection>

      <Show when={!props.isPull}>
        <IssueActions
          owner={props.owner}
          repo={props.repo}
          number={props.number}
          id={props.item.id}
          locked={props.item.locked}
          isPinned={!!props.isPinned}
          canLock={editable()}
          canPin={editable()}
          canTransfer={editable()}
          canDelete={!!props.viewerCanDelete}
        />
      </Show>
      <Show when={props.isPull && editable()}>
        <LockAction owner={props.owner} repo={props.repo} number={props.number} locked={props.item.locked} thing="pull request" />
      </Show>
    </div>
  );
}

function Projects(props: { items: ProjectItem[] | null }) {
  return (
    <Show when={props.items?.length} fallback={<span class="text-fg-muted">None yet</span>}>
      <ul class="flex flex-col gap-2">
        <For each={props.items ?? []}>
          {(p) => (
            <li>
              <a class="link-plain font-semibold" href={p.project.url} target="_blank" rel="noreferrer">
                {p.project.title}
              </a>
              <Show when={p.fieldValueByName?.name}>
                <div class="text-fg-muted">Status: {p.fieldValueByName!.name}</div>
              </Show>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}

function SubscribeButton(props: { id: string; subscribed: boolean; thing: string }) {
  const run = useAction(setSubscription);
  const [busy, setBusy] = createSignal(false);
  return (
    <>
      <button
        type="button"
        class="btn btn-sm w-full"
        disabled={busy()}
        onClick={async () => {
          setBusy(true);
          try {
            await run(props.id, !props.subscribed);
          } catch (e) {
            toastError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Octicon icon={props.subscribed ? bellSlashIcon : bellIcon} />
        {props.subscribed ? 'Unsubscribe' : 'Subscribe'}
      </button>
      <p class="text-fg-muted mt-2">
        {props.subscribed
          ? `You’re receiving notifications because you’re subscribed to this thread.`
          : `You’re not receiving notifications from this thread.`}
      </p>
    </>
  );
}

const LOCK_REASONS = [
  { value: '', label: 'Choose a reason' },
  { value: 'off-topic', label: 'Off-topic' },
  { value: 'too heated', label: 'Too heated' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'spam', label: 'Spam' },
];

function LockAction(props: { owner: string; repo: string; number: number; locked: boolean; thing: string }) {
  const [open, setOpen] = createSignal(false);
  const [reason, setReason] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const run = useAction(setLocked);
  const submit = async () => {
    setBusy(true);
    try {
      await run(props.owner, props.repo, props.number, !props.locked, reason() || undefined);
      setOpen(false);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" class="link-plain flex items-center gap-2 py-1 text-xs font-semibold" onClick={() => setOpen(true)}>
        <Octicon icon={props.locked ? unlockIcon : lockIcon} />
        {props.locked ? 'Unlock conversation' : 'Lock conversation'}
      </button>
      <Dialog open={open()} onClose={() => setOpen(false)} title={props.locked ? 'Unlock conversation on this ' + props.thing : 'Lock conversation on this ' + props.thing} width="480px">
        <Show
          when={!props.locked}
          fallback={
            <ul class="list-disc pl-5 text-sm flex flex-col gap-1">
              <li>
                <strong>Everyone</strong> will be able to comment on this {props.thing} once more.
              </li>
              <li>You can always lock this {props.thing} again in the future.</li>
            </ul>
          }
        >
          <ul class="list-disc pl-5 text-sm flex flex-col gap-1 mb-4">
            <li>
              Other users <strong>can’t add new comments</strong> to this {props.thing}.
            </li>
            <li>You and other collaborators with access to this repository can still leave comments that others can see.</li>
            <li>You can always unlock this {props.thing} again in the future.</li>
          </ul>
          <label class="form-label" for="lock-reason">
            Reason for locking
          </label>
          <select id="lock-reason" class="form-select w-full" value={reason()} onChange={(e) => setReason(e.currentTarget.value)}>
            <For each={LOCK_REASONS}>{(r) => <option value={r.value}>{r.label}</option>}</For>
          </select>
        </Show>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="btn" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button type="button" class="btn btn-primary" disabled={busy()} onClick={submit}>
            {props.locked ? 'Unlock conversation' : 'Lock conversation'}
          </button>
        </div>
      </Dialog>
    </>
  );
}

function IssueActions(props: {
  owner: string;
  repo: string;
  number: number;
  id: string;
  locked: boolean;
  isPinned: boolean;
  canLock: boolean;
  canPin: boolean;
  canTransfer: boolean;
  canDelete: boolean;
}) {
  const pin = useAction(setPinned);
  const transfer = useAction(transferIssue);
  const remove = useAction(deleteIssue);
  const navigate = useNavigate();
  const [dialog, setDialog] = createSignal<'transfer' | 'delete' | null>(null);
  const [target, setTarget] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Show when={props.canLock || props.canPin || props.canTransfer || props.canDelete}>
      <div class="pt-4 border-t border-line-muted flex flex-col gap-1">
        <Show when={props.canLock}>
          <LockAction owner={props.owner} repo={props.repo} number={props.number} locked={props.locked} thing="issue" />
        </Show>
        <Show when={props.canPin}>
          <button
            type="button"
            class="link-plain flex items-center gap-2 py-1 text-xs font-semibold"
            disabled={busy()}
            onClick={() => run(() => pin(props.id, !props.isPinned))}
          >
            <Octicon icon={pinIcon} />
            {props.isPinned ? 'Unpin issue' : 'Pin issue'}
          </button>
        </Show>
        <Show when={props.canTransfer}>
          <button type="button" class="link-plain flex items-center gap-2 py-1 text-xs font-semibold" onClick={() => setDialog('transfer')}>
            <Octicon icon={arrowRightIcon} />
            Transfer issue
          </button>
        </Show>
        <Show when={props.canDelete}>
          <button type="button" class="link-plain flex items-center gap-2 py-1 text-xs font-semibold text-fg-danger!" onClick={() => setDialog('delete')}>
            <Octicon icon={trashIcon} />
            Delete issue
          </button>
        </Show>
      </div>
      <Dialog open={dialog() === 'transfer'} onClose={() => setDialog(null)} title="Transfer issue" width="480px">
        <p class="text-sm mb-3">Move this issue to another repository you have write access to (same owner).</p>
        <label class="form-label" for="transfer-target">
          Repository
        </label>
        <input
          id="transfer-target"
          class="form-control w-full"
          placeholder={`${props.owner}/repository`}
          value={target()}
          onInput={(e) => setTarget(e.currentTarget.value.trim())}
        />
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="btn" onClick={() => setDialog(null)}>
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            disabled={busy() || !/^[\w.-]+\/[\w.-]+$/.test(target())}
            onClick={() =>
              run(async () => {
                const path = await transfer(props.id, target());
                setDialog(null);
                navigate(path);
              })
            }
          >
            Transfer issue
          </button>
        </div>
      </Dialog>
      <Dialog open={dialog() === 'delete'} onClose={() => setDialog(null)} title="Delete issue?" width="480px">
        <p class="text-sm">This will permanently delete this issue from this repository. This cannot be undone.</p>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="btn" onClick={() => setDialog(null)}>
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-danger"
            disabled={busy()}
            onClick={() =>
              run(async () => {
                await remove(props.id);
                setDialog(null);
                navigate(`/${props.owner}/${props.repo}/issues`);
              })
            }
          >
            Delete this issue
          </button>
        </div>
      </Dialog>
    </Show>
  );
}
