import { Portal } from '@solidjs/web';
import { createSignal, For, Show } from 'solid-js';
import { insertText } from '../../features/refined/editor';
import Avatar from './Avatar';
import { mentionPeople, mentionSuggestions, repoFromLocation, type MentionUser } from './mentions';

/** `@query` right before the caret (a login is 1–39 letters, digits and dashes). */
const MENTION = /(?:^|[\s([{>"'])@([A-Za-z0-9][A-Za-z0-9-]{0,38})?$/;

const MIRRORED = [
  'boxSizing', 'width', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight',
  'fontStretch', 'fontSize', 'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent',
  'letterSpacing', 'wordSpacing', 'tabSize',
] as const;

/** Viewport point just below text offset `pos` of a textarea (a mirror div lays the text out the same way). */
function caretPoint(el: HTMLTextAreaElement, pos: number) {
  const cs = getComputedStyle(el);
  const mirror = document.createElement('div');
  const s = mirror.style;
  for (const p of MIRRORED) s[p] = cs[p];
  Object.assign(s, { position: 'absolute', visibility: 'hidden', top: '0', left: '-9999px', whiteSpace: 'pre-wrap', overflowWrap: 'break-word' });
  mirror.textContent = el.value.slice(0, pos);
  const mark = document.createElement('span');
  mark.textContent = el.value.slice(pos) || '.';
  mirror.append(mark);
  document.body.append(mirror);
  const box = el.getBoundingClientRect();
  const top = box.top + el.clientTop + mark.offsetTop - el.scrollTop + (parseFloat(cs.lineHeight) || 20) + 2;
  const left = box.left + el.clientLeft + mark.offsetLeft - el.scrollLeft;
  mirror.remove();
  return { top, left: Math.max(8, Math.min(left, document.documentElement.clientWidth - 268)) };
}

interface Open {
  /** Offsets of `@query` in the text. */
  start: number;
  end: number;
  top: number;
  left: number;
  users: MentionUser[];
}

/**
 * github.com's @-mention suggester for a comment textarea: typing `@`
 * lists the people on the issue / pull request first, then the
 * repository's other mentionable users, narrowed as you type. ↑/↓ (or
 * Ctrl+P/N) move, Enter/Tab inserts, Escape dismisses.
 *
 * `attach` is a textarea ref; `view` renders the list (portalled, fixed
 * at the caret).
 */
export function createMentionSuggester(repo: () => string | undefined) {
  const [open, setOpen] = createSignal<Open | null>(null);
  const [index, setIndex] = createSignal(0);
  let field: HTMLTextAreaElement | undefined;
  let seq = 0;

  /** Follow the caret while the page scrolls. */
  const place = () => {
    const o = open();
    if (o && field?.isConnected) setOpen({ ...o, ...caretPoint(field, o.start) });
  };

  const close = () => {
    seq++;
    window.removeEventListener('scroll', place, { capture: true });
    if (open()) setOpen(null);
  };

  const update = () => {
    const el = field;
    if (!el || el.selectionStart !== el.selectionEnd) return close();
    const caret = el.selectionStart;
    const m = el.value.slice(0, caret).match(MENTION);
    const r = m && (repo() || repoFromLocation());
    if (!m || !r) return close();
    const query = m[1] ?? '';
    const start = caret - query.length - 1;
    const id = ++seq;
    const show = (users: MentionUser[]) => {
      if (id !== seq || !field) return;
      if (!users.length) return close();
      // Keep the highlight when the same query's list grows (people → repository search).
      const o = open();
      const selected = o && o.start === start && o.end === caret ? o.users[index()]?.login : undefined;
      if (!open()) window.addEventListener('scroll', place, { capture: true, passive: true });
      setOpen({ start, end: caret, users, ...caretPoint(field, start) });
      setIndex(Math.max(0, users.findIndex((u) => u.login === selected)));
    };
    // The item's people show at once; the repository search follows once typing pauses.
    void mentionPeople(r, query).then((users) => users.length && show(users));
    setTimeout(() => id === seq && void mentionSuggestions(r, query).then(show), 150);
  };

  const pick = (user: MentionUser) => {
    const o = open();
    if (!field || !o) return;
    close();
    field.setSelectionRange(o.start, o.end);
    insertText(field, `@${user.login} `);
  };

  const onKey = (e: KeyboardEvent) => {
    const o = open();
    if (!o || e.isComposing) return;
    const n = o.users.length;
    const key = e.ctrlKey && !e.metaKey && !e.altKey ? ({ n: 'ArrowDown', p: 'ArrowUp' } as Record<string, string>)[e.key] : e.key;
    if (key === 'ArrowDown') setIndex((index() + 1) % n);
    else if (key === 'ArrowUp') setIndex((index() - 1 + n) % n);
    else if ((key === 'Enter' || key === 'Tab') && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) pick(o.users[index()]!);
    else if (key === 'Escape') close();
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  const attach = (el: HTMLTextAreaElement) => {
    field = el;
    // Capture: ahead of the field's other key handlers (tab-to-indent, one-key-formatting, Ctrl+Enter).
    el.addEventListener('keydown', onKey, true);
    el.addEventListener('input', update);
    el.addEventListener('keyup', (e) => ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && update());
    el.addEventListener('click', update);
    el.addEventListener('blur', close);
    // Warm the item's people so a bare "@" lists them at once.
    el.addEventListener('focus', () => {
      const r = repo() || repoFromLocation();
      if (r) void mentionPeople(r, '');
    });
  };

  const view = () => (
    <Show when={open()}>
      {(o) => (
        <Portal>
        <ul
          class="mention-suggester"
          role="listbox"
          aria-label="Suggested users"
          style={{ top: `${o().top}px`, left: `${o().left}px` }}
          data-no-hovercard=""
          // Keep focus (and the caret) in the textarea.
          onMouseDown={(e) => e.preventDefault()}
        >
          <For each={o().users}>
            {(user, i) => (
              <li
                role="option"
                aria-selected={i() === index() ? 'true' : 'false'}
                onMouseMove={() => setIndex(i())}
                onClick={() => pick(user)}
              >
                <Avatar src={user.avatarUrl} size={20} />
                <span class="font-semibold">{user.login}</span>
                <Show when={user.name}>
                  <span class="mention-suggester-name truncate">{user.name}</span>
                </Show>
              </li>
            )}
          </For>
        </ul>
        </Portal>
      )}
    </Show>
  );

  return { attach, view };
}
