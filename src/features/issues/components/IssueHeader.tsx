import { useLocation } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dropdown, toastError } from '../../../components/ui';
import { checkIcon, eyeClosedIcon, eyeIcon, lockIcon, triangleDownIcon } from '../../../icons/octicons';
import { ACTIVITY_STATES, type ActivityFilter, activityFilter, CONVERSATION_PATH, RichText, setActivityFilter } from '../refined';

/**
 * Big "Title #123" heading with inline title editing, the state badge / meta
 * line under it and page actions on the right (issue page and PR layout).
 */
export default function IssueHeader(props: {
  title: string;
  number: number;
  canEdit: boolean;
  onSave: (title: string) => Promise<unknown>;
  /** Right-aligned buttons next to Edit (e.g. "New issue", "Code"). */
  actions?: JSX.Element;
  /** Draw the bottom border (the PR layout puts its tab bar there instead). */
  bordered?: boolean;
  /** State badge + meta line. */
  children: JSX.Element;
  /** Conversation is locked (shows a Locked label). */
  locked?: boolean;
}) {
  const location = useLocation();
  const [editing, setEditing] = createSignal(false);
  /** Repo of the page ("owner/name"), for #123 references in the title. */
  const repo = () => location.pathname.split('/').slice(1, 3).join('/');
  const conversationPath = () => (CONVERSATION_PATH.test(location.pathname) ? location.pathname.replace(/\/$/, '') : null);

  // Clicking the Closed / Merged badge scrolls to the latest close event.
  const jumpToClose = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.State')) return;
    const events = document.querySelectorAll<HTMLElement>('[data-rgh-close-event]');
    const last = events[events.length - 1];
    if (!last) return;
    last.scrollIntoView({ block: 'center' });
    last.classList.remove('rgh-flash');
    void last.offsetWidth;
    last.classList.add('rgh-flash');
  };
  const [draft, setDraft] = createSignal(() => props.title);
  const [busy, setBusy] = createSignal(false);

  const save = async (e: SubmitEvent) => {
    e.preventDefault();
    const title = draft().trim();
    if (!title) return;
    if (title === props.title) return setEditing(false);
    setBusy(true);
    try {
      await props.onSave(title);
      setEditing(false);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class={['pb-4', { 'mb-4 border-b border-line-muted': props.bordered !== false }]}>
      <Show
        when={editing()}
        fallback={
          <div class="flex flex-col-reverse md:flex-row md:items-start gap-2">
            <h1 class="flex-1 min-w-0 text-[26px] md:text-[32px] leading-tight font-normal break-words">
              <bdi class="text-fg">
                <RichText text={props.title} repo={repo()} />
              </bdi>{' '}
              <span class="text-fg-muted font-light">#{props.number}</span>
            </h1>
            <div class="flex items-center gap-2 shrink-0 md:mt-1">
              <Show when={props.canEdit}>
                <button
                  type="button"
                  class="btn btn-sm"
                  onClick={() => {
                    setDraft(props.title);
                    setEditing(true);
                  }}
                >
                  Edit
                </button>
              </Show>
              {props.actions}
            </div>
          </div>
        }
      >
        <form class="flex flex-wrap items-center gap-2" onSubmit={save}>
          <input
            class="form-control flex-1 min-w-[200px] text-base!"
            aria-label="Title"
            value={draft()}
            ref={(el) => queueMicrotask(() => el.focus())}
            onInput={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false);
            }}
          />
          <button type="submit" class="btn btn-sm" disabled={busy() || !draft().trim()}>
            Save
          </button>
          <button type="button" class="btn-link text-sm" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      </Show>
      <div
        class="flex flex-wrap items-center gap-2 mt-2 text-sm text-fg-muted rgh-jump-to-close-event"
        onClick={jumpToClose}
      >
        {props.children}
        <Show when={props.locked}>
          <span class="Label Label--secondary inline-flex items-center gap-1 rgh-locked-issue" title="This conversation is locked">
            <Octicon icon={lockIcon} size={12} /> Locked
          </span>
        </Show>
        <Show when={conversationPath()}>
          {(path) => <ActivityFilterMenu path={path()} />}
        </Show>
      </div>
    </div>
  );
}

/** "Show all activities / Hide events / Hide events, bots, collapsed comments". */
function ActivityFilterMenu(props: { path: string }) {
  const current = () => activityFilter(props.path);
  return (
    <Dropdown
      class="btn btn-invisible btn-sm text-fg-muted! font-normal! px-2! rgh-conversation-activity-filter"
      title="Conversation activity filter (h)"
      menuClass="w-72"
      button={
        <span class="inline-flex items-center gap-1">
          <Octicon icon={current() === 'showAll' ? eyeIcon : eyeClosedIcon} />
          {current() === 'showAll' ? 'Activity' : ACTIVITY_STATES[current()]}
          <Octicon icon={triangleDownIcon} />
        </span>
      }
    >
      {(close) => (
        <For each={Object.entries(ACTIVITY_STATES) as [ActivityFilter, string][]}>
          {([state, label]) => (
            <button
              type="button"
              class="SelectMenu-item"
              role="menuitemradio"
              aria-checked={current() === state ? 'true' : 'false'}
              onClick={() => {
                setActivityFilter(props.path, state);
                close();
              }}
            >
              <span class="w-4 shrink-0">
                <Show when={current() === state}>
                  <Octicon icon={checkIcon} />
                </Show>
              </span>
              {label}
            </button>
          )}
        </For>
      )}
    </Dropdown>
  );
}
