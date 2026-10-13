import { action, query } from '@solidjs/router';
import { getRepo } from '../../features/repo/api';
import { gh, gql } from '../../lib/github';

/** The page a hovercard is shown on — GitHub tailors the context lines to it. */
export interface HovercardSubject {
  owner: string;
  repo: string;
  kind: 'repository' | 'issue' | 'pull_request';
  number?: number;
}

export interface HovercardContext {
  message: string;
  octicon: string;
}

export interface HovercardData {
  type: 'User' | 'Organization';
  login: string;
  name: string | null;
  avatarUrl: string;
  /** User bio / organization description. */
  bio: string | null;
  location: string | null;
  pronouns: string | null;
  status: { emojiHTML: string | null; message: string | null } | null;
  isViewer: boolean;
  viewerIsFollowing: boolean;
  viewerCanFollow: boolean;
  /** Organizations. */
  isVerified?: boolean;
  repositories?: number;
  members?: number;
  /** "Committed to this repository in the past day", "Member of @org", … (users only). */
  contexts: HovercardContext[];
}

/** GitHub's database id of the issue / PR a hovercard is shown on (for `subject_id`). */
const itemIds = new Map<string, Promise<{ kind: 'issue' | 'pull_request'; id: string } | null>>();
function itemId(owner: string, repo: string, number: number) {
  const key = `${owner}/${repo}#${number}`.toLowerCase();
  if (!itemIds.has(key)) {
    itemIds.set(
      key,
      gql<any>(
        `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){
          issueOrPullRequest(number:$number){__typename ... on Issue{fullDatabaseId} ... on PullRequest{fullDatabaseId}}
        }}`,
        { owner, name: repo, number },
      )
        .then((d) => {
          const item = d.repository?.issueOrPullRequest;
          if (!item?.fullDatabaseId) return null;
          return { kind: item.__typename === 'PullRequest' ? ('pull_request' as const) : ('issue' as const), id: String(item.fullDatabaseId) };
        })
        .catch(() => null),
    );
  }
  return itemIds.get(key)!;
}

async function subjectQuery(s: HovercardSubject | undefined) {
  if (!s) return {};
  try {
    if (s.kind !== 'repository' && s.number) {
      const item = await itemId(s.owner, s.repo, s.number);
      if (item) return { subject_type: item.kind, subject_id: item.id };
    }
    const repo = await getRepo(s.owner, s.repo);
    return { subject_type: 'repository', subject_id: repo.id };
  } catch {
    return {};
  }
}

async function fetchHovercard(login: string, subject: HovercardSubject | undefined): Promise<HovercardData | null> {
  // Resolve the page subject's id alongside the profile query (only users need it).
  const subjectP = subjectQuery(subject);
  const data = await gql<any>(
    `query($login:String!){repositoryOwner(login:$login){__typename login avatarUrl
      ... on User{name bio location pronouns isViewer viewerIsFollowing viewerCanFollow status{emojiHTML message}}
      ... on Organization{name description location isVerified membersWithRole{totalCount} repositories{totalCount}}
    }}`,
    { login },
  ).catch(() => null);
  const o = data?.repositoryOwner;
  if (!o) return null;
  if (o.__typename === 'Organization') {
    return {
      type: 'Organization',
      login: o.login,
      name: o.name ?? null,
      avatarUrl: o.avatarUrl,
      bio: o.description ?? null,
      location: o.location ?? null,
      pronouns: null,
      status: null,
      isViewer: false,
      viewerIsFollowing: false,
      viewerCanFollow: false,
      isVerified: !!o.isVerified,
      repositories: o.repositories?.totalCount ?? 0,
      members: o.membersWithRole?.totalCount ?? 0,
      contexts: [],
    };
  }
  const contexts = await subjectP
    .then((q) => gh<{ contexts: HovercardContext[] }>(`/users/${encodeURIComponent(o.login)}/hovercard`, { query: q }))
    .then((r) => r.contexts ?? [])
    .catch(() => []);
  return {
    type: 'User',
    login: o.login,
    name: o.name || null,
    avatarUrl: o.avatarUrl,
    bio: o.bio || null,
    location: o.location || null,
    pronouns: o.pronouns || null,
    status: o.status && (o.status.emojiHTML || o.status.message) ? o.status : null,
    isViewer: !!o.isViewer,
    viewerIsFollowing: !!o.viewerIsFollowing,
    viewerCanFollow: !!o.viewerCanFollow,
    contexts,
  };
}

/** Results live for a few minutes so re-hovering is instant (the router query alone only dedupes in-flight work). */
const TTL = 5 * 60_000;
const cache = new Map<string, { at: number; value: Promise<HovercardData | null> }>();
const cacheKey = (login: string, s?: HovercardSubject) =>
  `${login.toLowerCase()}|${s ? `${s.kind}:${s.owner}/${s.repo}#${s.number ?? ''}`.toLowerCase() : ''}`;

/** Everything a user / organization hovercard shows, per login + page subject. */
export const getHovercard = query((login: string, subject?: HovercardSubject): Promise<HovercardData | null> => {
  const key = cacheKey(login, subject);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = fetchHovercard(login, subject);
  cache.set(key, { at: Date.now(), value });
  value.then((v) => v ?? cache.delete(key)).catch(() => cache.delete(key));
  return value;
}, 'user-hovercard');

/** Drop cached cards of one login (after following / unfollowing). */
function forget(login: string) {
  const prefix = `${login.toLowerCase()}|`;
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}

/** PUT / DELETE /user/following/:login from a hovercard's Follow button. */
export const followFromHovercard = action(async (login: string, follow: boolean) => {
  forget(login);
  await gh(`/user/following/${encodeURIComponent(login)}`, { method: follow ? 'PUT' : 'DELETE' });
}, 'hovercard-follow');
