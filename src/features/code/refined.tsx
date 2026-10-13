import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import Octicon from '../../components/Octicon';
import { toast, toastError } from '../../components/ui';
import { chevronLeftIcon } from '../../icons/octicons';
import { encodePath } from '../../lib/github';
import { useHotkey } from '../../lib/hotkeys';
import { feature, featureOption } from '../refined';
import { resolveSha } from './api';

/**
 * Shared helpers for the Refined GitHub features of the code area (file
 * browsing, code views, commits and diffs). Each is gated by `feature(id)`.
 */

// ---------------------------------------------------------------------------
// Code HTML transforms: linkify-code, show-whitespace

const TAG = /(<[^>]+>)/;
const URL_RE = /\bhttps?:\/\/(?:(?!&[lg]t;|&quot;)[^\s<>"'`])+/g;
const TRAILING = /[.,;:!?)\]}'"*]+$/;
/** `#123` / `owner/repo#123` — only inside comments (`pl-c` tokens), like the extension. */
const REF_RE = /(^|[\s([{,])((?:([\w.-]+)\/([\w.-]+))?#(\d+))\b/g;

function linkifyText(text: string, base: string, inComment: boolean) {
  let out = text.replace(URL_RE, (match) => {
    const trail = TRAILING.exec(match)?.[0] ?? '';
    const url = trail ? match.slice(0, -trail.length) : match;
    return `<a href="${url.replace(/"/g, '%22')}" target="_blank" rel="noreferrer" class="rgh-linkified-code">${url}</a>${trail}`;
  });
  if (inComment && out.includes('#')) {
    // Skip the parts that just became links.
    out = out
      .split(/(<a [^>]*>.*?<\/a>)/)
      .map((part, i) =>
        i % 2
          ? part
          : part.replace(REF_RE, (_m, pre: string, ref: string, owner?: string, repo?: string, n?: string) => {
              const href = owner && repo ? `/${owner}/${repo}/issues/${n}` : `${base}/issues/${n}`;
              return `${pre}<a href="${href}" class="rgh-linkified-code">${ref}</a>`;
            }),
      )
      .join('');
  }
  return out;
}

const wsSpan = (run: string) => `<span data-rgh-whitespace="${run[0] === '\t' ? 'tab' : 'space'}">${run}</span>`;

/**
 * Post-process one line of highlighted (or escaped) code HTML: link URLs and
 * issue references (`linkify-code`) and mark whitespace (`show-whitespace`).
 * Only text between tags is touched.
 */
export function transformCodeLine(html: string, opts: { linkifyBase?: string; whitespace?: boolean }) {
  if (!html) return html;
  let out = html;
  if (opts.linkifyBase && (out.includes('://') || out.includes('#'))) {
    let inComment = false;
    out = out
      .split(TAG)
      .map((part, i) => {
        if (i % 2) {
          if (part.startsWith('</')) inComment = false;
          else if (/class="[^"]*\bpl-c\b/.test(part)) inComment = true;
          return part;
        }
        return linkifyText(part, opts.linkifyBase!, inComment);
      })
      .join('');
  }
  if (opts.whitespace && /[ \t]/.test(out)) {
    out = out
      .split(TAG)
      .map((part, i) => (i % 2 ? part : part.replace(/( +|\t+)/g, wsSpan)))
      .join('');
  }
  return out;
}

/** The code-transform options currently enabled (reactive). */
export function codeTransformOptions(base: string) {
  return {
    linkifyBase: feature('linkify-code') ? base : undefined,
    whitespace: feature('show-whitespace'),
  };
}

/** `tab-size`: inline style for code containers (GitHub's default is 8). */
export function tabSizeStyle(): JSX.CSSProperties | undefined {
  if (!feature('tab-size')) return undefined;
  const n = Number(featureOption<number>('tab-size', 'size')) || 4;
  return { '--tab-size': String(Math.min(16, Math.max(1, n))) };
}

// ---------------------------------------------------------------------------
// conventional-commits

const CONVENTIONAL = /^(?<type>\w+)(?:\((?<scope>.+?)\))?(?<major>!)?: */;
const TYPES = new Map([
  ['feat', 'Feature'],
  ['fix', 'Fix'],
  ['chore', 'Chore'],
  ['revert', 'Revert'],
  ['style', 'Style'],
  ['docs', 'Docs'],
  ['build', 'Build'],
  ['refactor', 'Refactor'],
  ['test', 'Test'],
  ['ci', 'CI'],
  ['perf', 'Performance'],
]);

export function parseConventionalCommit(title: string) {
  const m = CONVENTIONAL.exec(title);
  if (!m?.groups?.type) return undefined;
  const type = TYPES.get(m.groups.type.toLowerCase());
  if (!type) return undefined;
  // A title that is only "ci:" would leave nothing to show.
  if (m[0].length === title.length) return undefined;
  return {
    rawType: m.groups.type.toLowerCase(),
    type: m.groups.major ? `${type}!` : type,
    scope: m.groups.scope ? `${m.groups.scope}: ` : undefined,
    rest: title.slice(m[0].length),
  };
}

// ---------------------------------------------------------------------------
// suggest-commit-title-limit

export const COMMIT_TITLE_LIMIT = 72;

/** True when the title is over 72 characters and the feature is on (reactive). */
export const titleTooLong = (title: string) => feature('suggest-commit-title-limit') && title.length > COMMIT_TITLE_LIMIT;

/** "73 / 72" counter + hint shown under commit / PR title fields while they are too long. */
export function TitleLengthHint(props: { value: string }) {
  return (
    <Show when={titleTooLong(props.value)}>
      <p class="text-xs text-fg-danger mt-1 mb-2" role="status">
        {props.value.length} / {COMMIT_TITLE_LIMIT} characters — titles longer than {COMMIT_TITLE_LIMIT} characters are truncated in
        most git tools.
      </p>
    </Show>
  );
}

// ---------------------------------------------------------------------------
// default-branch-button

/** "‹" button left of the branch picker that opens the same path on the default branch. */
export function DefaultBranchButton(props: { gitRef: string; defaultBranch: string; href: string }) {
  return (
    <Show when={feature('default-branch-button') && props.gitRef !== props.defaultBranch}>
      <a
        class="btn btn-sm px-2! rgh-default-branch-button"
        href={props.href}
        aria-label="View on the default branch"
        title={`View on the default branch (${props.defaultBranch})`}
      >
        <Octicon icon={chevronLeftIcon} />
      </a>
    </Show>
  );
}

// ---------------------------------------------------------------------------
// `y` permalinks (copy-on-y)

const SHA = /^[0-9a-f]{40}$/i;

/**
 * GitHub's `y`: expand the URL of a tree/blob/blame page to its permalink (the
 * ref replaced by its commit SHA). With `copy-on-y` the permalink is also
 * copied to the clipboard.
 */
export function usePermalinkHotkey(get: () => { owner: string; repo: string; gitRef: string; route: string; path: string }) {
  useHotkey({
    keys: 'y',
    description: 'Expand URL to its canonical form (permalink)',
    group: 'Source code browsing',
    handler: () => {
      const { owner, repo, gitRef, route, path } = get();
      void (async () => {
        try {
          const sha = SHA.test(gitRef) ? gitRef.toLowerCase() : await resolveSha(owner, repo, gitRef);
          const href = `/${owner}/${repo}/${route}/${sha}${path ? `/${encodePath(path)}` : ''}${window.location.search}${window.location.hash}`;
          // Like github.com, only the address changes: the page already shows this commit's content.
          history.replaceState(history.state, '', href);
          if (feature('copy-on-y')) {
            await navigator.clipboard.writeText(new URL(href, window.location.origin).href);
            toast('Permalink copied to clipboard', 'success');
          }
        } catch (e) {
          toastError(e);
        }
      })();
    },
  });
}

// ---------------------------------------------------------------------------
// file-age-color

const MONTH = 30 * 24 * 3600 * 1000;

/** Heat index 1 (hot) … 10 for files changed in the last ~3 weeks; dimming for older ones. */
export function fileAge(date: string): { heat?: number; opacity?: string } {
  const diff = Date.now() - new Date(date).getTime();
  if (diff > 4 * MONTH) return { opacity: diff > 12 * MONTH ? '0.6' : '0.8' };
  // The extension's range: 0 … 2,000,000,000 ms (~23 days) maps to heat 1 … 10.
  const interp = Math.max(0, Math.min(1, diff / 2_000_000_000));
  return { heat: Math.min(10, Math.max(1, Math.floor(interp * 10) + 1)) };
}
