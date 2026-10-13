import { useNavigate } from '@solidjs/router';
import { createMemo, Errored, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { toast, toastError } from '../../../components/ui';
import { trashIcon } from '../../../icons/octicons';
import type { Repository } from '../../../lib/types';
import { feature } from '../../refined';
import { deleteRepository } from '../../repo-settings/api';
import { getViewer } from '../../user/api';
import { getForkOpenPulls } from '../api';

/** Hash that opens the delete dialog on /settings with the name pre-filled (quick-repo-deletion). */
export const DELETE_HASH = '#dialog-show-repo-delete-menu-dialog';

export const QUICK_DELETE_TITLE = 'Instant deletion via alt+click';

/**
 * quick-repo-deletion: alt+click deletes after a single confirm(). Returns
 * true when it handled the click.
 */
export function useInstantDelete() {
  const navigate = useNavigate();
  return async (e: MouseEvent, repo: Repository) => {
    if (!e.altKey || !feature('quick-repo-deletion')) return false;
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`⚠️ ${repo.full_name} ⚠️ will be deleted. Are you sure?`)) return true;
    try {
      toast('Deleting repo…');
      await deleteRepository(repo.owner.login, repo.name);
      toast(`Repository ${repo.full_name} deleted. You can restore it from your GitHub settings.`, 'success', 8000);
      navigate(repo.parent ? `/${repo.parent.full_name}` : `/${repo.owner.login}?tab=repositories`);
    } catch (err) {
      toastError(err);
    }
    return true;
  };
}

/** "Delete fork" on the home of an un-starred fork the viewer administers. */
export function DeleteForkButton(props: { repo: Repository }) {
  const instantDelete = useInstantDelete();
  return (
    <Show when={feature('quick-repo-deletion') && props.repo.fork && props.repo.permissions?.admin && props.repo.stargazers_count === 0}>
      <a
        class="btn btn-sm btn-danger"
        href={`/${props.repo.full_name}/settings${DELETE_HASH}`}
        title={QUICK_DELETE_TITLE}
        onClick={(e) => void instantDelete(e, props.repo)}
      >
        <Octicon icon={trashIcon} />
        Delete fork
      </a>
    </Show>
  );
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many.replace('$$', String(n)));

function useForkPulls(repo: () => Repository) {
  const viewer = createMemo(() => getViewer());
  return createMemo(() =>
    repo().parent ? getForkOpenPulls(repo().parent!.full_name, repo().full_name, viewer().login) : { count: 0, href: '' },
  );
}

const enabledFor = (repo: Repository) => feature('show-open-prs-of-forks') && repo.fork && !!repo.parent && !!repo.permissions?.admin;

/** show-open-prs-of-forks: " with 2 open pull requests" after "forked from owner/repo". */
export function ForkPullsHint(props: { repo: Repository }) {
  return (
    <Show when={enabledFor(props.repo)}>
      <Errored fallback={null}>
        <Loading>
          <ForkPullsHintInner repo={props.repo} />
        </Loading>
      </Errored>
    </Show>
  );
}

function ForkPullsHintInner(props: { repo: Repository }) {
  const pulls = useForkPulls(() => props.repo);
  return (
    <Show when={pulls().count}>
      {' '}
      with <a href={pulls().href}>{plural(pulls().count, 'one open pull request', '$$ open pull requests')}</a>
    </Show>
  );
}

/** show-open-prs-of-forks: warning in the delete dialog of a fork with open PRs. */
export function ForkPullsDeleteWarning(props: { repo: Repository }) {
  return (
    <Show when={enabledFor(props.repo)}>
      <Errored fallback={null}>
        <Loading>
          <ForkPullsDeleteWarningInner repo={props.repo} />
        </Loading>
      </Errored>
    </Show>
  );
}

function ForkPullsDeleteWarningInner(props: { repo: Repository }) {
  const pulls = useForkPulls(() => props.repo);
  return (
    <Show when={pulls().count}>
      <p class="flash flash-warn mt-3">
        <span>
          It will also close your <a href={pulls().href}>{plural(pulls().count, 'open pull request', '$$ open pull requests')}</a> in{' '}
          <strong>{props.repo.parent!.full_name}</strong>.
        </span>
      </p>
    </Show>
  );
}
