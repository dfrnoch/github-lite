import { For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, IssueLabel, itemState, RelativeTime, StateIcon } from '../../../components/ui';
import { commentIcon, gitPullRequestIcon, milestoneIcon } from '../../../icons/octicons';
import CommitStatusIcon from '../../repo/components/CommitStatusIcon';
import type { ListItem } from '../types';
import { userHref } from './Comment';

/** Inline `code` inside GitHub's rendered titles (titleHTML). */
export const TITLE_CODE =
  '[&_code]:font-mono [&_code]:text-[85%] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:bg-[var(--bgColor-neutral-muted)]';

const REVIEW_TEXT: Record<string, { text: string; class: string }> = {
  APPROVED: { text: 'Approved', class: 'text-fg-success' },
  CHANGES_REQUESTED: { text: 'Changes requested', class: 'text-fg-danger' },
  REVIEW_REQUIRED: { text: 'Review required', class: '' },
};

/** "7/8" passing checks for a PR row. */
function checkCounts(item: ListItem) {
  const rollup = item.commits?.nodes[0]?.commit.statusCheckRollup;
  if (!rollup) return null;
  const counts = [...(rollup.contexts.checkRunCountsByState ?? []), ...(rollup.contexts.statusContextCountsByState ?? [])];
  const ok = counts.filter((c) => ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(c.state)).reduce((n, c) => n + c.count, 0);
  return { state: rollup.state, text: `${ok}/${rollup.contexts.totalCount}` };
}

/** One row of an issue / PR list. `showRepo` prefixes the number with owner/repo (global lists). */
export default function IssueRow(props: { item: ListItem; showRepo?: boolean; labelHref?: (name: string) => string }) {
  const isPull = () => props.item.__typename === 'PullRequest';
  const path = () => `/${props.item.repository.nameWithOwner}/${isPull() ? 'pull' : 'issues'}/${props.item.number}`;
  const author = () => props.item.author?.login ?? 'ghost';
  const checks = () => checkCounts(props.item);
  return (
    <div class="Box-row Box-row--hover flex items-start gap-3 py-2! px-4!">
      <StateIcon
        class="mt-1 shrink-0"
        state={itemState({ isPull: isPull(), state: props.item.state, stateReason: props.item.stateReason, draft: props.item.isDraft })}
      />
      <div class="flex-1 min-w-0">
        <div class="leading-snug">
          {/* oxlint-disable-next-line solid/no-innerhtml -- titleHTML is rendered + sanitized by GitHub */}
          <a class={`link-plain font-semibold text-base mr-1 break-words ${TITLE_CODE}`} href={path()} innerHTML={props.item.titleHTML || props.item.title} />
          <For each={props.item.labels.nodes}>
            {(l) => (
              <IssueLabel
                class="mr-1 align-middle"
                name={l.name}
                color={l.color}
                title={l.description}
                href={props.labelHref?.(l.name)}
              />
            )}
          </For>
        </div>
        <div class="mt-1 text-xs text-fg-muted flex flex-wrap items-center gap-x-1">
          <span>
            {props.showRepo ? props.item.repository.nameWithOwner : ''}#{props.item.number}
          </span>
          <span>·</span>
          <a class="link-muted" href={userHref(author())}>
            {author()}
          </a>
          <Show
            when={props.item.state === 'OPEN'}
            fallback={
              <span>
                {props.item.state === 'MERGED' ? 'was merged' : 'was closed'} <RelativeTime datetime={props.item.closedAt} />
              </span>
            }
          >
            <span>
              opened <RelativeTime datetime={props.item.createdAt} />
            </span>
          </Show>
          <Show when={isPull() && props.item.isDraft}>
            <span>· Draft</span>
          </Show>
          <Show when={isPull() && !props.item.isDraft && props.item.state === 'OPEN' && props.item.reviewDecision}>
            {(d) => (
              <span>
                · <span class={REVIEW_TEXT[d()]?.class}>{REVIEW_TEXT[d()]?.text}</span>
              </span>
            )}
          </Show>
          <Show when={checks()}>
            {(c) => (
              <span class="inline-flex items-center gap-1">
                · <CommitStatusIcon state={c().state} href={`${path()}/checks`} />
                <a class="link-muted" href={`${path()}/checks`}>
                  {c().text}
                </a>
              </span>
            )}
          </Show>
          <Show when={props.item.milestone}>
            {(m) => (
              <span class="inline-flex items-center gap-1">
                ·
                <a class="link-muted inline-flex items-center gap-1" href={`/${props.item.repository.nameWithOwner}/milestone/${m().number}`}>
                  <Octicon icon={milestoneIcon} size={12} />
                  {m().title}
                </a>
              </span>
            )}
          </Show>
          <Show when={props.item.issueType}>
            {(t) => <span>· {t().name}</span>}
          </Show>
        </div>
      </div>
      <div class="hidden sm:flex items-center gap-4 shrink-0 text-xs text-fg-muted pt-1">
        <Show when={(props.item.closedByPullRequestsReferences?.totalCount ?? 0) > 0}>
          <span class="inline-flex items-center gap-1" title="Linked pull requests">
            <Octicon icon={gitPullRequestIcon} />
            {props.item.closedByPullRequestsReferences!.totalCount}
          </span>
        </Show>
        <Show when={props.item.assignees.nodes.length}>
          <span class="AvatarStack flex">
            <For each={props.item.assignees.nodes.slice(0, 3)}>
              {(a) => (
                <a href={userHref(a.login)} title={`Assigned to ${a.login}`}>
                  <Avatar src={a.avatarUrl} login={a.login} size={20} />
                </a>
              )}
            </For>
          </span>
        </Show>
        <Show when={props.item.comments.totalCount > 0}>
          <a class="link-muted inline-flex items-center gap-1" href={path()} aria-label={`${props.item.comments.totalCount} comments`}>
            <Octicon icon={commentIcon} />
            {props.item.comments.totalCount}
          </a>
        </Show>
      </div>
    </div>
  );
}
