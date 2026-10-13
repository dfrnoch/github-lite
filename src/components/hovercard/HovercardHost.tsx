import { useLocation } from '@solidjs/router';
import { createSignal, onSettled, Show } from 'solid-js';
import { RESERVED } from '../layout/headerContext';
import Popover from '../ui/Popover';
import { getHovercard, type HovercardData, type HovercardSubject } from './api';
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

/** The hovercard target an event started in, if any. */
function targetOf(node: EventTarget | null): HTMLElement | null {
  const el = (node as Element | null)?.closest?.('[data-hovercard-user], a[href]') as HTMLElement | null;
  if (!el || el.closest(EXCLUDED)) return null;
  return loginOf(el) ? el : null;
}

/** Login of a target: its `data-hovercard-user`, or a single-segment profile link (`/login`). */
function loginOf(el: HTMLElement): string | null {
  const explicit = el.getAttribute('data-hovercard-user');
  if (explicit != null) return explicit || null;
  const href = el.getAttribute('href');
  if (!href || href.startsWith('#')) return null;
  let url: URL;
  try {
    url = new URL(href, location.href);
  } catch {
    return null;
  }
  if (url.origin !== location.origin && url.hostname !== 'github.com') return null;
  if (url.search || url.hash) return null;
  const m = url.pathname.match(LOGIN);
  if (!m) return null;
  const login = m[1]!;
  if (RESERVED.has(login.toLowerCase()) || NOT_LOGINS.has(login.toLowerCase())) return null;
  return login;
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

/**
 * github.com's user / organization hovercards, app-wide. Mounted once; finds
 * targets by event delegation on the document — profile links (`/login`) and
 * any element with `data-hovercard-user="login"` (e.g. non-link avatars).
 * Shows after a short hover (data is prefetched as soon as the hover starts),
 * stays while the pointer moves into the card, hides shortly after leaving
 * both, and on Escape / click / navigation.
 */
export default function HovercardHost() {
  const loc = useLocation();
  const [card, setCard] = createSignal<{ anchor: HTMLElement; data: HovercardData } | null>(null);
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
      const login = loginOf(el)!;
      // Start fetching right away so the card can show with data when the delay ends.
      const data = getHovercard(login, subjectOf(loc.pathname)).catch(() => null);
      showTimer = setTimeout(() => {
        void data.then((d) => {
          if (pending !== el) return;
          pending = null;
          // A revalidation may have swapped the element out from under the pointer.
          const anchor = el.isConnected ? el : targetOf(document.elementFromPoint(lastX, lastY));
          if (!d || !anchor || loginOf(anchor) !== login) return;
          cancelHide();
          setCard({ anchor, data: d });
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
      aria-label="User card"
    >
      <Show when={card()}>{(c) => <UserHovercard data={c().data} />}</Show>
    </Popover>
  );
}
