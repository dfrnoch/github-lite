import { createMemo, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { RelativeTime } from '../../../components/ui';
import { fileDirectoryFillIcon, fileIcon, fileSubmoduleIcon, fileSymlinkFileIcon } from '../../../icons/octicons';
import { encodePath } from '../../../lib/github';
import { getTreeCommits, type TreeEntry } from '../api';
import { CommitMessage } from './LatestCommit';

const SYMLINK_MODE = 0o120000;

/** Submodules on github.com open in-app at the pinned commit; other hosts link out. */
function submoduleHref(e: TreeEntry) {
  const m = e.target?.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? `/${m[1]}/${m[2]}/tree/${e.oid}` : (e.target ?? undefined);
}

/** github.com's file table: icon, name, last commit message, last commit date. */
export default function FileTable(props: {
  owner: string;
  repo: string;
  gitRef: string;
  path: string;
  entries: TreeEntry[];
}) {
  const base = () => `/${props.owner}/${props.repo}`;
  const parent = () => props.path.split('/').slice(0, -1).join('/');
  const commits = createMemo(() =>
    getTreeCommits(
      props.owner,
      props.repo,
      props.gitRef,
      props.entries.map((e) => e.path),
    ),
  );

  const hrefFor = (e: TreeEntry) =>
    `${base()}/${e.type === 'tree' ? 'tree' : 'blob'}/${encodePath(props.gitRef)}/${encodePath(e.path)}`;

  return (
    <table class="w-full text-sm table-fixed">
      <tbody>
        <Show when={props.path}>
          <tr class="border-t border-line-muted hover:bg-canvas-muted">
            <td colspan={3} class="py-2 px-4">
              <a class="link-plain flex items-center gap-3" href={parent() ? `${base()}/tree/${encodePath(props.gitRef)}/${encodePath(parent())}` : `${base()}/tree/${encodePath(props.gitRef)}`}>
                <Octicon icon={fileDirectoryFillIcon} class="text-[var(--treeViewItem-leadingVisual-iconColor-rest)]" />
                ..
              </a>
            </td>
          </tr>
        </Show>
        <For each={props.entries}>
          {(entry) => (
            <tr class="border-t border-line-muted first:border-t-0 hover:bg-canvas-muted">
              <td class="py-2 pl-4 pr-2 w-[35%] md:w-[30%]">
                <div class="flex items-center gap-3 min-w-0">
                  <Show
                    when={entry.type !== 'commit'}
                    fallback={<Octicon icon={fileSubmoduleIcon} class="text-fg-muted" />}
                  >
                    <Octicon
                      icon={entry.type === 'tree' ? fileDirectoryFillIcon : entry.mode === SYMLINK_MODE ? fileSymlinkFileIcon : fileIcon}
                      class={entry.type === 'tree' ? 'text-[var(--treeViewItem-leadingVisual-iconColor-rest)]' : 'text-fg-muted'}
                    />
                  </Show>
                  <Show
                    when={entry.type !== 'commit'}
                    fallback={
                      <a class="link-plain truncate" href={submoduleHref(entry)} title={entry.target ?? entry.name}>
                        {entry.name} @ <span class="font-mono text-fg-accent">{entry.oid.slice(0, 7)}</span>
                      </a>
                    }
                  >
                    <a class="link-plain truncate" href={hrefFor(entry)} title={entry.name}>
                      {entry.name}
                    </a>
                  </Show>
                </div>
              </td>
              <td class="py-2 px-2 text-fg-muted">
                <Loading fallback={<span class="Skeleton w-2/3" />}>
                  <Show when={commits()[entry.path]}>
                    {(c) => (
                      <div class="truncate">
                        <CommitMessage message={c().messageHeadline} base={base()} href={`${base()}/commit/${c().oid}`} />
                      </div>
                    )}
                  </Show>
                </Loading>
              </td>
              <td class="py-2 pr-4 pl-2 text-right text-fg-muted whitespace-nowrap w-32">
                <Loading fallback={<span class="Skeleton w-16 ml-auto" />}>
                  <Show when={commits()[entry.path]}>{(c) => <RelativeTime datetime={c().committedDate} relative />}</Show>
                </Loading>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}
