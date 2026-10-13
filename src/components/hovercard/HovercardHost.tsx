import { useLocation } from '@solidjs/router';
import { createSignal, Match, onSettled, Switch } from 'solid-js';
import { RESERVED } from '../layout/headerContext';
import Popover from '../ui/Popover';
import {
  getHovercard,
  getIssueHovercard,
  type HovercardData,
  type HovercardSubject,
  type IssueHovercardData,
} from './api';
import IssueHovercard from './IssueHovercard';
import UserHovercard from './UserHovercard';

const SHOW_DELAY = 500;
const HIDE_DELAY = 200;

/** Top-level paths that aren't logins, beyond the app's own reserved pages. */
const NOT_LOGINS = new Set([
  'account',
  'apps',
  'collections',
  'contact',
  'copilot',
  'customer-stories',
  'enterprise',
  'events',
  'join',
  'pricing',
  'readme',
  'security',
  'site',
  'team',
  'users',
]);

/** Where hovercards would be noise: the global header, drawers, dialogs, other popovers. */
const EXCLUDED = '[data-no-hovercard], .AppHeader, .Drawer, dialog, .btn, .UnderlineNav, .SelectMenu';

const LOGIN = /^\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/?$/;
/** /owner/repo/issues/123 or /owner/repo/pull/123 (optionally /files, /commits…). */
const ISSUE = /^\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)(?:\/[^/]*)?\/?$/;

type Target = { kind: 'user'; login: string } | { kind: 'issue'; owner: string; repo: string; number: number };
const keyOf = (t: Target) => (t.kind === 'user' ? `@${t.login}` : `${t.owner}/${t.repo}#${t.number}`).toLowerCase();

/** The hovercard target an event started in, if any. */
function targetOf(node: EventTarget | null): HTMLElement | null {
  const el = (node as Element | null)?.closest?.(
    '[data-hovercard-user], [data-hovercard-issue], a[href]',
  ) as HTMLElement | null;
  if (!el || el.closest(EXCLUDED)) return null;
  const info = infoOf(el);
  if (!info) return null;
  if (info.kind === 'issue') {
    // Issue / PR lists already show what the card would; and a link to the
    // page you're on (its files, conflicts, commits) isn't worth a card.
    if (el.closest('[data-no-issue-hovercard]')) return null;
    const here = location.pathname.match(ISSUE);
    if (here && here[1]!.toLowerCase() === info.owner.toLowerCase() && here[2]!.toLowerCase() === info.repo.toLowerCase() && Number(here[3]) === info.number) return null;
  }
  return el;
}

/** An in-app or github.com URL for a link, or null. */
function urlOf(el: HTMLElement): URL | null {
  const href = el.getAttribute('href');
  if (!href || href.startsWith('#')) return null;
  try {
    const url = new URL(href, location.href);
    return url.origin === location.origin || url.hostname === 'github.com' ? url : null;
  } catch {
    return null;
  }
}

/**
 * What a target shows: a user (its `data-hovercard-user`, or a single-segment
 * profile link `/login`) or an issue / pull request (`data-hovercard-issue=
 * "owner/repo#123"`, or a link to one — #123 references in comments, commit
 * messages and timelines).
 */
function infoOf(el: HTMLElement): Target | null {
  const user = el.getAttribute('data-hovercard-user');
  if (user != null) return user ? { kind: 'user', login: user } : null;
  const issue = el.getAttribute('data-hovercard-issue')?.match(/^([^/]+)\/([^#]+)#(\d+)$/);
  if (issue) return { kind: 'issue', owner: issue[1]!, repo: issue[2]!, number: Number(issue[3]) };
  const url = urlOf(el);
  if (!url) return null;
  const ref = url.pathname.match(ISSUE);
  if (ref && !RESERVED.has(ref[1]!.toLowerCase()) && !NOT_LOGINS.has(ref[1]!.toLowerCase())) {
    return { kind: 'issue', owner: decodeURIComponent(ref[1]!), repo: decodeURIComponent(ref[2]!), number: Number(ref[3]) };
  }
  if (url.search || url.hash) return null;
  const m = url.pathname.match(LOGIN);
  if (!m) return null;
  const login = m[1]!;
  if (RESERVED.has(login.toLowerCase()) || NOT_LOGINS.has(login.toLowerCase())) return null;
  return { kind: 'user', login };
}

/** The repo / issue / PR the current page is about (tailors the hovercard's context lines). */
function subjectOf(pathname: string): HovercardSubject | undefined {
  const [owner, repo, kind, num] = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (!owner || !repo || RESERVED.has(owner.toLowerCase()) || NOT_LOGINS.has(owner.toLowerCase())) return undefined;
  if ((kind === 'pull' || kind === 'issues') && num && /^\d+$/.test(num)) {
    return { owner, repo, kind: kind === 'pull' ? 'pull_request' : 'issue', number: Number(num) };
  }
  return { owner, repo, kind: 'repository' };
}

type Card =
  | { kind: 'user'; anchor: HTMLElement; data: HovercardData }
  | { kind: 'issue'; anchor: HTMLElement; data: IssueHovercardData };

/**
 * github.com's hovercards, app-wide: users / organizations and issues / pull
 * requests. Mounted once; finds targets by event delegation on the document —
 * profile links, issue/PR links (e.g. #123 references), and elements with
 * `data-hovercard-user` / `data-hovercard-issue` (e.g. non-link avatars).
 * Shows after a short hover (data is prefetched as soon as the hover starts),
 * stays while the pointer moves into the card, hides shortly after leaving
 * both, and on Escape / click / navigation.
 */
export default function HovercardHost() {
  const loc = useLocation();
  const [card, setCard] = createSignal<Card | null>(null);
  let pending: HTMLElement | null = null;
  /** Last pointer position over a target — to re-find it if the page re-rendered it meanwhile. */
  let lastX = 0;
  let lastY = 0;
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const cancelHide = () => clearTimeout(hideTimer);
  const hideNow = () => {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    pending = null;
    if (card()) setCard(null);
  };
  const scheduleHide = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => setCard(null), HIDE_DELAY);
  };

  onSettled(() => {
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const el = targetOf(e.target);
      if (!el) return;
      if (card()?.anchor === el) {
        cancelHide();
        return;
      }
      lastX = e.clientX;
      lastY = e.clientY;
      if (pending === el) return;
      clearTimeout(showTimer);
      pending = el;
      const target = infoOf(el)!;
      // Start fetching right away so the card can show with data when the delay ends.
      const data: Promise<Card['data'] | null> = (
        target.kind === 'user'
          ? getHovercard(target.login, subjectOf(loc.pathname))
          : getIssueHovercard(target.owner, target.repo, target.number)
      ).catch(() => null);
      showTimer = setTimeout(() => {
        void data.then((d) => {
          if (pending !== el) return;
          pending = null;
          // A revalidation may have swapped the element out from under the pointer.
          const anchor = el.isConnected ? el : targetOf(document.elementFromPoint(lastX, lastY));
          const now = anchor && infoOf(anchor);
          if (!d || !anchor || !now || keyOf(now) !== keyOf(target)) return;
          cancelHide();
          setCard({ kind: target.kind, anchor, data: d } as Card);
        });
      }, SHOW_DELAY);
    };
    const onOut = (e: PointerEvent) => {
      const el = targetOf(e.target);
      if (!el) return;
      const to = e.relatedTarget as Node | null;
      if (to && el.contains(to)) return;
      if (pending === el) {
        clearTimeout(showTimer);
        pending = null;
      }
      if (card()?.anchor === el) scheduleHide();
    };
    const onClick = (e: MouseEvent) => {
      // Following a link (a target, or one inside the card) dismisses the card.
      if (targetOf(e.target) || (e.target as Element | null)?.closest?.('a[href]')) hideNow();
    };
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('click', onClick);
    window.addEventListener('popstate', hideNow);
    return () => {
      hideNow();
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('click', onClick);
      window.removeEventListener('popstate', hideNow);
    };
  });

  return (
    <Popover
      anchor={card()?.anchor}
      open={!!card()}
      onClose={hideNow}
      onPointerEnter={cancelHide}
      onPointerLeave={scheduleHide}
      class="w-[340px] max-w-[calc(100vw-16px)]"
      aria-label={card()?.kind === 'issue' ? 'Issue card' : 'User card'}
    >
      <Switch>
        <Match when={card()?.kind === 'issue' && (card() as Extract<Card, { kind: 'issue' }>)}>
          {(c) => <IssueHovercard data={c().data} />}
        </Match>
        <Match when={card()?.kind === 'user' && (card() as Extract<Card, { kind: 'user' }>)}>
          {(c) => <UserHovercard data={c().data} />}
        </Match>
      </Switch>
    </Popover>
  );
}
