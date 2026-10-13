import { query } from '@solidjs/router';
import { gh } from '../../lib/github';
import type { Repository, Viewer } from '../../lib/types';
import { REPO_FIELDS, type RepoSummary, toRepoSummary } from '../profile/api';

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

/**
 * Details (owner avatar, private flag, description…) for pinned repositories,
 * keyed by lower-cased `owner/name`, in ONE aliased GraphQL request. Repos
 * that were deleted or became inaccessible are simply missing.
 */
export const getPinnedRepos = query(async (names: string[]): Promise<Record<string, RepoSummary>> => {
  const out: Record<string, RepoSummary> = {};
  const list = names.slice(0, 50);
  if (!list.length) return out;
  const fields = list
    .map((full, i) => {
      const [owner, name] = full.split('/');
      return `r${i}:repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(name)}){${REPO_FIELDS}}`;
    })
    .join('\n');
  // Raw POST (not gql()) so a NOT_FOUND for one repo doesn't discard the rest.
  const res = await gh<{ data?: Record<string, any> }>('/graphql', { method: 'POST', body: { query: `query{${fields}}` } }).catch(
    () => ({ data: undefined }),
  );
  list.forEach((full, i) => {
    const r = res.data?.[`r${i}`];
    if (r?.nameWithOwner) out[full.toLowerCase()] = toRepoSummary(r);
  });
  return out;
}, 'pinned-repos');
