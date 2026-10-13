import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createMemo, Loading } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { PageSpinner } from '../../../../components/ui';
import { getCommit } from '../../../../features/code/api';
import CommitDetails from '../../../../features/code/components/CommitDetails';
import { useRepo } from '../../../../features/repo/context';
import { fileCodeIcon } from '../../../../icons/octicons';

/** /:owner/:repo/commit/:sha — commit message, metadata and diff. */
export default function CommitPage() {
  const ctx = useRepo();
  const params = useParams<{ sha: string }>();
  const data = createMemo(() => getCommit(ctx.owner(), ctx.name(), params.sha));

  return (
    <div class="px-4 md:px-6 lg:px-8 py-6 max-w-[1800px] mx-auto">
      <Loading fallback={<PageSpinner />}>
        <Title>{`${data().info.messageHeadline} · ${ctx.fullName()}@${data().rest.sha.slice(0, 7)}`}</Title>
        <CommitDetails
          data={data()}
          owner={ctx.owner()}
          repo={ctx.name()}
          defaultBranch={ctx.repo().default_branch}
          actions={
            <a class="btn btn-sm" href={`${ctx.base()}/tree/${data().rest.sha}`} title="Browse the repository at this point in the history">
              <Octicon icon={fileCodeIcon} /> Browse files
            </a>
          }
        />
      </Loading>
    </div>
  );
}
