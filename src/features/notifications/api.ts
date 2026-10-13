import { action, query } from '@solidjs/router';
import { gh, ghPage, gql } from '../../lib/github';
import type { SimpleUser } from '../../lib/types';

export interface NotificationThread {
  id: string;
  unread: boolean;
  reason: string;
  updated_at: string;
  last_read_at: string | null;
  subject: { title: string; url: string | null; latest_comment_url: string | null; type: string };
  repository: { id: number; name: string; full_name: string; owner: SimpleUser; private: boolean };
  url: string;
  subscription_url: string;
}

export const PER_PAGE = 50;

export interface NotificationsQuery {
  /** `owner/name` → GET /repos/:o/:r/notifications */
  repo?: string;
  /** false → only unread (the API default); true → read + unread. */
  all: boolean;
  participating: boolean;
  page: number;
}

/** One page of the inbox (GET /notifications or the repo-scoped variant). */
export const getNotifications = query(
  (q: NotificationsQuery) =>
    ghPage<NotificationThread>(q.repo ? `/repos/${q.repo}/notifications` : '/notifications', {
      page: q.page,
      perPage: PER_PAGE,
      query: { all: q.all || undefined, participating: q.participating || undefined },
    }),
  'notifications',
);

export interface SubjectState {
  state: string;
  stateReason?: string | null;
  merged?: boolean;
  isDraft?: boolean;
  /** Opened by a bot (GitHub App) — the "Select by" menu's "Bots" filter. */
  isBot?: boolean;
}

/**
 * Issue / PR state for a page of notifications (one aliased GraphQL call), so
 * rows show the colored open/closed/merged icon like github.com. Keys are
 * `owner/name#number`.
 */
export const getSubjectStates = query(async (keys: string[]): Promise<Record<string, SubjectState>> => {
  if (!keys.length) return {};
  const fields = keys
    .map((key, i) => {
      const [repo, num] = key.split('#');
      const [owner, name] = repo!.split('/');
      return `s${i}:repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(name)}){issueOrPullRequest(number:${Number(num)}){
        ... on Issue{state stateReason author{__typename}}
        ... on PullRequest{state merged isDraft author{__typename}}
      }}`;
    })
    .join('\n');
  try {
    const data = await gql<any>(`query{${fields}}`);
    const out: Record<string, SubjectState> = {};
    keys.forEach((key, i) => {
      const s = data?.[`s${i}`]?.issueOrPullRequest;
      if (s) out[key] = { state: s.state, stateReason: s.stateReason, merged: s.merged, isDraft: s.isDraft, isBot: s.author?.__typename === 'Bot' };
    });
    return out;
  } catch {
    // Icons fall back to the plain type icon.
    return {};
  }
}, 'notification-subject-states');

/** PATCH /notifications/threads/:id — mark a thread as read. */
export const markThreadRead = action(async (id: string) => {
  await gh(`/notifications/threads/${id}`, { method: 'PATCH' });
}, 'notification-mark-read');

/** DELETE /notifications/threads/:id — mark a thread as done (removes it from the inbox). */
export const markThreadDone = action(async (id: string) => {
  await gh(`/notifications/threads/${id}`, { method: 'DELETE' });
}, 'notification-mark-done');

/** Several threads at once (bulk actions). */
export const markThreads = action(async (ids: string[], as: 'read' | 'done') => {
  await Promise.all(
    ids.map((id) => gh(`/notifications/threads/${id}`, { method: as === 'read' ? 'PATCH' : 'DELETE' })),
  );
}, 'notification-mark-many');

/** DELETE /notifications/threads/:id/subscription — stop notifications for this thread. */
export const unsubscribeThread = action(async (id: string) => {
  await gh(`/notifications/threads/${id}/subscription`, { method: 'DELETE' });
}, 'notification-unsubscribe');

/** PUT /notifications (or /repos/:o/:r/notifications) — mark everything up to now as read. */
export const markAllRead = action(async (repo?: string) => {
  const last_read_at = new Date().toISOString();
  if (repo) await gh(`/repos/${repo}/notifications`, { method: 'PUT', body: { last_read_at } });
  else await gh('/notifications', { method: 'PUT', body: { last_read_at, read: true } });
}, 'notification-mark-all-read');
