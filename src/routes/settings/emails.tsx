import { Title } from '@solidjs/meta';
import { useAction } from '@solidjs/router';
import { createMemo, createSignal, For, Show } from 'solid-js';
import Octicon from '../../components/Octicon';
import { Blankslate, toast, toastError } from '../../components/ui';
import { addEmail, deleteEmail, type Email, getEmails, REQUIRED_SCOPES, setEmailVisibility } from '../../features/settings/api';
import ScopeNotice from '../../features/settings/components/ScopeNotice';
import Subhead from '../../features/settings/components/Subhead';
import { linkExternalIcon, mailIcon, trashIcon } from '../../icons/octicons';

export default function EmailSettings() {
  const emails = createMemo(() => getEmails());
  return (
    <>
      <Title>Emails</Title>
      <Subhead title="Emails" />
      <Show
        when={emails()}
        fallback={<ScopeNotice scope={REQUIRED_SCOPES.emails} what="your email addresses" />}
      >
        {(list) => <Emails emails={list()} />}
      </Show>
    </>
  );
}

function Emails(props: { emails: Email[] }) {
  const remove = useAction(deleteEmail);
  const add = useAction(addEmail);
  const setVisibility = useAction(setEmailVisibility);
  const primary = createMemo(() => props.emails.find((e) => e.primary));
  const sorted = createMemo(() => [...props.emails].sort((a, b) => Number(b.primary) - Number(a.primary)));
  const [newEmail, setNewEmail] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  // Writable derived: follows the server value, flipped locally while saving.
  const [isPrivate, setIsPrivate] = createSignal(() => primary()?.visibility === 'private');

  const del = async (email: string) => {
    if (!confirm(`Remove ${email} from your account?`)) return;
    setBusy(true);
    try {
      await remove(email);
      toast(`Removed ${email}`, 'success');
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    const email = newEmail().trim();
    if (!email) return;
    setBusy(true);
    try {
      await add(email);
      setNewEmail('');
      toast(`We sent a verification email to ${email}. Follow the link in it to verify the address.`, 'success');
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const toggleVisibility = async (makePrivate: boolean) => {
    setBusy(true);
    setIsPrivate(makePrivate);
    try {
      await setVisibility(makePrivate ? 'private' : 'public');
      toast(makePrivate ? 'Your email address is now private' : 'Your email address is now public', 'success');
    } catch (err) {
      setIsPrivate(!makePrivate);
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Show
        when={sorted().length}
        fallback={<Blankslate icon={mailIcon} title="No email addresses" class="Box mb-4" />}
      >
        <ul class="Box mb-4">
          <For each={sorted()}>
            {(email) => (
              <li class="Box-row flex items-start gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <strong class="break-all">{email.email}</strong>
                    <Show when={email.primary}>
                      <span class="Label Label--accent">Primary</span>
                    </Show>
                    <Show when={email.primary && email.visibility}>
                      <span class="Label">{email.visibility === 'private' ? 'Private' : 'Public'}</span>
                    </Show>
                    <span class={['Label', email.verified ? 'Label--success' : 'Label--attention']}>
                      {email.verified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                  <ul class="mt-2 text-sm text-fg-muted list-disc pl-5">
                    <Show
                      when={email.primary}
                      fallback={
                        <li>
                          {email.verified
                            ? 'This email can be used to sign in and receive notifications.'
                            : 'Unverified email addresses cannot receive notifications or be used to reset your password.'}
                        </li>
                      }
                    >
                      <li>This email will be used for account-related notifications and can also be used for password resets.</li>
                      <li>
                        {email.visibility === 'private'
                          ? 'Not visible in emails.'
                          : 'Visible in emails and used for web-based Git operations.'}
                      </li>
                    </Show>
                  </ul>
                </div>
                <Show when={!email.primary}>
                  <button
                    type="button"
                    class="btn btn-sm btn-danger"
                    aria-label={`Delete ${email.email}`}
                    disabled={busy()}
                    onClick={() => del(email.email)}
                  >
                    <Octicon icon={trashIcon} />
                  </button>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <form class="form-group" onSubmit={submit}>
        <label for="add-email">Add email address</label>
        <div class="flex gap-2 max-w-[440px]">
          <input
            id="add-email"
            class="form-control flex-1"
            type="email"
            required
            placeholder="Email address"
            value={newEmail()}
            onInput={(e) => setNewEmail(e.currentTarget.value)}
          />
          <button type="submit" class="btn" disabled={busy() || !newEmail().trim()}>
            Add
          </button>
        </div>
      </form>

      <Subhead title="Primary email address" small />
      <p class="mb-2">
        <Show when={primary()} fallback="You have no primary email address.">
          {(p) => (
            <>
              <strong>{p().email}</strong> will be used for account-related notifications and can be used for password
              resets.
            </>
          )}
        </Show>
      </p>
      <p class="text-sm text-fg-muted mb-2">
        The API can't change your primary email address — pick a different one on github.com.
      </p>
      <a class="btn btn-sm inline-flex items-center gap-1" href="https://github.com/settings/emails" target="_blank" rel="noreferrer">
        Change primary email on GitHub
        <Octicon icon={linkExternalIcon} size={12} />
      </a>

      <Subhead title="Email privacy" small />
      <label class="flex items-start gap-2">
        <input
          type="checkbox"
          class="mt-1"
          checked={isPrivate()}
          disabled={busy() || !primary()}
          onChange={(e) => toggleVisibility(e.currentTarget.checked)}
        />
        <span>
          <span class="font-semibold">Keep my email addresses private</span>
          <span class="note text-sm!">
            We'll remove your public profile email and use{' '}
            <code class="font-mono">ID+username@users.noreply.github.com</code> when performing web-based Git operations
            (e.g. edits and merges) and sending email on your behalf.
          </span>
        </span>
      </label>
    </>
  );
}
