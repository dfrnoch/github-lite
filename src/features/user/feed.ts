import { query } from '@solidjs/router';
import { gh, gql } from '../../lib/github';
import { REPO_FIELDS, type RepoSummary, toRepoSummary } from '../profile/api';

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

export interface FeedExtras {
  /** Repository details keyed by `owner/name` (cards for stars, forks, creates). */
  repos: Record<string, RepoSummary>;
  /** Pull request title/state keyed by `owner/name#number` (the event payload no longer carries them). */
  pulls: Record<string, { title: string; state: string; merged: boolean; isDraft: boolean; comments: number; additions: number; deletions: number }>;
  /** Commit headline keyed by sha (push events only carry `head`). */
  commits: Record<string, { messageHeadline: string; abbreviatedOid: string }>;
}

export interface FeedPage {
  events: GitHubEvent[];
  extras: FeedExtras;
  hasNext: boolean;
}

const CARD_EVENTS = new Set(['WatchEvent', 'ForkEvent', 'PublicEvent', 'CreateEvent', 'ReleaseEvent', 'MemberEvent']);
const PR_EVENTS = new Set(['PullRequestEvent', 'PullRequestReviewEvent', 'PullRequestReviewCommentEvent']);

/**
 * Event payloads are trimmed (no PR titles, no pushed commits), so one
 * aliased GraphQL query per page fills in repo cards, PR titles/states and
 * head-commit headlines. Errors for deleted repos are tolerated.
 */
async function enrich(events: GitHubEvent[]): Promise<FeedExtras> {
  const extras: FeedExtras = { repos: {}, pulls: {}, commits: {} };
  const byRepo = new Map<string, { card: boolean; pulls: Set<number>; commits: Set<string> }>();
  const entry = (name: string) => {
    let e = byRepo.get(name);
    if (!e) byRepo.set(name, (e = { card: false, pulls: new Set(), commits: new Set() }));
    return e;
  };
  for (const ev of events) {
    if (CARD_EVENTS.has(ev.type) && !(ev.type === 'CreateEvent' && ev.payload.ref_type !== 'repository')) entry(ev.repo.name).card = true;
    if (ev.type === 'ForkEvent' && ev.payload.forkee?.full_name) entry(ev.payload.forkee.full_name).card = true;
    if (PR_EVENTS.has(ev.type)) {
      const n = ev.payload.number ?? ev.payload.pull_request?.number;
      if (n) entry(ev.repo.name).pulls.add(n);
    }
    if (ev.type === 'PushEvent' && ev.payload.head) entry(ev.repo.name).commits.add(ev.payload.head);
  }
  if (!byRepo.size) return extras;
  const keys: { alias: string; name: string }[] = [];
  const fields = [...byRepo.entries()]
    .slice(0, 40)
    .map(([name, e], i) => {
      const [owner, repo] = name.split('/');
      keys.push({ alias: `r${i}`, name });
      const inner = [
        e.card ? REPO_FIELDS : 'id',
        ...[...e.pulls].map((n) => `p${n}:pullRequest(number:${n}){title state merged isDraft additions deletions comments{totalCount}}`),
        ...[...e.commits].map((sha) => `c${sha}:object(oid:${JSON.stringify(sha)}){... on Commit{messageHeadline abbreviatedOid}}`),
      ].join(' ');
      return `r${i}:repository(owner:${JSON.stringify(owner)},name:${JSON.stringify(repo)}){${inner}}`;
    })
    .join('\n');
  // Raw POST (not gql()) so partial NOT_FOUND errors for deleted repos don't discard the rest.
  const res = await gh<{ data?: Record<string, any> }>('/graphql', { method: 'POST', body: { query: `query{${fields}}` } }).catch(
    () => ({ data: undefined }),
  );
  const data = res.data ?? {};
  for (const { alias, name } of keys) {
    const r = data[alias];
    if (!r) continue;
    if (r.nameWithOwner) extras.repos[name] = toRepoSummary(r);
    for (const [k, v] of Object.entries(r)) {
      if (!v) continue;
      if (k.startsWith('p') && /^p\d+$/.test(k)) {
        const pr = v as any;
        extras.pulls[`${name}#${k.slice(1)}`] = {
          title: pr.title,
          state: pr.state,
          merged: pr.merged,
          isDraft: pr.isDraft,
          comments: pr.comments.totalCount,
          additions: pr.additions,
          deletions: pr.deletions,
        };
      } else if (/^c[0-9a-f]{40}$/.test(k)) {
        extras.commits[k.slice(1)] = v as any;
      }
    }
  }
  return extras;
}

/** One page (30 events) of the viewer's dashboard feed, with GraphQL extras. */
export const getFeedPage = query(async (login: string, page: number): Promise<FeedPage> => {
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
export const getRecentActivity = query(async (login: string): Promise<RecentItem[]> => {
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
