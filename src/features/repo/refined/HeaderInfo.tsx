import { createMemo, Errored, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar } from '../../../components/ui';
import { lockIcon, repoForkedIcon, starFillIcon, starIcon } from '../../../icons/octicons';
import { compactNumber, formatNumber } from '../../../lib/format';
import { feature } from '../../refined';
import { getRepo, getRepoHeaderInfo } from '../api';
import CommitStatusIcon from '../components/CommitStatusIcon';

/**
 * Refined GitHub additions to the "owner / repo" breadcrumb of the global
 * header (rendered by AppHeader on repo pages). Failures stay silent: the
 * header must never break because of them.
 */

/**
 * The header's route context is a new object on every navigation; settle on
 * the owner/repo pair so queries aren't re-asked when it didn't change.
 */
function useRepoKey(props: { owner: string; repo: string }) {
  return createMemo(() => ({ owner: props.owner, repo: props.repo }), {
    equals: (a, b) => a.owner === b.owner && a.repo === b.repo,
  });
}

/** repo-avatars: the owner's avatar before their name. */
export function RepoHeaderAvatar(props: { owner: string; repo: string }) {
  const key = useRepoKey(props);
  const repo = createMemo(() => getRepo(key().owner, key().repo));
  return (
    <Show when={feature('repo-avatars')}>
      <Errored fallback={null}>
        <Loading fallback={<Avatar login={props.owner} size={16} class="hidden md:inline-block shrink-0 ml-1" />}>
          <Avatar
            src={repo().owner.avatar_url}
            login={props.owner}
            size={16}
            square={repo().owner.type === 'Organization'}
            class="hidden md:inline-block shrink-0 ml-1"
          />
        </Loading>
      </Errored>
    </Show>
  );
}

/** repo-header-info: lock (private), fork parent link, star count and CI status after the repo name. */
export function RepoHeaderInfo(props: { owner: string; repo: string }) {
  const key = useRepoKey(props);
  const info = createMemo(() => getRepoHeaderInfo(key().owner, key().repo));
  const base = () => `/${props.owner}/${props.repo}`;
  return (
    <Show when={feature('repo-header-info')}>
      <Errored fallback={null}>
        <Loading>
          <span class="hidden md:flex items-center gap-0.5 ml-1 text-fg-muted shrink-0">
            <Show when={info().isPrivate}>
              <span class="inline-flex p-1" title="Private repository">
                <Octicon icon={lockIcon} size={12} />
              </span>
            </Show>
            <Show when={info().parent}>
              {(parent) => (
                <a class="AppHeader-context-item inline-flex! items-center text-fg-muted! px-1!" href={`/${parent()}`} title={`Forked from ${parent()}`}>
                  <Octicon icon={repoForkedIcon} size={12} />
                </a>
              )}
            </Show>
            <Show when={info().stars > 1}>
              <Show
                when={info().canSeeStargazers}
                fallback={
                  <span class="inline-flex items-center gap-1 px-1 text-sm" title={starTitle(info().stars, info().starred)}>
                    <StarIcon starred={info().starred} />
                    {compactNumber(info().stars)}
                  </span>
                }
              >
                <a
                  class="AppHeader-context-item inline-flex! items-center gap-1 text-fg-muted! px-1!"
                  href={`${base()}/stargazers`}
                  title={starTitle(info().stars, info().starred)}
                >
                  <StarIcon starred={info().starred} />
                  {compactNumber(info().stars)}
                </a>
              </Show>
            </Show>
            <Show when={info().ci}>
              {(ci) => (
                <span class="inline-flex px-1" title="CI status of latest commit">
                  <CommitStatusIcon state={ci().state} href={`${base()}/commit/${ci().oid}`} owner={props.owner} repo={props.repo} sha={ci().oid} />
                </span>
              )}
            </Show>
          </span>
        </Loading>
      </Errored>
    </Show>
  );
}

const starTitle = (n: number, starred: boolean) => `Repository starred by ${formatNumber(n)} people${starred ? ', including you' : ''}`;

function StarIcon(props: { starred: boolean }) {
  return <Octicon icon={props.starred ? starFillIcon : starIcon} size={12} class={props.starred ? 'text-[var(--button-star-iconColor)]' : undefined} />;
}
