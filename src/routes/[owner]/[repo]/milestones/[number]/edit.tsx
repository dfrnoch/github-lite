import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createMemo } from 'solid-js';
import { getMilestone } from '../../../../../features/issues/api';
import { MilestoneForm } from '../../../../../features/issues/components/Milestones';
import { useRepo } from '../../../../../features/repo/context';

/** /:owner/:repo/milestones/:number/edit */
export default function EditMilestonePage() {
  const ctx = useRepo();
  const params = useParams<{ number: string }>();
  const milestone = createMemo(() => getMilestone(ctx.owner(), ctx.name(), Number(params.number)));
  return (
    <div class="container-lg px-4 md:px-6 py-6">
      <Title>{`Edit milestone · ${ctx.fullName()}`}</Title>
      <div class="pb-4 mb-4 border-b border-line-muted">
        <h1 class="text-2xl font-normal">Edit milestone</h1>
      </div>
      <MilestoneForm owner={ctx.owner()} repo={ctx.name()} milestone={milestone()} />
    </div>
  );
}
