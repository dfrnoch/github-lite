import { createMemo, For, Show } from 'solid-js';

export interface EditorSettings {
  indentMode: 'spaces' | 'tabs';
  indentSize: number;
  wrap: boolean;
}

/**
 * Lightweight code editor: a monospace textarea with a line-number gutter,
 * Tab / Shift+Tab (in)dent, auto-indent on Enter and soft-wrap toggle.
 */
export default function CodeEditor(props: {
  value: string;
  onInput: (value: string) => void;
  settings: EditorSettings;
  onSave?: () => void;
  autofocus?: boolean;
}) {
  const lineCount = createMemo(() => props.value.split('\n').length);
  const numbers = createMemo(() => Array.from({ length: lineCount() }, (_, i) => i + 1));
  const indent = () => (props.settings.indentMode === 'tabs' ? '\t' : ' '.repeat(props.settings.indentSize));

  const edit = (el: HTMLTextAreaElement, start: number, end: number, text: string, cursor: [number, number]) => {
    // setRangeText keeps the browser's undo stack in most engines when paired with an input event.
    el.setRangeText(text, start, end, 'end');
    el.setSelectionRange(...cursor);
    props.onInput(el.value);
  };

  const onKeyDown = (e: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) => {
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: t, value } = el;
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      props.onSave?.();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      if (s === t && !e.shiftKey) {
        edit(el, s, t, indent(), [s + indent().length, s + indent().length]);
        return;
      }
      // Block (un)indent of every selected line.
      const block = value.slice(lineStart, t);
      const lines = block.split('\n');
      const unit = indent();
      const next = lines
        .map((l) => {
          if (!e.shiftKey) return unit + l;
          if (l.startsWith('\t')) return l.slice(1);
          const spaces = l.match(/^ */)![0].length;
          return l.slice(Math.min(spaces, props.settings.indentSize));
        })
        .join('\n');
      const firstDelta = e.shiftKey ? next.split('\n')[0]!.length - lines[0]!.length : unit.length;
      edit(el, lineStart, t, next, [Math.max(lineStart, s + firstDelta), t + (next.length - block.length)]);
      return;
    }
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const lead = value.slice(lineStart, s).match(/^[ \t]*/)![0];
      if (!lead) return;
      e.preventDefault();
      edit(el, s, t, `\n${lead}`, [s + 1 + lead.length, s + 1 + lead.length]);
    }
  };

  return (
    <div class="flex overflow-auto max-h-[70vh] min-h-[300px] bg-canvas font-mono text-xs leading-5">
      <Show when={!props.settings.wrap}>
        <div class="select-none text-right text-fg-muted pl-3 pr-2 py-2 border-r border-line-muted bg-canvas sticky left-0" aria-hidden="true">
          <For each={numbers()}>{(n) => <div class="h-5">{n}</div>}</For>
        </div>
      </Show>
      <textarea
        class={[
          'flex-1 py-2 px-3 bg-transparent outline-none resize-none border-0 text-fg overflow-hidden',
          props.settings.wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
        ]}
        style={{
          height: props.settings.wrap ? undefined : `${lineCount() * 20 + 16}px`,
          'min-height': '300px',
          'tab-size': String(props.settings.indentSize),
          'field-sizing': 'content',
        }}
        wrap={props.settings.wrap ? 'soft' : 'off'}
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        aria-label="File contents"
        autofocus={props.autofocus}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
