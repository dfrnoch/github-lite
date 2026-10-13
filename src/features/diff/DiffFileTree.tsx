import { createMemo, createSignal, For, Show } from 'solid-js';
import Octicon from '../../components/Octicon';
import {
  chevronDownIcon,
  chevronRightIcon,
  diffAddedIcon,
  diffModifiedIcon,
  diffRemovedIcon,
  diffRenamedIcon,
  fileDirectoryFillIcon,
  fileDirectoryOpenFillIcon,
  searchIcon,
} from '../../icons/octicons';
import type { DiffFile } from '../../lib/types';

interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
  file?: DiffFile;
}

/** Directory tree of changed files; single-child folder chains collapse into "a/b/c". */
export function buildDiffTree(files: DiffFile[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [] };
  for (const file of files) {
    const parts = file.filename.split('/');
    let node = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join('/');
      if (i === parts.length - 1) {
        node.children!.push({ name: part, path, file });
        return;
      }
      let dir = node.children!.find((c) => c.children && c.name === part);
      if (!dir) {
        dir = { name: part, path, children: [] };
        node.children!.push(dir);
      }
      node = dir;
    });
  }
  const compact = (n: TreeNode): TreeNode => {
    if (!n.children) return n;
    let cur = n;
    while (cur.children!.length === 1 && cur.children![0]!.children) {
      const only = cur.children![0]!;
      cur = { name: cur.name ? `${cur.name}/${only.name}` : only.name, path: only.path, children: only.children };
    }
    const children = cur.children!
      .map(compact)
      .sort((a, b) => Number(!a.children) - Number(!b.children) || a.name.localeCompare(b.name));
    return { ...cur, children };
  };
  return compact(root).children!;
}

export function FileStatusIcon(props: { status: DiffFile['status']; class?: string }) {
  const icon = () =>
    props.status === 'added'
      ? diffAddedIcon
      : props.status === 'removed'
        ? diffRemovedIcon
        : props.status === 'renamed' || props.status === 'copied'
          ? diffRenamedIcon
          : diffModifiedIcon;
  const color = () =>
    props.status === 'added'
      ? 'text-fg-success'
      : props.status === 'removed'
        ? 'text-fg-danger'
        : props.status === 'renamed' || props.status === 'copied'
          ? 'text-fg-muted'
          : 'text-fg-attention';
  return (
    <span class={['inline-flex', color(), props.class]}>
      <Octicon icon={icon()} aria-label={props.status} />
    </span>
  );
}

/** Sidebar listing the changed files of a diff; clicking one jumps to it. */
export default function DiffFileTree(props: {
  files: DiffFile[];
  active?: string;
  onSelect: (file: DiffFile) => void;
  isViewed?: (path: string) => boolean;
}) {
  const [filter, setFilter] = createSignal('');
  const filtered = createMemo(() => {
    const f = filter().trim().toLowerCase();
    return f ? props.files.filter((x) => x.filename.toLowerCase().includes(f)) : props.files;
  });
  const tree = createMemo(() => buildDiffTree(filtered()));
  const [closed, setClosed] = createSignal<Set<string>>(new Set());
  const toggle = (path: string) =>
    setClosed((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const Node = (p: { node: TreeNode; depth: number }) => (
    <Show
      when={p.node.children}
      fallback={
        <li>
          <button
            type="button"
            class={[
              'w-full flex items-center gap-2 py-1 pr-2 rounded-md text-left text-sm hover:bg-canvas-muted',
              { 'bg-canvas-muted font-semibold': props.active === p.node.path },
            ]}
            style={{ 'padding-left': `${p.depth * 12 + 24}px` }}
            title={p.node.path}
            onClick={() => props.onSelect(p.node.file!)}
          >
            <FileStatusIcon status={p.node.file!.status} class="shrink-0" />
            <span class={['truncate', { 'text-fg-muted': !!props.isViewed?.(p.node.path) }]}>{p.node.name}</span>
          </button>
        </li>
      }
    >
      {(children) => (
        <li>
          <button
            type="button"
            class="w-full flex items-center gap-1 py-1 pr-2 rounded-md text-left text-sm hover:bg-canvas-muted"
            style={{ 'padding-left': `${p.depth * 12 + 4}px` }}
            title={p.node.path}
            aria-expanded={closed().has(p.node.path) ? 'false' : 'true'}
            onClick={() => toggle(p.node.path)}
          >
            <Octicon icon={closed().has(p.node.path) ? chevronRightIcon : chevronDownIcon} class="text-fg-muted shrink-0" />
            <Octicon
              icon={closed().has(p.node.path) ? fileDirectoryFillIcon : fileDirectoryOpenFillIcon}
              class="shrink-0 text-[var(--treeViewItem-leadingVisual-iconColor-rest)]"
            />
            <span class="truncate">{p.node.name}</span>
          </button>
          <Show when={!closed().has(p.node.path)}>
            <ul>
              <For each={children()}>{(child) => <Node node={child} depth={p.depth + 1} />}</For>
            </ul>
          </Show>
        </li>
      )}
    </Show>
  );

  return (
    <nav aria-label="File tree">
      <div class="relative mb-2">
        <Octicon icon={searchIcon} class="absolute left-2 top-2 text-fg-muted" />
        <input
          class="form-control form-control-sm w-full pl-7!"
          placeholder="Filter files…"
          aria-label="Filter files"
          value={filter()}
          onInput={(e) => setFilter(e.currentTarget.value)}
        />
      </div>
      <ul>
        <For each={tree()} fallback={<li class="px-2 py-1 text-sm text-fg-muted">No matching files</li>}>
          {(node) => <Node node={node} depth={0} />}
        </For>
      </ul>
    </nav>
  );
}
