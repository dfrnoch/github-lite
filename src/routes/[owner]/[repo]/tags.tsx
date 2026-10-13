import { Title } from '@solidjs/meta';
import { useAction, useSearchParams } from '@solidjs/router';
import { createMemo, createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Blankslate, Dropdown, RelativeTime, toast } from '../../../components/ui';
import { deleteTag, getTags } from '../../../features/releases/api';
import { tagHref } from '../../../features/releases/components/ReleaseCard';
import ReleasesSubnav from '../../../features/releases/components/ReleasesSubnav';
import { ConfirmDialog } from '../../../features/repo-settings/components/ui';
import { useRepo } from '../../../features/repo/context';
import { clockIcon, fileIcon, fileZipIcon, gitCommitIcon, kebabHorizontalIcon, tagIcon } from '../../../icons/octicons';

/** /:owner/:repo/tags — tags newest first with archive links (?after= / ?before= cursors). */
export default function TagsPage() {
  const ctx = useRepo();
  const [search] = useSearchParams<{ after?: string; before?: string }>();
  const data = createMemo(() => getTags(ctx.owner(), ctx.name(), search.after, search.before));
  const remove = useAction(deleteTag);
  const [deleting, setDeleting] = createSignal<string | null>(null);
  const canEdit = () => !!ctx.repo().permissions?.push;
  const archive = (tag: string, ext: string) => `https://github.com/${ctx.fullName()}/archive/refs/tags/${tag}.${ext}`;

  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`Tags · ${ctx.fullName()}`}</Title>
      <ReleasesSubnav base={ctx.base()} active="tags" />
      <div class="Box">
        <div class="Box-header flex items-center gap-2 font-semibold">
          <Octicon icon={tagIcon} /> Tags
        </div>
        <For each={data().tags} fallback={<Blankslate icon={tagIcon} title="There aren’t any tags here" />}>
          {(t) => (
            <div class="Box-row">
              <div class="flex items-start gap-2">
                <h2 class="text-base font-semibold flex-1 min-w-0 break-all">
                  <a class="link-plain" href={t.hasRelease ? tagHref(ctx.base(), t.name) : `${ctx.base()}/tree/${t.name}`}>
                    {t.name}
                  </a>
                </h2>
                <Show when={t.verified}>
                  <span class="Label Label--success">Verified</span>
                </Show>
                <Show when={canEdit()}>
                  <Dropdown class="btn-octicon" align="right" menuClass="w-48" button={<Octicon icon={kebabHorizontalIcon} />}>
                    {(close) => (
                      <>
                        <a class="SelectMenu-item" href={`${ctx.base()}/releases/new?tag=${encodeURIComponent(t.name)}`}>
                          Create release
                        </a>
                        <button
                          type="button"
                          class="SelectMenu-item text-fg-danger!"
                          onClick={() => {
                            close();
                            setDeleting(t.name);
                          }}
                        >
                          Delete tag
                        </button>
                      </>
                    )}
                  </Dropdown>
                </Show>
              </div>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-fg-muted">
                <Show when={t.date}>
                  <span class="flex items-center gap-1">
                    <Octicon icon={clockIcon} /> <RelativeTime datetime={t.date} relative />
                  </span>
                </Show>
                <a class="flex items-center gap-1 link-muted font-mono" href={`${ctx.base()}/commit/${t.oid}`}>
                  <Octicon icon={gitCommitIcon} /> {t.abbreviatedOid}
                </a>
                <a class="flex items-center gap-1 link-muted" href={archive(t.name, 'zip')}>
                  <Octicon icon={fileZipIcon} /> zip
                </a>
                <a class="flex items-center gap-1 link-muted" href={archive(t.name, 'tar.gz')}>
                  <Octicon icon={fileZipIcon} /> tar.gz
                </a>
                <Show when={t.hasRelease}>
                  <a class="flex items-center gap-1 link-muted" href={tagHref(ctx.base(), t.name)}>
                    <Octicon icon={fileIcon} /> Notes
                  </a>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>
      <Show when={data().pageInfo.hasNextPage || data().pageInfo.hasPreviousPage}>
        <nav class="pagination" aria-label="Pagination">
          <Show when={data().pageInfo.hasPreviousPage && data().pageInfo.startCursor} fallback={<span class="disabled">Previous</span>}>
            <a href={`${ctx.base()}/tags?before=${encodeURIComponent(data().pageInfo.startCursor!)}`}>Previous</a>
          </Show>
          <Show when={data().pageInfo.hasNextPage && data().pageInfo.endCursor} fallback={<span class="disabled">Next</span>}>
            <a href={`${ctx.base()}/tags?after=${encodeURIComponent(data().pageInfo.endCursor!)}`}>Next</a>
          </Show>
        </nav>
      </Show>
      <ConfirmDialog
        open={deleting() != null}
        onClose={() => setDeleting(null)}
        title={`Delete tag ${deleting()}?`}
        confirmText={deleting() ?? undefined}
        button="Delete this tag"
        onConfirm={() => remove(ctx.owner(), ctx.name(), deleting()!).then(() => toast('Tag deleted'))}
      >
        <p>This permanently deletes the tag from the repository. Releases pointing at it become drafts.</p>
      </ConfirmDialog>
    </div>
  );
}
