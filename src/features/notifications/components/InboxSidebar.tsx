import { createMemo, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar } from '../../../components/ui';
import {
  bookmarkIcon,
  checkIcon,
  eyeIcon,
  inboxIcon,
  mentionIcon,
  peopleIcon,
  personIcon,
  commentIcon,
  type OcticonData,
} from '../../../icons/octicons';
import { getNotifications, type NotificationThread } from '../api';
import { inboxHref, type InboxQuery } from '../utils';

const FILTERS: { label: string; reason: string; icon: OcticonData }[] = [
  { label: 'Assigned', reason: 'assign', icon: personIcon },
  { label: 'Participating', reason: 'participating', icon: commentIcon },
  { label: 'Mentioned', reason: 'mention', icon: mentionIcon },
  { label: 'Team mentioned', reason: 'team_mention', icon: peopleIcon },
  { label: 'Review requested', reason: 'review_requested', icon: eyeIcon },
];

/** Left column of /notifications: Inbox / Saved / Done, reason filters, repositories. */
export default function InboxSidebar(props: { query: InboxQuery }) {
  const isInbox = () => !props.query.is && !props.query.reason && !props.query.repo;
  return (
    <nav aria-label="Notifications" class="text-sm">
      <ul class="NavList">
        <li>
          <a class="NavList-item" href="/notifications" aria-current={isInbox() ? 'page' : undefined}>
            <Octicon icon={inboxIcon} />
            <span class="flex-1">Inbox</span>
          </a>
        </li>
        <li>
          <span class="NavList-item opacity-50 cursor-not-allowed" title="Saved notifications are not available through the API">
            <Octicon icon={bookmarkIcon} />
            <span class="flex-1">Saved</span>
          </span>
        </li>
        <li>
          <a class="NavList-item" href={inboxHref('is:done')} aria-current={props.query.is === 'done' ? 'page' : undefined}>
            <Octicon icon={checkIcon} />
            <span class="flex-1">Done</span>
          </a>
        </li>
      </ul>
      <hr class="NavList-divider" />
      <div class="NavList-heading">Filters</div>
      <ul class="NavList">
        <For each={FILTERS}>
          {(f) => (
            <li>
              <a
                class="NavList-item"
                href={inboxHref(`reason:${f.reason.replace(/_/g, '-')}`)}
                aria-current={props.query.reason === f.reason && !props.query.repo ? 'page' : undefined}
              >
                <Octicon icon={f.icon} />
                <span class="flex-1">{f.label}</span>
              </a>
            </li>
          )}
        </For>
      </ul>
      <hr class="NavList-divider" />
      <div class="NavList-heading">Repositories</div>
      <Loading fallback={<div class="px-2 py-1 text-fg-muted">Loading…</div>}>
        <RepoList current={props.query.repo} />
      </Loading>
    </nav>
  );
}

/** Repositories in the (first page of the) inbox, most unread first — like github.com's sidebar. */
function RepoList(props: { current?: string }) {
  // Same query as the unfiltered inbox, so it's shared with the list on /notifications.
  const inbox = createMemo(() => getNotifications({ all: true, participating: false, page: 1 }));
  const repos = createMemo(() => {
    const map = new Map<string, { name: string; owner: NotificationThread['repository']['owner']; unread: number; total: number }>();
    for (const n of inbox().items) {
      const r = map.get(n.repository.full_name) ?? { name: n.repository.full_name, owner: n.repository.owner, unread: 0, total: 0 };
      r.total++;
      if (n.unread) r.unread++;
      map.set(r.name, r);
    }
    return [...map.values()].sort((a, b) => b.unread - a.unread || b.total - a.total);
  });
  return (
    <Show when={repos().length} fallback={<div class="px-2 py-1 text-fg-muted">No repositories</div>}>
      <ul class="NavList">
        <For each={repos()}>
          {(r) => (
            <li>
              <a
                class="NavList-item"
                href={inboxHref(`repo:${r.name}`)}
                aria-current={props.current?.toLowerCase() === r.name.toLowerCase() ? 'page' : undefined}
              >
                <Avatar src={r.owner.avatar_url} size={16} square={r.owner.type === 'Organization'} />
                <span class="flex-1 truncate">{r.name}</span>
                <Show when={r.unread}>
                  <span class="Counter">{r.unread}</span>
                </Show>
              </a>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}
