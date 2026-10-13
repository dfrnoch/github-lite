import { createMemo, createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar } from '../../../components/ui';
import { alertIcon, checkIcon, commentIcon, dotFillIcon, eyeIcon, fileDiffIcon, type OcticonData, xIcon } from '../../../icons/octicons';
import type { PullDetail } from '../../issues/types';
import { MergeSection, StatusCircle, type Tone } from './MergeSection';

const STATE: Record<string, { icon: OcticonData; class: string; label: string }> = {
  APPROVED: { icon: checkIcon, class: 'text-fg-success', label: 'approved these changes' },
  CHANGES_REQUESTED: { icon: fileDiffIcon, class: 'text-fg-danger', label: 'requested changes' },
  COMMENTED: { icon: commentIcon, class: 'text-fg-muted', label: 'left review comments' },
  DISMISSED: { icon: commentIcon, class: 'text-fg-muted', label: 'review was dismissed' },
  PENDING: { icon: dotFillIcon, class: 'text-fg-attention', label: 'review requested' },
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Reviews section: decision summary + an expandable list of reviewers and their latest state. */
export default function MergeReviews(props: { pull: PullDetail; owner: string }) {
  const [open, setOpen] = createSignal(false);
  const opinions = (s: string) => props.pull.latestOpinionatedReviews.nodes.filter((r) => r.state === s).length;
  const requested = () =>
    props.pull.reviewRequests.nodes
      .map((r) => r.requestedReviewer)
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) =>
        r.__typename === 'Team'
          ? { key: `team:${r.slug}`, name: r.combinedSlug ?? r.name, avatarUrl: r.avatarUrl, href: `/orgs/${props.owner}/teams/${r.slug}`, state: 'PENDING', team: true }
          : { key: r.login, name: r.login, avatarUrl: r.avatarUrl, href: `/${r.login}`, state: 'PENDING', team: false },
      );
  const rows = createMemo(
    () => {
      const pending = requested();
      // A later comment doesn't undo an approval: the opinionated state wins.
      const byAuthor = new Map<string, { avatarUrl: string; state: string }>();
      for (const r of props.pull.latestReviews.nodes) if (r.author) byAuthor.set(r.author.login, { avatarUrl: r.author.avatarUrl, state: r.state });
      for (const r of props.pull.latestOpinionatedReviews.nodes) if (r.author) byAuthor.set(r.author.login, { avatarUrl: r.author.avatarUrl, state: r.state });
      const reviewed = [...byAuthor]
        .filter(([login]) => !pending.some((p) => p.key === login))
        .map(([login, r]) => ({ key: login, name: login, avatarUrl: r.avatarUrl, href: `/${login}`, state: r.state, team: false }));
      return [...reviewed, ...pending];
    },
    { name: 'mergeReviewRows' },
  );

  const look = (): { tone: Tone; icon: OcticonData; title: string; desc: string } | null => {
    const approved = opinions('APPROVED');
    const changes = opinions('CHANGES_REQUESTED');
    switch (props.pull.reviewDecision) {
      case 'APPROVED':
        return {
          tone: 'success',
          icon: checkIcon,
          title: 'Changes approved',
          desc: `${plural(Math.max(approved, 1), 'approving review')} by reviewers with write access.`,
        };
      case 'CHANGES_REQUESTED':
        return {
          tone: 'danger',
          icon: xIcon,
          title: 'Changes requested',
          desc: `${plural(Math.max(changes, 1), 'review')} requesting changes by reviewers with write access.`,
        };
      case 'REVIEW_REQUIRED':
        return {
          tone: 'danger',
          icon: alertIcon,
          title: 'Review required',
          desc: 'At least 1 approving review is required by reviewers with write access.',
        };
    }
    // No branch protection: describe what happened anyway.
    if (changes) return { tone: 'danger', icon: xIcon, title: 'Changes requested', desc: `${plural(changes, 'review')} requesting changes.` };
    if (approved) return { tone: 'success', icon: checkIcon, title: 'Changes approved', desc: `${plural(approved, 'approving review')}.` };
    if (requested().length)
      return {
        tone: 'neutral',
        icon: eyeIcon,
        title: 'Review requested',
        desc: 'Review has been requested on this pull request. It is not required to merge.',
      };
    return null;
  };

  return (
    <Show when={look()}>
      {(l) => (
        <MergeSection
          icon={<StatusCircle tone={l().tone} icon={l().icon} />}
          title={l().title}
          desc={l().desc}
          expanded={open()}
          onToggle={rows().length ? () => setOpen(!open()) : undefined}
          toggleLabel={open() ? 'Hide reviewers' : 'Show reviewers'}
        >
          <Show when={open()}>
            <ul class="MergeBox-list" aria-label="Reviewers">
              <For each={rows()}>
                {(r) => (
                  <li class="MergeBox-check">
                    <Avatar src={r.avatarUrl} size={20} square={r.team} class="shrink-0" />
                    <span class="flex-1 min-w-0 truncate">
                      <a class="font-semibold text-fg" href={r.href}>
                        {r.name}
                      </a>{' '}
                      <span class="text-fg-muted">{(STATE[r.state] ?? STATE.COMMENTED!).label}</span>
                    </span>
                    <Octicon icon={(STATE[r.state] ?? STATE.COMMENTED!).icon} class={['shrink-0', (STATE[r.state] ?? STATE.COMMENTED!).class]} />
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </MergeSection>
      )}
    </Show>
  );
}
