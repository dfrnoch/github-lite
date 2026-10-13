import { useNavigate } from '@solidjs/router';
import { createMemo, Errored, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dropdown } from '../../../components/ui';
import { diffIcon, eyeIcon, linkExternalIcon, rssIcon, triangleDownIcon } from '../../../icons/octicons';
import { encodePath } from '../../../lib/github';
import { useHotkey } from '../../../lib/hotkeys';
import { feature } from '../../refined';
import { getRepoViewerState } from '../../repo/api';
import { useRepo } from '../../repo/context';
import { getChangelogFile, getPreviousTag } from '../api';

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

/** tag-changes-link: "Commits" — the compare view from the previous tag to this one. */
export function TagChangesLink(props: {
  owner: string;
  repo: string;
  tag: string;
  /** The previous tag when the page already looks it up. */
  previous?: string | null;
  class?: string;
}) {
  const prev = createMemo(() => {
    if (!feature('tag-changes-link')) return null;
    const known = props.previous;
    return known !== undefined ? known : getPreviousTag(props.owner, props.repo, props.tag);
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
