import { gql } from '../../lib/github';
import { RESERVED } from '../layout/headerContext';

export interface MentionUser {
  login: string;
  name: string | null;
  avatarUrl: string;
}

/** The issue / pull request a comment box is on, from the page URL (`/owner/repo/pull/123/files` …). */
function itemNumber(repo: string): number | null {
  const m = location.pathname.match(/^\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)/);
  return m && `${m[1]}/${m[2]}`.toLowerCase() === repo.toLowerCase() ? Number(m[3]) : null;
}

const USER = 'login name avatarUrl';
const LIMIT = 8;

/**
 * Everyone already on the issue / pull request — the people github.com's
 * @-suggester offers first: author, requested reviewers, assignees,
 * commenters and reviewers.
 */
async function fetchPeople(repo: string, number: number): Promise<MentionUser[]> {
  const [owner, name] = repo.split('/');
  const item = `author{login avatarUrl ... on User{name}} assignees(first:20){nodes{${USER}}} participants(first:100){nodes{${USER}}}`;
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){
      issueOrPullRequest(number:$number){
        ... on Issue{${item}}
        ... on PullRequest{${item} reviewRequests(first:20){nodes{requestedReviewer{... on User{${USER}}}}}}
      }
    }}`,
    { owner, name, number },
  );
  const i = data.repository?.issueOrPullRequest;
  return dedupe([
    i?.author,
    ...(i?.reviewRequests?.nodes ?? []).map((n: any) => n.requestedReviewer),
    ...(i?.assignees?.nodes ?? []),
    ...(i?.participants?.nodes ?? []),
  ]);
}

/** The repository's mentionable users matching `q` (searched by GitHub — listing them all is slow on big repos). */
async function fetchMatching(repo: string, q: string): Promise<MentionUser[]> {
  const [owner, name] = repo.split('/');
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$q:String!){repository(owner:$owner,name:$name){
      mentionableUsers(first:${LIMIT},query:$q){nodes{${USER}}}
    }}`,
    { owner, name, q },
  );
  return dedupe(data.repository?.mentionableUsers?.nodes ?? []);
}

function dedupe(list: (MentionUser | null | undefined)[]): MentionUser[] {
  const seen = new Set<string>();
  const out: MentionUser[] = [];
  for (const u of list) {
    if (!u?.login || seen.has(u.login.toLowerCase())) continue;
    seen.add(u.login.toLowerCase());
    out.push({ login: u.login, name: u.name || null, avatarUrl: u.avatarUrl });
  }
  return out;
}

const people = new Map<string, Promise<MentionUser[]>>();
const matching = new Map<string, Promise<MentionUser[]>>();

function cached<T>(map: Map<string, Promise<T[]>>, key: string, load: () => Promise<T[]>) {
  let hit = map.get(key);
  if (!hit) {
    hit = load().catch(() => {
      map.delete(key);
      return [];
    });
    map.set(key, hit);
  }
  return hit;
}

/** Rank: login prefix, then name-word prefix, then anywhere — stable within each (participants stay first). */
function filter(users: MentionUser[], q: string) {
  if (!q) return users;
  const needle = q.toLowerCase();
  const rank = (u: MentionUser) => {
    const login = u.login.toLowerCase();
    const name = (u.name ?? '').toLowerCase();
    if (login.startsWith(needle)) return 0;
    if (name.split(/\s+/).some((w) => w.startsWith(needle))) return 1;
    if (login.includes(needle) || name.includes(needle)) return 2;
    return 3;
  };
  return users
    .map((u, i) => ({ u, i, r: rank(u) }))
    .filter((x) => x.r < 3)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.u);
}

/** People on the current issue / pull request matching `q` (fast; shown while the repository search runs). */
export async function mentionPeople(repo: string, q: string): Promise<MentionUser[]> {
  const number = itemNumber(repo);
  if (number == null) return [];
  const list = await cached(people, `${repo}#${number}`.toLowerCase(), () => fetchPeople(repo, number));
  return filter(list, q).slice(0, LIMIT);
}

/** Suggestions for `@q` in a comment box of `repo` ("owner/repo"): the item's people, then other mentionable users. */
export async function mentionSuggestions(repo: string, q: string): Promise<MentionUser[]> {
  const first = await mentionPeople(repo, q);
  // A bare "@" on an issue / pull request lists just its people, like github.com.
  if (first.length >= LIMIT || (!q && first.length)) return first;
  const more = await cached(matching, `${repo}|${q}`.toLowerCase(), () => fetchMatching(repo, q));
  return dedupe([...first, ...more]).slice(0, LIMIT);
}

/** Repo of the current page when a comment box isn't told one ("owner/repo" from `/owner/repo/…`). */
export function repoFromLocation(): string | null {
  const [owner, repo] = location.pathname.split('/').filter(Boolean);
  return owner && repo && !RESERVED.has(owner.toLowerCase()) ? `${owner}/${repo}` : null;
}
