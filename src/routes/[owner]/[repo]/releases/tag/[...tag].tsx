import { Title } from '@solidjs/meta';
import { type RouteDefinition, useNavigate, useParams } from '@solidjs/router';
import { createMemo, createSignal, Errored, Loading, Show } from 'solid-js';
import { Blankslate, PageSpinner, toast, toastError } from '../../../../../components/ui';
import {
  convertReleaseToDraft,
  deleteRelease,
  getCommitsSinceRelease,
  getLatestReleaseId,
  getPreviousTag,
  getReleaseByTag,
  getReleaseCommit,
  getReleaseList,
  isReleaseFor,
  type Release,
  type ReleaseCommit,
} from '../../../../../features/releases/api';
import ReleaseCard from '../../../../../features/releases/components/ReleaseCard';
import ReleaseListNav from '../../../../../features/releases/components/ReleaseListNav';
import ReleasesSubnav, { ReleasesActions } from '../../../../../features/releases/components/ReleasesSubnav';
import { useCreateReleaseHotkey } from '../../../../../features/releases/components/RefinedReleases';
import { tagHref } from '../../../../../features/releases/versions';
import { useRepo } from '../../../../../features/repo/context';
import { tagIcon } from '../../../../../icons/octicons';
import { formatNumber } from '../../../../../lib/format';

const PAGE = 10;
const decodeTag = (raw: string | undefined) => decodeURIComponent(raw ?? '');

export const route = {
  preload: ({ params }) => {
    const tag = decodeTag(params.tag);
    void getReleaseByTag(params.owner!, params.repo!, tag);
    void getReleaseCommit(params.owner!, params.repo!, tag);
    void getReleaseList(params.owner!, params.repo!, tag);
    void getLatestReleaseId(params.owner!, params.repo!);
    void getCommitsSinceRelease(params.owner!, params.repo!, tag, 'HEAD');
    void getPreviousTag(params.owner!, params.repo!, tag);
  },
} satisfies RouteDefinition;

/** /:owner/:repo/releases/tag/:tag* — one release, with the release list beside it. */
export default function ReleasePage() {
  const ctx = useRepo();
  const params = useParams<{ tag: string }>();
  const tag = () => decodeTag(params.tag);
  const release = createMemo(() => getReleaseByTag(ctx.owner(), ctx.name(), tag()));
  const latestId = createMemo(() => getLatestReleaseId(ctx.owner(), ctx.name()));
  // Everything the card shows starts with the release, not after it.
  const commit = createMemo(() => getReleaseCommit(ctx.owner(), ctx.name(), tag()));
  const since = createMemo(() => getCommitsSinceRelease(ctx.owner(), ctx.name(), tag(), 'HEAD'));
  const previous = createMemo(() => getPreviousTag(ctx.owner(), ctx.name(), tag()));
  useCreateReleaseHotkey();

  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <div class="lg:w-11/12 mx-auto">
        <ReleasesSubnav base={ctx.base()} active="releases">
          <ReleasesActions />
        </ReleasesSubnav>
        <div class="flex">
          <Errored fallback={null}>
            <Loading fallback={<div class="hidden md:block w-1/6 min-w-[195px]" />}>
              <TagReleaseList tag={tag()} />
            </Loading>
          </Errored>
          <div class="flex-1 min-w-0 my-8">
            <Loading fallback={<PageSpinner />}>
              <Title>{`Release ${release()?.name || tag()} · ${ctx.fullName()}`}</Title>
              <Show
                when={release()}
                fallback={
                  <Blankslate icon={tagIcon} title="There isn’t a release for this tag">
                    <a href={`${ctx.base()}/tree/${tag()}`}>Browse the code at {tag()}</a>
                  </Blankslate>
                }
              >
                {(r) => (
                  <SingleRelease
                    release={r()}
                    latest={r().id === latestId()}
                    commit={commit()}
                    since={since()}
                    previousTag={previous()}
                  />
                )}
              </Show>
            </Loading>
          </div>
        </div>
      </div>
    </div>
  );
}

function SingleRelease(props: {
  release: Release;
  latest: boolean;
  commit: ReleaseCommit | null;
  /** Commits on the default branch since the release. */
  since: number | null;
  previousTag: string | null;
}) {
  const ctx = useRepo();
  const navigate = useNavigate();
  const [converting, setConverting] = createSignal(false);
  const branch = () => ctx.repo().default_branch;
  const canEdit = () => !!ctx.repo().permissions?.push;

  const convert = async () => {
    const r = props.release;
    const message = ['The release will be effectively deleted and a new draft will be created.'];
    if (r.reactions?.total_count) message.push('Existing user reactions will be lost.');
    message.push('Continue?');
    if (!confirm(message.join(' '))) return;
    setConverting(true);
    try {
      toast('Converting…');
      const draft = await convertReleaseToDraft(ctx.owner(), ctx.name(), r.id);
      // Drafts are addressed by their untagged-… URL.
      navigate(`${ctx.base()}/releases/edit/${draft.html_url.split('/releases/tag/')[1] ?? encodeURIComponent(draft.tag_name)}`);
    } catch (e) {
      toastError(e);
    } finally {
      setConverting(false);
    }
  };

  return (
    <ReleaseCard
      release={props.release}
      base={ctx.base()}
      owner={ctx.owner()}
      repo={ctx.name()}
      latest={props.latest}
      canEdit={canEdit()}
      commit={props.commit}
      previousTag={props.previousTag}
      expandAssets
      extraMeta={
        <Errored fallback={null}>
          <Loading fallback={null}>
            <Show when={!props.release.draft && props.since}>
              {(n) => (
                <div class="mr-4 mb-2">
                  ·{' '}
                  <a href={`${ctx.base()}/compare/${props.release.tag_name}...${branch()}`}>
                    {formatNumber(n())} {n() === 1 ? 'commit' : 'commits'}
                  </a>{' '}
                  to {branch()} since this release
                </div>
              )}
            </Show>
          </Loading>
        </Errored>
      }
      actions={
        <Show when={canEdit() && !props.release.draft}>
          <button type="button" class="btn btn-sm" disabled={converting()} onClick={convert}>
            {converting() ? 'Converting…' : 'Convert to draft'}
          </button>
        </Show>
      }
      onDelete={() =>
        deleteRelease(ctx.owner(), ctx.name(), props.release.id).then(() => {
          toast('Release deleted');
          navigate(`${ctx.base()}/releases`);
        })
      }
    />
  );
}

/**
 * The release list column of a single release: the newest 100 releases in
 * pages of 10, opened at the page holding this release.
 */
function TagReleaseList(props: { tag: string }) {
  const ctx = useRepo();
  const list = createMemo(() => getReleaseList(ctx.owner(), ctx.name(), props.tag));
  const path = (url: string) => new URL(url).pathname;
  const index = createMemo(() => {
    const t = props.tag;
    return list().findIndex((r) => isReleaseFor(r, t));
  });
  const [listPage, setListPage] = createSignal(() => Math.max(0, Math.floor(index() / PAGE)));
  const lastPage = () => Math.max(0, Math.ceil(list().length / PAGE) - 1);
  const shown = createMemo(() =>
    list()
      .slice(listPage() * PAGE, listPage() * PAGE + PAGE)
      .map((r) => ({ key: r.tagName, label: r.name || r.tagName, href: r.isDraft ? path(r.url) : tagHref(ctx.base(), r.tagName) })),
  );
  return (
    <ReleaseListNav
      items={shown()}
      current={index() >= 0 ? list()[index()]!.tagName : null}
      prev={listPage() > 0 ? { onClick: () => setListPage((p) => p - 1) } : null}
      next={listPage() < lastPage() ? { onClick: () => setListPage((p) => p + 1) } : null}
    />
  );
}
