import { useParams } from '@solidjs/router';
import { createMemo, Show } from 'solid-js';
import { Blankslate } from '../../../../../components/ui';
import CommitList from '../../../../../features/code/components/CommitList';
import { getPullCommits } from '../../../../../features/code/pullApi';
import { useRepo } from '../../../../../features/repo/context';
import { gitCommitIcon } from '../../../../../icons/octicons';

/** /:owner/:repo/pull/:number/commits — the PR's commits grouped by day. */
export default function PullCommitsTab() {
  const ctx = useRepo();
  const params = useParams<{ number: string }>();
  const commits = createMemo(() => getPullCommits(ctx.owner(), ctx.name(), Number(params.number)));
  return (
    <Show when={commits().length} fallback={<Blankslate icon={gitCommitIcon} title="No commits" class="Box" />}>
      <CommitList commits={commits()} base={ctx.base()} />
      <Show when={commits().length >= 250}>
        <p class="text-sm text-fg-muted text-center my-4">
          This pull request is big! Only the first 250 commits are shown.
        </p>
      </Show>
    </Show>
  );
}
