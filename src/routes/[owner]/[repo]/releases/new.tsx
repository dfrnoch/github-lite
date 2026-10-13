import { Title } from '@solidjs/meta';
import { useSearchParams } from '@solidjs/router';
import { createMemo, Errored, Loading, Show } from 'solid-js';
import ReleaseForm from '../../../../features/releases/components/ReleaseForm';
import { getPublishState } from '../../../../features/repo/api';
import { unreleasedLabel } from '../../../../features/repo/refined/RefExtras';
import { tagHref } from '../../../../features/releases/versions';
import { encodePath } from '../../../../lib/github';
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
        <Errored fallback={null}>
          <Loading>
            <UnreleasedHint />
          </Loading>
        </Errored>
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

/** "12 unreleased commits on main since v1.2.3". */
function UnreleasedHint() {
  const ctx = useRepo();
  const state = createMemo(() => getPublishState(ctx.owner(), ctx.name()));
  return (
    <Show when={state().latestTag && state().aheadBy > 0 ? state() : null}>
      {(s) => (
        <p class="text-sm text-fg-muted mt-1">
          <a href={`${ctx.base()}/compare/${encodePath(s().latestTag!)}...${encodePath(s().defaultBranch)}`} target="_blank" rel="noreferrer">
            {unreleasedLabel(s().aheadBy)}
          </a>{' '}
          on {s().defaultBranch} since{' '}
          <a href={tagHref(ctx.base(), s().latestTag!)} target="_blank" rel="noreferrer">
            {s().latestTag}
          </a>
        </p>
      )}
    </Show>
  );
}
