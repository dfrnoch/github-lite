import { revalidate } from '@solidjs/router';
import { toast, toastError } from '../../components/ui';
import { gh } from '../../lib/github';
import { getUnreadNotifications } from '../user/api';
import type { NotificationThread } from './api';
import { subjectHref } from './utils';

/**
 * Open app paths in new tabs. Browsers only let one tab open per click unless
 * pop-ups are allowed for this site, so report how many were blocked.
 * Returns how many tabs actually opened.
 */
export function openInNewTabs(paths: string[]): number {
  let opened = 0;
  for (const path of paths) {
    const w = window.open(new URL(path, location.origin).href, '_blank');
    if (!w) continue;
    w.opener = null;
    opened++;
  }
  const blocked = paths.length - opened;
  if (blocked > 0) {
    toast(
      `Your browser blocked ${blocked} ${blocked === 1 ? 'tab' : 'tabs'}. Allow pop-ups for this site to open several notifications at once.`,
      'error',
      8000,
    );
  }
  return opened;
}

/** github.com marks a thread read when it is opened from the inbox; do the same for threads opened in bulk. */
export async function markOpenedRead(threads: NotificationThread[]) {
  const ids = threads.filter((n) => n.unread).map((n) => n.id);
  if (!ids.length) return;
  await Promise.all(ids.map((id) => gh(`/notifications/threads/${id}`, { method: 'PATCH' })));
  void revalidate([getUnreadNotifications.key, 'notifications']);
}

/** How many unread notifications `unread-anywhere` opens at most (like Refined GitHub). */
export const UNREAD_ANYWHERE_LIMIT = 5;
let busy = false;

/**
 * Refined GitHub's `unread-anywhere`: fetch the unread inbox fresh and open
 * the newest few threads in new tabs, from any page (header button / `g u`).
 */
export async function openUnreadNotifications() {
  if (busy) return;
  busy = true;
  try {
    const unread = await gh<NotificationThread[]>('/notifications', { query: { per_page: 50 } });
    if (!unread.length) {
      toast('No unread notifications');
      return;
    }
    const batch = unread.slice(0, UNREAD_ANYWHERE_LIMIT);
    const opened = openInNewTabs(batch.map(subjectHref));
    if (!opened) return;
    toast(
      unread.length > UNREAD_ANYWHERE_LIMIT
        ? `Opened the last ${UNREAD_ANYWHERE_LIMIT} unread notifications`
        : `${opened} ${opened === 1 ? 'notification' : 'notifications'} opened`,
      'success',
    );
    await markOpenedRead(batch.slice(0, opened));
  } catch (e) {
    toastError(e);
  } finally {
    busy = false;
  }
}
