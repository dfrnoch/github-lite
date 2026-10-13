import { query } from '@solidjs/router';
import { gh, gql } from '../../lib/github';
import { REPO_FIELDS, type RepoSummary, toRepoSummary } from '../profile/api';
import { getViewer } from './api';

/** A GitHub event (GET /users/:user/received_events). Payloads are trimmed by the API. */
export interface GitHubEvent {
  id: string;
  type: string;
  actor: { login: string; display_login?: string; avatar_url: string };
  repo: { id: number; name: string };
  org?: { login: string; avatar_url: string };
  payload: any;
  public: boolean;
  created_at: string;
}

/** One reaction pill (content is GraphQL's ReactionContent, e.g. THUMBS_UP). */
export interface FeedReaction {
  content: string;
  count: number;
  viewerHasReacted: boolean;
}

/** An issue or pull request referenced by feed events. */
export interface FeedItem {
  kind: 'issue' | 'pull';
  title: string;
  number: number;
  state: string;
  stateReason: string | null;
  merged: boolean;
  isDraft: boolean;
  bodyHTML: string;
  author: string | null;
  /** Who merged the pull request. */
  mergedBy: string | null;
  comments: number;
  commits: number;
  reactions: FeedReaction[];
}

/** An issue comment / review / review comment shown as a card's excerpt. */
export interface FeedComment {
  bodyHTML: string;
  url: string | null;
  reactions: FeedReaction[];
}

export interface FeedRelease {
  name: string | null;
  tagName: string;
  isPrerelease: boolean;
  descriptionHTML: string;
  /** Users @mentioned in the notes ("Contributors"). */
  mentions: { login: string; avatarUrl: string | null }[];
  reactions: FeedReaction[];
}

export interface FeedExtras {
  /** Repository details keyed by `owner/name` (cards for stars, forks, creates). */
  repos: Record<string, RepoSummary>;
  /** Owner avatar / org flag of every repository on the page, keyed by `owner/name`. */
  owners: Record<string, { login: string; avatarUrl: string; isOrg: boolean }>;
  /** Issues and pull requests keyed by `owner/name#number` (payloads no longer carry titles/states). */
  items: Record<string, FeedItem>;
  /** Comment / review bodies keyed by node id. */
  comments: Record<string, FeedComment>;
  /** Releases keyed by `owner/name@tag`. */
  releases: Record<string, FeedRelease>;
  /** Commit headline keyed by sha (push events only carry `head`). */
  commits: Record<string, { messageHeadline: string; abbreviatedOid: string }>;
}

export interface FeedPage {
  events: GitHubEvent[];
  extras: FeedExtras;
  hasNext: boolean;
}

const CARD_EVENTS = new Set(['WatchEvent', 'ForkEvent', 'PublicEvent', 'CreateEvent', 'MemberEvent']);
const ITEM_EVENTS = new Set(['PullRequestEvent', 'PullRequestReviewEvent', 'PullRequestReviewCommentEvent', 'IssuesEvent', 'IssueCommentEvent']);
const REACTIONS = 'reactionGroups{content reactors{totalCount} viewerHasReacted}';
const ITEM_FIELDS = `__typename
  ... on Issue{title number state stateReason bodyHTML author{login} comments{totalCount} ${REACTIONS}}
  ... on PullRequest{title number state merged mergedBy{login} isDraft bodyHTML author{login} comments{totalCount} commits{totalCount} ${REACTIONS}}`;
const COMMENT_FIELDS = `__typename
  ... on IssueComment{bodyHTML url ${REACTIONS}}
  ... on PullRequestReview{bodyHTML url ${REACTIONS}}
  ... on PullRequestReviewComment{bodyHTML url ${REACTIONS}}`;
const RELEASE_FIELDS = `name tagName isPrerelease descriptionHTML mentions(first:12){nodes{login avatarUrl}} ${REACTIONS}`;

const toReactions = (groups: any[] | undefined): FeedReaction[] =>
  (groups ?? [])
    .map((g) => ({ content: g.content, count: g.reactors?.totalCount ?? 0, viewerHasReacted: !!g.viewerHasReacted }))
    .filter((g) => g.count > 0);

/** The issue / PR number an event refers to (if any). */
export const eventItemNumber = (ev: GitHubEvent): number | undefined =>
  ev.payload.number ?? ev.payload.pull_request?.number ?? ev.payload.issue?.number;

/** Node id of the comment / review an event carries (if any). */
export const eventCommentId = (ev: GitHubEvent): string | undefined =>
  ev.payload.comment?.node_id ?? (ev.payload.review?.body ? ev.payload.review.node_id : undefined);

/**
 * Event payloads are trimmed (no PR titles, bodies or states, no pushed
 * commits), so ONE aliased GraphQL query per page fills in repo cards,
 * issue/PR titles, states, rendered bodies, reactions and comment counts,
 * comment and release bodies, and head-commit headlines. Errors for deleted
 * repos are tolerated.
 */
async function enrich(events: GitHubEvent[]): Promise<FeedExtras> {
  const extras: FeedExtras = { repos: {}, owners: {}, items: {}, comments: {}, releases: {}, commits: {} };
  const byRepo = new Map<string, { card: boolean; items: Set<number>; commits: Set<string>; releases: Set<string> }>();
  const commentIds = new Set<string>();
  const entry = (name: string) => {
    let e = byRepo.get(name);
    if (!e) byRepo.set(name, (e = { card: false, items: new Set(), commits: new Set(), releases: new Set() }));
    return e;
  };
  for (const ev of events) {
    const e = entry(ev.repo.name);
    if (CARD_EVENTS.has(ev.type) && !(ev.type === 'CreateEvent' && ev.payload.ref_type !== 'repository')) e.card = true;
    if (ev.type === 'ForkEvent' && ev.payload.forkee?.full_name) entry(ev.payload.forkee.full_name).card = true;
    if (ITEM_EVENTS.has(ev.type)) {
      const n = eventItemNumber(ev);
      if (n) e.items.add(n);
      const c = eventCommentId(ev);
      if (c) commentIds.add(c);
    }
    if (ev.type === 'ReleaseEvent' && ev.payload.release?.tag_name) e.releases.add(ev.payload.release.tag_name);
    if (ev.type === 'PushEvent' && ev.payload.head) e.commits.add(ev.payload.head);
  }
  if (!byRepo.size) return extras;

  const repoKeys: { alias: string; name: string }[] = [];
  const itemKeys: { alias: string; key: string }[] = [];
  const releaseKeys: { alias: string; key: string }[] = [];
  const parts = [...byRepo.entries()].slice(0, 40).map(([name, e], i) => {
    const [owner, repo] = name.split('/');
    repoKeys.push({ alias: `r${i}`, name });
    const inner = [
      e.card ? REPO_FIELDS : 'owner{login avatarUrl __typename}',
      ...[...e.items].map((n) => {
        const alias = `i${itemKeys.length}`;
        itemKeys.push({ alias, key: `${name}#${n}` });
        return `${alias}:issueOrPullRequest(number:${n}){${ITEM_FIELDS}}`;
      }),
      ...[...e.releases].map((tag) => {
        const alias = `l${releaseKeys.length}`;
        releaseKeys.push({ alias, key: `${name}@${tag}` });
        return `${alias}:release(tagName:${JSON.stringify(tag)}){${RELEASE_FIELDS}}`;
      }),
      ...[...e.commits].map((sha) => `c${sha}:object(oid:${JSON.stringify(sha)}){... on Commit{messageHeadline abbreviatedOid}}`),
    ].join(' ');
    return `r${i}:repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(repo)}){${inner}}`;
  });
  const nodeKeys = [...commentIds].slice(0, 40).map((id, i) => ({ alias: `n${i}`, id }));
  for (const { alias, id } of nodeKeys) parts.push(`${alias}:node(id:${JSON.stringify(id)}){${COMMENT_FIELDS}}`);

  // Raw POST (not gql()) so partial NOT_FOUND errors for deleted repos don't discard the rest.
  const res = await gh<{ data?: Record<string, any> }>('/graphql', { method: 'POST', body: { query: `query{${parts.join('\n')}}` } }).catch(
    () => ({ data: undefined }),
  );
  const data = res.data ?? {};
  for (const { alias, name } of repoKeys) {
    const r = data[alias];
    if (!r) continue;
    if (r.nameWithOwner) extras.repos[name] = toRepoSummary(r);
    if (r.owner) extras.owners[name] = { login: r.owner.login, avatarUrl: r.owner.avatarUrl, isOrg: r.owner.__typename === 'Organization' };
    for (const [k, v] of Object.entries(r)) if (v && /^c[0-9a-f]{40}$/.test(k)) extras.commits[k.slice(1)] = v as any;
    for (const { alias: a, key } of itemKeys) {
      const it = r[a];
      if (!it?.title) continue;
      extras.items[key] = {
        kind: it.__typename === 'PullRequest' ? 'pull' : 'issue',
        title: it.title,
        number: it.number,
        state: it.state,
        stateReason: it.stateReason ?? null,
        merged: !!it.merged,
        isDraft: !!it.isDraft,
        bodyHTML: it.bodyHTML ?? '',
        author: it.author?.login ?? null,
        mergedBy: it.mergedBy?.login ?? null,
        comments: it.comments?.totalCount ?? 0,
        commits: it.commits?.totalCount ?? 0,
        reactions: toReactions(it.reactionGroups),
      };
    }
    for (const { alias: a, key } of releaseKeys) {
      const rel = r[a];
      if (!rel) continue;
      extras.releases[key] = {
        name: rel.name,
        tagName: rel.tagName,
        isPrerelease: !!rel.isPrerelease,
        descriptionHTML: rel.descriptionHTML ?? '',
        mentions: (rel.mentions?.nodes ?? []).filter(Boolean).map((u: any) => ({ login: u.login, avatarUrl: u.avatarUrl })),
        reactions: toReactions(rel.reactionGroups),
      };
    }
  }
  for (const { alias, id } of nodeKeys) {
    const c = data[alias];
    if (c?.bodyHTML != null) extras.comments[id] = { bodyHTML: c.bodyHTML, url: c.url ?? null, reactions: toReactions(c.reactionGroups) };
  }
  return extras;
}

/** One page (30 events) of the viewer's dashboard feed, with GraphQL extras. */
export const getFeedPage = query(async (page: number): Promise<FeedPage> => {
  // Resolving the viewer here (cached) keeps viewer → events one flight for the page.
  const { login } = await getViewer();
  const events = await gh<GitHubEvent[]>(`/users/${login}/received_events`, { query: { page, per_page: 30 } });
  return { events, extras: await enrich(events), hasNext: events.length === 30 && page < 10 };
}, 'feed-page');

export interface RecentItem {
  kind: 'issue' | 'pull';
  title: string;
  number: number;
  repo: string;
  state: string;
  stateReason: string | null;
  merged: boolean;
  isDraft: boolean;
  updatedAt: string;
}

/** Dashboard "Recent activity": issues & PRs the viewer was recently involved in. */
export const getRecentActivity = query(async (): Promise<RecentItem[]> => {
  const { login } = await getViewer();
  const data = await gql<any>(
    `query($q:String!){search(type:ISSUE,query:$q,first:5){nodes{
      __typename
      ... on Issue{title number state stateReason updatedAt repository{nameWithOwner}}
      ... on PullRequest{title number state merged isDraft updatedAt repository{nameWithOwner}}
    }}}`,
    { q: `involves:${login} sort:updated-desc` },
  );
  return data.search.nodes
    .filter((n: any) => n?.title)
    .map((n: any) => ({
      kind: n.__typename === 'PullRequest' ? 'pull' : 'issue',
      title: n.title,
      number: n.number,
      repo: n.repository.nameWithOwner,
      state: n.state,
      stateReason: n.stateReason ?? null,
      merged: !!n.merged,
      isDraft: !!n.isDraft,
      updatedAt: n.updatedAt,
    }));
}, 'recent-activity');

const TRENDING_KEY = 'gh-lite:feed-trending';
const TRENDING_TTL = 60 * 60 * 1000;

/**
 * "Trending repositories" card: the most-starred repositories created in the
 * last 7 days (the API has no trending endpoint). Cached in localStorage for
 * an hour so the dashboard doesn't spend a search request on every visit.
 */
export const getFeedTrending = query(async (): Promise<RepoSummary[]> => {
  try {
    const cached = JSON.parse(localStorage.getItem(TRENDING_KEY) ?? 'null') as { at: number; repos: RepoSummary[] } | null;
    if (cached && Date.now() - cached.at < TRENDING_TTL && Array.isArray(cached.repos)) return cached.repos;
  } catch {
    // Corrupt cache: refetch.
  }
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const data = await gql<any>(`query($q:String!){search(type:REPOSITORY,query:$q,first:5){nodes{... on Repository{${REPO_FIELDS}}}}}`, {
    q: `created:>${since} sort:stars-desc`,
  });
  const repos = (data.search.nodes as any[]).filter((n) => n?.id).map(toRepoSummary);
  try {
    localStorage.setItem(TRENDING_KEY, JSON.stringify({ at: Date.now(), repos }));
  } catch {
    // Storage full / disabled: fine, just uncached.
  }
  return repos;
}, 'feed-trending');
