/**
 * Refined GitHub "Writing comments" features as small reusable helpers.
 *
 * `MarkdownEditor` applies all of them. Other text fields opt in with ref
 * directives (they gate themselves on their feature toggle at event time):
 *
 *   <textarea ref={[tabToIndent, oneKeyFormatting, fitTextarea]} />   // plain comment-like textareas
 *   <input ref={[oneKeyFormatting, monospaceField]} />                 // commit / PR title inputs
 *   <input ref={avoidAccidentalSubmissions} />                         // title inputs inside a <form>
 *   <div ref={noSelfReference}>…rendered markdown…</div>               // issue / PR pages
 *
 * `commentField` and `titleField` bundle the usual combinations.
 */
import { createEffect, createRoot } from 'solid-js';
import { toast } from '../../components/ui/Toast';
import { feature } from '.';

type TextField = HTMLTextAreaElement | HTMLInputElement;

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

// ---------------------------------------------------------------------------
// Text field editing (keeps the browser's undo stack, fires `input`)
// ---------------------------------------------------------------------------

/** Replace the selection with `text` like typing would (undoable, fires `input`). */
export function insertText(field: TextField, text: string) {
  if (document.activeElement !== field) field.focus();
  // execCommand keeps the native undo history; it's deprecated but still the only way.
  // oxlint-disable-next-line typescript/no-deprecated
  if (!document.execCommand('insertText', false, text)) {
    field.setRangeText(text, field.selectionStart ?? 0, field.selectionEnd ?? 0, 'end');
    field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }
}

/** Wrap the selection in `before`/`after`, keeping the wrapped text selected. */
export function wrapSelection(field: TextField, before: string, after = before) {
  const start = field.selectionStart ?? 0;
  const end = field.selectionEnd ?? 0;
  const selected = field.value.slice(start, end);
  insertText(field, before + selected + after);
  field.setSelectionRange(start + before.length, start + before.length + selected.length);
}

/** Pad block content with blank lines unless the text around the cursor already has them. */
export function smartBlockWrap(content: string, field: TextField) {
  const before = field.value.slice(0, field.selectionStart ?? 0);
  const after = field.value.slice(field.selectionEnd ?? 0);
  const atStart = /\n*$/.exec(before)![0].length;
  const atEnd = /^\n*/.exec(after)![0].length;
  const prepend = /\S/.test(before) && atStart < 2 ? '\n'.repeat(2 - atStart) : '';
  const append = /\S/.test(after) && atEnd < 2 ? '\n'.repeat(2 - atEnd) : '';
  return prepend + content + append;
}

/** Tab: indent the selected lines (or insert a tab). */
export function indentSelection(field: HTMLTextAreaElement) {
  const { selectionStart: s, selectionEnd: e, value } = field;
  if (!value.slice(s, e).includes('\n')) return insertText(field, '\t');
  const lineStart = value.lastIndexOf('\n', s - 1) + 1;
  // A selection ending right after a newline doesn't include the next line.
  const end = value[e - 1] === '\n' ? e - 1 : e;
  const block = value.slice(lineStart, end);
  const indented = block.replace(/^|\n/g, '$&\t');
  field.setSelectionRange(lineStart, end);
  insertText(field, indented);
  field.setSelectionRange(s + 1, e + indented.length - block.length);
}

/** Shift+Tab: remove one level of indentation (a tab or up to 2 spaces) from the selected lines. */
export function unindentSelection(field: HTMLTextAreaElement) {
  const { selectionStart: s, selectionEnd: e, value } = field;
  const lineStart = value.lastIndexOf('\n', s - 1) + 1;
  const lastLineStart = value.lastIndexOf('\n', e - 1) + 1;
  const lastIndent = /^(\t| {1,2})/.exec(value.slice(lastLineStart))?.[0].length ?? 0;
  // Include the last line's indentation even when the cursor sits inside it.
  const end = Math.max(e, lastLineStart + lastIndent);
  const block = value.slice(lineStart, end);
  const unindented = block.replace(/(^|\n)(\t| {1,2})/g, '$1');
  if (unindented === block) return;
  const firstRemoved = /^(\t| {1,2})/.exec(block)?.[0].length ?? 0;
  field.setSelectionRange(lineStart, end);
  insertText(field, unindented);
  const start = Math.max(lineStart, s - firstRemoved);
  field.setSelectionRange(start, Math.max(start, e - (block.length - unindented.length)));
}

// ---------------------------------------------------------------------------
// Ref directives
// ---------------------------------------------------------------------------

/** tab-to-indent: Tab / Shift+Tab indent and unindent; Escape leaves the field (so Tab isn't a trap). */
export function tabToIndent(el: HTMLTextAreaElement) {
  el.addEventListener('keydown', (e) => {
    if (!feature('tab-to-indent') || e.defaultPrevented || e.metaKey || e.altKey || e.ctrlKey || e.isComposing) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) unindentSelection(el);
      else indentSelection(el);
    } else if (e.key === 'Escape' && !e.shiftKey && feature('tab-to-indent')) {
      el.blur();
    }
  });
}

const FORMATTING = ['`', "'", '"', '[', '(', '{', '*', '_', '~', '“', '‘'];
const MATCHING = ['`', "'", '"', ']', ')', '}', '*', '_', '~', '”', '’'];
const QUOTES = new Set(['`', "'", '"']);

/** one-key-formatting: typing a Markdown symbol with text selected wraps the selection instead of replacing it. */
export function oneKeyFormatting(el: TextField) {
  (el as HTMLElement).addEventListener('keydown', (e) => {
    if (!feature('one-key-formatting') || e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey) return;
    const i = FORMATTING.indexOf(e.key);
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (i < 0 || start === end) return;
    // Allow replacing a single selected quote with another one.
    if (QUOTES.has(e.key) && end - start === 1 && QUOTES.has(el.value[start]!)) return;
    e.preventDefault();
    wrapSelection(el, FORMATTING[i]!, MATCHING[i]!);
  });
}

/** fit-textareas: grow with the content instead of scrolling. */
export function fitTextarea(el: HTMLTextAreaElement) {
  el.classList.add('rgh-fit-textarea');
}

/** monospace-textareas: monospace font for commit messages, titles and other code-like fields. */
export function monospaceField(el: TextField) {
  el.classList.add('rgh-monospace-field');
}

/**
 * avoid-accidental-submissions: Enter in a title input no longer submits its
 * form right away — the first Enter shows a hint, a second Enter (or
 * Ctrl/Cmd+Enter) submits.
 */
export function avoidAccidentalSubmissions(el: HTMLInputElement) {
  let warned = false;
  el.addEventListener('input', () => (warned = false));
  el.addEventListener(
    'keydown',
    (e) => {
      if (!feature('avoid-accidental-submissions') || e.key !== 'Enter' || e.isComposing || !el.form) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        el.form.requestSubmit();
        return;
      }
      const submit = el.form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');
      if (warned || submit?.disabled) return;
      e.preventDefault();
      warned = true;
      toast(`A submission via Enter has been prevented. Press Enter again or use ${isMac ? '⌘' : 'Ctrl'} Enter.`);
    },
    { capture: true },
  );
}

/** The usual comment-field bundle for plain textareas outside MarkdownEditor. */
export const commentField = [tabToIndent, oneKeyFormatting, fitTextarea] as const;
/** Commit / PR title inputs. */
export const titleField = [oneKeyFormatting, monospaceField] as const;

/**
 * no-self-reference: in rendered markdown under `el`, links to the page
 * you're on (e.g. "#123" inside #123) get a wavy red underline and lose
 * their href. Watches for re-renders.
 */
export function noSelfReference(el: HTMLElement) {
  const mark = () => {
    if (!feature('no-self-reference')) return;
    for (const a of el.querySelectorAll<HTMLAnchorElement>('.markdown-body a.issue-link[href]:not([href*="#"])')) {
      const url = new URL(a.href, location.href);
      const here = location.pathname.replace(/\/$/, '');
      // Same page (also matches /pull/1 when on /pull/1/files etc. — GitHub doesn't, so compare exactly).
      if (url.origin !== location.origin || url.pathname.replace(/\/$/, '') !== here) continue;
      a.title = 'Link is a self-reference';
      a.removeAttribute('href');
      a.classList.add('rgh-self-reference');
    }
  };
  const observer = new MutationObserver(mark);
  observer.observe(el, { childList: true, subtree: true });
  queueMicrotask(mark);
}

/** prevent-comment-loss: links clicked in a comment preview open in a new tab. Use as a click handler on the preview. */
export function openPreviewLinksInNewTab(e: MouseEvent) {
  if (!feature('prevent-comment-loss') || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
  if (!a || a.getAttribute('href')!.startsWith('#')) return;
  e.preventDefault();
  window.open(a.href, '_blank', 'noopener');
}

// ---------------------------------------------------------------------------
// prevent-link-loss
// ---------------------------------------------------------------------------

const escapeRegex = (s: string) => s.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');
const origins = () => [...new Set(['https://github.com', typeof location !== 'undefined' ? location.origin : ''])].filter(Boolean).map(escapeRegex).join('|');
const PR_COMMIT = /[/]([^/]+[/][^/]+)[/]pull[/](\d+)[/](?:commits|changes|files)[/]([\da-f]{7})[\da-f]{33}(?:[.]{2}([\da-f]{7})[\da-f]{33})?(?:#[\w-]+)?\b/;
const COMPARE = /[/]([^/]+[/][^/]+)[/]compare[/](.+)(#diff-[\d\-LRa-f]+)/;
const DISCUSSION = /[/]([^/]+[/][^/]+)[/]discussions[/](\d+)[?][^\s#]+(#[\w-]+)?\b/;
const withOrigin = (re: RegExp) => new RegExp(String.raw`\b(?:${origins()})` + re.source, 'gi');

/**
 * GitHub shortens some pasted URLs into misleading text (commit links inside
 * PRs, compare links with a diff anchor, discussion links with a query).
 * Rewrites them as explicit Markdown links. `repo` is the current "owner/name".
 */
export function fixLinkLoss(value: string, repo?: string) {
  const prefix = (nameWithOwner: string, delimiter = '') => (repo && nameWithOwner.toLowerCase() === repo.toLowerCase() ? '' : nameWithOwner + delimiter);
  const currentPr = Number(/\/pull\/(\d+)/.exec(typeof location !== 'undefined' ? location.pathname : '')?.[1]) || null;
  const linked = (url: string, index: number, full: string) => full[index + url.length] === ')';
  return value
    .replace(withOrigin(PR_COMMIT), (url, nameWithOwner: string, pr: string, c1: string, c2: string | undefined, index: number, full: string) => {
      if (linked(url, index, full)) return url;
      const prRef = currentPr === Number(pr) ? '(this PR)' : `(#${pr})`;
      return `[${prefix(nameWithOwner, '@')}\`${c2 ? `${c1}..${c2}` : c1}\` ${prRef}](${url})`;
    })
    .replace(withOrigin(COMPARE), (url, nameWithOwner: string, compare: string, hash: string, index: number, full: string) =>
      linked(url, index, full) ? url : `[${prefix(nameWithOwner, '@')}\`${compare}\`${hash.slice(0, 16)}](${url})`,
    )
    .replace(withOrigin(DISCUSSION), (url, nameWithOwner: string, n: string, comment: string | undefined, index: number, full: string) =>
      linked(url, index, full) ? url : `[${prefix(nameWithOwner)}#${n}${comment ? ' (comment)' : ''}](${url})`,
    );
}

export const isVulnerableToLinkLoss = (value: string, repo?: string) => !!value && fixLinkLoss(value, repo) !== value;

// ---------------------------------------------------------------------------
// unfinished-comments
// ---------------------------------------------------------------------------

const UNFINISHED_PREFIX = '✏️ Comment - ';
const drafts = new Set<() => boolean>();

/** Register a comment field's "has unsent text" check while it's mounted; returns the unregister function. */
export function trackUnfinishedComment(isDirty: () => boolean) {
  drafts.add(isDirty);
  return () => drafts.delete(isDirty);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const clean = document.title.replaceAll(UNFINISHED_PREFIX, '');
    const flag = document.visibilityState === 'hidden' && feature('unfinished-comments') && [...drafts].some((d) => d());
    document.title = flag ? UNFINISHED_PREFIX + clean : clean;
  });

  // CSS-only parts (fit-textareas, monospace-textareas) are gated by attributes on <html>.
  createRoot(() =>
    createEffect(
      () => ({ fit: feature('fit-textareas'), mono: feature('monospace-textareas') }),
      ({ fit, mono }) => {
        document.documentElement.toggleAttribute('data-rgh-fit-textareas', fit);
        document.documentElement.toggleAttribute('data-rgh-monospace-textareas', mono);
      },
    ),
  );
}
