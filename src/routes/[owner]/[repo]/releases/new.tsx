import { Title } from '@solidjs/meta';
import { useSearchParams } from '@solidjs/router';
import ReleaseForm from '../../../../features/releases/components/ReleaseForm';
import { useRepo } from '../../../../features/repo/context';

/** /:owner/:repo/releases/new (?tag= prefills the tag). */
export default function NewRelease() {
  const ctx = useRepo();
  const [search] = useSearchParams<{ tag?: string }>();
  return (
    <div class="container-lg px-4 md:px-6 py-6">
      <Title>{`New release · ${ctx.fullName()}`}</Title>
      <div class="pb-2 mb-4 border-b border-line-muted">
        <h1 class="text-2xl font-normal">Draft a new release</h1>
      </div>
      <ReleaseForm
        owner={ctx.owner()}
        repo={ctx.name()}
        base={ctx.base()}
        defaultBranch={ctx.repo().default_branch}
        release={null}
        initialTag={search.tag}
      />
    </div>
  );
}
