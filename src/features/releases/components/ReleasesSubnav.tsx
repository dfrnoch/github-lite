import { useNavigate } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createMemo, createUniqueId, Errored, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { searchIcon } from '../../../icons/octicons';
import { UnreleasedCommitsButton } from '../../repo/refined/RefExtras';
import { useRepo } from '../../repo/context';
import { getReleaseTagNames } from '../api';
import { tagHref } from '../versions';
import { ChangelogLink, SubscribeReleases } from './RefinedReleases';

/** "Releases | Tags" switch above both lists, with optional right-side actions. */
export default function ReleasesSubnav(props: { base: string; active: 'releases' | 'tags'; children?: JSX.Element }) {
  return (
    <div class="flex flex-col sm:flex-row flex-wrap sm:items-center gap-2 pb-4 mb-4 border-b border-line-muted">
      <nav class="flex flex-1" aria-label="Releases and Tags">
        <a class="subnav-item" href={`${props.base}/releases`} aria-current={props.active === 'releases' ? 'page' : undefined}>
          Releases
        </a>
        <a class="subnav-item" href={`${props.base}/tags`} aria-current={props.active === 'tags' ? 'page' : undefined}>
          Tags
        </a>
        <ChangelogLink owner={props.base.split('/')[1]!} repo={props.base.split('/')[2]!} />
      </nav>
      {props.children}
    </div>
  );
}

/**
 * Right side of the releases header (list and single release pages):
 * Subscribe, unreleased commits, "Draft a new release" and "Find a release".
 */
export function ReleasesActions(props: { query?: string; unreleased?: boolean; onSearch?: (q: string | undefined) => void }) {
  const ctx = useRepo();
  const canEdit = () => !!ctx.repo().permissions?.push;
  return (
    <div class="flex flex-wrap items-center gap-2">
      <SubscribeReleases />
      <Show when={props.unreleased}>
        <Errored fallback={null}>
          <Loading>
            <UnreleasedCommitsButton repo={ctx.repo()} withDraft={false} />
          </Loading>
        </Errored>
      </Show>
      <Show when={canEdit()}>
        <a class="btn btn-primary" href={`${ctx.base()}/releases/new`}>
          Draft a new release
        </a>
      </Show>
      <FindRelease value={props.query ?? ''} onSearch={props.onSearch} />
    </div>
  );
}

/**
 * "Find a release": submits `?q=` to the releases list. Every release tag is
 * suggested (picking one opens it) and `prerelease:false` hides pre-releases.
 */
export function FindRelease(props: { value: string; onSearch?: (q: string | undefined) => void }) {
  const ctx = useRepo();
  const navigate = useNavigate();
  const listId = createUniqueId();
  const tags = createMemo(() => getReleaseTagNames(ctx.owner(), ctx.name()));
  const knownTags = () => {
    try {
      return tags();
    } catch {
      return []; // Suggestions not loaded yet.
    }
  };
  const search = (q: string | undefined) => {
    if (props.onSearch) props.onSearch(q);
    else navigate(q ? `${ctx.base()}/releases?q=${encodeURIComponent(q)}` : `${ctx.base()}/releases`);
  };
  return (
    <form
      class="relative w-full sm:w-[200px] md:w-[200px]"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const value = String(new FormData(e.currentTarget).get('q') ?? '').trim();
        if (value && knownTags().includes(value)) return navigate(tagHref(ctx.base(), value));
        search(value || undefined);
      }}
    >
      <Octicon icon={searchIcon} class="absolute left-2 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" />
      <input
        name="q"
        class="form-control w-full pl-7!"
        type="search"
        placeholder="Find a release"
        aria-label="Find a release"
        list={listId}
        autocomplete="off"
        value={props.value}
        onInput={(e) => {
          // Picking a datalist suggestion fires `input` without an inputType.
          if ('inputType' in e && (e as InputEvent).inputType) return;
          const value = e.currentTarget.value;
          if (value === 'prerelease:false') return search(value);
          if (knownTags().includes(value)) navigate(tagHref(ctx.base(), value));
        }}
        onChange={(e) => {
          if (!e.currentTarget.value && props.value) search(undefined);
        }}
      />
      <Errored fallback={null}>
        <Loading>
          <datalist id={listId}>
            <option value="prerelease:false">Hide pre-releases</option>
            <For each={tags()}>{(t) => <option value={t} />}</For>
          </datalist>
        </Loading>
      </Errored>
    </form>
  );
}
