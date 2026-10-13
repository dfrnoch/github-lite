import { useAction } from '@solidjs/router';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { toast, toastError } from '../../../components/ui';
import type { Viewer } from '../../../lib/types';
import { type Email, type SocialAccount, updateProfile } from '../api';
import SocialAccounts from './SocialAccounts';

export type ProfileUser = Viewer & { hireable: boolean | null };

/** The "Public profile" form (PATCH /user), seeded from GET /user. */
export default function ProfileForm(props: {
  user: ProfileUser;
  /** null when the token can't read /user/emails. */
  emails: Email[] | null;
  socialAccounts: SocialAccount[] | null;
}) {
  const save = useAction(updateProfile);
  // Writable derived signals: start from the saved profile, editable locally,
  // re-seeded when the profile revalidates after a save.
  const [name, setName] = createSignal(() => props.user.name ?? '');
  const [email, setEmail] = createSignal(() => props.user.email ?? '');
  const [bio, setBio] = createSignal(() => props.user.bio ?? '');
  const [blog, setBlog] = createSignal(() => props.user.blog ?? '');
  const [company, setCompany] = createSignal(() => props.user.company ?? '');
  const [location, setLocation] = createSignal(() => props.user.location ?? '');
  const [twitter, setTwitter] = createSignal(() => props.user.twitter_username ?? '');
  const [hireable, setHireable] = createSignal(() => !!props.user.hireable);
  const [busy, setBusy] = createSignal(false);

  // Options for "Public email": verified addresses, always including the current one.
  const emailOptions = createMemo(() => {
    const verified = (props.emails ?? []).filter((e) => e.verified).map((e) => e.email);
    const current = props.user.email;
    return current && !verified.includes(current) ? [current, ...verified] : verified;
  });

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await save({
        name: name(),
        email: email(),
        bio: bio(),
        blog: blog(),
        company: company(),
        location: location(),
        twitter_username: twitter(),
        hireable: hireable(),
      });
      toast('Profile updated successfully', 'success');
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} class="max-w-[440px]">
      <div class="form-group mt-0!">
        <label for="profile-name">Name</label>
        <input id="profile-name" class="form-control" value={name()} onInput={(e) => setName(e.currentTarget.value)} />
        <p class="note">
          Your name may appear around GitHub where you contribute or are mentioned. You can remove it at any time.
        </p>
      </div>

      <div class="form-group">
        <label for="profile-email">Public email</label>
        <select id="profile-email" class="form-select" value={email()} onChange={(e) => setEmail(e.currentTarget.value)}>
          <option value="" selected={email() === ''}>
            {emailOptions().length ? "Don't show my email address" : 'Select a verified email to display'}
          </option>
          <For each={emailOptions()}>
            {(address) => (
              <option value={address} selected={email() === address}>
                {address}
              </option>
            )}
          </For>
        </select>
        <p class="note">
          <Show
            when={props.emails}
            fallback={<>Your token can't list your verified emails (needs the user:email scope). </>}
          >
            You can manage verified email addresses in your <a href="/settings/emails">email settings</a>.
          </Show>
        </p>
      </div>

      <div class="form-group">
        <label for="profile-bio">Bio</label>
        <textarea
          id="profile-bio"
          class="form-control min-h-[64px]!"
          rows={3}
          maxlength={160}
          placeholder="Tell us a little bit about yourself"
          value={bio()}
          onInput={(e) => setBio(e.currentTarget.value)}
        />
        <p class="note flex justify-between gap-2">
          <span>You can @mention other users and organizations to link to them.</span>
          <span class={{ 'text-fg-danger': bio().length >= 160 }}>{160 - bio().length}</span>
        </p>
      </div>

      <div class="form-group">
        <label for="profile-blog">URL</label>
        <input id="profile-blog" class="form-control" type="text" value={blog()} onInput={(e) => setBlog(e.currentTarget.value)} />
      </div>

      <SocialAccounts accounts={props.socialAccounts} />

      <div class="form-group">
        <label for="profile-twitter">Twitter username</label>
        <div class="flex items-center gap-2">
          <span class="text-fg-muted">@</span>
          <input
            id="profile-twitter"
            class="form-control"
            value={twitter()}
            onInput={(e) => setTwitter(e.currentTarget.value.replace(/^@/, ''))}
          />
        </div>
      </div>

      <div class="form-group">
        <label for="profile-company">Company</label>
        <input id="profile-company" class="form-control" value={company()} onInput={(e) => setCompany(e.currentTarget.value)} />
        <p class="note">You can @mention your company's GitHub organization to link it.</p>
      </div>

      <div class="form-group">
        <label for="profile-location">Location</label>
        <input id="profile-location" class="form-control" value={location()} onInput={(e) => setLocation(e.currentTarget.value)} />
      </div>

      <div class="form-group">
        <label class="flex! items-start gap-2 font-normal!">
          <input type="checkbox" class="mt-1" checked={hireable()} onChange={(e) => setHireable(e.currentTarget.checked)} />
          <span>
            <span class="font-semibold">Available for hire</span>
            <span class="note">Show a "Hire me" indication on your profile.</span>
          </span>
        </label>
      </div>

      <p class="text-xs text-fg-muted mb-4">
        All of the fields on this page are optional and can be deleted at any time, and by filling them out, you're giving
        us consent to share this data wherever your user profile appears. Please see our{' '}
        <a href="https://docs.github.com/site-policy/privacy-policies/github-privacy-statement" target="_blank" rel="noreferrer">
          privacy statement
        </a>{' '}
        to learn more about how we use this information.
      </p>

      <button type="submit" class="btn btn-primary" disabled={busy()}>
        {busy() ? 'Updating…' : 'Update profile'}
      </button>
    </form>
  );
}
