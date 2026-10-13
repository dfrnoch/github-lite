import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar } from '../../../components/ui';
import { locationIcon, organizationIcon } from '../../../icons/octicons';
import type { UserCard } from '../api';
import FollowButton from './FollowButton';

/** A person row (followers / following / org people): avatar, name + login, bio, Follow. */
export default function UserListItem(props: { user: UserCard; actions?: JSX.Element; hideFollow?: boolean }) {
  return (
    <li class="flex items-start gap-4 py-6 border-b border-line-muted list-none">
      <a href={`/${props.user.login}`} class="shrink-0">
        <Avatar src={props.user.avatarUrl} size={50} square={props.user.isOrg} />
      </a>
      <div class="flex-1 min-w-0">
        <a class="link-plain no-underline! group" href={`/${props.user.login}`}>
          <Show when={props.user.name}>
            <span class="text-base text-fg group-hover:underline mr-1">{props.user.name}</span>
          </Show>
          <span class={props.user.name ? 'text-fg-muted' : 'text-base text-fg'}>{props.user.login}</span>
        </a>
        <Show when={props.user.bio}>
          <p class="text-fg-muted text-sm mt-1 break-words">{props.user.bio}</p>
        </Show>
        <Show when={props.user.company || props.user.location}>
          <p class="flex flex-wrap gap-x-4 text-fg-muted text-sm mt-1">
            <Show when={props.user.company}>
              <span class="inline-flex items-center gap-1">
                <Octicon icon={organizationIcon} />
                {props.user.company}
              </span>
            </Show>
            <Show when={props.user.location}>
              <span class="inline-flex items-center gap-1">
                <Octicon icon={locationIcon} />
                {props.user.location}
              </span>
            </Show>
          </p>
        </Show>
      </div>
      <div class="shrink-0 flex items-center gap-2">
        {props.actions}
        <Show when={!props.hideFollow && !props.user.isViewer && !props.user.isOrg}>
          <FollowButton login={props.user.login} following={props.user.viewerIsFollowing} class="btn-sm" />
        </Show>
      </div>
    </li>
  );
}
