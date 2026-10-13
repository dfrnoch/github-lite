import { useAction } from '@solidjs/router';
import { createMemo, createSignal, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Dropdown, toastError } from '../../../components/ui';
import {
  bellSlashIcon,
  checkIcon,
  eyeIcon,
  repoForkedIcon,
  starFillIcon,
  starIcon,
  triangleDownIcon,
} from '../../../icons/octicons';
import { compactNumber } from '../../../lib/format';
import type { Repository } from '../../../lib/types';
import { PinButton } from '../../user/components/PinnedRepos';
import { getRepoViewerState, setRepoSubscription, starRepo } from '../api';
import { DeleteForkButton } from '../refined/ForkTools';
import GithubIoLink from '../refined/GithubIoLink';

export function VisibilityLabel(props: { repo: Repository }) {
  return (
    <span class="Label">
      {props.repo.visibility === 'internal' ? 'Internal' : props.repo.private ? 'Private' : 'Public'}
      {props.repo.archived ? ' archive' : ''}
      {props.repo.is_template ? ' template' : ''}
    </span>
  );
}

/** Repo name row on the Code tab: avatar, name, visibility, Watch / Fork / Star. */
export default function RepoTitle(props: { repo: Repository }) {
  const owner = () => props.repo.owner.login;
  const name = () => props.repo.name;
  return (
    <div class="flex flex-wrap items-center gap-2 pb-4 mb-4 border-b border-line-muted">
      <Avatar src={props.repo.owner.avatar_url} size={24} square={props.repo.owner.type === 'Organization'} />
      <strong class="text-xl font-semibold break-all">
        <a class="link-plain" href={`/${owner()}/${name()}`}>
          {name()}
        </a>
      </strong>
      <GithubIoLink name={name()} />
      <VisibilityLabel repo={props.repo} />
      <div class="flex-1" />
      <div class="flex flex-wrap gap-2">
        <DeleteForkButton repo={props.repo} />
        <PinButton name={props.repo.full_name} />
        <Loading
          fallback={
            <>
              <button type="button" class="btn btn-sm" disabled>
                <Octicon icon={eyeIcon} /> Watch
              </button>
              <button type="button" class="btn btn-sm" disabled>
                <Octicon icon={starIcon} /> Star
              </button>
            </>
          }
        >
          <WatchButton repo={props.repo} />
          <ForkButton repo={props.repo} />
          <StarButton repo={props.repo} />
        </Loading>
      </div>
    </div>
  );
}

function WatchButton(props: { repo: Repository }) {
  const state = createMemo(() => getRepoViewerState(props.repo.owner.login, props.repo.name));
  const subscribe = useAction(setRepoSubscription);
  const set = (mode: 'watching' | 'ignoring' | 'none') =>
    subscribe(props.repo.owner.login, props.repo.name, mode).catch(toastError);
  const Option = (p: { mode: 'watching' | 'ignoring' | 'none'; title: string; desc: string; close: () => void }) => {
    const current = () =>
      ({ SUBSCRIBED: 'watching', IGNORED: 'ignoring' })[state().viewerSubscription as string] ?? 'none';
    return (
      <button
        type="button"
        class="SelectMenu-item items-start!"
        onClick={() => {
          p.close();
          void set(p.mode);
        }}
      >
        <span class="w-4 mt-0.5">
          <Show when={current() === p.mode}>
            <Octicon icon={checkIcon} />
          </Show>
        </span>
        <span>
          <span class="block font-semibold">{p.title}</span>
          <span class="block text-xs text-fg-muted font-normal">{p.desc}</span>
        </span>
      </button>
    );
  };
  return (
    <Dropdown
      class="btn btn-sm"
      align="right"
      menuClass="w-80"
      button={
        <>
          <Octicon icon={state().viewerSubscription === 'IGNORED' ? bellSlashIcon : eyeIcon} />
          {state().viewerSubscription === 'SUBSCRIBED' ? 'Unwatch' : 'Watch'}
          <span class="Counter">{compactNumber(props.repo.subscribers_count ?? props.repo.watchers_count)}</span>
          <Octicon icon={triangleDownIcon} />
        </>
      }
    >
      {(close) => (
        <>
          <Option mode="none" title="Participating and @mentions" desc="Only receive notifications from this repository when participating or @mentioned." close={close} />
          <Option mode="watching" title="All Activity" desc="Notified of all notifications on this repository." close={close} />
          <Option mode="ignoring" title="Ignore" desc="Never be notified." close={close} />
        </>
      )}
    </Dropdown>
  );
}

function ForkButton(props: { repo: Repository }) {
  return (
    <div class="BtnGroup">
      <a class="btn btn-sm" href={`/${props.repo.full_name}/fork`} aria-disabled={props.repo.allow_forking === false ? 'true' : undefined}>
        <Octicon icon={repoForkedIcon} />
        Fork
        <span class="Counter">{compactNumber(props.repo.forks_count)}</span>
      </a>
      <a class="btn btn-sm px-1.5!" href={`/${props.repo.full_name}/forks`} aria-label="See your forks of this repository">
        <Octicon icon={triangleDownIcon} />
      </a>
    </div>
  );
}

function StarButton(props: { repo: Repository }) {
  const state = createMemo(() => getRepoViewerState(props.repo.owner.login, props.repo.name));
  const star = useAction(starRepo);
  const [busy, setBusy] = createSignal(false);
  return (
    <button
      type="button"
      class="btn btn-sm"
      disabled={busy()}
      onClick={async () => {
        setBusy(true);
        try {
          await star(props.repo.owner.login, props.repo.name, !state().viewerHasStarred);
        } catch (e) {
          toastError(e);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Octicon icon={state().viewerHasStarred ? starFillIcon : starIcon} class={state().viewerHasStarred ? 'text-[#e3b341]!' : undefined} />
      {state().viewerHasStarred ? 'Starred' : 'Star'}
      <span class="Counter">{compactNumber(props.repo.stargazers_count)}</span>
    </button>
  );
}

