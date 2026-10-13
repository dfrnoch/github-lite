import { Title } from '@solidjs/meta';
import { useAction, useNavigate } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, onSettled, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Dialog, Spinner, toast, toastError } from '../../../../components/ui';
import type { RepoSettings } from '../../../../features/repo-settings/api';
import {
  deleteRepository,
  getBranchNames,
  renameRepository,
  transferRepository,
  updateRepoSettings,
} from '../../../../features/repo-settings/api';
import { CheckboxSetting, ConfirmDialog, DangerRow, SectionHeading, Subhead } from '../../../../features/repo-settings/components/ui';
import { useRepo } from '../../../../features/repo/context';
import { DELETE_HASH, ForkPullsDeleteWarning, QUICK_DELETE_TITLE, useInstantDelete } from '../../../../features/repo/refined/ForkTools';
import { feature } from '../../../../features/refined';
import { arrowSwitchIcon, gitBranchIcon, pencilIcon } from '../../../../icons/octicons';

/** /:owner/:repo/settings — General. */
export default function GeneralSettings() {
  const ctx = useRepo();
  const repo = () => ctx.repo() as RepoSettings;
  const update = useAction(updateRepoSettings);
  const save = (patch: Partial<RepoSettings>) => update(ctx.owner(), ctx.name(), patch).then(() => toast('Settings saved', 'success', 2500));

  return (
    <>
      <Title>{`General · ${ctx.fullName()}`}</Title>
      <Subhead title="General" />
      <RenameForm />
      <CheckboxSetting
        class="mt-4"
        label="Template repository"
        description="Template repositories let users generate new repositories with the same directory structure and files."
        checked={!!repo().is_template}
        onSave={(v) => save({ is_template: v })}
      />
      <CheckboxSetting
        label="Require contributors to sign off on web-based commits"
        description="Enabling this setting will require contributors to sign off on commits made through GitHub’s web interface."
        checked={!!repo().web_commit_signoff_required}
        onSave={(v) => save({ web_commit_signoff_required: v })}
      />

      <SectionHeading class="mt-8">Default branch</SectionHeading>
      <DefaultBranch save={save} />

      <SectionHeading class="mt-8">Features</SectionHeading>
      <div class="Box">
        <div class="Box-row py-1!">
          <CheckboxSetting
            label="Wikis"
            description="Wikis host documentation for your repository."
            checked={repo().has_wiki}
            onSave={(v) => save({ has_wiki: v })}
          />
        </div>
        <div class="Box-row py-1!">
          <CheckboxSetting
            label="Issues"
            description="Issues integrate lightweight task tracking into your repository. Keep projects on track with issue labels and milestones, and reference them in commit messages."
            checked={repo().has_issues}
            onSave={(v) => save({ has_issues: v })}
          />
        </div>
        <div class="Box-row py-1!">
          <CheckboxSetting
            label="Discussions"
            description="Discussions is the space for your community to have conversations, ask questions and post answers without opening issues."
            checked={repo().has_discussions}
            onSave={(v) => save({ has_discussions: v })}
          />
        </div>
        <div class="Box-row py-1!">
          <CheckboxSetting
            label="Projects"
            description="Projects on GitHub are created at the repository owner's level (organization or user) and can be linked to a repository's Projects tab."
            checked={repo().has_projects}
            onSave={(v) => save({ has_projects: v })}
          />
        </div>
      </div>

      <SectionHeading class="mt-8">Pull Requests</SectionHeading>
      <p class="text-sm text-fg-muted mb-2">
        When merging pull requests, you can allow any combination of merge commits, squashing, or rebasing. At least one option
        must be enabled.
      </p>
      <div class="Box">
        <div class="Box-row py-1!">
          <CheckboxSetting
            label="Allow merge commits"
            description="Add all commits from the head branch to the base branch with a merge commit."
            checked={repo().allow_merge_commit !== false}
            onSave={(v) => save({ allow_merge_commit: v })}
          >
            <Show when={repo().allow_merge_commit !== false}>
              <MessageSelect
                label="Default commit message"
                options={MERGE_MESSAGES}
                value={`${repo().merge_commit_title ?? 'MERGE_MESSAGE'}/${repo().merge_commit_message ?? 'PR_TITLE'}`}
                onSave={(title, message) => save({ merge_commit_title: title as any, merge_commit_message: message as any })}
              />
            </Show>
          </CheckboxSetting>
        </div>
        <div class="Box-row py-1!">
          <CheckboxSetting
            label="Allow squash merging"
            description="Combine all commits from the head branch into a single commit in the base branch."
            checked={repo().allow_squash_merge !== false}
            onSave={(v) => save({ allow_squash_merge: v })}
          >
            <Show when={repo().allow_squash_merge !== false}>
              <MessageSelect
                label="Default commit message"
                options={SQUASH_MESSAGES}
                value={`${repo().squash_merge_commit_title ?? 'COMMIT_OR_PR_TITLE'}/${repo().squash_merge_commit_message ?? 'COMMIT_MESSAGES'}`}
                onSave={(title, message) =>
                  save({ squash_merge_commit_title: title as any, squash_merge_commit_message: message as any })
                }
              />
            </Show>
          </CheckboxSetting>
        </div>
        <div class="Box-row py-1!">
          <CheckboxSetting
            label="Allow rebase merging"
            description="Add all commits from the head branch onto the base branch individually."
            checked={repo().allow_rebase_merge !== false}
            onSave={(v) => save({ allow_rebase_merge: v })}
          />
        </div>
      </div>
      <div class="mt-2">
        <CheckboxSetting
          label="Always suggest updating pull request branches"
          description="Whenever there are new changes available in the base branch, present an “update branch” option in the pull request."
          checked={!!repo().allow_update_branch}
          onSave={(v) => save({ allow_update_branch: v })}
        />
        <CheckboxSetting
          label="Allow auto-merge"
          description="Waits for merge requirements to be met and then merges automatically."
          checked={!!repo().allow_auto_merge}
          onSave={(v) => save({ allow_auto_merge: v })}
        />
        <CheckboxSetting
          label="Automatically delete head branches"
          description="Deleted branches will still be able to be restored."
          checked={!!repo().delete_branch_on_merge}
          onSave={(v) => save({ delete_branch_on_merge: v })}
        />
      </div>

      <Show when={repo().private && repo().owner.type === 'Organization'}>
        <SectionHeading class="mt-8">Forking</SectionHeading>
        <CheckboxSetting
          label="Allow forking"
          description="If enabled, forking is allowed on private and internal repositories."
          checked={!!repo().allow_forking}
          onSave={(v) => save({ allow_forking: v })}
        />
      </Show>

      <DangerZone save={save} />
    </>
  );
}

const MERGE_MESSAGES = [
  { value: 'MERGE_MESSAGE/PR_TITLE', label: 'Default message', note: 'Merge pull request #123 from branch-name' },
  { value: 'PR_TITLE/BLANK', label: 'Pull request title', note: 'Pull request title' },
  { value: 'PR_TITLE/PR_BODY', label: 'Pull request title and description', note: 'Pull request title and description' },
];

const SQUASH_MESSAGES = [
  { value: 'COMMIT_OR_PR_TITLE/COMMIT_MESSAGES', label: 'Default message', note: 'Uses the commit title and message for single-commit pull requests, or the pull request title and list of commits otherwise' },
  { value: 'PR_TITLE/BLANK', label: 'Pull request title', note: 'Pull request title' },
  { value: 'PR_TITLE/COMMIT_MESSAGES', label: 'Pull request title and commit details', note: 'Pull request title and list of commits' },
  { value: 'PR_TITLE/PR_BODY', label: 'Pull request title and description', note: 'Pull request title and description' },
];

function MessageSelect(props: {
  label: string;
  options: { value: string; label: string; note: string }[];
  value: string;
  onSave: (title: string, message: string) => Promise<unknown>;
}) {
  const current = () => props.options.find((o) => o.value === props.value) ?? props.options[0]!;
  return (
    <div class="mt-2 max-w-[440px]">
      <label class="text-xs font-semibold block mb-1">{props.label}</label>
      <select
        class="form-select form-control-sm w-auto!"
        value={props.value}
        onChange={(e) => {
          const [title, message] = e.currentTarget.value.split('/') as [string, string];
          props.onSave(title, message).catch(toastError);
        }}
      >
        <For each={props.options}>{(o) => <option value={o.value}>{o.label}</option>}</For>
      </select>
      <p class="note">{current().note}</p>
    </div>
  );
}

function RenameForm() {
  const ctx = useRepo();
  const navigate = useNavigate();
  const [name, setName] = createSignal(() => ctx.repo().name);
  const [busy, setBusy] = createSignal(false);
  return (
    <form
      class="form-group mt-0!"
      onSubmit={async (e) => {
        e.preventDefault();
        const next = name().trim();
        if (!next || next === ctx.repo().name) return;
        setBusy(true);
        try {
          const repo = await renameRepository(ctx.owner(), ctx.name(), next);
          toast('Repository renamed', 'success');
          navigate(`/${repo.full_name}/settings`);
        } catch (err) {
          toastError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label for="rename-field">Repository name</label>
      <div class="flex gap-2 items-center">
        <input
          id="rename-field"
          class="form-control max-w-[300px]"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          autocomplete="off"
          spellcheck="false"
        />
        <button type="submit" class="btn" disabled={busy() || !name().trim() || name().trim() === ctx.repo().name}>
          {busy() ? 'Renaming…' : 'Rename'}
        </button>
      </div>
    </form>
  );
}

function DefaultBranch(props: { save: (patch: Partial<RepoSettings>) => Promise<unknown> }) {
  const ctx = useRepo();
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <p class="text-sm text-fg-muted mb-2">
        The default branch is considered the “base” branch in your repository, against which all pull requests and code commits
        are automatically made, unless you specify a different branch.
      </p>
      <div class="Box">
        <div class="Box-row flex items-center gap-2">
          <Octicon icon={gitBranchIcon} class="text-fg-muted" />
          <code class="font-mono text-sm flex-1">{ctx.repo().default_branch}</code>
          <a class="btn-octicon" href={`${ctx.base()}/branches`} aria-label="Rename branch" title="Rename branch">
            <Octicon icon={pencilIcon} />
          </a>
          <button type="button" class="btn-octicon" aria-label="Switch to another branch" title="Switch to another branch" onClick={() => setOpen(true)}>
            <Octicon icon={arrowSwitchIcon} />
          </button>
        </div>
      </div>
      <Dialog open={open()} onClose={() => setOpen(false)} title="Switch default branch to another branch" width="440px">
        <Show when={open()}>
          <SwitchBranchForm save={props.save} onDone={() => setOpen(false)} />
        </Show>
      </Dialog>
    </>
  );
}

function SwitchBranchForm(props: { save: (patch: Partial<RepoSettings>) => Promise<unknown>; onDone: () => void }) {
  const ctx = useRepo();
  const branches = createMemo(() => getBranchNames(ctx.owner(), ctx.name()));
  const [choice, setChoice] = createSignal(() => ctx.repo().default_branch);
  const [busy, setBusy] = createSignal(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await props.save({ default_branch: choice() });
          props.onDone();
        } catch (err) {
          toastError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p class="text-sm mb-3">
        Choose another branch to use as the default branch of {ctx.fullName()} instead of{' '}
        <code class="font-mono">{ctx.repo().default_branch}</code>.
      </p>
      <Loading fallback={<Spinner size={20} />}>
        <select class="form-select" value={choice()} onChange={(e) => setChoice(e.currentTarget.value)}>
          <For each={branches()}>{(b) => <option value={b}>{b}</option>}</For>
        </select>
      </Loading>
      <p class="flash flash-warn mt-3 text-sm">
        Changing your default branch can have unintended consequences that can affect new pull requests and clones.
      </p>
      <button type="submit" class="btn btn-danger btn-block mt-3" disabled={busy() || choice() === ctx.repo().default_branch}>
        {busy() ? 'Updating…' : 'Update'}
      </button>
    </form>
  );
}

function DangerZone(props: { save: (patch: Partial<RepoSettings>) => Promise<unknown> }) {
  const ctx = useRepo();
  const navigate = useNavigate();
  const [dialog, setDialog] = createSignal<null | 'visibility' | 'transfer' | 'archive' | 'delete'>(null);
  const instantDelete = useInstantDelete();
  // quick-repo-deletion: "Delete fork" links here with a hash that opens the dialog, name pre-filled.
  const [prefillDelete, setPrefillDelete] = createSignal(false);
  onSettled(() => {
    if (location.hash !== DELETE_HASH || !feature('quick-repo-deletion')) return;
    history.replaceState(history.state, '', location.pathname + location.search);
    setPrefillDelete(true);
    setDialog('delete');
  });
  const close = () => setDialog(null);
  const isPublic = () => !ctx.repo().private;
  const [newOwner, setNewOwner] = createSignal('');
  const [newName, setNewName] = createSignal(() => ctx.repo().name);
  const transfer = async () => {
    if (!newOwner().trim()) throw new Error('Enter the new owner');
    await transferRepository(ctx.owner(), ctx.name(), newOwner().trim(), newName().trim());
    toast('Repository transfer started', 'success');
    navigate(`/${newOwner().trim()}/${newName().trim() || ctx.name()}`);
  };
  const remove = async () => {
    await deleteRepository(ctx.owner(), ctx.name());
    toast(`Your repository "${ctx.fullName()}" was successfully deleted.`, 'success');
    navigate('/');
  };

  return (
    <>
      <SectionHeading class="mt-10">Danger Zone</SectionHeading>
      <div class="Box Box--danger">
        <DangerRow
          title="Change repository visibility"
          description={`This repository is currently ${ctx.repo().visibility ?? (isPublic() ? 'public' : 'private')}.`}
          button={
            <button type="button" class="btn btn-danger" disabled={ctx.repo().fork && isPublic()} onClick={() => setDialog('visibility')}>
              Change visibility
            </button>
          }
        />
        <DangerRow
          title="Transfer ownership"
          description="Transfer this repository to another user or to an organization where you have the ability to create repositories."
          button={
            <button type="button" class="btn btn-danger" onClick={() => setDialog('transfer')}>
              Transfer
            </button>
          }
        />
        <DangerRow
          title={ctx.repo().archived ? 'Unarchive this repository' : 'Archive this repository'}
          description={ctx.repo().archived ? 'Mark this repository as unarchived and read-write.' : 'Mark this repository as archived and read-only.'}
          button={
            <button type="button" class="btn btn-danger" onClick={() => setDialog('archive')}>
              {ctx.repo().archived ? 'Unarchive this repository' : 'Archive this repository'}
            </button>
          }
        />
        <DangerRow
          title="Delete this repository"
          description="Once you delete a repository, there is no going back. Please be certain."
          button={
            <button
              type="button"
              class="btn btn-danger"
              title={feature('quick-repo-deletion') ? QUICK_DELETE_TITLE : undefined}
              onClick={async (e) => {
                if (await instantDelete(e, ctx.repo())) return;
                setPrefillDelete(false);
                setDialog('delete');
              }}
            >
              Delete this repository
            </button>
          }
        />
      </div>

      <ConfirmDialog
        open={dialog() === 'visibility'}
        onClose={close}
        title={`Change to ${isPublic() ? 'private' : 'public'}`}
        confirmText={ctx.fullName()}
        button={`I want to make this repository ${isPublic() ? 'private' : 'public'}`}
        onConfirm={() => props.save({ visibility: isPublic() ? 'private' : 'public' })}
      >
        <Show
          when={isPublic()}
          fallback={<p>The code will be visible to everyone who can visit github.com. Anyone can fork your repository.</p>}
        >
          <p>
            Making this repository private will remove all stars and watchers, and detach public forks from this repository’s
            fork network.
          </p>
        </Show>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog() === 'archive'}
        onClose={close}
        title={ctx.repo().archived ? 'Unarchive repository' : 'Archive repository'}
        confirmText={ctx.fullName()}
        button={ctx.repo().archived ? 'I understand, unarchive this repository' : 'I understand, archive this repository'}
        onConfirm={() => props.save({ archived: !ctx.repo().archived })}
      >
        <p>
          {ctx.repo().archived
            ? 'This will make the repository writable again.'
            : 'This repository will become read-only. You will still be able to fork the repository and unarchive it at any time.'}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog() === 'transfer'}
        onClose={close}
        title="Transfer repository"
        confirmText={ctx.fullName()}
        button="I understand, transfer this repository."
        onConfirm={transfer}
      >
        <div class="form-group mt-0!">
          <label for="transfer-owner">New owner</label>
          <input id="transfer-owner" class="form-control" placeholder="username or organization" value={newOwner()} onInput={(e) => setNewOwner(e.currentTarget.value)} />
        </div>
        <div class="form-group">
          <label for="transfer-name">Repository name</label>
          <input id="transfer-name" class="form-control" value={newName()} onInput={(e) => setNewName(e.currentTarget.value)} />
        </div>
        <p class="note">Transferring to a user requires them to accept the transfer by email.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog() === 'delete'}
        onClose={close}
        title={`Delete ${ctx.fullName()}`}
        confirmText={ctx.fullName()}
        prefill={prefillDelete() ? ctx.fullName() : undefined}
        button="Delete this repository"
        onConfirm={remove}
      >
        <p class="flash flash-warn">
          <span>
            This will permanently delete the <strong>{ctx.fullName()}</strong> repository, wiki, issues, comments, packages,
            secrets, workflow runs, and remove all collaborator associations.
          </span>
        </p>
        <ForkPullsDeleteWarning repo={ctx.repo()} />
      </ConfirmDialog>
    </>
  );
}
