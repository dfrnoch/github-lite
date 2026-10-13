import { useAction } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, toast, toastError } from '../../../components/ui';
import { linkIcon, locationIcon, mailIcon, organizationIcon, peopleIcon } from '../../../icons/octicons';
import { compactNumber } from '../../../lib/format';
import { type SocialAccount, updateProfile, type UserProfile } from '../api';
import FollowButton from './FollowButton';

const withProtocol = (url: string) => (/^https?:\/\//.test(url) ? url : `https://${url}`);

const SOCIAL_LABEL: Record<string, string> = {
  TWITTER: 'X',
  LINKEDIN: 'LinkedIn',
  MASTODON: 'Mastodon',
  BLUESKY: 'Bluesky',
  YOUTUBE: 'YouTube',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  REDDIT: 'Reddit',
  TWITCH: 'Twitch',
  NPM: 'npm',
  HOMETOWN: 'Hometown',
};

function socialText(a: SocialAccount) {
  if (a.provider === 'TWITTER' || a.provider === 'BLUESKY' || a.provider === 'MASTODON') return a.displayName;
  return a.displayName || a.url.replace(/^https?:\/\//, '');
}

/** Left column of a user profile: avatar, names, bio, follow/edit, details, organizations. */
export default function UserSidebar(props: { user: UserProfile }) {
  const [editing, setEditing] = createSignal(false);
  const Detail = (p: { icon: typeof linkIcon; label: string; children: any }) => (
    <li class="flex items-start gap-2 mt-1 text-sm" aria-label={p.label}>
      <Octicon icon={p.icon} class="text-fg-muted mt-0.5" />
      <span class="min-w-0 break-words">{p.children}</span>
    </li>
  );

  return (
    <div>
      <div class="flex md:block items-center gap-4 mb-4">
        <div class="relative shrink-0">
          <Avatar src={props.user.avatarUrl} size={296} class="w-16! h-16! md:w-full! md:h-auto! md:max-w-[296px]" />
          <Show when={props.user.status?.emojiHTML || props.user.status?.message}>
            <div
              class="hidden md:flex absolute bottom-[12%] right-0 h-[38px] min-w-[38px] items-center gap-1 px-2 rounded-full bg-canvas border border-line text-xs shadow-sm max-w-[80%]"
              title={props.user.status?.message ?? ''}
            >
              <Show when={props.user.status?.emojiHTML}>
                {/* oxlint-disable-next-line solid/no-innerhtml -- emoji HTML from GitHub */}
                {(html) => <span innerHTML={html()} />}
              </Show>
              <Show when={props.user.status?.message}>
                <span class="truncate text-fg-muted">{props.user.status?.message}</span>
              </Show>
            </div>
          </Show>
        </div>
        <h1 class="md:mt-4">
          <Show when={props.user.name}>
            <span class="block text-2xl font-semibold leading-tight">{props.user.name}</span>
          </Show>
          <span class="block text-xl font-light text-fg-muted leading-6">
            {props.user.login}
            <Show when={props.user.pronouns}>
              <span class="text-base"> · {props.user.pronouns}</span>
            </Show>
          </span>
        </h1>
      </div>

      <Show when={!editing()} fallback={<EditProfileForm user={props.user} onDone={() => setEditing(false)} />}>
        <Show when={props.user.bioHTML}>
          {/* oxlint-disable-next-line solid/no-innerhtml -- bioHTML is rendered + sanitized by GitHub */}
          {(html) => <div class="text-base mb-4 break-words [&_a]:font-semibold" innerHTML={html()} />}
        </Show>
        <Show
          when={props.user.isViewer}
          fallback={
            <Show when={props.user.viewerCanFollow || props.user.viewerIsFollowing}>
              <FollowButton login={props.user.login} following={props.user.viewerIsFollowing} block class="mb-4" />
            </Show>
          }
        >
          <button type="button" class="btn btn-block mb-4" onClick={() => setEditing(true)}>
            Edit profile
          </button>
        </Show>
        <div class="flex items-center gap-1 text-sm text-fg-muted mb-4">
          <Octicon icon={peopleIcon} />
          <a class="link-muted" href={`/${props.user.login}?tab=followers`}>
            <span class="font-semibold text-fg">{compactNumber(props.user.followers)}</span> followers
          </a>
          ·
          <a class="link-muted" href={`/${props.user.login}?tab=following`}>
            <span class="font-semibold text-fg">{compactNumber(props.user.following)}</span> following
          </a>
        </div>
        <ul class="mb-4">
          <Show when={props.user.companyHTML}>
            {(html) => (
              <Detail icon={organizationIcon} label="Company">
                {/* oxlint-disable-next-line solid/no-innerhtml -- companyHTML is rendered by GitHub (@mentions) */}
                <span class="[&_a]:font-semibold [&_a]:text-fg" innerHTML={html()} />
              </Detail>
            )}
          </Show>
          <Show when={props.user.location}>
            {(loc) => (
              <Detail icon={locationIcon} label="Home location">
                {loc()}
              </Detail>
            )}
          </Show>
          <Show when={props.user.email}>
            {(email) => (
              <Detail icon={mailIcon} label="Email">
                <a class="link-plain" href={`mailto:${email()}`}>
                  {email()}
                </a>
              </Detail>
            )}
          </Show>
          <Show when={props.user.websiteUrl}>
            {(url) => (
              <Detail icon={linkIcon} label="Blog or website">
                <a class="link-plain" href={withProtocol(url())} target="_blank" rel="nofollow me noreferrer">
                  {url()}
                </a>
              </Detail>
            )}
          </Show>
          <For each={props.user.socialAccounts}>
            {(a) => (
              <Detail icon={linkIcon} label={SOCIAL_LABEL[a.provider] ?? 'Social account'}>
                <a class="link-plain" href={a.url} target="_blank" rel="nofollow me noreferrer">
                  {socialText(a)}
                </a>
              </Detail>
            )}
          </For>
        </ul>
      </Show>

      <Show when={props.user.organizations.length}>
        <div class="border-t border-line-muted pt-4 mt-4">
          <h2 class="text-base font-semibold mb-2">Organizations</h2>
          <div class="flex flex-wrap gap-1">
            <For each={props.user.organizations}>
              {(org) => (
                <a href={`/${org.login}`} aria-label={org.login} title={org.name ?? org.login}>
                  <Avatar src={org.avatarUrl} size={32} square />
                </a>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

/** Inline "Edit profile" form (PATCH /user), like github.com's sidebar editor. */
function EditProfileForm(props: { user: UserProfile; onDone: () => void }) {
  const save = useAction(updateProfile);
  const [name, setName] = createSignal(() => props.user.name ?? '');
  const [bio, setBio] = createSignal(() => props.user.bio ?? '');
  const [company, setCompany] = createSignal(() => props.user.company ?? '');
  const [location, setLocation] = createSignal(() => props.user.location ?? '');
  const [blog, setBlog] = createSignal(() => props.user.websiteUrl ?? '');
  const [twitter, setTwitter] = createSignal(() => props.user.twitterUsername ?? '');
  const [busy, setBusy] = createSignal(false);

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await save({
        name: name(),
        bio: bio(),
        company: company(),
        location: location(),
        blog: blog(),
        twitter_username: twitter(),
      });
      toast('Profile updated successfully', 'success');
      props.onDone();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  const Field = (p: { id: string; icon?: typeof linkIcon; placeholder: string; value: string; onInput: (v: string) => void; label: string }) => (
    <div class="flex items-center gap-2 mt-2">
      <Show when={p.icon}>{(icon) => <Octicon icon={icon()} class="text-fg-muted" />}</Show>
      <input
        id={p.id}
        class="form-control form-control-sm"
        aria-label={p.label}
        placeholder={p.placeholder}
        value={p.value}
        onInput={(e) => p.onInput(e.currentTarget.value)}
      />
    </div>
  );

  return (
    <form class="mb-4 text-sm" onSubmit={submit}>
      <label for="profile-name" class="block font-semibold mb-1">
        Name
      </label>
      <input id="profile-name" class="form-control form-control-sm" placeholder="Name" value={name()} onInput={(e) => setName(e.currentTarget.value)} />
      <label for="profile-bio" class="block font-semibold mt-3 mb-1">
        Bio
      </label>
      <textarea
        id="profile-bio"
        class="form-control form-control-sm min-h-[64px]!"
        placeholder="Add a bio"
        maxlength={160}
        value={bio()}
        onInput={(e) => setBio(e.currentTarget.value)}
      />
      <p class="note">You can @mention other users and organizations to link to them.</p>
      <Field id="profile-company" icon={organizationIcon} label="Company" placeholder="Company" value={company()} onInput={setCompany} />
      <Field id="profile-location" icon={locationIcon} label="Location" placeholder="Location" value={location()} onInput={setLocation} />
      <Field id="profile-blog" icon={linkIcon} label="Website" placeholder="Website" value={blog()} onInput={setBlog} />
      <Field id="profile-twitter" icon={linkIcon} label="X / Twitter username" placeholder="X username" value={twitter()} onInput={setTwitter} />
      <p class="note mt-2">
        Social accounts are managed in <a href="/settings/profile">profile settings</a>.
      </p>
      <div class="flex gap-2 mt-3">
        <button type="submit" class="btn btn-sm btn-primary" disabled={busy()}>
          {busy() ? 'Saving…' : 'Save'}
        </button>
        <button type="button" class="btn btn-sm" onClick={() => props.onDone()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
