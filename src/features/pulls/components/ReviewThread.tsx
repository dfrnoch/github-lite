import { useAction } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import { getViewer } from '../../user/api';
import Octicon from '../../../components/Octicon';
import { Avatar, MarkdownEditor, toastError } from '../../../components/ui';
import { checkIcon, chevronDownIcon, chevronRightIcon, fileIcon } from '../../../icons/octicons';
import LineNumberLink from '../../code/components/LineNumberLink';
import Comment from '../../issues/components/Comment';
import type { ReviewThread as Thread } from '../../issues/types';
import { replyToThread, setThreadResolved } from '../api';

interface HunkLine {
  kind: 'add' | 'del' | 'ctx' | 'hunk';
  text: string;
  old?: number;
  new?: number;
}

/** Parse a review comment's diff hunk into numbered lines. */
export function parseHunk(hunk: string): HunkLine[] {
  const out: HunkLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  for (const raw of hunk.split('\n')) {
    const m = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (m) {
      oldLine = Number(m[1]);
      newLine = Number(m[2]);
      out.push({ kind: 'hunk', text: raw });
    } else if (raw.startsWith('+')) out.push({ kind: 'add', text: raw.slice(1), new: newLine++ });
    else if (raw.startsWith('-')) out.push({ kind: 'del', text: raw.slice(1), old: oldLine++ });
    else if (raw.startsWith('\\')) continue;
    else out.push({ kind: 'ctx', text: raw.slice(1), old: oldLine++, new: newLine++ });
  }
  return out;
}

/** The few diff lines a review comment points at (GitHub shows the last 4). */
export function DiffHunk(props: { hunk: string; lines?: number; path?: string; filesHref?: string }) {
  const rows = createMemo(() => {
    const all = parseHunk(props.hunk);
    const body = all.filter((l) => l.kind !== 'hunk');
    const shown = body.slice(-(props.lines ?? 4));
    const header = all[0]?.kind === 'hunk' && body.length <= (props.lines ?? 4) ? [all[0]] : [];
    return [...header, ...shown];
  });
  return (
    <div class="overflow-x-auto">
      <table class="diff-table w-full text-xs">
        <tbody>
          <For each={rows()}>
            {(l) => (
              <tr>
                <td class={['blob-num', { 'blob-num-addition': l.kind === 'add', 'blob-num-deletion': l.kind === 'del', 'blob-num-hunk': l.kind === 'hunk' }]}>
                  <LineNumberLink n={l.old} side="L" path={props.path} filesHref={props.filesHref} />
                </td>
                <td class={['blob-num', { 'blob-num-addition': l.kind === 'add', 'blob-num-deletion': l.kind === 'del', 'blob-num-hunk': l.kind === 'hunk' }]}>
                  <LineNumberLink n={l.new} side="R" path={props.path} filesHref={props.filesHref} />
                </td>
                <td
                  class={[
                    'blob-code blob-code-inner whitespace-pre font-mono',
                    {
                      'blob-code-addition': l.kind === 'add',
                      'blob-code-deletion': l.kind === 'del',
                      'blob-code-hunk text-fg-muted': l.kind === 'hunk',
                    },
                  ]}
                >
                  {l.kind === 'add' ? '+ ' : l.kind === 'del' ? '- ' : l.kind === 'ctx' ? '  ' : ''}
                  {l.text}
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}

/** A review comment thread shown inline in the conversation: file, diff hunk, comments, reply, resolve. */
export default function ReviewThread(props: {
  thread: Thread;
  owner: string;
  repo: string;
  number: number;
  issueAuthor: string;
  viewerAvatar?: string;
  canReact: boolean;
}) {
  const [expanded, setExpanded] = createSignal(() => !props.thread.isResolved && !props.thread.isCollapsed);
  const first = () => props.thread.comments.nodes[0];
  const filesHref = () => `/${props.owner}/${props.repo}/pull/${props.number}/files`;

  return (
    <div class="Box mt-3 overflow-hidden">
      <div class="flex items-center gap-2 px-3 py-2 bg-canvas-muted border-b border-line text-sm">
        <button
          type="button"
          class="btn-octicon w-6 h-6"
          aria-label={expanded() ? 'Collapse thread' : 'Expand thread'}
          onClick={() => setExpanded(!expanded())}
        >
          <Octicon icon={expanded() ? chevronDownIcon : chevronRightIcon} />
        </button>
        <Octicon icon={fileIcon} class="text-fg-muted" />
        <a class="link-plain font-mono text-xs font-semibold truncate min-w-0" href={filesHref()}>
          {props.thread.path}
        </a>
        <Show when={props.thread.isOutdated}>
          <span class="Label Label--attention">Outdated</span>
        </Show>
        <div class="flex-1" />
        <Show when={props.thread.isResolved}>
          <span class="text-xs text-fg-muted flex items-center gap-1">
            <Octicon icon={checkIcon} /> Resolved
          </span>
        </Show>
      </div>
      <Show when={expanded()}>
        <Show when={props.thread.subjectType !== 'FILE' && first()?.diffHunk}>
          <div class="border-b border-line">
            <DiffHunk hunk={first()!.diffHunk} path={props.thread.path} filesHref={filesHref()} />
          </div>
        </Show>
        <div class="divide-y divide-[var(--borderColor-muted)]">
          <For each={props.thread.comments.nodes}>
            {(c) => (
              <div class="py-2">
                <Comment
                  nested
                  comment={c}
                  anchor={c.databaseId ? `discussion_r${c.databaseId}` : undefined}
                  commentRef={{ kind: 'review_comment', owner: props.owner, repo: props.repo, number: props.number, databaseId: c.databaseId }}
                  repo={`${props.owner}/${props.repo}`}
                  issueAuthor={props.issueAuthor}
                  verb=""
                  canReact={props.canReact}
                />
              </div>
            )}
          </For>
        </div>
        <ThreadFooter {...props} />
      </Show>
    </div>
  );
}

function ThreadFooter(props: {
  thread: Thread;
  owner: string;
  repo: string;
  number: number;
  viewerAvatar?: string;
}) {
  const [replying, setReplying] = createSignal(false);
  const [text, setText] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const viewer = createMemo(() => getViewer());
  const reply = useAction(replyToThread);
  const resolve = useAction(setThreadResolved);

  const submit = async () => {
    const id = props.thread.comments.nodes[0]?.databaseId;
    if (!id || !text().trim()) return;
    setBusy(true);
    try {
      await reply(props.owner, props.repo, props.number, id, text());
      setText('');
      setReplying(false);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const toggleResolved = async () => {
    setBusy(true);
    try {
      await resolve(props.thread.id, !props.thread.isResolved);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="border-t border-line bg-canvas-muted px-3 py-2">
      <Show
        when={replying()}
        fallback={
          <div class="flex items-center gap-2">
            <Show when={props.thread.viewerCanReply}>
              <Loading fallback={<span class="w-6" />}>
                <Avatar src={viewer().avatar_url} size={24} />
              </Loading>
              <button
                type="button"
                class="form-control form-control-sm flex-1 text-left text-fg-muted cursor-text"
                onClick={() => setReplying(true)}
              >
                Reply...
              </button>
            </Show>
            <Show when={props.thread.isResolved ? props.thread.viewerCanUnresolve : props.thread.viewerCanResolve}>
              <button type="button" class="btn btn-sm" disabled={busy()} onClick={toggleResolved}>
                {props.thread.isResolved ? 'Unresolve conversation' : 'Resolve conversation'}
              </button>
            </Show>
          </div>
        }
      >
        <MarkdownEditor value={text()} onInput={setText} repo={`${props.owner}/${props.repo}`} onSubmit={submit} minHeight={80} autofocus />
        <div class="flex justify-end gap-2 mt-2">
          <button type="button" class="btn btn-sm" onClick={() => setReplying(false)}>
            Cancel
          </button>
          <button type="button" class="btn btn-sm btn-primary" disabled={busy() || !text().trim()} onClick={submit}>
            Reply
          </button>
        </div>
      </Show>
    </div>
  );
}
