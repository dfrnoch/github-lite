import type { JSX } from '@solidjs/web';
import { createSignal, createUniqueId, Show } from 'solid-js';
import { Dialog, toastError } from '../../../components/ui';

/** Page heading of a settings section ("Subhead" on github.com). */
export function Subhead(props: { title: JSX.Element; actions?: JSX.Element; description?: JSX.Element; class?: string; danger?: boolean }) {
  return (
    <div class={['mb-4', props.class]}>
      <div class="flex items-center gap-2 pb-2 border-b border-line-muted">
        <h2 class={['flex-1 text-2xl font-normal', { 'text-fg-danger': props.danger }]}>{props.title}</h2>
        {props.actions}
      </div>
      <Show when={props.description}>
        <p class="mt-2 text-sm text-fg-muted">{props.description}</p>
      </Show>
    </div>
  );
}

/** Smaller section heading inside a settings page. */
export function SectionHeading(props: { children: JSX.Element; class?: string }) {
  return <h3 class={['text-xl font-normal pb-2 mb-3 border-b border-line-muted', props.class]}>{props.children}</h3>;
}

/**
 * A GitHub-style settings checkbox: bold label, muted description. With
 * `onSave` it saves immediately (like github.com's feature toggles) and
 * reverts the box when the request fails.
 */
export function CheckboxSetting(props: {
  label: JSX.Element;
  description?: JSX.Element;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  onSave?: (checked: boolean) => Promise<unknown>;
  children?: JSX.Element;
  class?: string;
}) {
  const [busy, setBusy] = createSignal(false);
  const id = createUniqueId();
  return (
    <div class={['flex items-start gap-2 py-2', props.class]}>
      <input
        id={id}
        type="checkbox"
        class="mt-1 shrink-0"
        checked={props.checked}
        disabled={props.disabled || busy()}
        onChange={async (e) => {
          const el = e.currentTarget;
          const value = el.checked;
          props.onChange?.(value);
          if (!props.onSave) return;
          setBusy(true);
          try {
            await props.onSave(value);
          } catch (err) {
            el.checked = !value;
            toastError(err);
          } finally {
            setBusy(false);
          }
        }}
      />
      <div class="min-w-0 flex-1">
        <label class="font-semibold text-sm cursor-pointer" for={id}>
          {props.label}
        </label>
        <Show when={props.description}>
          <p class="note">{props.description}</p>
        </Show>
        {props.children}
      </div>
    </div>
  );
}

/** Row of the red "Danger Zone" box: title + description on the left, button on the right. */
export function DangerRow(props: { title: JSX.Element; description: JSX.Element; button: JSX.Element }) {
  return (
    <div class="Box-row flex items-center gap-4">
      <div class="flex-1 min-w-0">
        <strong class="text-sm">{props.title}</strong>
        <p class="text-sm text-fg">{props.description}</p>
      </div>
      <div class="shrink-0">{props.button}</div>
    </div>
  );
}

/**
 * Confirmation dialog for destructive actions. With `confirmText` the user
 * must type it (e.g. "owner/repo") before the button enables.
 */
export function ConfirmDialog(props: {
  open: boolean;
  onClose: () => void;
  title: JSX.Element;
  children?: JSX.Element;
  confirmText?: string;
  button: string;
  onConfirm: () => Promise<unknown>;
  /** Pre-fill the confirmation box (each time the dialog opens). */
  prefill?: string;
}) {
  const [typed, setTyped] = createSignal(() => (props.open && props.prefill) || '');
  const [busy, setBusy] = createSignal(false);
  const ok = () => !props.confirmText || typed() === props.confirmText;
  return (
    <Dialog open={props.open} onClose={props.onClose} title={props.title} width="480px">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ok()) return;
          setBusy(true);
          try {
            await props.onConfirm();
            setTyped('');
            props.onClose();
          } catch (err) {
            toastError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div class="text-sm">{props.children}</div>
        <Show when={props.confirmText}>
          <label class="block text-sm mt-3 mb-1" for="confirm-dialog-input">
            To confirm, type “<strong>{props.confirmText}</strong>” in the box below
          </label>
          <input
            id="confirm-dialog-input"
            class="form-control"
            autocomplete="off"
            value={typed()}
            onInput={(e) => setTyped(e.currentTarget.value)}
          />
        </Show>
        <button type="submit" class="btn btn-danger btn-block mt-4" disabled={!ok() || busy()}>
          {busy() ? 'Working…' : props.button}
        </button>
      </form>
    </Dialog>
  );
}

/** Repo permission levels, in GitHub's order. */
export const ROLES = [
  { value: 'pull', label: 'Read', description: 'Recommended for non-code contributors who want to view or discuss your project' },
  { value: 'triage', label: 'Triage', description: 'Recommended for contributors who need to manage issues and pull requests without write access' },
  { value: 'push', label: 'Write', description: 'Recommended for contributors who actively push to your project' },
  { value: 'maintain', label: 'Maintain', description: 'Recommended for project managers who need to manage the repository without access to sensitive or destructive actions' },
  { value: 'admin', label: 'Admin', description: 'Recommended for people who need full access to the project, including sensitive and destructive actions like managing security or deleting a repository' },
] as const;

/** role_name / invitation permissions → PUT permission value. */
export const roleValue = (role: string) =>
  ({ read: 'pull', write: 'push', pull: 'pull', push: 'push', triage: 'triage', maintain: 'maintain', admin: 'admin' })[role] ?? role;
export const roleLabel = (role: string) => ROLES.find((r) => r.value === roleValue(role))?.label ?? role;

/** new-repo-disable-projects-and-wikis: the opt-out checkbox on /new and /fork. */
export function DisableProjectsAndWikis(props: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div class="flash flash-warn py-2! mb-4">
      <label class="flex items-start gap-2 text-sm">
        <input type="checkbox" class="mt-1" checked={props.checked} onChange={(e) => props.onChange(e.currentTarget.checked)} />
        <span>
          <strong>Disable Projects and Wikis</strong>
          <span class="note mt-0!">
            After creating the repository disable the projects and wiki.{' '}
            <a
              href="https://github.com/refined-github/refined-github/wiki/Extended-feature-descriptions#new-repo-disable-projects-and-wikis"
              target="_blank"
              rel="noreferrer"
            >
              Suggestion by Refined GitHub.
            </a>
          </span>
        </span>
      </label>
    </div>
  );
}
