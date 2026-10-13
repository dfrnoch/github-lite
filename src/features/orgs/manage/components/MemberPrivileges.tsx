import { Title } from '@solidjs/meta';
import { useAction } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createMemo, createOptimistic, createSignal, For, Show } from 'solid-js';
import { toast, toastError } from '../../../../components/ui';
import { CheckboxSetting, Subhead } from '../../../repo-settings/components/ui';
import { getOrgSettings, type OrgSettings, updateOrg } from '../api';

/** /orgs/:org/settings/member_privileges — base permissions, creation and forking rules. */
export default function MemberPrivileges(props: { org: string }) {
  const settings = createMemo(() => getOrgSettings(props.org));
  return (
    <>
      <Title>{`Member privileges · ${props.org}`}</Title>
      <Subhead title="Member privileges" />
      <Show
        when={settings().default_repository_permission !== undefined}
        fallback={
          <div class="flash flash-warn">GitHub didn’t return the member privilege settings — only organization owners can see them.</div>
        }
      >
        <BasePermissions org={props.org} settings={settings()} />
        <RepoCreation org={props.org} settings={settings()} />
        <Forking org={props.org} settings={settings()} />
        <PagesCreation org={props.org} settings={settings()} />
        <Signoff org={props.org} settings={settings()} />
      </Show>
    </>
  );
}

/** One settings block: heading, description, body and its own Save button. */
function Block(props: {
  title: string;
  description: JSX.Element;
  children: JSX.Element;
  patch: () => Partial<OrgSettings>;
  org: string;
  dirty: boolean;
}) {
  const update = useAction(updateOrg);
  const [busy, setBusy] = createOptimistic(false);
  return (
    <form
      class="mb-10"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await update(props.org, props.patch());
          toast(`${props.title} saved`, 'success');
        } catch (err) {
          toastError(err);
        }
      }}
    >
      <h3 class="text-xl font-normal pb-2 mb-3 border-b border-line-muted">{props.title}</h3>
      <p class="text-sm text-fg-muted mb-3">{props.description}</p>
      {props.children}
      <button type="submit" class="btn mt-3" disabled={busy() || !props.dirty}>
        {busy() ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}

type P = { org: string; settings: OrgSettings };

const BASE = [
  { value: 'none', label: 'No permission', desc: 'Members will only be able to clone and pull public repositories.' },
  { value: 'read', label: 'Read', desc: 'Members will be able to clone and pull all repositories.' },
  { value: 'write', label: 'Write', desc: 'Members will be able to clone, pull, and push all repositories.' },
  { value: 'admin', label: 'Admin', desc: 'Members will be able to clone, pull, push, and add new collaborators to all repositories.' },
] as const;

function BasePermissions(props: P) {
  const [value, setValue] = createSignal(() => props.settings.default_repository_permission ?? 'read');
  return (
    <Block
      org={props.org}
      title="Base permissions"
      description="Base permissions to the organization’s repositories apply to all members and exclude outside collaborators."
      patch={() => ({ default_repository_permission: value() })}
      dirty={value() !== props.settings.default_repository_permission}
    >
      <label class="form-label" for="base-permission">
        Default repository permission
      </label>
      <select
        id="base-permission"
        class="form-select w-auto! min-w-[200px]"
        onChange={(e) => setValue(e.currentTarget.value as OrgSettings['default_repository_permission'] & string)}
      >
        <For each={BASE}>
          {(b) => (
            <option value={b.value} selected={value() === b.value}>
              {b.label}
            </option>
          )}
        </For>
      </select>
      <p class="note">{BASE.find((b) => b.value === value())?.desc}</p>
    </Block>
  );
}

function RepoCreation(props: P) {
  const [pub, setPub] = createSignal(() => !!props.settings.members_can_create_public_repositories);
  const [priv, setPriv] = createSignal(() => !!props.settings.members_can_create_private_repositories);
  const [internal, setInternal] = createSignal(() => !!props.settings.members_can_create_internal_repositories);
  const enterprise = () => props.settings.plan?.name === 'enterprise';
  return (
    <Block
      org={props.org}
      title="Repository creation"
      description="Members will be able to create only selected repository types. Outside collaborators can never create repositories."
      patch={() => ({
        members_can_create_public_repositories: pub(),
        members_can_create_private_repositories: priv(),
        ...(enterprise() ? { members_can_create_internal_repositories: internal() } : {}),
      })}
      dirty={
        pub() !== !!props.settings.members_can_create_public_repositories ||
        priv() !== !!props.settings.members_can_create_private_repositories ||
        (enterprise() && internal() !== !!props.settings.members_can_create_internal_repositories)
      }
    >
      <CheckboxSetting label="Public" description="Members will be able to create public repositories, visible to anyone." checked={pub()} onChange={setPub} />
      <CheckboxSetting label="Private" description="Members will be able to create private repositories, visible to organization members with permission." checked={priv()} onChange={setPriv} />
      <Show when={enterprise()}>
        <CheckboxSetting label="Internal" description="Members will be able to create internal repositories, visible to all enterprise members." checked={internal()} onChange={setInternal} />
      </Show>
    </Block>
  );
}

function Forking(props: P) {
  const [fork, setFork] = createSignal(() => !!props.settings.members_can_fork_private_repositories);
  return (
    <Block
      org={props.org}
      title="Repository forking"
      description="Forks of private repositories are private to the forker and follow the base repository’s access."
      patch={() => ({ members_can_fork_private_repositories: fork() })}
      dirty={fork() !== !!props.settings.members_can_fork_private_repositories}
    >
      <CheckboxSetting
        label="Allow forking of private repositories"
        description="If enabled, forking is allowed on private repositories. If disabled, forking is not allowed on any private repositories."
        checked={fork()}
        onChange={setFork}
      />
    </Block>
  );
}

function PagesCreation(props: P) {
  const [pub, setPub] = createSignal(() => !!props.settings.members_can_create_public_pages);
  const [priv, setPriv] = createSignal(() => !!props.settings.members_can_create_private_pages);
  return (
    <Block
      org={props.org}
      title="Pages creation"
      description="Members will be able to publish sites with only the selected access controls."
      patch={() => ({ members_can_create_public_pages: pub(), members_can_create_private_pages: priv() })}
      dirty={pub() !== !!props.settings.members_can_create_public_pages || priv() !== !!props.settings.members_can_create_private_pages}
    >
      <CheckboxSetting label="Public" description="Members will be able to create public sites, visible to anyone." checked={pub()} onChange={setPub} />
      <CheckboxSetting
        label="Private"
        description="Members will be able to create private sites, visible to anyone with read access (GitHub Enterprise Cloud)."
        checked={priv()}
        onChange={setPriv}
      />
    </Block>
  );
}

function Signoff(props: P) {
  const [required, setRequired] = createSignal(() => !!props.settings.web_commit_signoff_required);
  return (
    <Block
      org={props.org}
      title="Commit signoff"
      description="Choose whether repositories will require contributors to sign off on commits they make through GitHub’s web interface."
      patch={() => ({ web_commit_signoff_required: required() })}
      dirty={required() !== !!props.settings.web_commit_signoff_required}
    >
      <CheckboxSetting
        label="Require sign off on web-based commits"
        description="Signing off is a way for contributors to affirm that their commit complies with the repository’s terms, commonly the Developer Certificate of Origin (DCO)."
        checked={required()}
        onChange={setRequired}
      />
    </Block>
  );
}
