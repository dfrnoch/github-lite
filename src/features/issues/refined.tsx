/**
 * Helpers for the Refined GitHub conversation features (see
 * src/features/refined/registry/conversations.ts): batched name / reactor
 * lookups, the activity filter state, low-quality comment detection and
 * inline text rendering (`code` spans, issue references).
 */
import type { JSX } from '@solidjs/web';
import { createSignal, For, Show } from 'solid-js';
import { gh, gql } from '../../lib/github';
import { feature } from '../refined';

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------

export const isBotLogin = (login: string | null | undefined) => !!login && login.endsWith('[bot]');
export const isBot = (actor: { __typename?: string; login: string } | null | undefined) =>
  !!actor && (actor.__typename === 'Bot' || isBotLogin(actor.login));

// ---------------------------------------------------------------------------
// Batched lookups: many components ask for one key each; one GraphQL request
// (aliases) answers all keys asked for in the same tick.
// ---------------------------------------------------------------------------

function createBatcher<V>(fetchMany: (keys: string[]) => Promise<Map<string, V>>, max = 50) {
  const [values, setValues] = createSignal<Record<string, V | null>>({}, { ownedWrite: true });
  const requested = new Set<string>();
  let queue: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flushQueue = () => {
    timer = undefined;
    const keys = queue;
    queue = [];
    for (let i = 0; i < keys.length; i += max) {
      const chunk = keys.slice(i, i + max);
      fetchMany(chunk)
        .then((found) =>
          setValues((v) => {
            const next = { ...v };
            for (const k of chunk) next[k] = found.get(k) ?? null;
            return next;
          }),
        )
        .catch(() => {
          // Allow a retry on the next request for these keys.
          for (const k of chunk) requested.delete(k);
        });
    }
  };
  /** Reactive: `undefined` while loading, `null` when missing. */
  return (key: string): V | null | undefined => {
    if (!requested.has(key)) {
      requested.add(key);
      queue.push(key);
      timer ??= setTimeout(flushQueue, 30);
    }
    return values()[key];
  };
}

/** show-names: a user's display name ("" when they have none). */
export const nameOf = createBatcher<string>(async (logins) => {
  const valid = logins.filter((l) => /^[\w-]+$/.test(l));
  if (!valid.length) return new Map();
  const data = await gql<Record<string, { name?: string | null } | null>>(
    `{${valid.map((l, i) => `u${i}:repositoryOwner(login:${JSON.stringify(l)}){... on User{name} ... on Organization{name}}`).join(' ')}}`,
  );
  return new Map(valid.map((l, i) => [l, data[`u${i}`]?.name ?? '']));
});

/** Whether a display name adds anything next to the login. */
export const nameDiffers = (login: string, name: string | null | undefined) =>
  !!name && name.replace(/\s/g, '').toLowerCase() !== login.toLowerCase();

export interface Reactor {
  login: string;
  avatarUrl: string;
}
const REACTOR = `... on User{login avatarUrl} ... on Bot{login avatarUrl} ... on Organization{login avatarUrl} ... on Mannequin{login avatarUrl}`;

/**
 * reactions-avatars: who reacted, per reaction, for one reactable node. The
 * key is `nodeId|signature` so changed counts fetch again.
 */
export const reactorsOf = createBatcher<Record<string, Reactor[]>>(async (keys) => {
  const data = await gql<Record<string, { reactionGroups?: { content: string; reactors: { nodes: Reactor[] } }[] } | null>>(
    `{${keys
      .map((k, i) => `r${i}:node(id:${JSON.stringify(k.split('|')[0])}){... on Reactable{reactionGroups{content reactors(first:10){nodes{${REACTOR}}}}}}`)
      .join(' ')}}`,
  );
  return new Map(
    keys.map((k, i) => [
      k,
      Object.fromEntries((data[`r${i}`]?.reactionGroups ?? []).map((g) => [g.content, g.reactors.nodes.filter((n) => n?.login)])),
    ]),
  );
});

// ---------------------------------------------------------------------------
// conversation-activity-filter
// ---------------------------------------------------------------------------

export const ACTIVITY_STATES = {
  showAll: 'Show all activities',
  hideEvents: 'Hide events',
  hideAllNoise: 'Hide events, bots, collapsed comments',
} as const;
export type ActivityFilter = keyof typeof ACTIVITY_STATES;

const sessionKey = (path: string) => `rgh-conversation-activity-filter-state:${path}`;
const [activityStates, setActivityStates] = createSignal<Record<string, ActivityFilter>>({});

/** The filter chosen for a conversation (kept per page for the session, like the extension). */
export function activityFilter(path: string): ActivityFilter {
  if (!feature('conversation-activity-filter')) return 'showAll';
  const chosen = activityStates()[path];
  if (chosen) return chosen;
  const stored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(sessionKey(path)) : null;
  return stored && stored in ACTIVITY_STATES ? (stored as ActivityFilter) : 'showAll';
}

export function setActivityFilter(path: string, state: ActivityFilter) {
  sessionStorage.setItem(sessionKey(path), state);
  setActivityStates((s) => ({ ...s, [path]: state }));
}

export function cycleActivityFilter(path: string) {
  const names = Object.keys(ACTIVITY_STATES) as ActivityFilter[];
  setActivityFilter(path, names[(names.indexOf(activityFilter(path)) + 1) % names.length]!);
}

/** "/owner/repo/issues/1" or "/owner/repo/pull/1" (conversation tab only). */
export const CONVERSATION_PATH = /^\/[^/]+\/[^/]+\/(?:issues|pull)\/\d+\/?$/;

// ---------------------------------------------------------------------------
// hide-low-quality-comments
// ---------------------------------------------------------------------------

const LOW_QUALITY_WORDS = [
  'a', 'an', 'and', 'any', 'bump', 'dito', 'ditto', 'following', 'for', 'here', 'is', 'issue', 'issues', 'me', 'on', 'please',
  'pls', 'plz', 'question', 'same', 'solution', 'still', 'there', 'this', 'too', 'update', 'updates',
];
const LOW_QUALITY_RE = new RegExp(String.raw`\b(?:${LOW_QUALITY_WORDS.join('|')})\b`, 'gi');

/** "+1", "👍", "same here", "any update?"… */
export function isLowQualityText(text: string) {
  return text.replaceAll(LOW_QUALITY_RE, '').replaceAll(/[\s!,.?👌👍👎🙏]+|[\u{1F3FB}-\u{1F3FF}]|[+-]\d+|⬆️/gu, '') === '';
}

/** A comment whose only content is a low-quality paragraph (no links, images or quotes). */
export function isLowQualityComment(body: string, bodyHTML: string) {
  const html = bodyHTML.trim();
  if (!/^<p[^>]*>[\s\S]*<\/p>$/.test(html) || /<\/p>\s*<p/.test(html) || /<(a|img|blockquote|pre)\b/.test(html)) return false;
  return isLowQualityText(body.trim());
}

// ---------------------------------------------------------------------------
// parse-backticks + linkify-text
// ---------------------------------------------------------------------------

const REF = /(^|[\s(])((?:([\w.-]+\/[\w.-]+))?#(\d+))\b|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

/**
 * Plain text with `code` spans (parse-backticks) and, when `links` is set,
 * clickable #123 / owner/repo#123 references and URLs (linkify-text).
 * Pass `links={false}` inside other links.
 */
export function RichText(props: { text: string | null | undefined; repo?: string; links?: boolean }) {
  const parts = () => {
    const text = props.text ?? '';
    const backticks = feature('parse-backticks');
    const linkify = props.links !== false && !!props.repo && feature('linkify-text');
    const out: { kind: 'text' | 'code' | 'link'; text: string; href?: string }[] = [];
    const segments = backticks ? text.split(/(`[^`]+`)/) : [text];
    for (const seg of segments) {
      if (backticks && /^`[^`]+`$/.test(seg)) {
        out.push({ kind: 'code', text: seg.slice(1, -1) });
        continue;
      }
      if (!linkify) {
        out.push({ kind: 'text', text: seg });
        continue;
      }
      let last = 0;
      for (const m of seg.matchAll(REF)) {
        const start = m.index! + (m[1]?.length ?? 0);
        if (start > last) out.push({ kind: 'text', text: seg.slice(last, start) });
        if (m[5]) out.push({ kind: 'link', text: m[5], href: m[5] });
        else out.push({ kind: 'link', text: m[2]!, href: `/${m[3] ?? props.repo}/issues/${m[4]}` });
        last = m.index! + m[0].length;
      }
      if (last < seg.length) out.push({ kind: 'text', text: seg.slice(last) });
    }
    return out;
  };
  return (
    <For each={parts()}>
      {(p): JSX.Element =>
        p.kind === 'code' ? (
          <code class="rgh-backticks">{p.text}</code>
        ) : p.kind === 'link' ? (
          <a href={p.href} class="rgh-linkified" target={p.href!.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
            {p.text}
          </a>
        ) : (
          p.text
        )
      }
    </For>
  );
}

/** show-names: " Real Name" after a login (renders nothing when off / unknown / same as login). */
export function UserName(props: { login: string | null | undefined; class?: string }) {
  const name = () => (props.login && feature('show-names') && !isBotLogin(props.login) ? nameOf(props.login) : null);
  return (
    <Show when={props.login && nameDiffers(props.login, name()) ? name() : null}>
      {(n) => <span class={['rgh-show-names text-fg-muted font-normal', props.class]}> {n()}</span>}
    </Show>
  );
}

// ---------------------------------------------------------------------------
// comments-time-machine-links
// ---------------------------------------------------------------------------

/** The last commit on `ref` (default branch when omitted) at `date`. */
export async function commitAt(owner: string, repo: string, date: string, ref?: string) {
  const commits = await gh<{ sha: string }[]>(`/repos/${owner}/${repo}/commits`, { query: { until: date, per_page: 1, sha: ref } });
  return commits[0]?.sha ?? null;
}
