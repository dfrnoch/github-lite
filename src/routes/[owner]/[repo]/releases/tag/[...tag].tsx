import { Title } from '@solidjs/meta';
import { useNavigate, useParams } from '@solidjs/router';
import { createMemo, Show } from 'solid-js';
import Octicon from '../../../../../components/Octicon';
import { Blankslate, toast } from '../../../../../components/ui';
import { deleteRelease, getLatestReleaseId, getReleaseByTag } from '../../../../../features/releases/api';
import ReleaseCard from '../../../../../features/releases/components/ReleaseCard';
import { useRepo } from '../../../../../features/repo/context';
import { chevronLeftIcon, tagIcon } from '../../../../../icons/octicons';

/** /:owner/:repo/releases/tag/:tag* — a single release. */
export default function ReleasePage() {
  const ctx = useRepo();
  const params = useParams<{ tag: string }>();
  const navigate = useNavigate();
  const tag = () => decodeURIComponent(params.tag ?? '');
  const release = createMemo(() => getReleaseByTag(ctx.owner(), ctx.name(), tag()));
  const latestId = createMemo(() => getLatestReleaseId(ctx.owner(), ctx.name()));

  return (
    <div class="container-lg px-4 md:px-6 py-6">
      <Title>{`Release ${release()?.name || tag()} · ${ctx.fullName()}`}</Title>
      <div class="flex items-center gap-2 pb-4 mb-4 border-b border-line-muted text-sm">
        <a href={`${ctx.base()}/releases`} class="flex items-center gap-1">
          <Octicon icon={chevronLeftIcon} /> Releases
        </a>
        <span class="text-fg-muted">/</span>
        <span class="font-semibold truncate">{tag()}</span>
      </div>
      <Show
        when={release()}
        fallback={
          <Blankslate icon={tagIcon} title="There isn’t a release for this tag">
            <a href={`${ctx.base()}/tree/${tag()}`}>Browse the code at {tag()}</a>
          </Blankslate>
        }
      >
        {(r) => (
          <ReleaseCard
            release={r()}
            base={ctx.base()}
            owner={ctx.owner()}
            repo={ctx.name()}
            latest={r().id === latestId()}
            canEdit={!!ctx.repo().permissions?.push}
            expandAssets
            onDelete={() =>
              deleteRelease(ctx.owner(), ctx.name(), r().id).then(() => {
                toast('Release deleted');
                navigate(`${ctx.base()}/releases`);
              })
            }
          />
        )}
      </Show>
    </div>
  );
}
