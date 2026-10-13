import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, createSignal, createUniqueId, For, Show } from 'solid-js';

/**
 * A search box that highlights GitHub search syntax like github.com does:
 * qualifier keys (`label:`) stay in the default color, their values
 * (`bug`, `"good first issue"`) are accent-blue on a subtle accent
 * background, `@me` is purple and `AND` / `OR` / `NOT` are emphasised.
 *
 * Overlay technique: a transparent-text `<input>` (only the caret and the
 * selection are visible) sits on top of an `aria-hidden` mirror rendering
 * the tokenized query with the same font metrics; the mirror follows the
 * input's horizontal scroll.
 *
 * `class` styles the box (pass e.g. `form-control pl-8!`); `children` are
 * rendered inside it (absolutely positioned icons / clear buttons).
 * The value is controlled: set it through `value`, never `input.value`.
 *
 *   <QueryInput class="form-control" value={q()} onInput={setQ} label="Search issues" suggestions={ISSUE_QUALIFIERS} />
 */
export interface QueryInputProps {
  value: string;
  onInput?: (value: string) => void;
  /** Box classes (border, padding…). The input itself is unstyled. */
  class?: JSX.HTMLAttributes<HTMLDivElement>['class'];
  name?: string;
  placeholder?: string;
  /** aria-label of the input. */
  label?: string;
  /** Qualifier keys highlighted as such (default: every GitHub search qualifier). */
  keys?: readonly string[];
  /** Offer a qualifier suggestion list for these keys while typing (off when omitted). */
  suggestions?: readonly string[];
  /** Value lists offered after `key:` (merged over the built-in ones for is/state/sort/…). */
  values?: Record<string, readonly string[]>;
  inputRef?: (el: HTMLInputElement) => void;
  onFocus?: (e: FocusEvent & { currentTarget: HTMLInputElement }) => void;
  onBlur?: (e: FocusEvent & { currentTarget: HTMLInputElement }) => void;
  onKeyDown?: (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => void;
  children?: JSX.Element;
}

// ---------------------------------------------------------------------------
// Tokenizer

export interface QuerySegment {
  text: string;
  /** value = qualifier value, user = `@me`, keyword = AND / OR / NOT; plain otherwise. */
  kind?: 'value' | 'user' | 'keyword';
}

/** Every qualifier GitHub's issue, PR, repository, code, user and discussion searches understand. */
export const QUERY_KEYS: readonly string[] = [
  'is', 'state', 'type', 'in', 'label', 'author', 'assignee', 'mentions', 'commenter', 'involves', 'team', 'milestone',
  'project', 'no', 'has', 'sort', 'reason', 'language', 'repo', 'org', 'user', 'owner', 'created', 'updated', 'closed',
  'merged', 'comments', 'reactions', 'interactions', 'draft', 'review', 'reviewed-by', 'review-requested',
  'user-review-requested', 'team-review-requested', 'head', 'base', 'status', 'archived', 'linked', 'stars', 'forks',
  'size', 'pushed', 'topic', 'topics', 'license', 'path', 'extension', 'filename', 'symbol', 'content', 'fork', 'mirror',
  'template', 'followers', 'location', 'repos', 'category', 'answered', 'locked', 'parent-issue', 'sub-issue',
  'blocked-by', 'blocking', 'app', 'visibility', 'good-first-issues', 'help-wanted-issues', 'fullname', 'sponsorable',
  'author-email', 'author-name', 'author-date', 'committer', 'committer-email', 'committer-name', 'committer-date',
  'hash', 'parent', 'tree', 'merge', 'enterprise', 'tag', 'answered-by', 'field', 'iteration',
];

/** The qualifiers offered while typing in an issue / PR list. */
export const ISSUE_QUALIFIERS: readonly string[] = [
  'is', 'state', 'label', 'author', 'assignee', 'milestone', 'sort', 'no', 'reason', 'type', 'mentions', 'commenter',
  'involves', 'project', 'review', 'reviewed-by', 'review-requested', 'draft', 'base', 'head', 'linked', 'in',
  'created', 'updated', 'closed', 'comments', 'repo', 'org', 'archived',
];

/** Static values suggested after `key:` (keys without an entry get no value list). */
const VALUE_SUGGESTIONS: Record<string, readonly string[]> = {
  is: ['open', 'closed', 'issue', 'pr', 'merged', 'unmerged', 'draft', 'locked', 'unlocked', 'public', 'private', 'answered', 'unanswered'],
  state: ['open', 'closed'],
  sort: ['created-desc', 'created-asc', 'updated-desc', 'updated-asc', 'comments-desc', 'comments-asc', 'reactions-desc', 'reactions-+1-desc', 'interactions-desc'],
  no: ['label', 'milestone', 'assignee', 'project', 'type'],
  has: ['label', 'milestone', 'assignee', 'project', 'type'],
  reason: ['completed', '"not planned"', 'duplicate'],
  review: ['none', 'required', 'approved', 'changes_requested'],
  draft: ['true', 'false'],
  archived: ['true', 'false'],
  author: ['@me'],
  assignee: ['@me'],
  mentions: ['@me'],
  involves: ['@me'],
  commenter: ['@me'],
  'reviewed-by': ['@me'],
  'review-requested': ['@me'],
  in: ['title', 'body', 'comments', 'name', 'description', 'readme'],
  linked: ['pr', 'issue'],
};

const WORD = /\s+|(?:"[^"]*"?|[^\s"]+)+/g;
const QUALIFIER = /^(-?)([a-z][\w.-]*):([\s\S]*)$/i;
const VALUE_PART = /"[^"]*"?|[^,"]+|,/g;

/**
 * Split a search query into highlight segments, keeping every character
 * (whitespace included) so the concatenation equals the input.
 */
export function highlightQuery(q: string, keys: ReadonlySet<string> = DEFAULT_KEYS): QuerySegment[] {
  const out: QuerySegment[] = [];
  const push = (text: string, kind?: QuerySegment['kind']) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (!kind && last && !last.kind) last.text += text;
    else out.push(kind ? { text, kind } : { text });
  };
  for (const [word] of q.matchAll(WORD)) {
    if (/^\s/.test(word)) {
      push(word);
      continue;
    }
    if (/^(AND|OR|NOT)$/.test(word)) {
      push(word, 'keyword');
      continue;
    }
    // Grouping parentheses around a term: `(is:issue OR is:pr)`.
    const [, open = '', core = '', close = ''] = word.match(/^(\(*)([\s\S]*?)(\)*)$/)!;
    push(open);
    const m = core.match(QUALIFIER);
    if (m && m[3] && keys.has(m[2]!.toLowerCase())) {
      push(`${m[1]}${m[2]}:`);
      for (const [part] of m[3].matchAll(VALUE_PART)) push(part, part === ',' ? undefined : /^@me$/i.test(part) ? 'user' : 'value');
    } else push(core);
    push(close);
  }
  return out;
}

const DEFAULT_KEYS: ReadonlySet<string> = new Set(QUERY_KEYS);

const quoteValue = (v: string) => (/\s/.test(v) && !v.startsWith('"') ? `"${v}"` : v);

interface Suggestion {
  label: string;
  insert: string;
}

// ---------------------------------------------------------------------------

export default function QueryInput(props: QueryInputProps) {
  const [text, setText] = createSignal(() => props.value ?? '');
  const keySet = createMemo(() => (props.keys ? new Set(props.keys) : DEFAULT_KEYS));
  const segments = createMemo(() => highlightQuery(text(), keySet()));
  const listId = createUniqueId();
  let input!: HTMLInputElement;
  let mirror!: HTMLSpanElement;

  /** Keep the mirror under the input's horizontal scroll position. */
  const sync = () => {
    if (input && mirror) mirror.style.transform = input.scrollLeft ? `translateX(${-input.scrollLeft}px)` : '';
  };
  const syncSoon = () => requestAnimationFrame(sync);
  createEffect(
    () => segments(),
    () => {
      syncSoon();
    },
  );

  // ---- qualifier suggestions
  const [caret, setCaret] = createSignal(0);
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(-1);
  /** The word ending at the caret (only when the caret is at a word end). */
  const current = createMemo(() => {
    const t = text();
    const c = Math.min(caret(), t.length);
    if (c < t.length && !/\s/.test(t[c]!)) return null;
    const start = c - t.slice(0, c).match(/\S*$/)![0].length;
    return { start, end: c, word: t.slice(start, c) };
  });
  const options = createMemo<Suggestion[]>(() => {
    const keys = props.suggestions;
    const w = current();
    if (!keys || !open() || !w?.word) return [];
    const m = w.word.match(/^(-?)([a-z][\w-]*)?(?::(.*))?$/i);
    if (!m) return [];
    const [, neg = '', key = '', value] = m;
    if (value === undefined) {
      if (!key) return [];
      const k = key.toLowerCase();
      return keys
        .filter((q) => q.startsWith(k))
        .slice(0, 8)
        .map((q) => ({ label: `${neg}${q}:`, insert: `${neg}${q}:` }));
    }
    const k = key.toLowerCase();
    const values = keys.includes(k) ? (props.values?.[k] ?? VALUE_SUGGESTIONS[k]) : undefined;
    if (!values) return [];
    const v = value.toLowerCase();
    return values
      .filter((x) => x.toLowerCase().startsWith(v) && x.toLowerCase() !== v)
      .slice(0, 10)
      .map((x) => ({ label: `${neg}${key}:${x}`, insert: `${neg}${key}:${quoteValue(x)} ` }));
  });

  const update = (value: string) => {
    setText(value);
    props.onInput?.(value);
  };
  const accept = (s: Suggestion) => {
    const w = current();
    if (!w) return;
    const t = text();
    const next = t.slice(0, w.start) + s.insert + t.slice(w.end);
    const pos = w.start + s.insert.length;
    input.value = next;
    input.setSelectionRange(pos, pos);
    update(next);
    setCaret(pos);
    setActive(-1);
    syncSoon();
  };
  const trackCaret = () => {
    setCaret(input.selectionStart ?? input.value.length);
    syncSoon();
  };

  const onKeyDown = (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
    const list = options();
    if (list.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setActive((i) => (i + d + list.length + (i < 0 && d < 0 ? 1 : 0)) % list.length);
        return;
      }
      if ((e.key === 'Enter' && active() >= 0) || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        accept(list[Math.max(0, active())]!);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
    }
    if (e.key === 'Enter') setOpen(false);
    props.onKeyDown?.(e);
  };

  return (
    <div
      class={['QueryInput', props.class]}
      onMouseDown={(e) => {
        // Clicks on the box padding focus the input (like a native field).
        if (e.target === e.currentTarget) {
          e.preventDefault();
          input.focus();
        }
      }}
    >
      <div class="QueryInput-field">
        <div class="QueryInput-mirror" aria-hidden="true">
          <span ref={mirror}>
            <For each={segments()} keyed={false}>
              {(s) => (
                <span class={{ 'QueryInput-value': s().kind === 'value', 'QueryInput-user': s().kind === 'user', 'QueryInput-keyword': s().kind === 'keyword' }}>
                  {s().text}
                </span>
              )}
            </For>
          </span>
        </div>
        <input
          ref={(el) => {
            input = el;
            props.inputRef?.(el);
          }}
          type="text"
          name={props.name}
          value={text()}
          placeholder={props.placeholder}
          aria-label={props.label}
          autocomplete="off"
          spellcheck="false"
          enterkeyhint="search"
          role={props.suggestions ? 'combobox' : undefined}
          aria-autocomplete={props.suggestions ? 'list' : undefined}
          aria-expanded={props.suggestions ? (options().length ? 'true' : 'false') : undefined}
          aria-controls={props.suggestions ? listId : undefined}
          aria-activedescendant={active() >= 0 && options().length ? `${listId}-${active()}` : undefined}
          onInput={(e) => {
            update(e.currentTarget.value);
            setOpen(true);
            setActive(-1);
            trackCaret();
          }}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') trackCaret();
          }}
          onClick={trackCaret}
          onSelect={syncSoon}
          onScroll={sync}
          onFocus={(e) => {
            trackCaret();
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setOpen(false);
            setActive(-1);
            syncSoon();
            props.onBlur?.(e);
          }}
        />
      </div>
      {props.children}
      <Show when={options().length}>
        <ul class="SelectMenu QueryInput-menu" role="listbox" id={listId} aria-label="Search qualifiers">
          <For each={options()} keyed={false}>
            {(o, i) => (
              <li
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active() ? 'true' : 'false'}
                class={['SelectMenu-item font-mono text-xs!', { 'QueryInput-active': i === active() }]}
                onMouseDown={(e) => {
                  e.preventDefault();
                  accept(o());
                }}
              >
                {o().label}
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
