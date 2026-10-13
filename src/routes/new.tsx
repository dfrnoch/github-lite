import { Title } from '@solidjs/meta';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../components/Octicon';
import { Dropdown, Spinner, toast, toastError } from '../components/ui';
import {
  createRepository,
  getGitignoreTemplates,
  getLicenses,
  getOrgMemberships,
  getTemplateRepos,
} from '../features/repo-settings/api';
import OwnerName, { normalizeRepoName, type OwnerOption } from '../features/repo-settings/components/OwnerName';
import { getViewer } from '../features/user/api';
import { checkIcon, lockIcon, organizationIcon, repoIcon, repoTemplateIcon, triangleDownIcon } from '../icons/octicons';

/** /new — create a repository (optionally from a template). */
export default function NewRepository() {
  const [search] = useSearchParams<{ owner?: string; template_owner?: string; template_name?: string; name?: string }>();
  const navigate = useNavigate();
  const viewer = createMemo(() => getViewer());
  const memberships = createMemo(() => getOrgMemberships());
  const templates = createMemo(() => getTemplateRepos());
  const gitignores = createMemo(() => getGitignoreTemplates());
  const licenses = createMemo(() => getLicenses());

  const owners = createMemo<OwnerOption[]>(() => [
    { login: viewer().login, avatar_url: viewer().avatar_url, isViewer: true },
    ...memberships().map((m) => ({
      login: m.organization.login,
      avatar_url: m.organization.avatar_url,
      isViewer: false,
      role: m.role,
    })),
  ]);

  const [owner, setOwner] = createSignal(() => search.owner ?? viewer().login);
  const [name, setName] = createSignal(() => search.name ?? '');
  const [available, setAvailable] = createSignal<string | null>(null);
  const [description, setDescription] = createSignal('');
  const [visibility, setVisibility] = createSignal<'public' | 'private' | 'internal'>('public');
  const [template, setTemplate] = createSignal(() =>
    search.template_owner && search.template_name ? `${search.template_owner}/${search.template_name}` : '',
  );
  const [allBranches, setAllBranches] = createSignal(false);
  const [readme, setReadme] = createSignal(false);
  const [gitignore, setGitignore] = createSignal('');
  const [license, setLicense] = createSignal('');
  const [busy, setBusy] = createSignal(false);

  const isViewer = () => owner() === viewer().login;
  const canSubmit = () => !busy() && !!name().trim() && available() === `${owner()}/${normalizeRepoName(name())}`;

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!canSubmit()) return;
    setBusy(true);
    try {
      const repo = await createRepository({
        owner: owner(),
        isViewer: isViewer(),
        name: normalizeRepoName(name()),
        description: description().trim(),
        visibility: visibility(),
        template: template() || undefined,
        includeAllBranches: allBranches(),
        autoInit: readme(),
        gitignore: gitignore(),
        license: license(),
      });
      toast(`Created ${repo.full_name}`, 'success');
      navigate(`/${repo.full_name}`);
    } catch (err) {
      toastError(err);
      setBusy(false);
    }
  };

  return (
    <div class="max-w-[768px] mx-auto px-4 py-8">
      <Title>New repository</Title>
      <form onSubmit={submit}>
        <div class="pb-4 mb-4 border-b border-line-muted">
          <h1 class="text-2xl font-normal">Create a new repository</h1>
          <p class="text-sm text-fg-muted mt-1">
            A repository contains all project files, including the revision history. Already have a project repository
            elsewhere? <a href="https://github.com/new/import">Import a repository.</a>
          </p>
        </div>
        <p class="text-sm italic text-fg-muted mb-4">Required fields are marked with an asterisk (*).</p>

        <div class="mb-4">
          <span class="form-label">Repository template</span>
          <Loading fallback={<Spinner size={16} />}>
            <Dropdown
              class="btn"
              menuClass="w-80 max-h-80 overflow-auto"
              header="Choose a template"
              button={
                <>
                  <Octicon icon={repoTemplateIcon} />
                  <span>{template() || 'No template'}</span>
                  <Octicon icon={triangleDownIcon} />
                </>
              }
            >
              {(close) => (
                <>
                  <button
                    type="button"
                    class="SelectMenu-item"
                    onClick={() => {
                      setTemplate('');
                      close();
                    }}
                  >
                    <span class="w-4">
                      <Show when={!template()}>
                        <Octicon icon={checkIcon} />
                      </Show>
                    </span>
                    No template
                  </button>
                  <For each={templates()}>
                    {(t) => (
                      <button
                        type="button"
                        class="SelectMenu-item items-start!"
                        onClick={() => {
                          setTemplate(t.nameWithOwner);
                          close();
                        }}
                      >
                        <span class="w-4">
                          <Show when={template() === t.nameWithOwner}>
                            <Octicon icon={checkIcon} />
                          </Show>
                        </span>
                        <span class="min-w-0">
                          <span class="block font-semibold">{t.nameWithOwner}</span>
                          <Show when={t.description}>
                            <span class="block text-xs text-fg-muted truncate">{t.description}</span>
                          </Show>
                        </span>
                      </button>
                    )}
                  </For>
                </>
              )}
            </Dropdown>
          </Loading>
          <p class="note">Start your repository with a template repository’s contents.</p>
          <Show when={template()}>
            <label class="flex items-center gap-2 text-sm mt-2">
              <input type="checkbox" checked={allBranches()} onChange={(e) => setAllBranches(e.currentTarget.checked)} />
              Include all branches
            </label>
          </Show>
        </div>

        <OwnerName
          owners={owners()}
          owner={owner()}
          onOwner={(o) => {
            setOwner(o);
            if (o === viewer().login && visibility() === 'internal') setVisibility('private');
          }}
          name={name()}
          onName={setName}
          onAvailable={setAvailable}
        />
        <p class="text-sm text-fg-muted mt-2">
          Great repository names are short and memorable. Need inspiration? How about{' '}
          <strong class="text-fg-success">{SUGGESTIONS[new Date().getMinutes() % SUGGESTIONS.length]}</strong>?
        </p>

        <div class="form-group">
          <label for="repo-description">
            Description <span class="font-normal text-fg-muted">(optional)</span>
          </label>
          <input id="repo-description" class="form-control" value={description()} onInput={(e) => setDescription(e.currentTarget.value)} />
        </div>

        <div class="border-t border-line-muted pt-4 mt-4">
          <VisibilityOption
            value="public"
            current={visibility()}
            onChange={setVisibility}
            icon={repoIcon}
            title="Public"
            description="Anyone on the internet can see this repository. You choose who can commit."
          />
          <Show when={!isViewer()}>
            <VisibilityOption
              value="internal"
              current={visibility()}
              onChange={setVisibility}
              icon={organizationIcon}
              title="Internal"
              description={`Members of the enterprise that owns ${owner()} can see this repository. You choose who can commit.`}
            />
          </Show>
          <VisibilityOption
            value="private"
            current={visibility()}
            onChange={setVisibility}
            icon={lockIcon}
            title="Private"
            description="You choose who can see and commit to this repository."
          />
        </div>

        <Show when={!template()}>
          <div class="border-t border-line-muted pt-4 mt-4">
            <h2 class="text-base font-semibold">Initialize this repository with:</h2>
            <label class="flex items-start gap-2 mt-3 text-sm">
              <input type="checkbox" class="mt-1" checked={readme()} onChange={(e) => setReadme(e.currentTarget.checked)} />
              <span>
                <strong>Add a README file</strong>
                <span class="note">This is where you can write a long description for your project.</span>
              </span>
            </label>
            <Loading fallback={<Spinner size={16} />}>
              <div class="mt-4">
                <span class="form-label">Add .gitignore</span>
                <select class="form-select w-auto!" aria-label=".gitignore template" value={gitignore()} onChange={(e) => setGitignore(e.currentTarget.value)}>
                  <option value="">.gitignore template: None</option>
                  <For each={gitignores()}>{(g) => <option value={g}>{g}</option>}</For>
                </select>
                <p class="note">Choose which files not to track from a list of templates.</p>
              </div>
              <div class="mt-4">
                <span class="form-label">Choose a license</span>
                <select class="form-select w-auto!" aria-label="License" value={license()} onChange={(e) => setLicense(e.currentTarget.value)}>
                  <option value="">License: None</option>
                  <For each={licenses()}>{(l) => <option value={l.key}>{l.name}</option>}</For>
                </select>
                <p class="note">A license tells others what they can and can't do with your code.</p>
              </div>
            </Loading>
            <Show when={readme() || gitignore() || license()}>
              <p class="text-sm mt-3">
                This will set <code class="font-mono">main</code> as the default branch.
              </p>
            </Show>
          </div>
        </Show>

        <div class="border-t border-line-muted pt-4 mt-4">
          <p class="text-sm text-fg-muted mb-4">
            You are creating a {visibility()} repository in {isViewer() ? 'your personal account' : `the ${owner()} organization`}.
          </p>
          <button type="submit" class="btn btn-primary" disabled={!canSubmit()}>
            {busy() ? 'Creating repository…' : 'Create repository'}
          </button>
        </div>
      </form>
    </div>
  );
}

const SUGGESTIONS = ['super-duper-octo-lamp', 'fluffy-fiesta', 'curly-umbrella', 'ubiquitous-waffle', 'scaling-garbanzo', 'reimagined-spoon'];

function VisibilityOption(props: {
  value: 'public' | 'private' | 'internal';
  current: string;
  onChange: (v: 'public' | 'private' | 'internal') => void;
  icon: typeof repoIcon;
  title: string;
  description: string;
}) {
  return (
    <label class="flex items-start gap-3 py-2 text-sm cursor-pointer">
      <input type="radio" name="visibility" class="mt-2" checked={props.current === props.value} onChange={() => props.onChange(props.value)} />
      <Octicon icon={props.icon} size={24} class="text-fg-muted mt-0.5" />
      <span>
        <strong class="block">{props.title}</strong>
        <span class="text-xs text-fg-muted">{props.description}</span>
      </span>
    </label>
  );
}
