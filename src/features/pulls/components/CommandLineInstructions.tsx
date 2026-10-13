import { For, Show } from 'solid-js';
import { CopyButton } from '../../../components/ui';
import type { PullDetail } from '../../issues/types';

interface Step {
  title: string;
  commands?: string[];
  note?: boolean;
}

/** github.com's "View command line instructions" block, for this PR's head and base. */
export default function CommandLineInstructions(props: { owner: string; repo: string; pull: PullDetail; conflicting: boolean }) {
  const steps = (): Step[] => {
    const p = props.pull;
    const base = p.baseRefName;
    const head = p.headRefName;
    const forkOwner = p.headRepositoryOwner?.login ?? props.owner;
    const forkUrl = `https://github.com/${p.headRepository?.nameWithOwner ?? `${props.owner}/${props.repo}`}.git`;
    if (props.conflicting) {
      return [
        { title: 'Clone the repository or update your local repository with the latest changes.', commands: [`git pull origin ${base}`] },
        p.isCrossRepository
          ? { title: 'Check out the head branch of the pull request (from the fork).', commands: [`gh pr checkout ${p.number}`] }
          : { title: 'Switch to the head branch of the pull request.', commands: [`git checkout ${head}`] },
        { title: 'Merge the base branch into the head branch.', commands: [`git merge ${base}`] },
        { title: 'Fix the conflicts and commit the result.', note: true },
        { title: 'Push the changes.', commands: [p.isCrossRepository ? 'git push' : `git push -u origin ${head}`] },
      ];
    }
    const local = p.isCrossRepository ? `${forkOwner}-${head}` : head;
    return [
      {
        title: 'From your project repository, check out a new branch and test the changes.',
        commands: p.isCrossRepository
          ? [`git checkout -b ${local} ${base}`, `git pull ${forkUrl} ${head}`]
          : ['git fetch origin', `git checkout -b ${local} origin/${head}`, `git merge ${base}`],
      },
      { title: 'Merge the changes and update on GitHub.', commands: [`git checkout ${base}`, `git merge --no-ff ${local}`, `git push origin ${base}`] },
    ];
  };
  return (
    <div class="MergeBox-cli">
      <h4 class="font-semibold text-sm mb-1">{props.conflicting ? 'Resolve conflicts on the command line' : 'Merging via command line'}</h4>
      <p class="text-xs text-fg-muted mb-3">
        If you do not want to use the merge button or an automatic merge cannot be performed, you can perform a manual merge on the command line.
      </p>
      <ol class="flex flex-col gap-3">
        <For each={steps()}>
          {(s, i) => (
            <li>
              <div class="text-sm">
                <strong>Step {i() + 1}:</strong> {s.title}
              </div>
              <Show when={s.note}>
                <p class="text-xs text-fg-muted mt-1">
                  See{' '}
                  <a
                    href="https://docs.github.com/pull-requests/collaborating-with-pull-requests/addressing-merge-conflicts/resolving-a-merge-conflict-using-the-command-line"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Resolving a merge conflict using the command line
                  </a>{' '}
                  for step-by-step instructions on resolving merge conflicts.
                </p>
              </Show>
              <Show when={s.commands}>
                {(cmds) => (
                  <div class="MergeBox-cmd">
                    <pre>{cmds().join('\n')}</pre>
                    <CopyButton value={cmds().join('\n')} class="btn-octicon w-7! h-7! shrink-0" label="Copy commands" />
                  </div>
                )}
              </Show>
            </li>
          )}
        </For>
      </ol>
      <Show when={!(props.conflicting && props.pull.isCrossRepository)}>
        <p class="text-xs text-fg-muted mt-3">
          Tip: with the GitHub CLI, <code class="font-mono">gh pr checkout {props.pull.number}</code> checks out this pull request’s branch.
        </p>
      </Show>
    </div>
  );
}
