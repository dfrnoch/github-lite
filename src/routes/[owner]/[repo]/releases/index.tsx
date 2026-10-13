import { Title } from '@solidjs/meta';
import { useLocation, useSearchParams } from '@solidjs/router';
import { createMemo, For, Show } from 'solid-js';
import { Blankslate, Pagination, pageHref } from '../../../../components/ui';
import { getLatestReleaseId, getReleases } from '../../../../features/releases/api';
import ReleaseCard from '../../../../features/releases/components/ReleaseCard';
import ReleasesSubnav from '../../../../features/releases/components/ReleasesSubnav';
import { useRepo } from '../../../../features/repo/context';
import { tagIcon } from '../../../../icons/octicons';
import { formatDate } from '../../../../lib/format';

/** /:owner/:repo/releases */
export default function ReleasesPage() {
  const ctx = useRepo();
  const location = useLocation();
  const [search] = useSearchParams<{ page?: string }>();
  const page = () => Math.max(1, Number(search.page) || 1);
  const releases = createMemo(() => getReleases(ctx.owner(), ctx.name(), page()));
  const latestId = createMemo(() => getLatestReleaseId(ctx.owner(), ctx.name()));
  const canEdit = () => !!ctx.repo().permissions?.push;

  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`Releases · ${ctx.fullName()}`}</Title>
      <ReleasesSubnav base={ctx.base()} active="releases">
        <Show when={canEdit()}>
          <a class="btn btn-primary" href={`${ctx.base()}/releases/new`}>
            Draft a new release
          </a>
        </Show>
      </ReleasesSubnav>
      <For
        each={releases().items}
        fallback={
          <Blankslate
            icon={tagIcon}
            title="There aren’t any releases here"
            action={
              <Show when={canEdit()}>
                <a class="btn btn-primary" href={`${ctx.base()}/releases/new`}>
                  Create a new release
                </a>
              </Show>
            }
          >
            You can create a release to package software, along with release notes and links to binary files, for other
            people to use.
          </Blankslate>
        }
      >
        {(release) => (
          <section class="flex flex-col md:flex-row gap-4 mb-8">
            <div class="md:w-[200px] shrink-0 md:text-right text-sm text-fg-muted md:pt-6">
              <time datetime={release.published_at ?? release.created_at}>
                {formatDate(release.published_at ?? release.created_at, { year: 'numeric' })}
              </time>
            </div>
            <div class="flex-1 min-w-0">
              <ReleaseCard
                release={release}
                base={ctx.base()}
                owner={ctx.owner()}
                repo={ctx.name()}
                latest={release.id === latestId()}
                canEdit={canEdit()}
              />
            </div>
          </section>
        )}
      </For>
      <Pagination pageInfo={releases().pageInfo} href={(p) => pageHref(location, p)} />
    </div>
  );
}
