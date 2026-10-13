import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createMemo, Show } from 'solid-js';
import Octicon from '../../../../../../components/Octicon';
import { getCommit } from '../../../../../../features/code/api';
import CommitDetails from '../../../../../../features/code/components/CommitDetails';
import { getPullCommits } from '../../../../../../features/code/pullApi';
import { feature } from '../../../../../../features/refined';
import { useRepo } from '../../../../../../features/repo/context';
import { chevronLeftIcon, chevronRightIcon, fileCodeIcon } from '../../../../../../icons/octicons';

/** /:owner/:repo/pull/:number/commits/:sha — one commit of a pull request, with previous / next navigation. */
export default function PullCommitPage() {
  const ctx = useRepo();
  const params = useParams<{ number: string; sha: string }>();
  const number = () => Number(params.number);
  const data = createMemo(() => getCommit(ctx.owner(), ctx.name(), params.sha));
  const commits = createMemo(() => getPullCommits(ctx.owner(), ctx.name(), number()));
  const index = createMemo(() => commits().findIndex((c) => c.oid === data().rest.sha));
  const href = (oid: string) => `${ctx.base()}/pull/${params.number}/commits/${oid}`;
  const prev = () => (index() > 0 ? commits()[index() - 1] : undefined);
  const next = () => (index() >= 0 ? commits()[index() + 1] : undefined);

  const PrevNext = (): JSX.Element => (
    <div class="BtnGroup">
      <Show
        when={prev()}
        fallback={
          <button type="button" class="btn btn-sm" disabled>
            <Octicon icon={chevronLeftIcon} /> Prev
          </button>
        }
      >
        {(c) => (
          <a class="btn btn-sm" href={href(c().oid)} aria-label="View previous commit" title={c().messageHeadline}>
            <Octicon icon={chevronLeftIcon} /> Prev
          </a>
        )}
      </Show>
      <Show
        when={next()}
        fallback={
          <button type="button" class="btn btn-sm" disabled>
            Next <Octicon icon={chevronRightIcon} />
          </button>
        }
      >
        {(c) => (
          <a class="btn btn-sm" href={href(c().oid)} aria-label="View next commit" title={c().messageHeadline}>
            Next <Octicon icon={chevronRightIcon} />
          </a>
        )}
      </Show>
    </div>
  );

  return (
    <>
      <Title>{`${data().info.messageHeadline} by ${data().info.authors[0]?.user?.login ?? data().info.authors[0]?.name ?? ''} · Pull Request #${params.number} · ${ctx.fullName()}`}</Title>
      <CommitDetails
        data={data()}
        owner={ctx.owner()}
        repo={ctx.name()}
        defaultBranch={ctx.repo().default_branch}
        inPull
        actions={
          <>
            <Show when={index() >= 0}>
              <span class="text-xs text-fg-muted mr-1">
                Commit {index() + 1} of {commits().length}
              </span>
            </Show>
            <PrevNext />
            <a class="btn btn-sm" href={`${ctx.base()}/tree/${data().rest.sha}`} title="Browse the repository at this point in the history">
              <Octicon icon={fileCodeIcon} /> Browse files
            </a>
          </>
        }
        footer={
          // previous-next-commit-buttons: the same navigation again under the diff.
          <Show when={feature('previous-next-commit-buttons')}>
            <div class="flex justify-end mb-3">
              <PrevNext />
            </div>
          </Show>
        }
      />
    </>
  );
}
