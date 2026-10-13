import { query } from '@solidjs/router';
import { createMemo, For, Loading, Match, Show, Switch } from 'solid-js';
import RelativeTime from '../../components/ui/RelativeTime';
import { encodePath, gh, gql } from '../../lib/github';

/**
 * Refined GitHub's `useful-not-found-page`: on a 404 for a file or folder
 * URL, explain what happened to it (the commit that removed / renamed it),
 * point to it on the default branch, and cross out the parts of the path that
 * don't exist; on a 404 for a pull request commit, link the commit itself.
 */

type Parsed =
  | { kind: 'file'; owner: string; repo: string; view: 'blob' | 'tree' | 'blame'; rest: string[] }
  | { kind: 'pr-commit'; owner: string; repo: string; sha: string };

function parse(pathname: string): Parsed | null {
  const segs = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const [owner, repo, view, ...rest] = segs;
  if (!owner || !repo) return null;
  if ((view === 'blob' || view === 'tree' || view === 'blame') && rest.length >= 2) return { kind: 'file', owner, repo, view, rest };
  // /:owner/:repo/pull/:n/(commits|changes|files)/:sha
  if (view === 'pull' && /^(commits|changes|files)$/.test(rest[1] ?? '') && /^[0-9a-f]{7,40}$/i.test(rest[2] ?? '')) {
    return { kind: 'pr-commit', owner, repo, sha: rest[2]! };
  }
  return null;
}

interface FileHistory {
  ref: string;
  path: string;
  /** The last commit on `ref` that touched `path`, and what it did to it. */
  change: {
    sha: string;
    date: string;
    status: string;
    filename: string;
    previousFilename: string | null;
    parentSha: string | null;
  } | null;
  /** The path exists on the default branch (and `ref` is not the default branch). */
  onDefault: string | null;
  /** `ref`-relative path prefixes and whether they exist (folder breadcrumbs). */
  crumbs: { name: string; path: string; exists: boolean }[];
}

const MAX_REF_SEGMENTS = 4;

/** Resolve `ref/path…` (refs may contain slashes) and gather the history of the missing path — mostly one GraphQL call. */
const getFileHistory = query(async (owner: string, repo: string, rest: string[]): Promise<FileHistory | null> => {
  const candidates = Array.from({ length: Math.min(MAX_REF_SEGMENTS, rest.length - 1) }, (_, i) => ({
    ref: rest.slice(0, i + 1).join('/'),
    path: rest.slice(i + 1).join('/'),
  }));
  const fields = candidates
    .map(
      (c, i) => `r${i}:object(expression:${JSON.stringify(c.ref)}){... on Commit{history(first:1,path:${JSON.stringify(c.path)}){nodes{oid committedDate}}}}
      d${i}:object(expression:${JSON.stringify(`HEAD:${c.path}`)}){__typename}`,
    )
    .join('\n');
  const data = await gql<any>(`query($owner:String!,$name:String!){repository(owner:$owner,name:$name){defaultBranchRef{name} ${fields}}}`, {
    owner,
    name: repo,
  }).catch(() => null);
  const r = data?.repository;
  if (!r) return null;
  const i = candidates.findIndex((_, i) => r[`r${i}`]);
  // Unknown ref: the path may still exist on the default branch.
  const pick = i >= 0 ? i : 0;
  const { ref, path } = candidates[pick]!;
  const defaultBranch: string | undefined = r.defaultBranchRef?.name;
  const onDefault = r[`d${pick}`] && ref !== defaultBranch && defaultBranch ? defaultBranch : null;
  if (i < 0) return { ref, path, change: null, onDefault, crumbs: [] };

  const last = r[`r${i}`].history.nodes[0] as { oid: string; committedDate: string } | undefined;
  const parts = path.split('/');
  const [change, crumbs] = await Promise.all([
    last
      ? gh<any>(`/repos/${owner}/${repo}/commits/${last.oid}`)
          .then((c) => {
            const f = (c.files as any[] | undefined)?.find((f) => f.filename === path || f.previous_filename === path);
            return f
              ? {
                  sha: last.oid,
                  date: last.committedDate,
                  status: f.status as string,
                  filename: f.filename as string,
                  previousFilename: (f.previous_filename as string | undefined) ?? null,
                  parentSha: (c.parents?.[0]?.sha as string | undefined) ?? null,
                }
              : null;
          })
          .catch(() => null)
      : null,
    // Which folders along the path still exist on this ref.
    parts.length > 1
      ? gql<any>(
          `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){${parts
            .slice(0, -1)
            .map((_, j) => `p${j}:object(expression:${JSON.stringify(`${ref}:${parts.slice(0, j + 1).join('/')}`)}){__typename}`)
            .join(' ')}}}`,
          { owner, name: repo },
        )
          .then((d) =>
            parts.map((name, j) => ({
              name,
              path: parts.slice(0, j + 1).join('/'),
              exists: j < parts.length - 1 ? !!d?.repository?.[`p${j}`] : false,
            })),
          )
          .catch(() => [])
      : [],
  ]);
  return { ref, path, change, onDefault, crumbs };
}, 'useful-not-found-history');

const commitExists = query(async (owner: string, repo: string, sha: string) => {
  const d = await gql<any>(`query($owner:String!,$name:String!,$sha:String!){repository(owner:$owner,name:$name){object(expression:$sha){... on Commit{oid}}}}`, {
    owner,
    name: repo,
    sha,
  }).catch(() => null);
  return (d?.repository?.object?.oid as string | undefined) ?? null;
}, 'useful-not-found-commit');

export default function UsefulNotFound(props: { pathname: string }) {
  const parsed = createMemo(() => parse(props.pathname));
  return (
    <Show when={parsed()}>
      {(p) => (
        <div class="mt-6 flex flex-col gap-2 text-fg-muted text-sm">
          <Switch>
            <Match when={p().kind === 'file' && (p() as Extract<Parsed, { kind: 'file' }>)}>
              {(f) => <FileInfo owner={f().owner} repo={f().repo} view={f().view} rest={f().rest} />}
            </Match>
            <Match when={p().kind === 'pr-commit' && (p() as Extract<Parsed, { kind: 'pr-commit' }>)}>
              {(c) => <PrCommitInfo owner={c().owner} repo={c().repo} sha={c().sha} />}
            </Match>
          </Switch>
        </div>
      )}
    </Show>
  );
}

function CommitRef(props: { href: string; sha: string }) {
  return (
    <a class="font-mono text-xs px-1.5 py-0.5 rounded-md bg-accent-muted" href={props.href}>
      {props.sha.slice(0, 8)}
    </a>
  );
}

function FileInfo(props: { owner: string; repo: string; view: string; rest: string[] }) {
  const history = createMemo(() => getFileHistory(props.owner, props.repo, props.rest));
  const base = () => `/${props.owner}/${props.repo}`;
  const kind = () => (props.rest.at(-1)!.includes('.') ? 'file' : 'object');
  return (
    <Loading fallback={<p>Loading history of this {kind()}…</p>}>
      <Show when={history()}>
        {(h) => (
          <>
            <Show when={h().crumbs.length > 1 && props.view === 'tree'}>
              <p class="font-mono text-xs">
                <a href={base()}>{props.repo}</a>
                <For each={h().crumbs}>
                  {(c) => (
                    <>
                      {' / '}
                      <Show when={c.exists} fallback={<del class="text-fg-muted opacity-70">{c.name}</del>}>
                        <a href={`${base()}/tree/${encodePath(h().ref)}/${encodePath(c.path)}`}>{c.name}</a>
                      </Show>
                    </>
                  )}
                </For>
              </p>
            </Show>
            <Show when={h().change}>
              {(c) => (
                <p>
                  <CommitRef href={`${base()}/commit/${c().sha}`} sha={c().sha} /> {c().status}{' '}
                  <a
                    // Its last version: before the commit that removed / renamed it.
                    href={`${base()}/blob/${c().parentSha ?? c().sha}/${encodePath(c().previousFilename ?? c().filename)}`}
                  >
                    {c().previousFilename ?? c().filename}
                  </a>
                  <Show when={c().status === 'renamed'}>
                    {' to '}
                    <a href={`${base()}/blob/${c().sha}/${encodePath(c().filename)}`}>{c().filename}</a>
                  </Show>{' '}
                  <RelativeTime datetime={c().date} />.
                </p>
              )}
            </Show>
            <Show when={h().onDefault}>
              {(branch) => (
                <p>
                  <a href={`${base()}/${props.view === 'tree' ? 'tree' : 'blob'}/${encodePath(branch())}/${encodePath(h().path)}`}>{h().path}</a> exists on
                  the default branch.
                </p>
              )}
            </Show>
          </>
        )}
      </Show>
    </Loading>
  );
}

function PrCommitInfo(props: { owner: string; repo: string; sha: string }) {
  const oid = createMemo(() => commitExists(props.owner, props.repo, props.sha));
  return (
    <Loading fallback={null}>
      <Show when={oid()}>
        {(sha) => (
          <p>
            <CommitRef href={`/${props.owner}/${props.repo}/commit/${sha()}`} sha={sha()} /> exists outside of this pull request.
          </p>
        )}
      </Show>
    </Loading>
  );
}
