import { Title } from '@solidjs/meta';
import { MilestoneForm } from '../../../../features/issues/components/Milestones';
import { useRepo } from '../../../../features/repo/context';

/** /:owner/:repo/milestones/new */
export default function NewMilestonePage() {
  const ctx = useRepo();
  return (
    <div class="container-lg px-4 md:px-6 py-6">
      <Title>{`New milestone · ${ctx.fullName()}`}</Title>
      <div class="pb-4 mb-4 border-b border-line-muted">
        <h1 class="text-2xl font-normal">New milestone</h1>
        <p class="text-fg-muted text-sm mt-1">Create a new milestone to help organize your issues and pull requests.</p>
      </div>
      <MilestoneForm owner={ctx.owner()} repo={ctx.name()} />
    </div>
  );
}
