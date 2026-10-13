import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createMemo, Show } from 'solid-js';
import { Blankslate } from '../../../../../components/ui';
import { getLatestReleaseId, getReleaseByTag } from '../../../../../features/releases/api';
import ReleaseForm from '../../../../../features/releases/components/ReleaseForm';
import { useRepo } from '../../../../../features/repo/context';
import { tagIcon } from '../../../../../icons/octicons';

/** /:owner/:repo/releases/edit/:tag* */
export default function EditRelease() {
  const ctx = useRepo();
  const params = useParams<{ tag: string }>();
  const tag = () => decodeURIComponent(params.tag ?? '');
  const release = createMemo(() => getReleaseByTag(ctx.owner(), ctx.name(), tag()));
  const latestId = createMemo(() => getLatestReleaseId(ctx.owner(), ctx.name()));
  return (
    <div class="container-lg px-4 md:px-6 py-6">
      <Title>{`Edit release ${tag()} · ${ctx.fullName()}`}</Title>
      <div class="pb-2 mb-4 border-b border-line-muted">
        <h1 class="text-2xl font-normal">Edit release</h1>
      </div>
      <Show when={release()} fallback={<Blankslate icon={tagIcon} title="Release not found" />}>
        {(r) => (
          <ReleaseForm
            owner={ctx.owner()}
            repo={ctx.name()}
            base={ctx.base()}
            defaultBranch={ctx.repo().default_branch}
            release={r()}
            isLatest={r().id === latestId()}
          />
        )}
      </Show>
    </div>
  );
}
