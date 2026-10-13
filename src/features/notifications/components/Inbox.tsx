import { useAction, useNavigate } from '@solidjs/router';
import { createEffect, createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Blankslate, Pagination, RelativeTime, StateIcon, itemState, toast, toastError } from '../../../components/ui';
import { bellSlashIcon, checkIcon, inboxIcon, linkExternalIcon, readIcon } from '../../../icons/octicons';
import type { Page } from '../../../lib/github';
import { useHotkey } from '../../../lib/hotkeys';
import { feature } from '../../refined';
import {
  getSubjectStates,
  markAllRead,
  markThreadDone,
  markThreadRead,
  markThreads,
  unsubscribeThread,
  type NotificationThread,
  type SubjectState,
} from '../api';
import { openInNewTabs } from '../openTabs';
import { inboxHref, matchesReason, reasonLabel, subjectHref, subjectIcon, subjectNumber, type InboxQuery } from '../utils';
import SelectBy, { selectMatching, type Selection } from './SelectBy';

const keyOf = (n: NotificationThread) => {
  const num = subjectNumber(n);
  return num && (n.subject.type === 'Issue' || n.subject.type === 'PullRequest') ? `${n.repository.full_name}#${num}` : null;
};

/** The notification list: bulk actions, threads grouped by repository, pagination. */
export default function Inbox(props: { page: Page<NotificationThread>; query: InboxQuery; raw: string; pending: boolean }) {
  // Optimistic local state: threads read / done / unsubscribed in this session.
  // The actions revalidate the list when they settle; these keep the UI instant.
  const [readIds, setReadIds] = createSignal<ReadonlySet<string>>(new Set());
  const [doneIds, setDoneIds] = createSignal<ReadonlySet<string>>(new Set());
  const [unsubscribed, setUnsubscribed] = createSignal<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = createSignal<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = createSignal(false);
  const navigate = useNavigate();

  const runRead = useAction(markThreadRead);
  const runDone = useAction(markThreadDone);
  const runMany = useAction(markThreads);
  const runUnsub = useAction(unsubscribeThread);
  const runAllRead = useAction(markAllRead);

  const isUnread = (n: NotificationThread) => n.unread && !readIds().has(n.id);

  const visible = createMemo(() => {
    const q = props.query;
    const text = q.text.toLowerCase();
    return props.page.items.filter((n) => {
      if (doneIds().has(n.id)) return false;
      const unread = isUnread(n);
      if (q.is === 'unread' && !unread) return false;
      if ((q.is === 'read' || q.is === 'done') && unread) return false;
      if (!matchesReason(n, q.reason)) return false;
      if (text && !n.subject.title.toLowerCase().includes(text)) return false;
      return true;
    });
  });

  const groups = createMemo(() => {
    const map = new Map<string, NotificationThread[]>();
    for (const n of visible()) {
      const list = map.get(n.repository.full_name);
      if (list) list.push(n);
      else map.set(n.repository.full_name, [n]);
    }
    return [...map.entries()].map(([repo, items]) => ({ repo, owner: items[0]!.repository.owner, items }));
  });

  const stateKeys = createMemo(() => [...new Set(visible().map(keyOf).filter((k): k is string => !!k))]);
  const states = createMemo(() => getSubjectStates(stateKeys()));
  /** Subject states for handlers: the batched lookup may still be loading (then nothing is known yet). */
  const stateOf = (n: NotificationThread) => {
    const key = keyOf(n);
    if (!key) return undefined;
    try {
      return states()[key];
    } catch {
      return undefined;
    }
  };
  /** Visible threads in display order (grouped by repository). */
  const ordered = createMemo(() => groups().flatMap((g) => g.items));

  const add = (set: (fn: (s: ReadonlySet<string>) => ReadonlySet<string>) => void, ids: string[]) =>
    set((s) => new Set([...s, ...ids]));
  const allSelected = () => visible().length > 0 && visible().every((n) => selected().has(n.id));

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const markRead = async (n: NotificationThread) => {
    add(setReadIds, [n.id]);
    try {
      await runRead(n.id);
    } catch (e) {
      toastError(e);
    }
  };
  const markDone = async (n: NotificationThread) => {
    add(setDoneIds, [n.id]);
    try {
      await runDone(n.id);
    } catch (e) {
      toastError(e);
    }
  };
  const unsubscribe = async (n: NotificationThread) => {
    add(setUnsubscribed, [n.id]);
    try {
      await runUnsub(n.id);
      toast('Unsubscribed from this thread', 'success');
    } catch (e) {
      toastError(e);
    }
  };
  const bulk = async (as: 'read' | 'done') => {
    const ids = [...selected()];
    if (!ids.length) return;
    setBusy(true);
    add(as === 'read' ? setReadIds : setDoneIds, ids);
    setSelected(new Set<string>());
    try {
      await runMany(ids, as);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  const allRead = async () => {
    setBusy(true);
    add(
      setReadIds,
      props.page.items.map((n) => n.id),
    );
    try {
      await runAllRead(props.query.repo);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Refined GitHub: open-all-notifications ---------- */
  // Opens oldest first (like Refined GitHub), then marks them read — or done with alt-click.
  const openThreads = async (threads: NotificationThread[], asDone = false) => {
    if (!threads.length) return;
    const opened = openInNewTabs([...threads].reverse().map(subjectHref));
    if (!opened) return;
    const ids = asDone ? threads.map((n) => n.id) : threads.filter(isUnread).map((n) => n.id);
    if (!ids.length) return;
    add(asDone ? setDoneIds : setReadIds, ids);
    try {
      await runMany(ids, asDone ? 'done' : 'read');
    } catch (e) {
      toastError(e);
    }
  };
  const openSelected = () => {
    const ids = selected();
    void openThreads(visible().filter((n) => ids.has(n.id)));
    setSelected(new Set<string>());
  };

  /* ---------- Keyboard: GitHub's inbox shortcuts + Refined GitHub's ---------- */
  const [focused, setFocused] = createSignal<string | null>(null);
  const focusedThread = () => ordered().find((n) => n.id === focused());
  const move = (delta: number) => {
    const list = ordered();
    if (!list.length) return;
    const i = list.findIndex((n) => n.id === focused());
    const next = i < 0 ? (delta > 0 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, i + delta));
    setFocused(list[next]!.id);
  };
  createEffect(
    () => focused(),
    (id) => {
      if (id) document.querySelector(`[data-thread-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' });
    },
  );
  const group = 'Notifications';
  useHotkey({ keys: 'j', description: 'Move selection down', group, handler: () => move(1) });
  useHotkey({ keys: 'k', description: 'Move selection up', group, handler: () => move(-1) });
  useHotkey({
    keys: 'o',
    description: 'Open selection',
    group,
    when: () => !!focusedThread(),
    handler: () => {
      const n = focusedThread()!;
      if (isUnread(n)) void markRead(n);
      navigate(subjectHref(n));
    },
  });
  useHotkey({
    keys: 'O',
    description: 'Open selection in new tab',
    group,
    when: () => !!focusedThread(),
    handler: () => {
      const n = focusedThread()!;
      if (openInNewTabs([subjectHref(n)]) && isUnread(n)) void markRead(n);
    },
  });
  useHotkey({
    keys: 'x',
    description: 'Select or deselect the focused notification',
    group,
    when: () => !!focusedThread(),
    handler: () => toggle(focused()!, !selected().has(focused()!)),
  });
  useHotkey({
    keys: 'a',
    description: 'Select all notifications',
    group,
    handler: () => setSelected(new Set<string>(allSelected() ? [] : visible().map((n) => n.id))),
  });
  useHotkey({
    keys: 'p',
    description: 'Open selected notifications',
    group,
    feature: 'open-all-notifications',
    when: () => selected().size > 0,
    handler: openSelected,
  });

  const onSelectBy = (selection: Selection) => {
    const facts = visible().map((n) => ({ thread: n, unread: isUnread(n), state: stateOf(n) }));
    setSelected(new Set<string>(selectMatching(selection, facts)));
  };

  return (
    <Show
      when={visible().length}
      fallback={
        <Blankslate icon={inboxIcon} title={props.query.is === 'done' ? 'No done notifications' : 'All caught up!'} class="Box">
          {props.query.is === 'done' ? 'Notifications you mark as done show up here.' : 'Take a break, write some code, do what you do best.'}
        </Blankslate>
      }
    >
      <div class={['Box transition-opacity', { 'opacity-60': props.pending }]}>
        <div class="Box-header rgh-sticky-notifications flex items-center gap-3 py-2! px-4!">
          <input
            type="checkbox"
            aria-label="Select all notifications"
            checked={allSelected()}
            onChange={(e) => setSelected(new Set<string>(e.currentTarget.checked ? visible().map((n) => n.id) : []))}
          />
          <Show
            when={selected().size}
            fallback={<span class="text-sm text-fg-muted">Select all</span>}
          >
            <span class="text-sm font-semibold">{selected().size} selected</span>
            <Show when={feature('open-all-notifications')}>
              <button type="button" class="btn btn-sm" title="Open selected notifications (p)" onClick={openSelected}>
                <Octicon icon={linkExternalIcon} /> Open
              </button>
            </Show>
            <button type="button" class="btn btn-sm" disabled={busy()} onClick={() => bulk('read')}>
              <Octicon icon={readIcon} /> Mark as read
            </button>
            <button type="button" class="btn btn-sm" disabled={busy()} onClick={() => bulk('done')}>
              <Octicon icon={checkIcon} /> Done
            </button>
          </Show>
          <SelectBy onChange={onSelectBy} />
          <div class="flex-1" />
          <Show when={feature('open-all-notifications') && visible().some(isUnread)}>
            <button
              type="button"
              class="btn btn-sm"
              title="Open all unread notifications in new tabs (alt-click: and mark them done)"
              onClick={(e) => void openThreads(visible().filter(isUnread), e.altKey)}
            >
              <Octicon icon={linkExternalIcon} /> Open all unread
            </button>
          </Show>
          <Show when={props.query.is !== 'done' && visible().some(isUnread)}>
            <button type="button" class="btn btn-sm" disabled={busy()} onClick={allRead}>
              <Octicon icon={readIcon} /> Mark all as read
            </button>
          </Show>
        </div>
        <For each={groups()}>
          {(group) => (
            <>
              <div class="Box-row flex items-center gap-2 py-2! bg-canvas-muted text-sm font-semibold">
                <Avatar src={group.owner.avatar_url} size={16} square={group.owner.type === 'Organization'} />
                <a class="link-plain" href={`/${group.repo}`}>
                  {group.repo}
                </a>
                <Show when={feature('open-all-notifications') && group.items.some(isUnread)}>
                  <button
                    type="button"
                    class="btn btn-sm ml-auto font-normal"
                    title="Open all unread notifications from this repo"
                    onClick={(e) => void openThreads(group.items.filter(isUnread), e.altKey)}
                  >
                    <Octicon icon={linkExternalIcon} /> Open unread
                  </button>
                </Show>
              </div>
              <For each={group.items}>
                {(n) => (
                  <Row
                    thread={n}
                    unread={isUnread(n)}
                    unsubscribed={unsubscribed().has(n.id)}
                    selected={selected().has(n.id)}
                    focused={focused() === n.id}
                    stateKey={keyOf(n)}
                    states={states}
                    onSelect={(on) => toggle(n.id, on)}
                    onOpen={() => {
                      if (isUnread(n)) void markRead(n);
                    }}
                    onRead={() => markRead(n)}
                    onDone={() => markDone(n)}
                    onUnsubscribe={() => unsubscribe(n)}
                  />
                )}
              </For>
            </>
          )}
        </For>
      </div>
      <div class="mt-4">
        <Pagination pageInfo={props.page.pageInfo} href={(p) => inboxHref(props.raw, p)} />
      </div>
    </Show>
  );
}

function Row(props: {
  thread: NotificationThread;
  unread: boolean;
  unsubscribed: boolean;
  selected: boolean;
  /** Keyboard (j/k) selection. */
  focused: boolean;
  stateKey: string | null;
  /** The batched issue/PR state lookup (read under this row's own Loading). */
  states: () => Record<string, SubjectState>;
  onSelect: (on: boolean) => void;
  onOpen: () => void;
  onRead: () => void;
  onDone: () => void;
  onUnsubscribe: () => void;
}) {
  const navigate = useNavigate();
  const n = () => props.thread;
  const href = () => subjectHref(n());
  const num = () => subjectNumber(n());
  // `clean-notifications`: the number leads the title, on a tighter row.
  const clean = () => feature('clean-notifications');
  const fallbackIcon = () => (
    <Octicon icon={subjectIcon(n()).icon} class={subjectIcon(n()).class} />
  );
  return (
    <div
      class={[
        'Box-row Box-row--hover group flex items-center gap-3 px-4! cursor-pointer',
        {
          'Box-row--unread': props.unread,
          'bg-canvas-muted': !props.unread,
          'navigation-focus': props.focused,
          'py-2!': !clean(),
          'py-1.5!': clean(),
        },
      ]}
      data-thread-id={n().id}
      onClick={(e) => {
        // The whole row opens the subject (and marks it read) like github.com;
        // inner controls handle their own clicks.
        if ((e.target as HTMLElement).closest('a, button, input')) return;
        props.onOpen();
        navigate(href());
      }}
    >
      <input type="checkbox" aria-label="Select notification" checked={props.selected} onChange={(e) => props.onSelect(e.currentTarget.checked)} />
      <span class={['w-2 h-2 rounded-full shrink-0', { 'bg-accent-emphasis': props.unread }]} aria-label={props.unread ? 'Unread' : undefined} />
      <span class="shrink-0 flex">
        <Show when={props.stateKey} fallback={fallbackIcon()}>
          {(key) => (
            <Loading fallback={fallbackIcon()}>
              <Show when={props.states()[key()]} fallback={fallbackIcon()}>
                {(s) => (
                  <StateIcon
                    state={itemState({
                      isPull: n().subject.type === 'PullRequest',
                      state: s().state,
                      stateReason: s().stateReason,
                      merged: s().merged,
                      draft: s().isDraft,
                    })}
                  />
                )}
              </Show>
            </Loading>
          )}
        </Show>
      </span>
      <div class="flex-1 min-w-0">
        <a
          href={href()}
          class={['block truncate text-sm link-plain', { 'font-semibold text-fg': props.unread, 'text-fg-muted': !props.unread }]}
          onClick={() => props.onOpen()}
        >
          <Show when={clean() && num()}>
            <span class="font-normal text-fg-muted tabular-nums">#{num()} • </span>
          </Show>
          {n().subject.title}
          <Show when={!clean() && num()}>
            <span class="font-normal text-fg-muted"> #{num()}</span>
          </Show>
        </a>
      </div>
      <Show when={props.unsubscribed}>
        <span class="Label" title="You will no longer receive notifications for this thread">
          <Octicon icon={bellSlashIcon} /> Unsubscribed
        </span>
      </Show>
      <span class="text-xs text-fg-muted shrink-0 hidden sm:inline">{reasonLabel(n().reason)}</span>
      <div class="w-[112px] shrink-0 flex justify-end">
        <span class="text-xs text-fg-muted group-hover:hidden group-focus-within:hidden">
          <RelativeTime datetime={n().updated_at} />
        </span>
        <div class="hidden group-hover:flex group-focus-within:flex items-center gap-1">
          <Show when={props.unread}>
            <button type="button" class="btn-octicon w-7 h-7 -my-1" title="Mark as read" aria-label="Mark as read" onClick={() => props.onRead()}>
              <Octicon icon={readIcon} />
            </button>
          </Show>
          <button type="button" class="btn-octicon w-7 h-7 -my-1" title="Done" aria-label="Mark as done" onClick={() => props.onDone()}>
            <Octicon icon={checkIcon} />
          </button>
          <Show when={!props.unsubscribed}>
            <button type="button" class="btn-octicon w-7 h-7 -my-1" title="Unsubscribe" aria-label="Unsubscribe" onClick={() => props.onUnsubscribe()}>
              <Octicon icon={bellSlashIcon} />
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}
