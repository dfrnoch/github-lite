import type { JSX } from '@solidjs/web';
import { createSignal, Show } from 'solid-js';
import { toastError } from '../../../components/ui';

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
}) {
  const [editing, setEditing] = createSignal(false);
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
              <bdi class="text-fg">{props.title}</bdi> <span class="text-fg-muted font-light">#{props.number}</span>
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
      <div class="flex flex-wrap items-center gap-2 mt-2 text-sm text-fg-muted">{props.children}</div>
    </div>
  );
}
