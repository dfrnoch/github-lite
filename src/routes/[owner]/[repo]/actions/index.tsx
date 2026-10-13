import { Title } from '@solidjs/meta';
import ActionsShell from '../../../../features/actions/components/ActionsShell';
import RunsList from '../../../../features/actions/components/RunsList';
import { useRepo } from '../../../../features/repo/context';

/** /:owner/:repo/actions — runs of all workflows. */
export default function ActionsPage() {
  const ctx = useRepo();
  return (
    <ActionsShell active="">
      <Title>{`Workflow runs · ${ctx.fullName()}`}</Title>
      <RunsList
        heading={
          <>
            <h2 class="text-xl">All workflows</h2>
            <p class="text-sm text-fg-muted mt-1">Showing runs from all workflows</p>
          </>
        }
      />
    </ActionsShell>
  );
}
