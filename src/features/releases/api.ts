import { action, query } from '@solidjs/router';
import { encodePath, gh, GitHubError, ghPage, gql } from '../../lib/github';
import type { Reactions, SimpleUser } from '../../lib/types';
import type { TagCommit } from './versions';

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
  upload_url: string;
  tarball_url: string | null;
  zipball_url: string | null;
  reactions?: Reactions;
  mentions_count?: number;
  discussion_url?: string;
}

const HTML = 'application/vnd.github.full+json';

/** One page of releases (10 per page, like github.com), with rendered notes. */
export const getReleases = query(
  (owner: string, repo: string, page: number) =>
    ghPage<Release>(`/repos/${owner}/${repo}/releases`, { page, perPage: 10, accept: HTML }),
  'releases',
);

/** Id of the release marked "Latest" (null when there is none). */
export const getLatestReleaseId = query(async (owner: string, repo: string) => {
  try {
    return (await gh<Release>(`/repos/${owner}/${repo}/releases/latest`)).id;
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
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

/** tag-changes-link: the newest `max` tags (in pages of 100) with their commits, newest first. */
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

/** releases-dropdown: tag names of the newest 100 releases. */
export const getReleaseTagNames = query(async (owner: string, repo: string): Promise<string[]> => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){releases(first:100,orderBy:{field:CREATED_AT,direction:DESC}){nodes{tagName}}}}`,
    { owner, name: repo },
  );
  return data.repository.releases.nodes.map((n: any) => n.tagName as string);
}, 'rgh-release-tag-names');

const CHANGELOG = /^(?:changelog|news|changes|history|release|whatsnew)(?:\.(?:mdx?|mkdn?|mdwn|mdown|markdown|litcoffee|txt|rst))?$/i;

/** link-to-changelog-file: name of a changelog file at the repo root (default branch), or null. */
export const getChangelogFile = query(async (owner: string, repo: string): Promise<string | null> => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){object(expression:"HEAD:"){... on Tree{entries{name type}}}}}`,
    { owner, name: repo },
  );
  const entries: { name: string; type: string }[] = data.repository.object?.entries ?? [];
  return entries.find((e) => e.type === 'blob' && CHANGELOG.test(e.name))?.name ?? null;
}, 'rgh-changelog-file');

/** convert-release-to-draft: PATCH draft:true (the release URL then becomes an untagged draft URL). */
export const convertReleaseToDraft = (owner: string, repo: string, id: number) =>
  gh<Release>(`/repos/${owner}/${repo}/releases/${id}`, { method: 'PATCH', body: { draft: true } });
