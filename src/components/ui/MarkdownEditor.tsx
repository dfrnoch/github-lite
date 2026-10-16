import { createMemo, createSignal, For, Loading, onSettled, Show, untrack } from 'solid-js';
import {
  fitTextarea,
  fixLinkLoss,
  insertText,
  isVulnerableToLinkLoss,
  oneKeyFormatting,
  openPreviewLinksInNewTab,
  smartBlockWrap,
  tabToIndent,
  trackUnfinishedComment,
} from '../../features/refined/editor';
import {
  alertIcon,
  boldIcon,
  codeIcon,
  foldDownIcon,
  italicIcon,
  linkIcon,
  listOrderedIcon,
  listUnorderedIcon,
  markdownIcon,
  quoteIcon,
  tableIcon,
  tasklistIcon,
} from '../../icons/octicons';
import { renderMarkdown } from '../../lib/markdown';
import Octicon from '../Octicon';
import Dropdown from './Dropdown';
import Markdown from './Markdown';
import { createMentionSuggester } from './MentionSuggester';
import Spinner from './Spinner';

type Format = { before: string; after?: string; line?: boolean; placeholder?: string };

const FORMATS: { icon: typeof boldIcon; label: string; format: Format }[] = [
  { icon: boldIcon, label: 'Bold', format: { before: '**', after: '**', placeholder: 'bold' } },
  { icon: italicIcon, label: 'Italic', format: { before: '_', after: '_', placeholder: 'italic' } },
  { icon: quoteIcon, label: 'Quote', format: { before: '> ', line: true } },
  { icon: codeIcon, label: 'Code', format: { before: '`', after: '`', placeholder: 'code' } },
  { icon: linkIcon, label: 'Link', format: { before: '[', after: '](url)', placeholder: 'text' } },
  { icon: listUnorderedIcon, label: 'Unordered list', format: { before: '- ', line: true } },
  { icon: listOrderedIcon, label: 'Numbered list', format: { before: '1. ', line: true } },
  { icon: tasklistIcon, label: 'Task list', format: { before: '- [ ] ', line: true } },
];

/**
 * GitHub's comment box: Write / Preview tabs, a formatting toolbar, and a
 * preview rendered by the API (so it matches the final result exactly).
 * Ctrl/Cmd+Enter calls `onSubmit`.
 *
 * Refined GitHub writing features live here too: one-key-formatting,
 * fit-textareas, collapsible-content-button, table-input, prevent-comment-loss
 * and prevent-link-loss, plus the optional tab-to-indent and
 * unfinished-comments (behind their toggles) and (with `monospace`)
 * monospace-textareas.
 */
export default function MarkdownEditor(props: {
  value: string;
  onInput: (value: string) => void;
  /** "owner/repo" — resolves #123 and @mentions in the preview. */
  repo?: string;
  placeholder?: string;
  minHeight?: number;
  onSubmit?: () => void;
  autofocus?: boolean;
  id?: string;
  disabled?: boolean;
  /** Code-like content (release notes, commit messages): monospace font with monospace-textareas on. */
  monospace?: boolean;
}) {
  const [tab, setTab] = createSignal<'write' | 'preview'>('write');
  let textarea: HTMLTextAreaElement | undefined;
  const mentions = createMentionSuggester(() => props.repo);

  // unfinished-comments: text typed here that hasn't been sent (edits start from the existing body).
  const initial = untrack(() => props.value);
  onSettled(() => trackUnfinishedComment(() => !!props.value.trim() && props.value !== initial));

  const linkLoss = createMemo(() => isVulnerableToLinkLoss(props.value, props.repo));
  const fixLinks = () => {
    if (!textarea) return;
    const fixed = fixLinkLoss(textarea.value, props.repo);
    textarea.select();
    insertText(textarea, fixed);
  };

  /** collapsible-content-button: wrap the selection in <details>, selecting the body. */
  const insertDetails = () => {
    if (!textarea) return;
    const el = textarea;
    const selection = el.value.slice(el.selectionStart, el.selectionEnd);
    el.focus();
    insertText(el, smartBlockWrap(`<details>\n<summary>Details</summary>\n\n${selection}\n\n</details>`, el));
    const caret = el.selectionStart;
    const start = el.value.lastIndexOf('</summary>', caret) + '</summary>'.length + 2;
    el.setSelectionRange(start, Math.max(start, el.value.lastIndexOf('</details>', caret) - 2));
  };

  /** table-input: insert a columns × rows HTML table and put the caret in the first cell. */
  const insertTable = (columns: number, rows: number) => {
    if (!textarea) return;
    const el = textarea;
    const cursor = el.selectionStart;
    const row = columns === 1 ? '<tr><td>\n' : '<tr>\n' + ' <td>\n'.repeat(columns);
    el.focus();
    insertText(el, smartBlockWrap(`<table>\n${row.repeat(rows)}</table>`, el));
    const first = el.value.indexOf('<td>', cursor) + '<td>'.length;
    el.setSelectionRange(first, first);
  };

  const preview = createMemo(() => (tab() === 'preview' ? renderMarkdown(props.value, props.repo) : ''));

  const apply = (f: Format) => {
    if (!textarea) return;
    const el = textarea;
    const { selectionStart: s, selectionEnd: e, value } = el;
    let next: string;
    let cursor: [number, number];
    if (f.line) {
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const block = value.slice(lineStart, e);
      const prefixed = block
        .split('\n')
        .map((l) => f.before + l)
        .join('\n');
      next = value.slice(0, lineStart) + prefixed + value.slice(e);
      cursor = [s + f.before.length, e + (prefixed.length - block.length)];
    } else {
      const selected = value.slice(s, e) || f.placeholder || '';
      next = value.slice(0, s) + f.before + selected + (f.after ?? '') + value.slice(e);
      cursor = [s + f.before.length, s + f.before.length + selected.length];
    }
    props.onInput(next);
    queueMicrotask(() => {
      el.focus();
      el.setSelectionRange(...cursor);
    });
  };

  return (
    <div class="rounded-md border border-line">
      <div class="flex items-center justify-between gap-2 border-b border-line bg-canvas-muted px-2 pt-2 rounded-t-md">
        <div class="flex -mb-px shrink-0 self-end">
          <button
            type="button"
            class={[
              'px-4 py-2 text-sm border border-transparent rounded-t-md',
              { 'bg-canvas border-line border-b-canvas font-semibold': tab() === 'write', 'text-fg-muted': tab() !== 'write' },
            ]}
            onClick={() => setTab('write')}
          >
            Write
          </button>
          <button
            type="button"
            class={[
              'px-4 py-2 text-sm border border-transparent rounded-t-md',
              { 'bg-canvas border-line border-b-canvas font-semibold': tab() === 'preview', 'text-fg-muted': tab() !== 'preview' },
            ]}
            onClick={() => setTab('preview')}
          >
            Preview
          </button>
        </div>
        <Show when={tab() === 'write'}>
          <div class="hidden md:flex flex-wrap items-center justify-end min-w-0 pb-1">
            <For each={FORMATS}>{(f) => (
              <button
                type="button"
                class="btn-octicon w-7 h-7"
                title={f.label}
                aria-label={f.label}
                onClick={() => apply(f.format)}
              >
                <Octicon icon={f.icon} />
              </button>
            )}</For>
            <span class="w-px h-4 mx-1 bg-[var(--borderColor-default)]" aria-hidden="true" />
            <button type="button" class="btn-octicon w-7 h-7" title="Add collapsible content" aria-label="Add collapsible content" onClick={insertDetails}>
              <Octicon icon={foldDownIcon} />
            </button>
            <TableInput onPick={insertTable} />
          </div>
        </Show>
      </div>
      <div class="p-2">
        <Show
          when={tab() === 'preview'}
          fallback={
            <textarea
              ref={[(el: HTMLTextAreaElement) => (textarea = el), mentions.attach, tabToIndent, oneKeyFormatting, fitTextarea]}
              id={props.id}
              class={['form-control border-none! shadow-none! bg-canvas', { 'rgh-monospace-field': !!props.monospace }]}
              style={{ 'min-height': `${props.minHeight ?? 120}px` }}
              placeholder={props.placeholder ?? 'Add your comment here...'}
              value={props.value}
              disabled={props.disabled}
              autofocus={props.autofocus}
              onInput={(e) => props.onInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && props.onSubmit) {
                  e.preventDefault();
                  props.onSubmit();
                }
              }}
            />
          }
        >
          {/* prevent-comment-loss: links open in a new tab instead of leaving the draft. */}
          <div class="px-2 py-1" style={{ 'min-height': `${props.minHeight ?? 120}px` }} onClick={openPreviewLinksInNewTab}>
            <Loading fallback={<Spinner size={20} class="text-fg-muted" />}>
              <Show when={props.value.trim()} fallback={<p class="text-fg-muted">Nothing to preview</p>}>
                <Markdown html={preview()} />
              </Show>
            </Loading>
          </div>
        </Show>
        {mentions.view()}
      </div>
      <Show when={linkLoss()}>
        <div class="flash flash-warn mx-2 mb-2 flex items-center gap-2 text-sm">
          <Octicon icon={alertIcon} />
          <span class="flex-1">
            Your link may be{' '}
            <a href="https://github.com/refined-github/refined-github/wiki/Extended-feature-descriptions#prevent-link-loss" target="_blank" rel="noreferrer">
              misinterpreted
            </a>{' '}
            by GitHub.
          </span>
          <button type="button" class="btn btn-sm" onClick={fixLinks}>
            Fix link
          </button>
        </div>
      </Show>
      <div class="flex items-center gap-1 px-3 pb-2 text-xs text-fg-muted">
        <Octicon icon={markdownIcon} />
        <span>Markdown is supported</span>
      </div>
    </div>
  );
}

/** table-input: a 5×5 grid picker; hovering highlights the table size. */
function TableInput(props: { onPick: (columns: number, rows: number) => void }) {
  const [hover, setHover] = createSignal<[number, number]>([0, 0]);
  const cells = Array.from({ length: 25 }, (_, i) => [(i % 5) + 1, Math.floor(i / 5) + 1] as const);
  return (
    <Dropdown class="btn-octicon w-7 h-7" align="right" menuClass="p-1! min-w-0!" title="Add a table" button={<Octicon icon={tableIcon} />}>
      {(close) => (
        <div class="rgh-table-input" role="group" aria-label="Table size" onMouseLeave={() => setHover([0, 0])}>
          <For each={cells}>
            {([x, y]) => (
              <button
                type="button"
                class={['rgh-tic', { 'rgh-tic--on': x <= hover()[0] && y <= hover()[1] }]}
                aria-label={`${x} × ${y} table`}
                title={`${x} × ${y}`}
                onMouseEnter={() => setHover([x, y])}
                onFocus={() => setHover([x, y])}
                onClick={() => {
                  close();
                  props.onPick(x, y);
                }}
              />
            )}
          </For>
        </div>
      )}
    </Dropdown>
  );
}
