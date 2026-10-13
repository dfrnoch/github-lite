import { useNavigate } from '@solidjs/router';
import { createMemo, createUniqueId, Errored, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dropdown } from '../../../components/ui';
import { diffIcon, eyeIcon, linkExternalIcon, rssIcon, triangleDownIcon } from '../../../icons/octicons';
import { encodePath } from '../../../lib/github';
import { useHotkey } from '../../../lib/hotkeys';
import { feature } from '../../refined';
import { getRepoViewerState } from '../../repo/api';
import { useRepo } from '../../repo/context';
import { getChangelogFile, getReleaseTagNames, getTagCommits } from '../api';
import { previousTag, tagHref } from '../versions';


/** Refined GitHub widgets of the releases / tags pages. */

/** create-release-shortcut: `c` opens "Draft a new release" (for people who can push). */
export function useCreateReleaseHotkey() {
  const ctx = useRepo();
  const navigate = useNavigate();
  useHotkey({
    keys: 'c',
    description: 'Create a new release',
    group: 'Releases',
    feature: 'create-release-shortcut',
    when: () => !!ctx.repo().permissions?.push,
    handler: () => navigate(`${ctx.base()}/releases/new`),
  });
}

/** link-to-changelog-file: "Changelog" next to Releases | Tags when the repo root has one. */
export function ChangelogLink(props: { owner: string; repo: string }) {
  const file = createMemo(() => getChangelogFile(props.owner, props.repo));
  return (
    <Show when={feature('link-to-changelog-file')}>
      <Errored fallback={null}>
        <Loading>
          <Show when={file()}>
            {(name) => (
              <a class="subnav-item" href={`/${props.owner}/${props.repo}/blob/HEAD/${encodePath(name())}`} title={`View the ${name()} file`}>
                Changelog
              </a>
            )}
          </Show>
        </Loading>
      </Errored>
    </Show>
  );
}

/**
 * subscribe-releases. GitHub's "Custom → Releases" watch level isn't part of
 * the public API, so this offers what is reachable: the releases Atom feed,
 * or github.com's watch menu.
 */
export function SubscribeReleases() {
  const ctx = useRepo();
  const state = createMemo(() => getRepoViewerState(ctx.owner(), ctx.name()));
  return (
    <Show when={feature('subscribe-releases')}>
      <Errored fallback={null}>
        <Loading>
          <Show
            when={state().viewerSubscription !== 'SUBSCRIBED'}
            fallback={
              <button type="button" class="btn" disabled title="You are watching all activity, releases included. You can change your subscription from the repository home.">
                <Octicon icon={eyeIcon} /> Subscribed
              </button>
            }
          >
            <Dropdown
              class="btn"
              align="right"
              menuClass="w-72"
              title="Subscribe to releases"
              button={
                <>
                  <Octicon icon={eyeIcon} /> Subscribe <Octicon icon={triangleDownIcon} />
                </>
              }
            >
              {(close) => (
                <>
                  <a class="SelectMenu-item items-start!" href={`https://github.com/${ctx.fullName()}/releases.atom`} target="_blank" rel="noreferrer" onClick={close}>
                    <Octicon icon={rssIcon} class="mt-0.5" />
                    <span>
                      <span class="block font-semibold">Releases feed</span>
                      <span class="block text-xs text-fg-muted font-normal">Atom feed for your feed reader.</span>
                    </span>
                  </a>
                  <a class="SelectMenu-item items-start!" href={`https://github.com/${ctx.fullName()}`} target="_blank" rel="noreferrer" onClick={close}>
                    <Octicon icon={linkExternalIcon} class="mt-0.5" />
                    <span>
                      <span class="block font-semibold">Watch releases on GitHub</span>
                      <span class="block text-xs text-fg-muted font-normal">Watch → Custom → Releases (not available through the API).</span>
                    </span>
                  </a>
                </>
              )}
            </Dropdown>
          </Show>
        </Loading>
      </Errored>
    </Show>
  );
}

/** releases-dropdown: "Find a release" with every release tag as a suggestion; picking one opens it. */
export function FindRelease(props: { prereleasesHidden: boolean; onFilter: (q: string | undefined) => void }) {
  const ctx = useRepo();
  const navigate = useNavigate();
  const tags = createMemo(() => getReleaseTagNames(ctx.owner(), ctx.name()));
  const listId = createUniqueId();
  return (
    <Show when={feature('releases-dropdown')}>
      <form
        class="w-full md:w-[260px]"
        onSubmit={(e) => {
          e.preventDefault();
          const value = String(new FormData(e.currentTarget).get('q') ?? '').trim();
          if (value === 'prerelease:false') return props.onFilter(value);
          if (value) navigate(tagHref(ctx.base(), value));
        }}
      >
        <input
          name="q"
          class="form-control w-full"
          type="search"
          placeholder="Find a release"
          aria-label="Find a release"
          list={listId}
          autocomplete="off"
          value={props.prereleasesHidden ? 'prerelease:false' : ''}
          onInput={(e) => {
            // Picking a datalist suggestion fires `input` without an inputType.
            if ('inputType' in e && (e as InputEvent).inputType) return;
            const value = e.currentTarget.value;
            if (value === 'prerelease:false') return props.onFilter(value);
            let known: string[] = [];
            try {
              known = tags();
            } catch {
              // Suggestions not loaded yet.
            }
            if (known.includes(value)) navigate(tagHref(ctx.base(), value));
          }}
          onChange={(e) => {
            if (!e.currentTarget.value && props.prereleasesHidden) props.onFilter(undefined);
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
    </Show>
  );
}

/** tag-changes-link: "Commits" — the compare view from the previous tag to this one. */
export function TagChangesLink(props: { owner: string; repo: string; tag: string; class?: string }) {
  // The newest 100 tags cover most pages; older releases look further back (up to 1000 tags).
  const recent = createMemo(() => getTagCommits(props.owner, props.repo, 100));
  const older = createMemo(() =>
    !previousTag(props.tag, recent()) && recent().length >= 100 ? getTagCommits(props.owner, props.repo, 1000) : null,
  );
  const prev = createMemo(() => {
    const list = older();
    return previousTag(props.tag, list ?? recent());
  });
  return (
    <Show when={feature('tag-changes-link')}>
      <Errored fallback={null}>
        <Loading>
          <Show when={prev()}>
            {(p) => (
              <a
                class={['flex items-center gap-1 link-muted', props.class]}
                href={`/${props.owner}/${props.repo}/compare/${encodePath(p())}...${encodePath(props.tag)}`}
                title={`See commits between ${p()} and ${props.tag}`}
              >
                <Octicon icon={diffIcon} /> Commits
              </a>
            )}
          </Show>
        </Loading>
      </Errored>
    </Show>
  );
}
