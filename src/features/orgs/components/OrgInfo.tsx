import { createMemo, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar } from '../../../components/ui';
import { linkIcon, locationIcon, mailIcon, peopleIcon, verifiedIcon } from '../../../icons/octicons';
import { compactNumber } from '../../../lib/format';
import { getViewerFollows, type OrgProfile } from '../../profile/api';
import FollowButton from '../../profile/components/FollowButton';

const withProtocol = (url: string) => (/^https?:\/\//.test(url) ? url : `https://${url}`);

/** Organization identity block: avatar, name, verified badge, description, links, Follow. */
export default function OrgInfo(props: { org: OrgProfile }) {
  const follows = createMemo(() => getViewerFollows(props.org.login));
  return (
    <div class="border-b border-line-muted">
      <div class="container-xl px-4 md:px-6 lg:px-8 py-6 flex flex-col md:flex-row md:items-start gap-4">
        <Avatar src={props.org.avatarUrl} size={100} square class="shrink-0 w-[100px]! h-[100px]!" />
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-2xl font-semibold leading-tight">{props.org.name ?? props.org.login}</h1>
            <Show when={props.org.isVerified}>
              <span class="Label Label--success inline-flex items-center gap-1" title="GitHub has verified this organization's domain">
                <Octicon icon={verifiedIcon} size={12} /> Verified
              </span>
            </Show>
          </div>
          <Show when={props.org.descriptionHTML || props.org.description}>
            <div class="text-fg-muted mt-1">
              <Show when={props.org.descriptionHTML} fallback={props.org.description}>
                {/* oxlint-disable-next-line solid/no-innerhtml -- descriptionHTML is rendered + sanitized by GitHub */}
                {(html) => <span innerHTML={html()} />}
              </Show>
            </div>
          </Show>
          <ul class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-fg-muted">
            <li class="inline-flex items-center gap-1">
              <Octicon icon={peopleIcon} />
              <span class="font-semibold text-fg">{compactNumber(props.org.followers)}</span> followers
            </li>
            <Show when={props.org.location}>
              <li class="inline-flex items-center gap-1">
                <Octicon icon={locationIcon} />
                {props.org.location}
              </li>
            </Show>
            <Show when={props.org.websiteUrl}>
              {(url) => (
                <li class="inline-flex items-center gap-1">
                  <Octicon icon={linkIcon} />
                  <a class="link-plain font-semibold" href={withProtocol(url())} target="_blank" rel="nofollow noreferrer">
                    {url().replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                </li>
              )}
            </Show>
            <Show when={props.org.twitterUsername}>
              {(t) => (
                <li class="inline-flex items-center gap-1">
                  <Octicon icon={linkIcon} />
                  <a class="link-plain font-semibold" href={`https://x.com/${t()}`} target="_blank" rel="nofollow noreferrer">
                    @{t()}
                  </a>
                </li>
              )}
            </Show>
            <Show when={props.org.email}>
              {(email) => (
                <li class="inline-flex items-center gap-1">
                  <Octicon icon={mailIcon} />
                  <a class="link-plain font-semibold" href={`mailto:${email()}`}>
                    {email()}
                  </a>
                </li>
              )}
            </Show>
          </ul>
        </div>
        <Loading fallback={<button type="button" class="btn btn-sm" disabled>Follow</button>}>
          <FollowButton login={props.org.login} following={follows()} class="btn-sm" />
        </Loading>
      </div>
    </div>
  );
}
