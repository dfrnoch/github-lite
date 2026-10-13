import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createMemo, Show } from 'solid-js';
import { getMilestone } from '../../../../features/issues/api';
import IssueList from '../../../../features/issues/components/IssueList';
import { DueDate, MilestoneActions, percentComplete, ProgressBar } from '../../../../features/issues/components/Milestones';
import { quote } from '../../../../features/issues/query';
import { RichText } from '../../../../features/issues/refined';
import { useRepo } from '../../../../features/repo/context';

/** /:owner/:repo/milestone/:number — issues and PRs in a milestone with its progress. */
export default function MilestonePage() {
  const ctx = useRepo();
  const params = useParams<{ number: string }>();
  const milestone = createMemo(() => getMilestone(ctx.owner(), ctx.name(), Number(params.number)));
  const canEdit = () => !!ctx.repo().permissions?.push || !!ctx.repo().permissions?.triage;
  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`${milestone().title} Milestone · ${ctx.fullName()}`}</Title>
      <div class="flex flex-col md:flex-row gap-6 pb-4 mb-4 border-b border-line-muted">
        <div class="flex-1 min-w-0">
          <h1 class="text-[32px] font-normal leading-tight break-words">{milestone().title}</h1>
          <div class="text-sm text-fg-muted mt-2 flex flex-wrap items-center gap-x-4">
            <Show when={milestone().state === 'closed'}>
              <span class="State State--done State--small">Closed</span>
            </Show>
            <DueDate milestone={milestone()} />
            <span>
              <strong class="text-fg">{percentComplete(milestone())}%</strong> complete
            </span>
          </div>
          <Show when={milestone().description}>
            <p class="mt-3 whitespace-pre-line break-words">
              <RichText text={milestone().description} repo={ctx.fullName()} />
            </p>
          </Show>
        </div>
        <div class="w-full md:w-[360px] shrink-0">
          <ProgressBar percent={percentComplete(milestone())} class="mb-3 mt-2" />
          <Show when={canEdit()}>
            <div class="flex flex-wrap items-center gap-3">
              <MilestoneActions owner={ctx.owner()} repo={ctx.name()} milestone={milestone()} afterDelete={`${ctx.base()}/milestones`} />
              <a class="btn btn-sm btn-primary ml-auto rgh-new-milestone" href={`${ctx.base()}/milestones/new`}>
                New milestone
              </a>
            </div>
          </Show>
        </div>
      </div>
      <IssueList
        kind="all"
        owner={ctx.owner()}
        repo={ctx.name()}
        defaultQuery={`state:open milestone:${quote(milestone().title)} sort:created-desc`}
      />
    </div>
  );
}
