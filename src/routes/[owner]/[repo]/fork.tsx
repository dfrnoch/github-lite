import { Title } from '@solidjs/meta';
import { useNavigate } from '@solidjs/router';
import { createMemo, createSignal, Show } from 'solid-js';
import { toast, toastError } from '../../../components/ui';
import { feature } from '../../../features/refined';
import { createFork, disableProjectsAndWiki, getOrgMemberships } from '../../../features/repo-settings/api';
import { DisableProjectsAndWikis } from '../../../features/repo-settings/components/ui';
import OwnerName, { normalizeRepoName, type OwnerOption } from '../../../features/repo-settings/components/OwnerName';
import { useRepo } from '../../../features/repo/context';
import { getViewer } from '../../../features/user/api';
import { gh } from '../../../lib/github';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** /:owner/:repo/fork — create a fork. */
export default function ForkPage() {
  const ctx = useRepo();
  const navigate = useNavigate();
  const viewer = createMemo(() => getViewer());
  const memberships = createMemo(() => getOrgMemberships());
  const owners = createMemo<OwnerOption[]>(() => [
    { login: viewer().login, avatar_url: viewer().avatar_url, isViewer: true },
    ...memberships().map((m) => ({ login: m.organization.login, avatar_url: m.organization.avatar_url, isViewer: false, role: m.role })),
  ]);
  const [owner, setOwner] = createSignal(() => viewer().login);
  const [name, setName] = createSignal(() => ctx.repo().name);
  const [description, setDescription] = createSignal(() => ctx.repo().description ?? '');
  const [defaultOnly, setDefaultOnly] = createSignal(true);
  const [available, setAvailable] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal<string | null>(null);
  const [noProjects, setNoProjects] = createSignal(true);
  const isViewer = () => owner() === viewer().login;
  const canSubmit = () => !busy() && available() === `${owner()}/${normalizeRepoName(name())}`;

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!canSubmit()) return;
    setBusy('Forking…');
    try {
      const fork = await createFork(ctx.owner(), ctx.name(), {
        organization: isViewer() ? undefined : owner(),
        name: normalizeRepoName(name()),
        defaultBranchOnly: defaultOnly(),
      });
      if (description().trim() !== (ctx.repo().description ?? '')) {
        await gh(`/repos/${fork.full_name}`, { method: 'PATCH', body: { description: description().trim() } }).catch(() => {});
      }
      // Forks are created asynchronously: wait (briefly) until the git data is there.
      setBusy('Waiting for the fork to be ready…');
      for (let i = 0; i < 10; i++) {
        try {
          await gh(`/repos/${fork.full_name}/commits`, { query: { per_page: 1 } });
          break;
        } catch {
          await sleep(1500);
        }
      }
      if (feature('new-repo-disable-projects-and-wikis') && noProjects()) {
        await disableProjectsAndWiki(fork.full_name).catch(() => {});
      }
      toast(`Forked ${ctx.fullName()} to ${fork.full_name}`, 'success');
      navigate(`/${fork.full_name}`);
    } catch (err) {
      toastError(err);
      setBusy(null);
    }
  };

  return (
    <div class="max-w-[768px] mx-auto px-4 py-8">
      <Title>{`Create a new fork · ${ctx.fullName()}`}</Title>
      <form onSubmit={submit}>
        <div class="pb-4 mb-4 border-b border-line-muted">
          <h1 class="text-2xl font-normal">Create a new fork</h1>
          <p class="text-sm text-fg-muted mt-1">
            A <em>fork</em> is a copy of a repository. Forking a repository allows you to freely experiment with changes
            without affecting the original project.{' '}
            <a href={`${ctx.base()}/forks`}>View existing forks.</a>
          </p>
        </div>
        <p class="text-sm italic text-fg-muted mb-4">Required fields are marked with an asterisk (*).</p>
        <OwnerName
          owners={owners()}
          owner={owner()}
          onOwner={setOwner}
          name={name()}
          onName={setName}
          onAvailable={setAvailable}
        />
        <p class="text-sm text-fg-muted mt-2">
          By default, forks are named the same as their upstream repository. You can customize the name to distinguish it
          further.
        </p>
        <div class="form-group">
          <label for="fork-description">
            Description <span class="font-normal text-fg-muted">(optional)</span>
          </label>
          <input id="fork-description" class="form-control" value={description()} onInput={(e) => setDescription(e.currentTarget.value)} />
        </div>
        <label class="flex items-start gap-2 text-sm border-t border-line-muted pt-4">
          <input type="checkbox" class="mt-1" checked={defaultOnly()} onChange={(e) => setDefaultOnly(e.currentTarget.checked)} />
          <span>
            <strong>
              Copy the <code class="font-mono">{ctx.repo().default_branch}</code> branch only
            </strong>
            <span class="note">Contribute back to {ctx.fullName()} by adding your own branch.</span>
          </span>
        </label>
        <div class="border-t border-line-muted pt-4 mt-4">
          <Show when={feature('new-repo-disable-projects-and-wikis')}>
            <DisableProjectsAndWikis checked={noProjects()} onChange={setNoProjects} />
          </Show>
          <p class="text-sm text-fg-muted mb-4">
            You are creating a fork in {isViewer() ? 'your personal account' : `the ${owner()} organization`}.
          </p>
          <button type="submit" class="btn btn-primary" disabled={!canSubmit()}>
            {busy() ?? 'Create fork'}
          </button>
          <Show when={ctx.repo().allow_forking === false}>
            <p class="flash flash-warn mt-3 text-sm">Forking is disabled for this repository.</p>
          </Show>
        </div>
      </form>
    </div>
  );
}
