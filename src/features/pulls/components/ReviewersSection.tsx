import { useAction } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, toastError } from '../../../components/ui';
import { checkIcon, commentIcon, dotFillIcon, fileDiffIcon, gitPullRequestDraftIcon, peopleIcon } from '../../../icons/octicons';
import { getAssignableUsers, type PickerUser } from '../../issues/api';
import { userHref } from '../../issues/components/Comment';
import { PICKER_TRIGGER_CLASS, pickerTrigger, SidebarSection } from '../../issues/components/IssueSidebar';
import SelectPanel from '../../issues/components/SelectPanel';
import type { PullDetail } from '../../issues/types';
import { setDraft, setReviewers } from '../api';

const REVIEW_ICON: Record<string, { icon: typeof checkIcon; class: string; label: string }> = {
  APPROVED: { icon: checkIcon, class: 'text-fg-success', label: 'approved these changes' },
  CHANGES_REQUESTED: { icon: fileDiffIcon, class: 'text-fg-danger', label: 'requested changes' },
  COMMENTED: { icon: commentIcon, class: 'text-fg-muted', label: 'left review comments' },
  DISMISSED: { icon: commentIcon, class: 'text-fg-muted', label: 'review dismissed' },
};

/** Sidebar "Reviewers": requested reviewers + latest review per person, with the request picker. */
export default function ReviewersSection(props: { owner: string; repo: string; pull: PullDetail; editable: boolean }) {
  const request = useAction(setReviewers);
  const draft = useAction(setDraft);
  const [busy, setBusy] = createSignal(false);

  const requested = () =>
    props.pull.reviewRequests.nodes
      .map((r) => r.requestedReviewer)
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) => (r.__typename === 'Team' ? { key: `team:${r.slug}`, name: r.combinedSlug ?? r.name, avatarUrl: r.avatarUrl ?? '' } : { key: r.login, name: r.login, avatarUrl: r.avatarUrl }));
  const reviews = () =>
    props.pull.latestReviews.nodes.filter((r) => r.author && !requested().some((q) => q.key === r.author!.login));

  const candidates = async (): Promise<PickerUser[]> => {
    // Read reactive values before the await so they stay dependencies.
    const suggested = props.pull.suggestedReviewers.map((s) => ({ login: s.reviewer.login, avatarUrl: s.reviewer.avatarUrl, name: 'Suggested' }));
    const author = props.pull.author?.login;
    const users = await getAssignableUsers(props.owner, props.repo);
    const seen = new Set<string>();
    return [...suggested, ...users].filter((u) => u.login !== author && !seen.has(u.login) && !!seen.add(u.login));
  };

  const apply = async (keys: string[]) => {
    const before = requested().map((r) => r.key);
    try {
      await request(
        props.owner,
        props.repo,
        props.pull.number,
        keys.filter((k) => !before.includes(k)),
        before.filter((k) => !keys.includes(k)),
      );
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <SidebarSection
      title="Reviewers"
      canEdit={props.editable && props.pull.state === 'OPEN'}
      picker={
        <SelectPanel
          class="block"
          triggerClass={PICKER_TRIGGER_CLASS}
          trigger={pickerTrigger('Reviewers')}
          title="Request up to 15 reviewers"
          align="right"
          multiple
          max={15}
          load={candidates}
          key={(u) => u.login}
          text={(u) => `${u.login} ${u.name ?? ''}`}
          render={(u) => (
            <span class="flex items-center gap-2">
              <Avatar src={u.avatarUrl} size={20} />
              <span class="font-semibold">{u.login}</span>
              <span class="text-fg-muted truncate font-normal">{u.name}</span>
            </span>
          )}
          selected={requested().map((r) => r.key)}
          onApply={apply}
        />
      }
    >
      <Show when={requested().length || reviews().length} fallback={<span class="text-fg-muted">No reviews</span>}>
        <ul class="flex flex-col gap-2">
          <For each={reviews()}>
            {(r) => (
              <li class="flex items-center gap-2">
                <Avatar src={r.author!.avatarUrl} size={20} />
                <a class="link-plain font-semibold flex-1 truncate" href={userHref(r.author!.login)}>
                  {r.author!.login}
                </a>
                <Show when={REVIEW_ICON[r.state]}>
                  {(look) => (
                    <span title={look().label} class="flex">
                      <Octicon icon={look().icon} class={look().class} />
                    </span>
                  )}
                </Show>
              </li>
            )}
          </For>
          <For each={requested()}>
            {(r) => (
              <li class="flex items-center gap-2">
                <Show when={r.avatarUrl} fallback={<Octicon icon={peopleIcon} class="text-fg-muted" />}>
                  <Avatar src={r.avatarUrl} size={20} square={r.key.startsWith('team:')} />
                </Show>
                <span class="font-semibold flex-1 truncate">{r.name}</span>
                <span title="Awaiting requested review" class="flex">
                  <Octicon icon={dotFillIcon} class="text-fg-attention" />
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={props.pull.state === 'OPEN' && !props.pull.isDraft && props.pull.viewerCanUpdate}>
        <p class="mt-3 text-fg-muted">
          Still in progress?{' '}
          <button
            type="button"
            class="btn-link text-xs inline-flex! items-center gap-1"
            disabled={busy()}
            onClick={async () => {
              setBusy(true);
              try {
                await draft(props.pull.id, true);
              } catch (e) {
                toastError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Octicon icon={gitPullRequestDraftIcon} size={12} /> Convert to draft
          </button>
        </p>
      </Show>
    </SidebarSection>
  );
}
