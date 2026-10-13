import { Title } from '@solidjs/meta';
import { useAction, useNavigate } from '@solidjs/router';
import { createMemo, createOptimistic, createSignal, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Avatar, toast, toastError } from '../../../../components/ui';
import { linkExternalIcon } from '../../../../icons/octicons';
import { ConfirmDialog, DangerRow, Subhead } from '../../../repo-settings/components/ui';
import { deleteOrg, getOrgSettings, type OrgSettings, updateOrg } from '../api';

/** /orgs/:org/settings/profile — "General": the organization profile + danger zone. */
export default function OrgProfileSettings(props: { org: string }) {
  const settings = createMemo(() => getOrgSettings(props.org));
  return (
    <>
      <Title>{`Organization profile · ${props.org}`}</Title>
      <Subhead title="General" />
      <div class="flex flex-col-reverse md:flex-row gap-8">
        <div class="flex-1 min-w-0 max-w-[640px]">
          <ProfileForm org={props.org} settings={settings()} />
        </div>
        <div class="md:w-[200px] shrink-0">
          <h3 class="text-sm font-semibold mb-2">Profile picture</h3>
          <Avatar src={settings().avatar_url} size={200} square class="block" />
          <a
            class="btn btn-sm mt-3 inline-flex items-center gap-1"
            href={`https://github.com/organizations/${props.org}/settings/profile`}
            target="_blank"
            rel="noreferrer"
          >
            Upload on GitHub
            <Octicon icon={linkExternalIcon} size={12} />
          </a>
          <p class="note">The API can’t upload avatars.</p>
        </div>
      </div>
      <DangerZone org={props.org} />
    </>
  );
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  onInput: (v: string) => void;
  note?: string;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <div class="form-group">
      <label for={props.id}>{props.label}</label>
      <Show
        when={props.textarea}
        fallback={
          <input
            id={props.id}
            class="form-control"
            type={props.type ?? 'text'}
            placeholder={props.placeholder}
            value={props.value}
            onInput={(e) => props.onInput(e.currentTarget.value)}
          />
        }
      >
        <textarea
          id={props.id}
          class="form-control min-h-[64px]!"
          placeholder={props.placeholder}
          value={props.value}
          onInput={(e) => props.onInput(e.currentTarget.value)}
        />
      </Show>
      <Show when={props.note}>
        <p class="note">{props.note}</p>
      </Show>
    </div>
  );
}

function ProfileForm(props: { org: string; settings: OrgSettings }) {
  const update = useAction(updateOrg);
  const [name, setName] = createSignal(() => props.settings.name ?? '');
  const [email, setEmail] = createSignal(() => props.settings.email ?? '');
  const [description, setDescription] = createSignal(() => props.settings.description ?? '');
  const [blog, setBlog] = createSignal(() => props.settings.blog ?? '');
  const [twitter, setTwitter] = createSignal(() => props.settings.twitter_username ?? '');
  const [location, setLocation] = createSignal(() => props.settings.location ?? '');
  const [company, setCompany] = createSignal(() => props.settings.company ?? '');
  const [billing, setBilling] = createSignal(() => props.settings.billing_email ?? '');
  const [busy, setBusy] = createOptimistic(false);

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    const patch: Partial<OrgSettings> = {
      name: name().trim(),
      email: email().trim(),
      description: description().trim(),
      blog: blog().trim(),
      twitter_username: twitter().trim().replace(/^@/, ''),
      location: location().trim(),
      company: company().trim(),
    };
    if (props.settings.billing_email !== undefined && billing().trim()) patch.billing_email = billing().trim();
    setBusy(true);
    try {
      await update(props.org, patch);
      toast('Profile updated successfully', 'success');
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <form onSubmit={submit}>
      <div class="form-group mt-0!">
        <label for="org-name">Organization display name</label>
        <input id="org-name" class="form-control" value={name()} onInput={(e) => setName(e.currentTarget.value)} />
      </div>
      <Field id="org-email" label="Email (will be public)" type="email" value={email()} onInput={setEmail} />
      <Field
        id="org-description"
        label="Description"
        textarea
        placeholder="Tell us about your organization"
        value={description()}
        onInput={setDescription}
      />
      <Field id="org-blog" label="URL" type="url" placeholder="https://example.com" value={blog()} onInput={setBlog} />
      <Field
        id="org-twitter"
        label="X (Twitter) username"
        placeholder="username"
        value={twitter()}
        onInput={setTwitter}
      />
      <Field id="org-location" label="Location" value={location()} onInput={setLocation} />
      <Field id="org-company" label="Company" value={company()} onInput={setCompany} />
      <Show when={props.settings.billing_email !== undefined}>
        <Field
          id="org-billing"
          label="Billing email (Private)"
          type="email"
          value={billing()}
          onInput={setBilling}
          note="Receipts and billing notifications are sent here."
        />
      </Show>
      <p class="note mb-4">
        Social accounts other than X and the README pinned to your profile are edited on{' '}
        <a href={`https://github.com/organizations/${props.org}/settings/profile`} target="_blank" rel="noreferrer">
          GitHub
        </a>
        .
      </p>
      <button type="submit" class="btn btn-primary" disabled={busy()}>
        {busy() ? 'Updating…' : 'Update profile'}
      </button>
    </form>
  );
}

function DangerZone(props: { org: string }) {
  const remove = useAction(deleteOrg);
  const navigate = useNavigate();
  const [deleting, setDeleting] = createSignal(false);
  async function confirmDelete() {
    const org = props.org;
    await remove(org);
    toast(`${org} is being deleted`, 'success');
    navigate('/', { replace: true });
  }
  const ghSettings = () => `https://github.com/organizations/${props.org}/settings/profile`;
  return (
    <>
      <Subhead title="Danger zone" danger class="mt-10" />
      <div class="Box Box--danger">
        <DangerRow
          title="Rename organization"
          description="Renaming an organization can have unintended side effects. The API can’t rename organizations — continue on GitHub."
          button={
            <a class="btn btn-danger inline-flex items-center gap-1" href={ghSettings()} target="_blank" rel="noreferrer">
              Rename on GitHub <Octicon icon={linkExternalIcon} size={12} />
            </a>
          }
        />
        <DangerRow
          title="Archive this organization"
          description="Mark this organization and all its repositories as archived and read-only. Only possible on GitHub."
          button={
            <a class="btn btn-danger inline-flex items-center gap-1" href={ghSettings()} target="_blank" rel="noreferrer">
              Archive on GitHub <Octicon icon={linkExternalIcon} size={12} />
            </a>
          }
        />
        <DangerRow
          title="Delete this organization"
          description="Once deleted, it will be gone forever. Please be certain."
          button={
            <button type="button" class="btn btn-danger" onClick={() => setDeleting(true)}>
              Delete this organization
            </button>
          }
        />
      </div>
      <ConfirmDialog
        open={deleting()}
        onClose={() => setDeleting(false)}
        title={`Delete ${props.org}`}
        confirmText={props.org}
        button="Cancel plan and delete this organization"
        onConfirm={confirmDelete}
      >
        <div class="flash flash-error mb-3">
          This deletes the organization, all of its repositories, packages and teams. The organization name becomes
          available again after 90 days. This cannot be undone.
        </div>
      </ConfirmDialog>
    </>
  );
}
