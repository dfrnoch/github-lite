import { action, query } from '@solidjs/router';
import { gh, GitHubError, gql } from '../../lib/github';
import type { Repository, SimpleUser } from '../../lib/types';

/* ------------------------------------------------------------------ */
/* Repository summaries (profile / org / stars lists, pinned cards)    */
/* ------------------------------------------------------------------ */

/** What a repo list item needs — normalized from GraphQL or REST. */
export interface RepoSummary {
  id: string;
  name: string;
  fullName: string;
  owner: { login: string; avatarUrl: string; isOrg: boolean };
  description: string | null;
  descriptionHTML?: string | null;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  isTemplate: boolean;
  isMirror: boolean;
  parent: string | null;
  language: { name: string; color: string | null } | null;
  stars: number;
  forks: number;
  license: string | null;
  updatedAt: string;
  topics: string[];
  viewerHasStarred?: boolean;
}

/** GraphQL selection for RepoSummary (use with `toRepoSummary`). */
export const REPO_FIELDS = `id name nameWithOwner description shortDescriptionHTML isPrivate isFork isArchived isTemplate isMirror
  owner{login avatarUrl __typename} parent{nameWithOwner}
  primaryLanguage{name color} stargazerCount forkCount licenseInfo{name spdxId}
  pushedAt updatedAt viewerHasStarred repositoryTopics(first:12){nodes{topic{name}}}`;

export function toRepoSummary(r: any): RepoSummary {
  const spdx = r.licenseInfo?.spdxId;
  return {
    id: r.id,
    name: r.name,
    fullName: r.nameWithOwner,
    owner: { login: r.owner.login, avatarUrl: r.owner.avatarUrl, isOrg: r.owner.__typename === 'Organization' },
    description: r.description,
    descriptionHTML: r.shortDescriptionHTML,
    isPrivate: r.isPrivate,
    isFork: r.isFork,
    isArchived: r.isArchived,
    isTemplate: r.isTemplate,
    isMirror: r.isMirror,
    parent: r.parent?.nameWithOwner ?? null,
    language: r.primaryLanguage,
    stars: r.stargazerCount,
    forks: r.forkCount,
    license: r.licenseInfo ? (spdx && spdx !== 'NOASSERTION' ? `${r.licenseInfo.name}` : r.licenseInfo.name) : null,
    updatedAt: r.pushedAt ?? r.updatedAt,
    topics: r.repositoryTopics?.nodes.map((n: any) => n.topic.name) ?? [],
    viewerHasStarred: r.viewerHasStarred,
  };
}

/** Normalize a REST repository (for callers that only have REST data). */
export function repoSummaryFromRest(r: Repository): RepoSummary {
  return {
    id: r.node_id,
    name: r.name,
    fullName: r.full_name,
    owner: { login: r.owner.login, avatarUrl: r.owner.avatar_url, isOrg: r.owner.type === 'Organization' },
    description: r.description,
    isPrivate: r.private,
    isFork: r.fork,
    isArchived: r.archived,
    isTemplate: !!r.is_template,
    isMirror: false,
    parent: r.parent?.full_name ?? null,
    language: r.language ? { name: r.language, color: null } : null,
    stars: r.stargazers_count,
    forks: r.forks_count,
    license: r.license?.name ?? null,
    updatedAt: r.pushed_at ?? r.updated_at,
    topics: r.topics ?? [],
  };
}

/** Re-read REST list items through GraphQL `nodes` (stars state, parent, colors), keeping REST order. */
async function enrichRepos(repos: Repository[]): Promise<RepoSummary[]> {
  if (!repos.length) return [];
  const data = await gql<{ nodes: any[] }>(`query($ids:[ID!]!){nodes(ids:$ids){... on Repository{${REPO_FIELDS}}}}`, {
    ids: repos.map((r) => r.node_id),
  }).catch(() => null);
  return repos.map((r, i) => {
    const node = data?.nodes[i];
    return node?.id ? toRepoSummary(node) : repoSummaryFromRest(r);
  });
}

export interface RepoListResult {
  items: RepoSummary[];
  total: number | null;
  page: number;
  hasNext: boolean;
}

export interface RepoFilters {
  q?: string;
  type?: string;
  language?: string;
  sort?: string;
}

export const PER_PAGE = 30;

/** Offset cursors work for GraphQL `search` connections (not for v2 cursors). */
const searchCursor = (page: number, perPage: number) => (page > 1 ? btoa(`cursor:${(page - 1) * perPage}`) : null);

const TYPE_QUALIFIERS: Record<string, string> = {
  public: 'is:public',
  private: 'is:private',
  sources: 'fork:false',
  // github.com's `type=source` (what `hide-user-forks` links to): no forks, no archives.
  source: 'fork:false archived:false',
  forks: 'fork:only',
  archived: 'archived:true',
  mirror: 'mirror:true',
  template: 'template:true',
};

async function searchRepos(q: string, page: number, perPage = PER_PAGE): Promise<RepoListResult> {
  const data = await gql<any>(
    `query($q:String!,$first:Int!,$after:String){search(type:REPOSITORY,query:$q,first:$first,after:$after){
      repositoryCount pageInfo{hasNextPage} nodes{... on Repository{${REPO_FIELDS}}}}}`,
    { q, first: perPage, after: searchCursor(page, perPage) },
  );
  const total = data.search.repositoryCount as number;
  return {
    items: data.search.nodes.filter((n: any) => n?.id).map(toRepoSummary),
    total,
    page,
    hasNext: page * perPage < Math.min(total, 1000),
  };
}

/**
 * The Repositories tab of a user or organization. Plain listings page through
 * REST (exact, includes the viewer's private repos); text / language / type /
 * star filters go through repository search, like github.com does.
 */
export const getOwnerRepos = query(
  async (login: string, isOrg: boolean, isViewer: boolean, f: RepoFilters, page = 1): Promise<RepoListResult> => {
    const type = f.type ?? '';
    const sort = f.sort ?? '';
    const restType = isOrg ? ['', 'all', 'public', 'private', 'forks', 'sources'].includes(type) : ['', 'all', 'public', 'private'].includes(type);
    if (!f.q && !f.language && restType && sort !== 'stargazers') {
      const restSort = sort === 'name' ? 'full_name' : 'pushed';
      const direction = sort === 'name' ? 'asc' : 'desc';
      let path: string;
      let q: Record<string, string>;
      if (isOrg) {
        path = `/orgs/${login}/repos`;
        q = { type: type || 'all', sort: restSort, direction };
      } else if (isViewer) {
        path = '/user/repos';
        q = { affiliation: 'owner', visibility: type === 'public' || type === 'private' ? type : 'all', sort: restSort, direction };
      } else {
        if (type === 'private') return { items: [], total: 0, page, hasNext: false };
        path = `/users/${login}/repos`;
        q = { type: 'owner', sort: restSort, direction };
      }
      const res = await gh<Repository[]>(path, { query: { ...q, page, per_page: PER_PAGE } });
      return { items: await enrichRepos(res), total: null, page, hasNext: res.length === PER_PAGE };
    }
    const parts = [`${isOrg ? 'org' : 'user'}:${login}`, TYPE_QUALIFIERS[type] ?? 'fork:true'];
    if (f.language) parts.push(`language:"${f.language}"`);
    if (f.q) parts.push(`${f.q} in:name`);
    parts.push(sort === 'stargazers' ? 'sort:stars-desc' : sort === 'name' ? '' : 'sort:updated-desc');
    return searchRepos(parts.filter(Boolean).join(' '), page);
  },
  'owner-repos',
);

/* ------------------------------------------------------------------ */
/* Owner profile                                                        */
/* ------------------------------------------------------------------ */

export interface PinnedGist {
  kind: 'gist';
  name: string;
  description: string | null;
  url: string;
  stars: number;
  file: string | null;
  language: { name: string; color: string | null } | null;
}
export type PinnedItem = ({ kind: 'repo' } & RepoSummary) | PinnedGist;

export interface SocialAccount {
  provider: string;
  url: string;
  displayName: string;
}

interface OwnerBase {
  login: string;
  name: string | null;
  avatarUrl: string;
  location: string | null;
  websiteUrl: string | null;
  email: string | null;
  twitterUsername: string | null;
  followers: number;
  repositories: number;
  projects: number;
  packages: number;
  pinned: PinnedItem[];
  popular: RepoSummary[];
  languages: { name: string; color: string | null; count: number }[];
}

export interface UserProfile extends OwnerBase {
  type: 'User';
  id: string;
  databaseId: number;
  bio: string | null;
  bioHTML: string | null;
  company: string | null;
  companyHTML: string | null;
  pronouns: string | null;
  hireable: boolean;
  status: { emojiHTML: string | null; message: string | null } | null;
  isViewer: boolean;
  viewerIsFollowing: boolean;
  viewerCanFollow: boolean;
  /** Whether this user follows the signed-in viewer. */
  isFollowingViewer: boolean;
  following: number;
  stars: number;
  organizations: { login: string; avatarUrl: string; name: string | null }[];
  socialAccounts: SocialAccount[];
  createdAt: string;
}

export interface OrgProfile extends OwnerBase {
  type: 'Organization';
  id: string;
  databaseId: number;
  description: string | null;
  descriptionHTML: string | null;
  isVerified: boolean;
  viewerIsAMember: boolean;
  viewerCanAdminister: boolean;
  members: number;
  teams: number;
  people: { login: string; avatarUrl: string; name: string | null }[];
  topics: { name: string; count: number }[];
  recent: RepoSummary[];
}

export type OwnerProfile = UserProfile | OrgProfile;

const PINNED = `pinnedItems(first:6){nodes{
  __typename
  ... on Repository{${REPO_FIELDS}}
  ... on Gist{name description url stargazerCount files(limit:1){name language{name color}}}
}}`;

const toPinned = (n: any): PinnedItem =>
  n.__typename === 'Gist'
    ? {
        kind: 'gist',
        name: n.files?.[0]?.name ?? n.name,
        description: n.description,
        url: n.url,
        stars: n.stargazerCount,
        file: n.files?.[0]?.name ?? null,
        language: n.files?.[0]?.language ?? null,
      }
    : { kind: 'repo', ...toRepoSummary(n) };

function countLanguages(nodes: any[]) {
  const map = new Map<string, { name: string; color: string | null; count: number }>();
  for (const n of nodes) {
    const l = n.primaryLanguage;
    if (!l) continue;
    const cur = map.get(l.name) ?? { name: l.name, color: l.color, count: 0 };
    cur.count++;
    map.set(l.name, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/**
 * Everything the /:owner page header + overview needs, for a user or an
 * organization, in one GraphQL round trip (the owner's type is detected from
 * the response, like github.com does from the login).
 */
export const getOwnerProfile = query(async (login: string): Promise<OwnerProfile> => {
  // REST in parallel: organizations have no follower count in GraphQL.
  const restP = gh<{ followers: number }>(`/users/${login}`).catch(() => ({ followers: 0 }));
  const data = await gql<any>(
    `query($login:String!){repositoryOwner(login:$login){
      __typename
      ... on User{
        id databaseId login name avatarUrl bio bioHTML company companyHTML location email websiteUrl twitterUsername pronouns isHireable createdAt
        status{emojiHTML message}
        isViewer viewerIsFollowing viewerCanFollow isFollowingViewer
        followers{totalCount} following{totalCount}
        repositories(ownerAffiliations:OWNER){totalCount}
        starredRepositories{totalCount}
        projectsV2{totalCount} packages{totalCount}
        organizations(first:30){nodes{login avatarUrl name}}
        socialAccounts(first:10){nodes{provider url displayName}}
        ${PINNED}
        popular:repositories(first:6,ownerAffiliations:OWNER,privacy:PUBLIC,isFork:false,orderBy:{field:STARGAZERS,direction:DESC}){nodes{${REPO_FIELDS}}}
        langs:repositories(first:100,ownerAffiliations:OWNER,orderBy:{field:PUSHED_AT,direction:DESC}){nodes{primaryLanguage{name color}}}
      }
      ... on Organization{
        id databaseId login name avatarUrl description descriptionHTML location email websiteUrl twitterUsername isVerified
        viewerIsAMember viewerCanAdminister
        membersWithRole{totalCount}
        people:membersWithRole(first:24){nodes{login avatarUrl name}}
        teams{totalCount}
        repositories{totalCount}
        projectsV2{totalCount} packages{totalCount}
        ${PINNED}
        popular:repositories(first:6,privacy:PUBLIC,orderBy:{field:STARGAZERS,direction:DESC}){nodes{${REPO_FIELDS}}}
        recent:repositories(first:10,orderBy:{field:PUSHED_AT,direction:DESC}){nodes{${REPO_FIELDS}}}
        langs:repositories(first:100,orderBy:{field:PUSHED_AT,direction:DESC}){nodes{primaryLanguage{name color} repositoryTopics(first:10){nodes{topic{name}}}}}
      }
    }}`,
    { login },
  );
  const o = data.repositoryOwner;
  if (!o) throw new GitHubError(404, 'Not Found');
  const base = {
    login: o.login,
    name: o.name || null,
    avatarUrl: o.avatarUrl,
    location: o.location || null,
    websiteUrl: o.websiteUrl || null,
    email: o.email || null,
    twitterUsername: o.twitterUsername || null,
    repositories: o.repositories.totalCount,
    projects: o.projectsV2?.totalCount ?? 0,
    packages: o.packages?.totalCount ?? 0,
    pinned: o.pinnedItems.nodes.filter(Boolean).map(toPinned),
    popular: o.popular.nodes.map(toRepoSummary),
    languages: countLanguages(o.langs.nodes),
  };
  if (o.__typename === 'Organization') {
    const rest = await restP;
    const topics = new Map<string, number>();
    for (const n of o.langs.nodes) for (const t of n.repositoryTopics.nodes) topics.set(t.topic.name, (topics.get(t.topic.name) ?? 0) + 1);
    return {
      ...base,
      type: 'Organization',
      id: o.id,
      databaseId: o.databaseId,
      followers: rest.followers,
      description: o.description || null,
      descriptionHTML: o.descriptionHTML || null,
      isVerified: o.isVerified,
      viewerIsAMember: o.viewerIsAMember,
      viewerCanAdminister: o.viewerCanAdminister,
      members: o.membersWithRole.totalCount,
      teams: o.teams.totalCount,
      people: o.people.nodes,
      topics: [...topics].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      recent: o.recent.nodes.map(toRepoSummary),
    };
  }
  return {
    ...base,
    type: 'User',
    id: o.id,
    databaseId: o.databaseId,
    bio: o.bio || null,
    bioHTML: o.bioHTML || null,
    company: o.company || null,
    companyHTML: o.companyHTML || null,
    pronouns: o.pronouns || null,
    hireable: o.isHireable,
    status: o.status,
    isViewer: o.isViewer,
    viewerIsFollowing: o.viewerIsFollowing,
    viewerCanFollow: o.viewerCanFollow,
    isFollowingViewer: !!o.isFollowingViewer,
    followers: o.followers.totalCount,
    following: o.following.totalCount,
    stars: o.starredRepositories.totalCount,
    organizations: o.organizations.nodes,
    socialAccounts: o.socialAccounts.nodes,
    createdAt: o.createdAt,
  };
}, 'owner-profile');

/**
 * Logins of a user's *public* organization memberships (REST lists only
 * those), so `mark-private-orgs` can flag the rest of the viewer's orgs.
 */
export const getPublicOrgs = query(async (login: string) => {
  const orgs = await gh<{ login: string }[]>(`/users/${login}/orgs`, { query: { per_page: 100 } });
  return orgs.map((o) => o.login.toLowerCase());
}, 'public-orgs');

/** Rendered profile README: `login/login` for users, `.github/profile/README.md` for orgs. Null when absent. */
export const getProfileReadme = query(async (login: string, isOrg: boolean) => {
  try {
    const path = isOrg ? `/repos/${login}/.github/contents/profile/README.md` : `/repos/${login}/${login}/readme`;
    const html = await gh<string>(path, { accept: 'application/vnd.github.html' });
    return { html, repo: isOrg ? `${login}/.github` : `${login}/${login}`, path: isOrg ? 'profile/README.md' : 'README.md' };
  } catch (e) {
    if (e instanceof GitHubError && (e.status === 404 || e.status === 403 || e.status === 451)) return null;
    throw e;
  }
}, 'profile-readme');

/* ------------------------------------------------------------------ */
/* Contributions                                                        */
/* ------------------------------------------------------------------ */

export type ContributionLevel = 'NONE' | 'FIRST_QUARTILE' | 'SECOND_QUARTILE' | 'THIRD_QUARTILE' | 'FOURTH_QUARTILE';

export interface ContributionDay {
  date: string;
  count: number;
  level: ContributionLevel;
  weekday: number;
}

export interface Contributions {
  total: number;
  weeks: ContributionDay[][];
  months: { name: string; firstDay: string; totalWeeks: number }[];
  years: number[];
  activity: {
    commits: { repo: string; count: number }[];
    totalCommits: number;
    pulls: { repo: string; count: number }[];
    totalPulls: number;
    issues: { repo: string; count: number }[];
    totalIssues: number;
    reviews: number;
    created: { repo: string; at: string }[];
  };
}

/** Contribution calendar for a user — the last year, or a calendar year. */
export const getContributions = query(async (login: string, year?: number): Promise<Contributions | null> => {
  const range = year ? { from: `${year}-01-01T00:00:00Z`, to: `${year}-12-31T23:59:59Z` } : { from: null, to: null };
  const data = await gql<any>(
    `query($login:String!,$from:DateTime,$to:DateTime){user(login:$login){contributionsCollection(from:$from,to:$to){
      contributionYears
      contributionCalendar{totalContributions months{name firstDay totalWeeks}
        weeks{contributionDays{date contributionCount contributionLevel weekday}}}
      totalCommitContributions totalPullRequestContributions totalIssueContributions totalPullRequestReviewContributions
      commitContributionsByRepository(maxRepositories:6){repository{nameWithOwner} contributions{totalCount}}
      pullRequestContributionsByRepository(maxRepositories:6){repository{nameWithOwner} contributions{totalCount}}
      issueContributionsByRepository(maxRepositories:6){repository{nameWithOwner} contributions{totalCount}}
      repositoryContributions(first:6){nodes{occurredAt repository{nameWithOwner}}}
    }}}`,
    { login, ...range },
  ).catch((e) => {
    // Organizations (or unknown logins) have no contributions.
    if (e instanceof GitHubError && e.notFound) return { user: null };
    throw e;
  });
  const c = data.user?.contributionsCollection;
  if (!c) return null;
  const byRepo = (list: any[]) => list.map((x) => ({ repo: x.repository.nameWithOwner, count: x.contributions.totalCount }));
  return {
    total: c.contributionCalendar.totalContributions,
    months: c.contributionCalendar.months,
    weeks: c.contributionCalendar.weeks.map((w: any) =>
      w.contributionDays.map((d: any) => ({ date: d.date, count: d.contributionCount, level: d.contributionLevel, weekday: d.weekday })),
    ),
    years: c.contributionYears,
    activity: {
      commits: byRepo(c.commitContributionsByRepository),
      totalCommits: c.totalCommitContributions,
      pulls: byRepo(c.pullRequestContributionsByRepository),
      totalPulls: c.totalPullRequestContributions,
      issues: byRepo(c.issueContributionsByRepository),
      totalIssues: c.totalIssueContributions,
      reviews: c.totalPullRequestReviewContributions,
      created: c.repositoryContributions.nodes.map((n: any) => ({ repo: n.repository.nameWithOwner, at: n.occurredAt })),
    },
  };
}, 'contributions');

/* ------------------------------------------------------------------ */
/* Stars, followers, following                                          */
/* ------------------------------------------------------------------ */

const STAR_WINDOW = 300;

/**
 * Stars tab. Without filters it pages REST `/users/:login/starred` (sorted by
 * star date or recent activity); with a text/language/type filter or the
 * "most stars" sort it filters a window of the most recent 300 stars locally,
 * since the API has no search over a user's stars.
 */
export const getStarred = query(async (login: string, f: RepoFilters, page = 1): Promise<RepoListResult> => {
  const sort = f.sort || 'created';
  const filtered = !!(f.q || f.language || f.type) || sort === 'stars';
  if (!filtered) {
    const res = await gh<Repository[]>(`/users/${login}/starred`, {
      query: { sort: sort === 'updated' ? 'updated' : 'created', direction: 'desc', page, per_page: PER_PAGE },
    });
    return { items: await enrichRepos(res), total: null, page, hasNext: res.length === PER_PAGE };
  }
  const all: Repository[] = [];
  for (let p = 1; all.length < STAR_WINDOW; p++) {
    const res = await gh<Repository[]>(`/users/${login}/starred`, {
      query: { sort: sort === 'updated' ? 'updated' : 'created', direction: 'desc', page: p, per_page: 100 },
    });
    all.push(...res);
    if (res.length < 100) break;
  }
  const text = f.q?.toLowerCase() ?? '';
  let list = all.filter(
    (r) =>
      (!text || r.full_name.toLowerCase().includes(text) || (r.description ?? '').toLowerCase().includes(text)) &&
      (!f.language || r.language?.toLowerCase() === f.language.toLowerCase()) &&
      (!f.type ||
        (f.type === 'public' && !r.private) ||
        (f.type === 'private' && r.private) ||
        ((f.type === 'sources' || f.type === 'source') && !r.fork) ||
        (f.type === 'forks' && r.fork) ||
        (f.type === 'template' && r.is_template) ||
        (f.type === 'archived' && r.archived)),
  );
  if (sort === 'stars') list = [...list].sort((a, b) => b.stargazers_count - a.stargazers_count);
  const slice = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  return { items: await enrichRepos(slice), total: list.length, page, hasNext: page * PER_PAGE < list.length };
}, 'starred');

/** Languages of a user's starred repos (Stars tab language filter). */
export const getStarredLanguages = query(async (login: string) => {
  const res = await gh<Repository[]>(`/users/${login}/starred`, { query: { per_page: 100 } });
  const set = new Set(res.map((r) => r.language).filter(Boolean) as string[]);
  return [...set].sort();
}, 'starred-languages');

export interface UserCard {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  isViewer: boolean;
  viewerIsFollowing: boolean;
  isOrg: boolean;
}

/** Add names, bios and follow state to REST user lists (one GraphQL `nodes` call). */
export async function enrichUsers(users: SimpleUser[] & { node_id?: string }[]): Promise<UserCard[]> {
  if (!users.length) return [];
  const ids = users.map((u: any) => u.node_id as string);
  const data = await gql<{ nodes: any[] }>(
    `query($ids:[ID!]!){nodes(ids:$ids){__typename ... on User{id login name avatarUrl bio company location isViewer viewerIsFollowing}
      ... on Organization{id login name avatarUrl description location}}}`,
    { ids },
  ).catch(() => null);
  return users.map((u, i) => {
    const n = data?.nodes[i];
    return {
      id: n?.id ?? ids[i],
      login: u.login,
      name: n?.name || null,
      avatarUrl: u.avatar_url,
      bio: n?.bio ?? n?.description ?? null,
      company: n?.company ?? null,
      location: n?.location ?? null,
      isViewer: !!n?.isViewer,
      viewerIsFollowing: !!n?.viewerIsFollowing,
      isOrg: u.type === 'Organization',
    };
  });
}

/** `?tab=followers` / `?tab=following` — 50 per page like github.com. */
export const getFollows = query(async (login: string, which: 'followers' | 'following', page = 1) => {
  const res = await gh<SimpleUser[]>(`/users/${login}/${which}`, { query: { page, per_page: 50 } });
  return { items: await enrichUsers(res as any), page, hasNext: res.length === 50 };
}, 'follows');

/* ------------------------------------------------------------------ */
/* Mutations                                                            */
/* ------------------------------------------------------------------ */

/** Whether the viewer follows `login` (works for organizations too). */
export const getViewerFollows = query(async (login: string) => {
  try {
    await gh(`/user/following/${login}`);
    return true;
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return false;
    throw e;
  }
}, 'viewer-follows');

export const followUser = action(async (login: string, follow: boolean) => {
  await gh(`/user/following/${login}`, { method: follow ? 'PUT' : 'DELETE' });
}, 'follow-user');

export interface ProfilePatch {
  name?: string;
  bio?: string;
  company?: string;
  blog?: string;
  location?: string;
  twitter_username?: string;
  hireable?: boolean;
}

/** PATCH /user — the inline "Edit profile" form. */
export const updateProfile = action(async (patch: ProfilePatch) => {
  await gh('/user', { method: 'PATCH', body: patch });
}, 'update-profile');

/* ------------------------------------------------------------------ */
/* Projects & packages (read-only lists that link out to github.com)    */
/* ------------------------------------------------------------------ */

export interface ProjectCard {
  number: number;
  title: string;
  shortDescription: string | null;
  url: string;
  closed: boolean;
  updatedAt: string;
}

export const getOwnerProjects = query(async (login: string, isOrg: boolean, closed = false): Promise<ProjectCard[]> => {
  const data = await gql<any>(
    `query($login:String!){owner:${isOrg ? 'organization' : 'user'}(login:$login){
      projectsV2(first:50,orderBy:{field:UPDATED_AT,direction:DESC}){nodes{number title shortDescription url closed updatedAt}}
    }}`,
    { login },
  );
  return (data.owner?.projectsV2.nodes ?? []).filter((p: ProjectCard) => p.closed === closed);
}, 'owner-projects');

export interface PackageCard {
  name: string;
  packageType: string;
  repository: string | null;
  version: string | null;
}

export const getOwnerPackages = query(async (login: string, isOrg: boolean): Promise<PackageCard[]> => {
  const data = await gql<any>(
    `query($login:String!){owner:${isOrg ? 'organization' : 'user'}(login:$login){
      packages(first:50){nodes{name packageType repository{nameWithOwner} latestVersion{version}}}
    }}`,
    { login },
  );
  return (data.owner?.packages.nodes ?? []).map((p: any) => ({
    name: p.name,
    packageType: p.packageType,
    repository: p.repository?.nameWithOwner ?? null,
    version: p.latestVersion?.version ?? null,
  }));
}, 'owner-packages');

/** Languages used across an owner's most recently pushed 100 repositories (language filter menus). */
export const getOwnerLanguages = query(async (login: string, isOrg: boolean) => {
  const data = await gql<any>(
    `query($login:String!){owner:${isOrg ? 'organization' : 'user'}(login:$login){
      repositories(first:100,orderBy:{field:PUSHED_AT,direction:DESC}){nodes{primaryLanguage{name color}}}
    }}`,
    { login },
  );
  return countLanguages(data.owner?.repositories.nodes ?? []).map((l) => l.name);
}, 'owner-languages');
