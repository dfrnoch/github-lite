import { useLocation, useNavigate } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createContext, createEffect, createMemo, createSignal, For, Loading, onSettled, Show, untrack, useContext } from 'solid-js';
import Octicon from '../../../components/Octicon';
import {
  chevronDownIcon,
  chevronRightIcon,
  fileDirectoryFillIcon,
  fileDirectoryOpenFillIcon,
  fileIcon,
  fileSubmoduleIcon,
  fileSymlinkFileIcon,
  pencilIcon,
  searchIcon,
  sidebarCollapseIcon,
  sidebarExpandIcon,
} from '../../../icons/octicons';
import { encodePath } from '../../../lib/github';
import { useHotkey } from '../../../lib/hotkeys';
import type { Repository } from '../../../lib/types';
import { usePermalinkHotkey } from '../../code/refined';
import { feature } from '../../refined';
import { getTree, type TreeEntry } from '../api';
import RefPicker from './RefPicker';

const KEY = 'gh-lite:file-tree';
const store = typeof localStorage !== 'undefined' ? localStorage : undefined;
const [treeOpen, setTreeOpenSignal] = createSignal(store?.getItem(KEY) !== '0');
const setTreeOpen = (open: boolean) => {
  store?.setItem(KEY, open ? '1' : '0');
  setTreeOpenSignal(open);
};

/** True inside a CodeLayout whose file tree is showing (pages then drop their own branch picker on wide screens). */
export const FileTreeContext = createContext<() => boolean>(() => false);
export const useFileTreeOpen = () => useContext(FileTreeContext);

const SYMLINK_MODE = 0o120000;

/** Pages currently providing their own `t` (so the repo-wide one stands down). */
let codeFinders = 0;
export const hasCodeFinderHotkey = () => codeFinders > 0;

/** `t` opens the file finder (github.com's hotkey). */
export function useFinderHotkey(href: () => string) {
  const navigate = useNavigate();
  onSettled(() => {
    codeFinders++;
    return () => codeFinders--;
  });
  useHotkey({ keys: 't', description: 'Open the file finder', group: 'Source code browsing', handler: () => navigate(href()) });
}

/**
 * Tree/blob/blame page frame: a collapsible file-tree side panel (lazy-loaded
 * directories, current path expanded) next to the page content — like
 * github.com's code view.
 */
export default function CodeLayout(props: {
  repo: Repository;
  gitRef: string;
  path: string;
  /** `path` is a directory (its own listing is expanded in the tree too). */
  isDir?: boolean;
  children: JSX.Element;
}) {
  const base = () => `/${props.repo.full_name}`;
  // Start every expanded level of the tree at once instead of level by level.
  createEffect(
    () => [props.repo.owner.login, props.repo.name, props.gitRef, props.path, !!props.isDir] as const,
    ([owner, repo, ref, path, isDir]) => {
      if (!untrack(treeOpen)) return;
      const parts = path.split('/').filter(Boolean);
      untrack(() => {
        for (let i = 1; i < parts.length + (isDir ? 1 : 0); i++)
          void getTree(owner, repo, ref, parts.slice(0, i).join('/')).catch(() => null);
      });
    },
  );
  const findHref = () => `${base()}/find/${encodePath(props.gitRef)}`;
  useFinderHotkey(findHref);
  const location = useLocation();
  usePermalinkHotkey(() => ({
    owner: props.repo.owner.login,
    repo: props.repo.name,
    gitRef: props.gitRef,
    route: location.pathname.split('/')[3] ?? 'tree',
    path: props.path,
  }));
  return (
    <FileTreeContext value={treeOpen}>
      <div class="flex items-start">
        <Show when={treeOpen()}>
          <aside class="hidden lg:flex flex-col w-[320px] shrink-0 border-r border-line-muted sticky top-0 h-screen" aria-label="File tree">
            <div class="flex items-center gap-2 px-4 pt-4 pb-2">
              <button
                type="button"
                class="btn btn-sm btn-invisible px-1.5!"
                aria-label="Collapse file tree"
                title="Collapse file tree"
                onClick={() => setTreeOpen(false)}
              >
                <Octicon icon={sidebarExpandIcon} />
              </button>
              <h2 class="font-semibold flex-1">Files</h2>
            </div>
            <div class="px-4 pb-2 flex flex-col gap-2">
              <div class="[&_.relative]:w-full [&_.btn]:w-full! [&_.btn]:max-w-none!">
                <RefPicker
                  owner={props.repo.owner.login}
                  repo={props.repo.name}
                  current={props.gitRef}
                  defaultBranch={props.repo.default_branch}
                  hrefFor={(ref) => `${base()}/tree/${encodePath(ref)}`}
                />
              </div>
              <a class="form-control form-control-sm flex! items-center gap-2 text-fg-muted! no-underline!" href={findHref()}>
                <Octicon icon={searchIcon} />
                <span class="flex-1">Go to file</span>
                <kbd class="text-xs border border-line rounded px-1">t</kbd>
              </a>
            </div>
            <nav class="flex-1 overflow-auto px-2 pb-4">
              <ul>
                <TreeDir repo={props.repo} gitRef={props.gitRef} path="" current={props.path} depth={0} />
              </ul>
            </nav>
          </aside>
        </Show>
        <div class="flex-1 min-w-0 px-4 md:px-6 py-4">
          <Show when={!treeOpen()}>
            <button
              type="button"
              class="btn btn-sm px-1.5! mb-3 hidden lg:inline-flex"
              aria-label="Expand file tree"
              title="Expand file tree"
              onClick={() => setTreeOpen(true)}
            >
              <Octicon icon={sidebarCollapseIcon} />
            </button>
          </Show>
          {props.children}
        </div>
      </div>
    </FileTreeContext>
  );
}

function TreeDir(props: { repo: Repository; gitRef: string; path: string; current: string; depth: number }) {
  const entries = createMemo(() => getTree(props.repo.owner.login, props.repo.name, props.gitRef, props.path));
  return (
    <Loading
      fallback={
        <li class="py-1" style={{ 'padding-left': `${props.depth * 16 + 28}px` }}>
          <span class="Skeleton w-24" />
        </li>
      }
    >
      <For each={entries() ?? []}>
        {(entry) => <TreeItem entry={entry} repo={props.repo} gitRef={props.gitRef} current={props.current} depth={props.depth} />}
      </For>
    </Loading>
  );
}

function TreeItem(props: { entry: TreeEntry; repo: Repository; gitRef: string; current: string; depth: number }) {
  const base = () => `/${props.repo.full_name}`;
  const isDir = () => props.entry.type === 'tree';
  const isCurrent = () => props.current === props.entry.path;
  const onPath = () => props.current.startsWith(`${props.entry.path}/`) || isCurrent();
  const [open, setOpen] = createSignal(() => isDir() && onPath());
  const href = () =>
    `${base()}/${isDir() ? 'tree' : 'blob'}/${encodePath(props.gitRef)}/${encodePath(props.entry.path)}`;
  const pad = () => ({ 'padding-left': `${props.depth * 16 + 8}px` });
  const quickEdit = () =>
    feature('quick-file-edit') && !props.repo.archived && !/^[0-9a-f]{40}$/i.test(props.gitRef) && props.entry.mode !== SYMLINK_MODE;
  let row!: HTMLDivElement;
  // sidebar-focus-file: bring the current file / folder into view in the tree.
  createEffect(
    () => isCurrent() && feature('sidebar-focus-file'),
    (focus) => {
      if (focus) requestAnimationFrame(() => row?.scrollIntoView({ block: 'nearest' }));
    },
  );

  return (
    <li>
      <div
        ref={row}
        class={[
          'rgh-tree-row relative flex items-center gap-1 rounded-md pr-2 h-8 text-sm hover:bg-canvas-muted',
          { 'bg-canvas-muted font-semibold': isCurrent() },
        ]}
        style={pad()}
      >
        <Show when={isCurrent()}>
          <span class="absolute -left-2 top-1.5 bottom-1.5 w-1 rounded-md bg-accent-emphasis" />
        </Show>
        <Show
          when={isDir()}
          fallback={
            <>
              <span class="w-4 shrink-0" />
              <Show
                when={props.entry.type === 'commit'}
                fallback={
                  <Show
                    when={quickEdit()}
                    fallback={
                      <Octicon
                        icon={props.entry.mode === SYMLINK_MODE ? fileSymlinkFileIcon : fileIcon}
                        class="text-fg-muted shrink-0"
                      />
                    }
                  >
                    <a
                      class="rgh-quick-file-edit text-fg-muted hover:text-fg-accent inline-flex shrink-0"
                      href={`${base()}/edit/${encodePath(props.gitRef)}/${encodePath(props.entry.path)}`}
                      aria-label={`Edit ${props.entry.name}`}
                      title="Edit this file"
                    >
                      <Octicon icon={fileIcon} />
                      <Octicon icon={pencilIcon} />
                    </a>
                  </Show>
                }
              >
                <Octicon icon={fileSubmoduleIcon} class="text-fg-muted shrink-0" />
              </Show>
              <Show
                when={props.entry.type !== 'commit'}
                fallback={<span class="truncate ml-1 text-fg-muted">{props.entry.name}</span>}
              >
                <a class="link-plain truncate ml-1 flex-1" href={href()} title={props.entry.path}>
                  {props.entry.name}
                </a>
              </Show>
            </>
          }
        >
          <button
            type="button"
            class="w-4 h-4 inline-flex items-center justify-center text-fg-muted shrink-0"
            aria-label={open() ? `Collapse ${props.entry.name}` : `Expand ${props.entry.name}`}
            aria-expanded={open() ? 'true' : 'false'}
            onClick={() => setOpen(!open())}
          >
            <Octicon icon={open() ? chevronDownIcon : chevronRightIcon} size={12} />
          </button>
          <Octicon
            icon={open() ? fileDirectoryOpenFillIcon : fileDirectoryFillIcon}
            class="shrink-0 text-[var(--treeViewItem-leadingVisual-iconColor-rest)]"
          />
          <a class="link-plain truncate ml-1 flex-1" href={href()} title={props.entry.path} onClick={() => setOpen(true)}>
            {props.entry.name}
          </a>
        </Show>
      </div>
      <Show when={isDir() && open()}>
        <ul>
          <TreeDir repo={props.repo} gitRef={props.gitRef} path={props.entry.path} current={props.current} depth={props.depth + 1} />
        </ul>
      </Show>
    </li>
  );
}
