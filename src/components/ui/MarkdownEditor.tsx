import { createMemo, createSignal, Loading, Show } from 'solid-js';
import {
  boldIcon,
  codeIcon,
  italicIcon,
  linkIcon,
  listOrderedIcon,
  listUnorderedIcon,
  markdownIcon,
  quoteIcon,
  tasklistIcon,
} from '../../icons/octicons';
import { renderMarkdown } from '../../lib/markdown';
import Octicon from '../Octicon';
import Markdown from './Markdown';
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
}) {
  const [tab, setTab] = createSignal<'write' | 'preview'>('write');
  let textarea!: HTMLTextAreaElement;

  const preview = createMemo(() => (tab() === 'preview' ? renderMarkdown(props.value, props.repo) : ''));

  const apply = (f: Format) => {
    const { selectionStart: s, selectionEnd: e, value } = textarea;
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
      textarea.focus();
      textarea.setSelectionRange(...cursor);
    });
  };

  return (
    <div class="rounded-md border border-line">
      <div class="flex items-center justify-between gap-2 border-b border-line bg-canvas-muted px-2 pt-2 rounded-t-md">
        <div class="flex -mb-px">
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
          <div class="hidden md:flex items-center pb-1">
            {FORMATS.map((f) => (
              <button
                type="button"
                class="btn-octicon w-7 h-7"
                title={f.label}
                aria-label={f.label}
                onClick={() => apply(f.format)}
              >
                <Octicon icon={f.icon} />
              </button>
            ))}
          </div>
        </Show>
      </div>
      <div class="p-2">
        <Show
          when={tab() === 'preview'}
          fallback={
            <textarea
              ref={textarea}
              id={props.id}
              class="form-control border-none! shadow-none! bg-canvas"
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
          <div class="px-2 py-1" style={{ 'min-height': `${props.minHeight ?? 120}px` }}>
            <Loading fallback={<Spinner size={20} class="text-fg-muted" />}>
              <Show when={props.value.trim()} fallback={<p class="text-fg-muted">Nothing to preview</p>}>
                <Markdown html={preview()} />
              </Show>
            </Loading>
          </div>
        </Show>
      </div>
      <div class="flex items-center gap-1 px-3 pb-2 text-xs text-fg-muted">
        <Octicon icon={markdownIcon} />
        <span>Markdown is supported</span>
      </div>
    </div>
  );
}
