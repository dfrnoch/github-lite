import { action, query } from '@solidjs/router';
import { getToken } from '../../lib/auth';
import { encodePath, gh, GitHubError, ghPage, gql } from '../../lib/github';
import type { Reactions, SimpleUser } from '../../lib/types';
import { previousTag, type TagCommit } from './versions';

export interface ReleaseAsset {
  id: number;
  name: string;
  label: string | null;
  content_type: string;
  size: number;
  download_count: number;
  browser_download_url: string;
  created_at: string;
  updated_at: string;
  state: string;
}

export interface Release {
  id: number;
  tag_name: string;
  target_commitish: string;
  name: string | null;
  body: string | null;
  body_html?: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
  author: SimpleUser;
  assets: ReleaseAsset[];
  html_url: string;
  /** Published with immutable assets/tag (GitHub "Immutable" releases). */
  immutable?: boolean;
  upload_url: string;
  tarball_url: string | null;
  zipball_url: string | null;
  reactions?: Reactions;
  mentions_count?: number;
  discussion_url?: string;
}

const HTML = 'application/vnd.github.full+json';

/** What the REST release payload lacks: the tag's commit (short SHA, signature). */
export interface ReleaseCommit {
  oid: string;
  abbreviatedOid: string;
  /** Signature verified (null when unsigned). */
  verified: boolean | null;
}

/** Tag commits of releases by tag name — one GraphQL call with an alias per tag. */
async function fetchReleaseCommits(owner: string, repo: string, tags: string[]): Promise<Record<string, ReleaseCommit>> {
  if (!tags.length) return {};
  const fields = tags
    .map((t, i) => `r${i}:release(tagName:${JSON.stringify(t)}){tagCommit{oid abbreviatedOid signature{isValid}}}`)
    .join(' ');
  const data = await gql<any>(`query($owner:String!,$name:String!){repository(owner:$owner,name:$name){${fields}}}`, { owner, name: repo });
  const out: Record<string, ReleaseCommit> = {};
  tags.forEach((t, i) => {
    const c = data.repository?.[`r${i}`]?.tagCommit;
    if (c) out[t] = { oid: c.oid, abbreviatedOid: c.abbreviatedOid, verified: c.signature ? !!c.signature.isValid : null };
  });
  return out;
}

/**
 * One page of releases (10 per page, like github.com), with rendered notes
 * and (joined into the same flight) each release's tag commit.
 */
export const getReleases = query(async (owner: string, repo: string, page: number) => {
  const res = await ghPage<Release>(`/repos/${owner}/${repo}/releases`, { page, perPage: 10, accept: HTML });
  const commits = await fetchReleaseCommits(
    owner,
    repo,
    res.items.filter((r) => !r.draft).map((r) => r.tag_name),
  ).catch(() => ({}) as Record<string, ReleaseCommit>);
  return { ...res, commits };
}, 'releases');

/** Tag commit of one release (single release page; starts alongside the release itself). */
export const getReleaseCommit = query(
  async (owner: string, repo: string, tag: string): Promise<ReleaseCommit | null> =>
    (await fetchReleaseCommits(owner, repo, [tag]).catch(() => ({}) as Record<string, ReleaseCommit>))[tag] ?? null,
  'release-commit',
);

/** "N commits to <branch> since this release" (compare tag...branch; null when it can't be compared). */
export const getCommitsSinceRelease = query(async (owner: string, repo: string, tag: string, branch: string) => {
  try {
    const cmp = await gh<{ ahead_by: number }>(`/repos/${owner}/${repo}/compare/${encodePath(tag)}...${encodePath(branch)}`, {
      query: { per_page: 1 },
    });
    return cmp.ahead_by;
  } catch (e) {
    if (e instanceof GitHubError && (e.status === 404 || e.status === 422)) return null;
    throw e;
  }
}, 'commits-since-release');

export interface ReleaseListEntry {
  name: string | null;
  tagName: string;
  isDraft: boolean;
  isPrerelease: boolean;
  isLatest: boolean;
  /** Draft releases are addressed by their untagged-… URL. */
  url: string;
}

/** Is `entry` the release addressed by `tag` (drafts by their untagged-… URL)? */
export const isReleaseFor = (entry: ReleaseListEntry, tag: string) =>
  entry.tagName === tag || entry.url.endsWith(`/tag/${encodeURIComponent(tag)}`) || entry.url.endsWith(`/tag/${tag}`);

/** Releases newest first, names only, in pages of 100 until `done` (at most 1000). */
async function fetchReleaseList(owner: string, repo: string, done: (list: ReleaseListEntry[]) => boolean) {
  const out: ReleaseListEntry[] = [];
  let after: string | null = null;
  for (let i = 0; i < 10; i++) {
    const data: any = await gql<any>(
      `query($owner:String!,$name:String!,$after:String){repository(owner:$owner,name:$name){releases(first:100,after:$after,orderBy:{field:CREATED_AT,direction:DESC}){pageInfo{hasNextPage endCursor} nodes{name tagName isDraft isPrerelease isLatest url}}}}`,
      { owner, name: repo, after },
    );
    const conn = data.repository.releases;
    out.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage || done(out)) break;
    after = conn.pageInfo.endCursor;
  }
  return out;
}

/**
 * Release names for the release list column and tag suggestions: the newest
 * 100, or — with `until` — as many pages as it takes to reach that release.
 */
export const getReleaseList = query(
  (owner: string, repo: string, until?: string): Promise<ReleaseListEntry[]> =>
    fetchReleaseList(owner, repo, (list) => !until || list.some((r) => isReleaseFor(r, until))),
  'release-list',
);

/** Id of the release marked "Latest" (null when there is none; GraphQL, so no 404 when there isn't one). */
export const getLatestReleaseId = query(async (owner: string, repo: string): Promise<number | null> => {
  const data = await gql<any>(`query($owner:String!,$name:String!){repository(owner:$owner,name:$name){latestRelease{databaseId}}}`, {
    owner,
    name: repo,
  });
  return data.repository.latestRelease?.databaseId ?? null;
}, 'latest-release-id');

/**
 * A release by tag. Drafts aren't reachable through /releases/tags/:tag, so
 * fall back to scanning the newest releases (also matching the
 * `untagged-…` names github.com uses for draft URLs).
 */
export const getReleaseByTag = query(async (owner: string, repo: string, tag: string) => {
  try {
    return await gh<Release>(`/repos/${owner}/${repo}/releases/tags/${encodePath(tag)}`, { accept: HTML });
  } catch (e) {
    if (!(e instanceof GitHubError && e.status === 404)) throw e;
  }
  const page = await ghPage<Release>(`/repos/${owner}/${repo}/releases`, { perPage: 100, accept: HTML });
  return (
    page.items.find((r) => r.tag_name === tag || r.html_url.endsWith(`/tag/${encodeURIComponent(tag)}`) || r.html_url.endsWith(`/${tag}`)) ??
    null
  );
}, 'release-by-tag');

export interface ReleaseInput {
  tag_name: string;
  target_commitish?: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  make_latest?: 'true' | 'false' | 'legacy';
  discussion_category_name?: string;
}

/** Create / update (plain async — the form uploads assets and then navigates). */
export const saveRelease = (owner: string, repo: string, id: number | null, input: ReleaseInput) =>
  gh<Release>(`/repos/${owner}/${repo}/releases${id ? `/${id}` : ''}`, { method: id ? 'PATCH' : 'POST', body: input });

export const deleteRelease = (owner: string, repo: string, id: number) =>
  gh(`/repos/${owner}/${repo}/releases/${id}`, { method: 'DELETE' });

/** POST /releases/generate-notes — computes notes, creates nothing. */
export const generateReleaseNotes = (
  owner: string,
  repo: string,
  input: { tag_name: string; target_commitish?: string; previous_tag_name?: string },
) => gh<{ name: string; body: string }>(`/repos/${owner}/${repo}/releases/generate-notes`, { method: 'POST', body: input });

/** Upload one asset to uploads.github.com (raw body, Content-Type from the file). */
export function uploadReleaseAsset(release: Release, file: File) {
  const url = release.upload_url.replace(/\{.*\}$/, '');
  return gh<ReleaseAsset>(url, {
    method: 'POST',
    query: { name: file.name },
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
}

export const deleteReleaseAsset = (owner: string, repo: string, assetId: number) =>
  gh(`/repos/${owner}/${repo}/releases/assets/${assetId}`, { method: 'DELETE' });

/* ------------------------------------------------------------------ tags */

export interface TagEntry {
  name: string;
  oid: string;
  abbreviatedOid: string;
  date: string | null;
  verified: boolean | null;
  hasRelease: boolean;
}

export interface TagsPage {
  totalCount: number;
  tags: TagEntry[];
  pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean; startCursor: string | null; endCursor: string | null };
}

const COMMIT = `oid abbreviatedOid committedDate signature{isValid}`;

/** Tags newest first (by commit date), cursor-paginated, with "has a release" flags. */
export const getTags = query(
  async (owner: string, repo: string, after?: string, before?: string): Promise<TagsPage> => {
    const data = await gql<any>(
      `query($owner:String!,$name:String!,$first:Int,$last:Int,$after:String,$before:String){repository(owner:$owner,name:$name){
        refs(refPrefix:"refs/tags/",first:$first,last:$last,after:$after,before:$before,orderBy:{field:TAG_COMMIT_DATE,direction:DESC}){
          totalCount pageInfo{hasNextPage hasPreviousPage startCursor endCursor}
          nodes{name target{__typename ... on Commit{${COMMIT}} ... on Tag{tagger{date} target{... on Commit{${COMMIT}}}}}}
        }
        releases(first:100,orderBy:{field:CREATED_AT,direction:DESC}){nodes{tagName}}
      }}`,
      { owner, name: repo, first: before ? null : 10, last: before ? 10 : null, after: after ?? null, before: before ?? null },
    );
    const r = data.repository;
    const withRelease = new Set<string>(r.releases.nodes.map((n: any) => n.tagName));
    return {
      totalCount: r.refs.totalCount,
      pageInfo: r.refs.pageInfo,
      tags: r.refs.nodes.map((n: any): TagEntry => {
        const commit = n.target.__typename === 'Tag' ? n.target.target : n.target;
        return {
          name: n.name,
          oid: commit?.oid ?? '',
          abbreviatedOid: commit?.abbreviatedOid ?? '',
          date: n.target.tagger?.date ?? commit?.committedDate ?? null,
          verified: commit?.signature ? !!commit.signature.isValid : null,
          hasRelease: withRelease.has(n.name),
        };
      }),
    };
  },
  'tags',
);

export const deleteTag = action(async (owner: string, repo: string, tag: string) => {
  await gh(`/repos/${owner}/${repo}/git/refs/tags/${encodePath(tag)}`, { method: 'DELETE' });
}, 'delete-tag');

/** Delete from a list (revalidates the list). Pages showing the release itself use `deleteRelease` + navigate. */
export const removeRelease = action(async (owner: string, repo: string, id: number) => {
  await deleteRelease(owner, repo, id);
}, 'remove-release');

/** Does `refs/tags/<tag>` exist? */
export const checkTagExists = query(async (owner: string, repo: string, tag: string) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$ref:String!){repository(owner:$owner,name:$name){ref(qualifiedName:$ref){name}}}`,
    { owner, name: repo, ref: `refs/tags/${tag}` },
  );
  return !!data.repository.ref;
}, 'tag-exists');

/* ------------------------------------------------ Refined GitHub (releases) */

/** The newest `max` tags (in pages of 100) with their commits, newest first. */
export const getTagCommits = query(async (owner: string, repo: string, max: number): Promise<TagCommit[]> => {
  const out: TagCommit[] = [];
  let after: string | null = null;
  while (out.length < max) {
    const data: any = await gql<any>(
      `query($owner:String!,$name:String!,$after:String){repository(owner:$owner,name:$name){
        refs(refPrefix:"refs/tags/",first:100,after:$after,orderBy:{field:TAG_COMMIT_DATE,direction:DESC}){
          pageInfo{hasNextPage endCursor} nodes{name target{oid ... on Tag{target{oid}}}}
        }
      }}`,
      { owner, name: repo, after },
    );
    const refs = data.repository.refs;
    for (const n of refs.nodes) out.push({ name: n.name, oid: n.target.target?.oid ?? n.target.oid });
    if (!refs.pageInfo.hasNextPage) break;
    after = refs.pageInfo.endCursor;
  }
  return out;
}, 'rgh-tag-commits');

/**
 * The tag before `tag`. The newest 100 tags cover most
 * pages; older releases look further back (up to 1000 tags) — in one flight.
 */
export const getPreviousTag = query(async (owner: string, repo: string, tag: string): Promise<string | null> => {
  // `recent` usually comes from the cache, so read the token (a dependency of every request) before awaiting.
  getToken();
  const recent = await getTagCommits(owner, repo, 100);
  const prev = previousTag(tag, recent);
  if (prev || recent.length < 100) return prev ?? null;
  return previousTag(tag, await getTagCommits(owner, repo, 1000)) ?? null;
}, 'rgh-previous-tag');

/** Tag names of the newest 100 releases (shares the release list request). */
export const getReleaseTagNames = query(
  async (owner: string, repo: string): Promise<string[]> => (await getReleaseList(owner, repo)).map((n) => n.tagName),
  'rgh-release-tag-names',
);

const CHANGELOG = /^(?:changelog|news|changes|history|release|whatsnew)(?:\.(?:mdx?|mkdn?|mdwn|mdown|markdown|litcoffee|txt|rst))?$/i;

/** Name of a changelog file at the repo root (default branch), or null. */
export const getChangelogFile = query(async (owner: string, repo: string): Promise<string | null> => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){object(expression:"HEAD:"){... on Tree{entries{name type}}}}}`,
    { owner, name: repo },
  );
  const entries: { name: string; type: string }[] = data.repository.object?.entries ?? [];
  return entries.find((e) => e.type === 'blob' && CHANGELOG.test(e.name))?.name ?? null;
}, 'rgh-changelog-file');

/** PATCH draft:true (the release URL then becomes an untagged draft URL). */
export const convertReleaseToDraft = (owner: string, repo: string, id: number) =>
  gh<Release>(`/repos/${owner}/${repo}/releases/${id}`, { method: 'PATCH', body: { draft: true } });

/**
 * "Find a release": releases whose name or tag contains `q` (the API has no
 * release search, so this scans up to 1000 release names), first 10 matches
 * as full releases. Same shape as a `getReleases` page.
 */
export const searchReleases = query(async (owner: string, repo: string, q: string) => {
  const needle = q.trim().toLowerCase();
  const list = await fetchReleaseList(owner, repo, () => false);
  const hits = list.filter((r) => !r.isDraft && `${r.name ?? ''}\n${r.tagName}`.toLowerCase().includes(needle)).slice(0, 10);
  const tags = hits.map((h) => h.tagName);
  const [items, commits] = await Promise.all([
    Promise.all(tags.map((t) => gh<Release>(`/repos/${owner}/${repo}/releases/tags/${encodePath(t)}`, { accept: HTML }))),
    fetchReleaseCommits(owner, repo, tags).catch(() => ({}) as Record<string, ReleaseCommit>),
  ]);
  return { items, commits, total: hits.length, pageInfo: { page: 1, lastPage: 1, hasNext: false, hasPrev: false } };
}, 'release-search');
