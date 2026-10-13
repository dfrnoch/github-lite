import { query } from '@solidjs/router';
import { gh } from '../../lib/github';
import type { Repository, Viewer } from '../../lib/types';

/** The signed-in user (GET /user). */
export const getViewer = query(() => gh<Viewer>('/user'), 'viewer');

/** Unread notification count for the header dot (first page is enough). */
export const getUnreadNotifications = query(
  () => gh<unknown[]>('/notifications', { query: { per_page: 1 } }).then((n) => n.length > 0),
  'notifications-unread',
);

/** Repos the viewer can push to, most recently pushed first (nav drawer, dashboard). */
export const getTopRepos = query(
  (limit = 10) =>
    gh<Repository[]>('/user/repos', {
      query: { sort: 'pushed', per_page: limit, affiliation: 'owner,collaborator,organization_member' },
    }),
  'top-repos',
);
