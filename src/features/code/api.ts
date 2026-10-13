import { action, query } from '@solidjs/router';
import { encodePath, gh, GitHubError, gql, toBase64 } from '../../lib/github';
import type { Commit, DiffFile } from '../../lib/types';

// ---------------------------------------------------------------------------
// Commit history

export interface ChecksSummary {
  state: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR' | 'EXPECTED' | null;
  passed: number;
  total: number;
}

export interface HistoryCommit {
  oid: string;
  abbreviatedOid: string;
  messageHeadline: string;
  messageBody: string;
  committedDate: string;
  authoredDate: string;
  authors: { name: string | null; email: string | null; avatarUrl: string; user: { login: string } | null }[];
  authorCount: number;
  committer: { name: string | null; avatarUrl: string; user: { login: string } | null } | null;
  verified: boolean;
  signatureState: string | null;
  checks: ChecksSummary | null;
  /** Number of parents (2+ = merge commit). */
  parentCount: number;
}

export interface HistoryPage {
  commits: HistoryCommit[];
  hasNext: boolean;
  hasPrev: boolean;
  startCursor: string | null;
  endCursor: string | null;
  totalCount: number;
}

export const COMMIT_NODE_FIELDS = `oid abbreviatedOid message committedDate authoredDate
  authors(first:3){totalCount nodes{name email avatarUrl user{login}}}
  committer{name avatarUrl user{login}}
  signature{isValid state}
  parentCount:parents{totalCount}
  statusCheckRollup{state contexts(first:1){checkRunCount checkRunCountsByState{state count} statusContextCount statusContextCountsByState{state count}}}`;

const PASSING = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);

export function toHistoryCommit(c: any): HistoryCommit {
  const ctx = c.statusCheckRollup?.contexts;
  const passed = ctx
    ? [...(ctx.checkRunCountsByState ?? []), ...(ctx.statusContextCountsByState ?? [])]
        .filter((s: any) => PASSING.has(s.state))
        .reduce((n: number, s: any) => n + s.count, 0)
    : 0;
  // messageHeadline is cut at ~70 characters; github.com shows the whole first line.
  const [headline, ...body] = (c.message ?? c.messageHeadline ?? '').split('\n');
  const authors: HistoryCommit['authors'] = [];
  for (const a of c.authors?.nodes ?? []) {
    if (!authors.some((x) => (x.user && a.user ? x.user.login === a.user.login : x.name === a.name))) authors.push(a);
  }
  return {
    oid: c.oid,
    abbreviatedOid: c.abbreviatedOid,
    messageHeadline: headline ?? '',
    messageBody: body.join('\n').trim(),
    committedDate: c.committedDate,
    authoredDate: c.authoredDate,
    authors,
    authorCount: Math.max(authors.length, c.authors?.totalCount ?? 0),
    committer: c.committer ?? null,
    verified: !!c.signature?.isValid,
    signatureState: c.signature?.state ?? null,
    checks: c.statusCheckRollup
      ? { state: c.statusCheckRollup.state, passed, total: (ctx?.checkRunCount ?? 0) + (ctx?.statusContextCount ?? 0) }
      : null,
    parentCount: c.parentCount?.totalCount ?? 1,
  };
}

const userIds = new Map<string, string | null>();
async function userId(login: string) {
  if (!userIds.has(login)) {
    const data = await gql<any>(`query($login:String!){user(login:$login){id}}`, { login }).catch(() => null);
    userIds.set(login, data?.user?.id ?? null);
  }
  return userIds.get(login) ?? null;
}

export const HISTORY_PAGE_SIZE = 35;

/**
 * One page of `git log` for a ref (optionally limited to a path / author /
 * date range). Cursors are GitHub's own `<sha> <offset>` strings, so the
 * `?after=sha+34` links of github.com work unchanged.
 */
export const getCommitHistory = query(
  async (
    owner: string,
    repo: string,
    ref: string,
    opts: { path?: string; author?: string; since?: string; until?: string; after?: string; before?: string } = {},
  ): Promise<HistoryPage | null> => {
    let author: { id: string } | undefined;
    if (opts.author) {
      const id = await userId(opts.author);
      if (!id) return { commits: [], hasNext: false, hasPrev: false, startCursor: null, endCursor: null, totalCount: 0 };
      author = { id };
    }
    const data = await gql<any>(
      `query($owner:String!,$name:String!,$ref:String!,$path:String,$after:String,$before:String,$first:Int,$last:Int,$author:CommitAuthor,$since:GitTimestamp,$until:GitTimestamp){
        repository(owner:$owner,name:$name){object(expression:$ref){... on Commit{
          history(first:$first,last:$last,after:$after,before:$before,path:$path,author:$author,since:$since,until:$until){
            totalCount
            pageInfo{hasNextPage hasPreviousPage startCursor endCursor}
            nodes{${COMMIT_NODE_FIELDS}}
          }
        }}}
      }`,
      {
        owner,
        name: repo,
        ref,
        path: opts.path || null,
        after: opts.after || null,
        before: opts.before || null,
        first: opts.before ? null : HISTORY_PAGE_SIZE,
        last: opts.before ? HISTORY_PAGE_SIZE : null,
        author: author ?? null,
        since: opts.since ? new Date(opts.since).toISOString() : null,
        until: opts.until ? new Date(`${opts.until}T23:59:59`).toISOString() : null,
      },
    );
    const history = data.repository?.object?.history;
    if (!history) return null;
    // `after=` cursors from github.com links don't report a previous page.
    const offset = Number((opts.after ?? '').split(' ')[1] ?? -1);
    return {
      commits: history.nodes.map(toHistoryCommit),
      hasNext: history.pageInfo.hasNextPage,
      hasPrev: history.pageInfo.hasPreviousPage || offset >= 0,
      startCursor: history.pageInfo.startCursor,
      endCursor: history.pageInfo.endCursor,
      totalCount: history.totalCount,
    };
  },
  'commit-history',
);

/** Recent distinct authors of a ref — the "All users" filter menu. */
export const getRecentAuthors = query(async (owner: string, repo: string, ref: string) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$ref:String!){repository(owner:$owner,name:$name){object(expression:$ref){... on Commit{
      history(first:100){nodes{authors(first:2){nodes{avatarUrl user{login}}}}}
    }}}}`,
    { owner, name: repo, ref },
  );
  const seen = new Map<string, string>();
  for (const n of data.repository?.object?.history?.nodes ?? [])
    for (const a of n.authors.nodes) if (a.user && !seen.has(a.user.login)) seen.set(a.user.login, a.avatarUrl);
  return [...seen].map(([login, avatarUrl]) => ({ login, avatarUrl }));
}, 'recent-authors');

// ---------------------------------------------------------------------------
// Single commit

export interface CommitDetails {
  rest: Commit & { files: DiffFile[] };
  info: HistoryCommit & {
    message: string;
    parents: { oid: string; abbreviatedOid: string }[];
    pulls: { number: number; title: string; state: string }[];
  };
  /** The default branch contains this commit. */
  onDefaultBranch: boolean;
}

/** REST commit (with every page of files, up to 3,000) + GraphQL header data. */
export const getCommit = query(async (owner: string, repo: string, sha: string): Promise<CommitDetails> => {
  const restP = (async () => {
    const first = await gh<Commit & { files: DiffFile[] }>(`/repos/${owner}/${repo}/commits/${encodeURIComponent(sha)}`);
    const files = [...(first.files ?? [])];
    for (let page = 2; files.length === (page - 1) * 300 && page <= 10; page++) {
      const next = await gh<Commit & { files: DiffFile[] }>(`/repos/${owner}/${repo}/commits/${encodeURIComponent(sha)}`, {
        query: { page },
      });
      files.push(...(next.files ?? []));
    }
    return { ...first, files };
  })();
  const gqlP = gql<any>(
    `query($owner:String!,$name:String!,$expr:String!){repository(owner:$owner,name:$name){
      object(expression:$expr){... on Commit{
        ${COMMIT_NODE_FIELDS}
        parents(first:5){nodes{oid abbreviatedOid}}
        associatedPullRequests(first:3){nodes{number title state}}
      }}
      defaultBranchRef{compare(headRef:$expr){status}}
    }}`,
    { owner, name: repo, expr: sha },
  ).catch(() => null);
  const [rest, data] = await Promise.all([restP, gqlP]);
  const obj = data?.repository?.object;
  const status = data?.repository?.defaultBranchRef?.compare?.status;
  return {
    rest,
    info: obj
      ? {
          ...toHistoryCommit(obj),
          message: obj.message,
          parents: obj.parents.nodes,
          pulls: obj.associatedPullRequests?.nodes ?? [],
        }
      : fallbackInfo(rest),
    onDefaultBranch: status === 'BEHIND' || status === 'IDENTICAL',
  };
}, 'commit');

function fallbackInfo(c: Commit): CommitDetails['info'] {
  return {
    ...restToHistoryCommit(c),
    message: c.commit.message,
    parents: c.parents.map((p) => ({ oid: p.sha, abbreviatedOid: p.sha.slice(0, 7) })),
    pulls: [],
  };
}

/** Raw text of a file at a ref — for diff context expansion. Not a query: called on demand. */
export const fetchRaw = (owner: string, repo: string, ref: string, path: string) =>
  gh<string>(`/repos/${owner}/${repo}/contents/${encodePath(path)}`, { query: { ref }, accept: 'application/vnd.github.raw' });

// ---------------------------------------------------------------------------
// Compare

export interface CompareResult {
  status: 'diverged' | 'ahead' | 'behind' | 'identical';
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  merge_base_commit: Commit;
  commits: Commit[];
  files?: DiffFile[];
  html_url: string;
}

/** GET /compare/{base}...{head} — `head` may be `owner:branch` for forks. */
export const getCompare = query(async (owner: string, repo: string, base: string, head: string) => {
  try {
    return await gh<CompareResult>(`/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`, {
      query: { per_page: 250 },
    });
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}, 'compare');

/** HistoryCommit shape from a REST commit (compare / PR commit lists). */
export function restToHistoryCommit(c: Commit): HistoryCommit {
  const [headline, ...body] = c.commit.message.split('\n');
  return {
    oid: c.sha,
    abbreviatedOid: c.sha.slice(0, 7),
    messageHeadline: headline ?? '',
    messageBody: body.join('\n').trim(),
    committedDate: c.commit.committer.date,
    authoredDate: c.commit.author.date,
    authors: [
      {
        name: c.commit.author.name,
        email: c.commit.author.email,
        avatarUrl: c.author?.avatar_url ?? '',
        user: c.author ? { login: c.author.login } : null,
      },
    ],
    authorCount: 1,
    committer: { name: c.commit.committer.name, avatarUrl: c.committer?.avatar_url ?? '', user: c.committer ? { login: c.committer.login } : null },
    verified: !!c.commit.verification?.verified,
    signatureState: null,
    checks: null,
    parentCount: c.parents?.length ?? 1,
  };
}

/** Open pull request for head → base, if any (compare page shows a link instead of the form). */
export const getOpenPullFor = query(async (owner: string, repo: string, base: string, head: string) => {
  const headQualified = head.includes(':') ? head : `${owner}:${head}`;
  const pulls = await gh<{ number: number; title: string; html_url: string }[]>(`/repos/${owner}/${repo}/pulls`, {
    query: { state: 'open', base, head: headQualified, per_page: 1 },
  });
  return pulls[0] ?? null;
}, 'open-pull-for');

/** Forks of the repo (for cross-repository compare). */
export const getForks = query(
  (owner: string, repo: string) =>
    gh<{ full_name: string; owner: { login: string } }[]>(`/repos/${owner}/${repo}/forks`, {
      query: { per_page: 100, sort: 'newest' },
    }),
  'forks',
);

/** The repo's pull request template body ('' when there is none). */
export const getPullTemplate = query(async (owner: string, repo: string) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){pullRequestTemplates{filename body}}}`,
    { owner, name: repo },
  );
  return (data.repository?.pullRequestTemplates?.[0]?.body as string | undefined) ?? '';
}, 'pull-template');

export const createPull = action(
  async (owner: string, repo: string, body: { title: string; body: string; base: string; head: string; draft: boolean; maintainer_can_modify?: boolean }) =>
    gh<{ number: number }>(`/repos/${owner}/${repo}/pulls`, { method: 'POST', body }),
  'create-pull',
);

// ---------------------------------------------------------------------------
// Branches

export interface BranchRow {
  name: string;
  oid: string;
  committedDate: string;
  author: { login: string | null; name: string | null; avatarUrl: string | null };
}

const BRANCH_FIELDS = `name target{... on Commit{oid committedDate author{name avatarUrl user{login}}}}`;

const toBranchRow = (n: any): BranchRow => ({
  name: n.name,
  oid: n.target?.oid,
  committedDate: n.target?.committedDate,
  author: {
    login: n.target?.author?.user?.login ?? null,
    name: n.target?.author?.name ?? null,
    avatarUrl: n.target?.author?.avatarUrl ?? null,
  },
});

/**
 * Branches (optionally filtered by name), newest commit first. GraphQL can't
 * order refs by commit date, so up to 1,000 are fetched and sorted here.
 */
export const getAllBranches = query(async (owner: string, repo: string, filter?: string) => {
  const out: BranchRow[] = [];
  let after: string | null = null;
  let truncated = false;
  for (let i = 0; i < 10; i++) {
    const data: any = await gql<any>(
      `query($owner:String!,$name:String!,$after:String,$query:String){repository(owner:$owner,name:$name){
        refs(refPrefix:"refs/heads/",first:100,after:$after,query:$query){pageInfo{hasNextPage endCursor} nodes{${BRANCH_FIELDS}}}
      }}`,
      { owner, name: repo, after, query: filter || null },
    );
    const refs = data.repository.refs;
    out.push(...refs.nodes.map(toBranchRow));
    if (!refs.pageInfo.hasNextPage) break;
    after = refs.pageInfo.endCursor;
    truncated = i === 9;
  }
  out.sort((a, b) => (b.committedDate ?? '').localeCompare(a.committedDate ?? ''));
  return { branches: out, truncated };
}, 'all-branches');

export const getDefaultBranch = query(async (owner: string, repo: string) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){defaultBranchRef{${BRANCH_FIELDS}}}}`,
    { owner, name: repo },
  );
  return data.repository.defaultBranchRef ? toBranchRow(data.repository.defaultBranchRef) : null;
}, 'default-branch');

export interface BranchExtra {
  ahead: number;
  behind: number;
  /** The branch's PR in this repository. */
  pull: { number: number; state: 'OPEN' | 'CLOSED' | 'MERGED'; isDraft: boolean; title: string; repo: string } | null;
  /** The branch's PR in any repository (forks: also upstream) — show-associated-branch-prs-on-fork. */
  anyPull: BranchExtra['pull'];
  checks: ChecksSummary | null;
}

/** The PR github.com shows for a branch: an open one, else the newest. */
const pickPull = (prs: BranchExtra['pull'][]) =>
  prs.find((p) => p?.state === 'OPEN') ?? [...prs].sort((a, b) => b!.number - a!.number)[0] ?? null;

/** Ahead/behind vs the default branch, latest PR and checks — only for the rows on screen. */
export const getBranchExtras = query(async (owner: string, repo: string, defaultBranch: string, names: string[]) => {
  if (!names.length) return {} as Record<string, BranchExtra>;
  const fields = names
    .map(
      (n, i) => `b${i}:ref(qualifiedName:${JSON.stringify(`refs/heads/${n}`)}){
        compare(headRef:${JSON.stringify(defaultBranch)}){aheadBy behindBy}
        associatedPullRequests(first:5,orderBy:{field:CREATED_AT,direction:DESC}){nodes{number state isDraft title repository{nameWithOwner}}}
        target{... on Commit{statusCheckRollup{state contexts(first:1){checkRunCount checkRunCountsByState{state count} statusContextCount statusContextCountsByState{state count}}}}}
      }`,
    )
    .join('\n');
  const data = await gql<any>(`query($owner:String!,$name:String!){repository(owner:$owner,name:$name){${fields}}}`, {
    owner,
    name: repo,
  });
  const out: Record<string, BranchExtra> = {};
  names.forEach((n, i) => {
    const r = data.repository[`b${i}`];
    if (!r) return;
    // compare(base = this branch, head = default): the default's lead is this branch's lag.
    const prs = (r.associatedPullRequests?.nodes ?? []).map((p: any) => ({ ...p, repo: p.repository?.nameWithOwner ?? `${owner}/${repo}` }));
    const own = prs.filter((p: any) => p.repo.toLowerCase() === `${owner}/${repo}`.toLowerCase());
    out[n] = {
      behind: r.compare?.aheadBy ?? 0,
      ahead: r.compare?.behindBy ?? 0,
      pull: n === defaultBranch ? null : pickPull(own),
      anyPull: n === defaultBranch ? null : pickPull(prs),
      checks: toHistoryCommit({ ...r.target, oid: '', authors: { nodes: [] } }).checks,
    };
  });
  return out;
}, 'branch-extras');

/** Names of protected branches (REST — works without admin rights). */
export const getProtectedBranches = query(async (owner: string, repo: string) => {
  const list = await gh<{ name: string }[]>(`/repos/${owner}/${repo}/branches`, { query: { protected: true, per_page: 100 } }).catch(
    () => [],
  );
  return new Set(list.map((b) => b.name));
}, 'protected-branches');

/** SHA a ref points at. */
export async function resolveSha(owner: string, repo: string, ref: string) {
  return (await gh<string>(`/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`, { accept: 'application/vnd.github.sha' })).trim();
}

export const createBranch = action(async (owner: string, repo: string, name: string, from: string) => {
  const sha = /^[0-9a-f]{40}$/i.test(from) ? from : await resolveSha(owner, repo, from);
  await gh(`/repos/${owner}/${repo}/git/refs`, { method: 'POST', body: { ref: `refs/heads/${name}`, sha } });
}, 'create-branch');

export const renameBranch = action(async (owner: string, repo: string, name: string, newName: string) => {
  await gh(`/repos/${owner}/${repo}/branches/${encodeURIComponent(name)}/rename`, { method: 'POST', body: { new_name: newName } });
}, 'rename-branch');

/**
 * Delete / restore a branch. Plain functions rather than router actions: the
 * branch list keeps the deleted row (with "Restore") instead of revalidating.
 */
export async function deleteBranch(owner: string, repo: string, name: string) {
  await gh(`/repos/${owner}/${repo}/git/refs/heads/${encodePath(name)}`, { method: 'DELETE' });
}

export async function restoreBranch(owner: string, repo: string, name: string, sha: string) {
  await gh(`/repos/${owner}/${repo}/git/refs`, { method: 'POST', body: { ref: `refs/heads/${name}`, sha } });
}

// ---------------------------------------------------------------------------
// Blame

export interface BlameRange {
  startingLine: number;
  endingLine: number;
  age: number;
  commit: {
    oid: string;
    abbreviatedOid: string;
    messageHeadline: string;
    committedDate: string;
    authors: { nodes: { name: string | null; avatarUrl: string; user: { login: string } | null }[] };
    parents: { nodes: { oid: string }[] };
  };
}

export const getBlame = query(async (owner: string, repo: string, ref: string, path: string) => {
  const data = await gql<any>(
    `query($owner:String!,$name:String!,$ref:String!,$path:String!){repository(owner:$owner,name:$name){
      object(expression:$ref){... on Commit{oid blame(path:$path){ranges{startingLine endingLine age
        commit{oid abbreviatedOid messageHeadline committedDate authors(first:1){nodes{name avatarUrl user{login}}} parents(first:1){nodes{oid}}}
      }}}}
    }}`,
    { owner, name: repo, ref, path },
  );
  const blame = data.repository.object?.blame;
  if (!blame) throw new GitHubError(404, 'Not Found');
  return blame.ranges as BlameRange[];
}, 'blame');

// ---------------------------------------------------------------------------
// File finder

/** Every file path at a ref (git trees API, recursive). */
export const getAllPaths = query(async (owner: string, repo: string, ref: string) => {
  const data = await gh<{ tree: { path: string; type: string }[]; truncated: boolean }>(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}`,
    { query: { recursive: 1 } },
  );
  return { paths: data.tree.filter((t) => t.type === 'blob').map((t) => t.path), truncated: data.truncated };
}, 'all-paths');

// ---------------------------------------------------------------------------
// Editing files

export interface SaveFileInput {
  owner: string;
  repo: string;
  /** Branch the edit is based on. */
  branch: string;
  /** Commit to a new branch instead (created from `branch`). */
  newBranch?: string;
  path: string;
  /** Original path when renaming / editing; undefined for new files. */
  originalPath?: string;
  /** Blob sha of the original file (contents API optimistic lock). */
  sha?: string;
  content: string;
  message: string;
}

/**
 * Commit a created / edited file. Same path → contents API PUT (with the blob
 * sha); a rename goes through the git data API so it lands as one commit.
 */
export const saveFile = action(async (input: SaveFileInput) => {
  const { owner, repo } = input;
  const target = input.newBranch || input.branch;
  if (input.newBranch) {
    const sha = await resolveSha(owner, repo, input.branch);
    await gh(`/repos/${owner}/${repo}/git/refs`, { method: 'POST', body: { ref: `refs/heads/${input.newBranch}`, sha } });
  }
  if (!input.originalPath || input.originalPath === input.path) {
    await gh(`/repos/${owner}/${repo}/contents/${encodePath(input.path)}`, {
      method: 'PUT',
      body: { message: input.message, content: toBase64(input.content), sha: input.sha, branch: target },
    });
    return { branch: target };
  }
  // Rename: new tree with the file at its new path and the old path removed.
  const ref = await gh<{ object: { sha: string } }>(`/repos/${owner}/${repo}/git/ref/heads/${encodePath(target)}`);
  const parent = await gh<{ tree: { sha: string } }>(`/repos/${owner}/${repo}/git/commits/${ref.object.sha}`);
  const tree = await gh<{ sha: string }>(`/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: {
      base_tree: parent.tree.sha,
      tree: [
        { path: input.path, mode: '100644', type: 'blob', content: input.content },
        { path: input.originalPath, mode: '100644', type: 'blob', sha: null },
      ],
    },
  });
  const commit = await gh<{ sha: string }>(`/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: { message: input.message, tree: tree.sha, parents: [ref.object.sha] },
  });
  await gh(`/repos/${owner}/${repo}/git/refs/heads/${encodePath(target)}`, { method: 'PATCH', body: { sha: commit.sha } });
  return { branch: target };
}, 'save-file');
