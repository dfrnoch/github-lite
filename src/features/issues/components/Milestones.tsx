import { useAction, useNavigate } from '@solidjs/router';
import { createSignal, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dialog, RelativeTime, toastError } from '../../../components/ui';
import { alertIcon, calendarIcon, clockIcon } from '../../../icons/octicons';
import type { Milestone } from '../../../lib/types';
import { createMilestone, deleteMilestone, updateMilestone, type MilestoneInput } from '../api';

export const percentComplete = (m: { open_issues: number; closed_issues: number }) => {
  const total = m.open_issues + m.closed_issues;
  return total ? Math.round((m.closed_issues / total) * 100) : 0;
};

const longDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** "Due by May 1, 2025" / "Past due by 3 days" / "No due date" / "Closed …". */
export function DueDate(props: { milestone: Milestone }) {
  const pastDue = () => props.milestone.state === 'open' && !!props.milestone.due_on && Date.parse(props.milestone.due_on) < Date.now();
  return (
    <Show
      when={props.milestone.state === 'open'}
      fallback={
        <span class="inline-flex items-center gap-1">
          <Octicon icon={clockIcon} /> Closed <RelativeTime datetime={props.milestone.closed_at} />
        </span>
      }
    >
      <Show when={props.milestone.due_on} fallback={<span>No due date</span>}>
        {(due) => (
          <span class={['inline-flex items-center gap-1', { 'text-fg-danger': pastDue() }]}>
            <Octicon icon={pastDue() ? alertIcon : calendarIcon} />
            {pastDue() ? 'Past due by ' : 'Due by '}
            {pastDue() ? <RelativeTime datetime={due()} relative /> : longDate(due())}
          </span>
        )}
      </Show>
    </Show>
  );
}

/** Green progress bar used on milestone pages. */
export function ProgressBar(props: { percent: number; class?: string }) {
  return (
    <div class={['h-2 rounded-full overflow-hidden', props.class]} style={{ 'background-color': 'var(--bgColor-neutral-muted)' }}>
      <div class="h-full bg-success-emphasis rounded-full" style={{ width: `${props.percent}%` }} />
    </div>
  );
}

/** Edit / Close / Delete links for a milestone row or page. */
export function MilestoneActions(props: { owner: string; repo: string; milestone: Milestone; afterDelete?: string }) {
  const update = useAction(updateMilestone);
  const remove = useAction(deleteMilestone);
  const navigate = useNavigate();
  const [confirm, setConfirm] = createSignal(false);
  const base = () => `/${props.owner}/${props.repo}`;
  const toggle = async () => {
    try {
      await update(props.owner, props.repo, props.milestone.number, { state: props.milestone.state === 'open' ? 'closed' : 'open' });
    } catch (e) {
      toastError(e);
    }
  };
  return (
    <div class="flex gap-3 text-sm">
      <a href={`${base()}/milestones/${props.milestone.number}/edit`}>Edit</a>
      <button type="button" class="btn-link" onClick={toggle}>
        {props.milestone.state === 'open' ? 'Close' : 'Reopen'}
      </button>
      <button type="button" class="btn-link text-fg-danger!" onClick={() => setConfirm(true)}>
        Delete
      </button>
      <Dialog open={confirm()} onClose={() => setConfirm(false)} title="Delete milestone" width="440px">
        <p class="text-sm">
          Are you sure? Deleting a milestone will remove it from all issues and pull requests that use it.
        </p>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="btn" onClick={() => setConfirm(false)}>
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-danger"
            onClick={async () => {
              setConfirm(false);
              try {
                await remove(props.owner, props.repo, props.milestone.number);
                if (props.afterDelete) navigate(props.afterDelete);
              } catch (e) {
                toastError(e);
              }
            }}
          >
            Delete milestone
          </button>
        </div>
      </Dialog>
    </div>
  );
}

/** New / edit milestone form (title, due date, description). */
export function MilestoneForm(props: { owner: string; repo: string; milestone?: Milestone & { description: string | null } }) {
  const navigate = useNavigate();
  const create = useAction(createMilestone);
  const update = useAction(updateMilestone);
  const [title, setTitle] = createSignal(() => props.milestone?.title ?? '');
  const [due, setDue] = createSignal(() => props.milestone?.due_on?.slice(0, 10) ?? '');
  const [description, setDescription] = createSignal(() => props.milestone?.description ?? '');
  const [busy, setBusy] = createSignal(false);
  const base = () => `/${props.owner}/${props.repo}`;

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!title().trim()) return;
    setBusy(true);
    // GitHub stores the due date as a day; send noon UTC to avoid timezone shifts.
    const body: MilestoneInput = {
      title: title().trim(),
      description: description(),
      due_on: due() ? `${due()}T12:00:00Z` : null,
    };
    try {
      if (props.milestone) await update(props.owner, props.repo, props.milestone.number, body);
      else await create(props.owner, props.repo, body);
      navigate(`${base()}/milestones`);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} class="max-w-[720px]">
      <div class="form-group mt-0!">
        <label for="milestone-title">Title</label>
        <input id="milestone-title" class="form-control w-full" required placeholder="Title" value={title()} onInput={(e) => setTitle(e.currentTarget.value)} />
      </div>
      <div class="form-group">
        <label for="milestone-due">Due date (optional)</label>
        <input id="milestone-due" type="date" class="form-control" value={due()} onInput={(e) => setDue(e.currentTarget.value)} />
      </div>
      <div class="form-group">
        <label for="milestone-description">Description</label>
        <textarea
          id="milestone-description"
          class="form-control w-full min-h-[200px]"
          value={description()}
          onInput={(e) => setDescription(e.currentTarget.value)}
        />
      </div>
      <div class="flex justify-end gap-2 pt-4 mt-4 border-t border-line-muted">
        <Show when={props.milestone}>
          {(m) => <MilestoneActions owner={props.owner} repo={props.repo} milestone={m()} afterDelete={`${base()}/milestones`} />}
        </Show>
        <div class="flex-1" />
        <a class="btn" href={`${base()}/milestones`}>
          Cancel
        </a>
        <button type="submit" class="btn btn-primary" disabled={busy() || !title().trim()}>
          {props.milestone ? 'Save changes' : 'Create milestone'}
        </button>
      </div>
    </form>
  );
}
