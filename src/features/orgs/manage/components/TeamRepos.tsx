import { Title } from '@solidjs/meta';
import { useAction, useLocation, useSearchParams } from '@solidjs/router';
import { createMemo, createOptimistic, createSignal, For, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Blankslate, Dialog, Pagination, pageHref, toast, toastError } from '../../../../components/ui';
import { repoIcon } from '../../../../icons/octicons';
import { formatNumber } from '../../../../lib/format';
import { ROLES } from '../../../repo-settings/components/ui';
import { getTeam, getTeamRepos, removeTeamRepo, setTeamRepo, type TeamRepo } from '../api';

const labelOf = (perm: string) => ROLES.find((r) => r.value === perm)?.label ?? perm;

/** /orgs/:org/teams/:team/repositories */
export default function TeamRepos(props: { org: string; slug: string }) {
  const [sp] = useSearchParams<{ page?: string }>();
  const location = useLocation();
  const page = () => Math.max(1, Number(sp.page) || 1);
  const team = createMemo(() => getTeam(props.org, props.slug));
  const repos = createMemo(() => getTeamRepos(props.org, props.slug, page()));
  const [adding, setAdding] = createSignal(false);

  return (
    <>
      <Title>{`Repositories · ${team().name} · ${props.org}`}</Title>
      <div class="Box">
        <div class="Box-header py-3! flex items-center gap-2">
          <span class="text-sm font-semibold flex-1">
            {formatNumber(team().repositories)} {team().repositories === 1 ? 'repository' : 'repositories'}
          </span>
          <Show when={team().viewerCanAdminister}>
            <button type="button" class="btn btn-sm btn-primary" onClick={() => setAdding(true)}>
              Add repository
            </button>
          </Show>
        </div>
        <ul>
          <For
            each={repos().items}
            fallback={
              <li class="Box-row">
                <Blankslate icon={repoIcon} title="This team doesn’t have access to any repositories">
                  Give the team access to repositories to grant all of its members the same permission.
                </Blankslate>
              </li>
            }
          >
            {(r) => <RepoRow org={props.org} slug={props.slug} repo={r} canAdmin={team().viewerCanAdminister} />}
          </For>
        </ul>
      </div>
      <Pagination pageInfo={repos().pageInfo} href={(p) => pageHref(location, p)} />
      <Show when={adding()}>
        <AddRepoDialog org={props.org} slug={props.slug} teamName={team().name} open={adding()} onClose={() => setAdding(false)} />
      </Show>
    </>
  );
}

function PermissionSelect(props: { value: string; disabled?: boolean; onChange: (v: string, el: HTMLSelectElement) => void; id?: string; class?: string }) {
  return (
    <select
      id={props.id}
      class={['form-select', props.class]}
      aria-label="Permission"
      disabled={props.disabled}
      onChange={(e) => props.onChange(e.currentTarget.value, e.currentTarget)}
    >
      <For each={ROLES}>
        {(r) => (
          <option value={r.value} selected={props.value === r.value}>
            {r.label}
          </option>
        )}
      </For>
      <Show when={!ROLES.some((r) => r.value === props.value)}>
        <option value={props.value} selected>
          {props.value}
        </option>
      </Show>
    </select>
  );
}

function RepoRow(props: { org: string; slug: string; repo: TeamRepo; canAdmin: boolean }) {
  const set = useAction(setTeamRepo);
  const remove = useAction(removeTeamRepo);
  const [busy, setBusy] = createOptimistic(false);
  const change = async (permission: string, el?: HTMLSelectElement) => {
    setBusy(true);
    try {
      await set(props.org, props.slug, props.repo.full_name, permission);
      toast(`Team now has ${labelOf(permission)} access to ${props.repo.name}`, 'success');
    } catch (e) {
      if (el) el.value = props.repo.permission;
      toastError(e);
    }
  };
  const doRemove = async () => {
    if (!confirm(`Remove ${props.repo.full_name} from this team? Members lose the access the team granted.`)) return;
    setBusy(true);
    try {
      await remove(props.org, props.slug, props.repo.full_name);
      toast(`Removed ${props.repo.name} from the team`, 'success');
    } catch (e) {
      toastError(e);
    }
  };
  return (
    <li class={['Box-row flex items-center gap-3', { 'opacity-60': busy() }]}>
      <Octicon icon={repoIcon} class="text-fg-muted shrink-0" />
      <div class="flex-1 min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <a class="font-semibold break-all" href={`/${props.repo.full_name}`}>
            {props.repo.owner === props.org ? props.repo.name : props.repo.full_name}
          </a>
          <span class="Label">
            {props.repo.visibility === 'internal' ? 'Internal' : props.repo.private ? 'Private' : 'Public'}
            {props.repo.archived ? ' archive' : ''}
          </span>
        </div>
        <Show when={props.repo.description}>
          <p class="text-sm text-fg-muted truncate">{props.repo.description}</p>
        </Show>
      </div>
      <Show when={props.canAdmin} fallback={<span class="text-sm text-fg-muted">{labelOf(props.repo.permission)}</span>}>
        <PermissionSelect
          class="w-[130px]! form-control-sm"
          value={props.repo.permission}
          disabled={busy()}
          onChange={(v, el) => void change(v, el)}
        />
        <button type="button" class="btn btn-sm btn-danger" disabled={busy()} onClick={() => void doRemove()}>
          Remove
        </button>
      </Show>
    </li>
  );
}

function AddRepoDialog(props: { org: string; slug: string; teamName: string; open: boolean; onClose: () => void }) {
  const add = useAction(setTeamRepo);
  const [name, setName] = createSignal('');
  const [permission, setPermission] = createSignal('pull');
  const [busy, setBusy] = createOptimistic(false);
  const fullName = () => {
    const v = name().trim().replace(/^https?:\/\/[^/]+\//, '').replace(/\/+$/, '');
    return v.includes('/') ? v : v ? `${props.org}/${v}` : '';
  };
  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!fullName()) return;
    setBusy(true);
    try {
      await add(props.org, props.slug, fullName(), permission());
      toast(`Added ${fullName()} to ${props.teamName}`, 'success');
      props.onClose();
    } catch (err) {
      toastError(err);
    }
  };
  return (
    <Dialog open={props.open} onClose={props.onClose} title={`Add a repository to ${props.teamName}`} width="480px">
      <form onSubmit={submit}>
        <div class="form-group mt-0!">
          <label for="team-add-repo">Repository</label>
          <input
            id="team-add-repo"
            class="form-control"
            placeholder={`repository-name or ${props.org}/repository-name`}
            autocomplete="off"
            autofocus
            required
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
          <Show when={fullName()}>
            <p class="note">
              Adds <strong>{fullName()}</strong>
            </p>
          </Show>
        </div>
        <div class="form-group">
          <label for="team-add-perm">Permission</label>
          <PermissionSelect id="team-add-perm" value={permission()} onChange={(v) => setPermission(v)} />
          <p class="note">{ROLES.find((r) => r.value === permission())?.description}</p>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="btn" onClick={() => props.onClose()}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={busy() || !fullName()}>
            {busy() ? 'Adding…' : 'Add repository'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
