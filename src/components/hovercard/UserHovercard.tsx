import { useAction } from '@solidjs/router';
import { createMemo, createSignal, For, Show } from 'solid-js';
import {
  checkCircleIcon,
  clockIcon,
  codeReviewIcon,
  commentDiscussionIcon,
  commentIcon,
  eyeIcon,
  gitCommitIcon,
  gitMergeIcon,
  gitPullRequestIcon,
  heartIcon,
  issueClosedIcon,
  issueOpenedIcon,
  locationIcon,
  markGithubIcon,
  mentionIcon,
  type OcticonData,
  organizationIcon,
  peopleIcon,
  personIcon,
  repoIcon,
  rocketIcon,
  starIcon,
  verifiedIcon,
} from '../../icons/octicons';
import { formatNumber } from '../../lib/format';
import Octicon from '../Octicon';
import Avatar from '../ui/Avatar';
import { toastError } from '../ui/Toast';
import { followFromHovercard, type HovercardData } from './api';

/** Octicon names used by GET /users/{login}/hovercard contexts. */
const OCTICONS: Record<string, OcticonData> = {
  'check-circle': checkCircleIcon,
  clock: clockIcon,
  'code-review': codeReviewIcon,
  comment: commentIcon,
  'comment-discussion': commentDiscussionIcon,
  eye: eyeIcon,
  'git-commit': gitCommitIcon,
  'git-merge': gitMergeIcon,
  'git-pull-request': gitPullRequestIcon,
  heart: heartIcon,
  'issue-closed': issueClosedIcon,
  'issue-opened': issueOpenedIcon,
  location: locationIcon,
  'mark-github': markGithubIcon,
  mention: mentionIcon,
  organization: organizationIcon,
  people: peopleIcon,
  person: personIcon,
  repo: repoIcon,
  rocket: rocketIcon,
  star: starIcon,
};

/**
 * Context message with its references linked: `@org` → the org, `org/team`
 * in "Member of …" lines → the team, `owner/repo` elsewhere → the repo.
 */
function ContextMessage(props: { message: string }) {
  const parts = createMemo(() => {
    const member = props.message.startsWith('Member of');
    return props.message
      .split(/(@?[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]*[A-Za-z0-9_-]|@[A-Za-z0-9][A-Za-z0-9-]*)/g)
      .map((text, i) => {
        if (i % 2 === 0) return { text, href: null };
        const ref = text.replace(/^@/, '');
        const [org, rest] = ref.split('/');
        const href = !rest ? `/${org}` : member ? `/orgs/${org}/teams/${rest}` : `/${org}/${rest}`;
        return { text: ref, href };
      });
  });
  return (
    <For each={parts()}>
      {(part) => (
        <Show when={part.href} fallback={part.text}>
          {(href) => (
            <a class="link-muted text-fg-muted! hover:text-fg-accent!" href={href()}>
              {part.text}
            </a>
          )}
        </Show>
      )}
    </For>
  );
}

function Row(props: { icon: OcticonData; children: any }) {
  return (
    <li class="flex items-start gap-2 mt-1.5 text-xs text-fg-muted">
      <Octicon icon={props.icon} class="shrink-0 mt-px" />
      <span class="min-w-0 break-words">{props.children}</span>
    </li>
  );
}

function FollowButton(props: { login: string; following: boolean }) {
  const [following, setFollowing] = createSignal(() => props.following);
  const [busy, setBusy] = createSignal(false);
  const follow = useAction(followFromHovercard);
  const toggle = async () => {
    const next = !following();
    setFollowing(next);
    setBusy(true);
    try {
      await follow(props.login, next);
    } catch (e) {
      setFollowing(!next);
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" class="btn btn-sm" disabled={busy()} onClick={() => void toggle()}>
      {following() ? 'Unfollow' : 'Follow'}
    </button>
  );
}

/** github.com's user / organization hovercard body. */
export default function UserHovercard(props: { data: HovercardData }) {
  const d = () => props.data;
  const isOrg = () => d().type === 'Organization';
  const href = () => `/${d().login}`;
  return (
    <div>
      <Show when={d().status}>
        {(status) => (
          <div class="flex items-center gap-2 px-4 py-2 border-b border-line text-sm text-fg-muted Hovercard-emoji">
            <Show when={status().emojiHTML}>
              {/* oxlint-disable-next-line solid/no-innerhtml -- emoji HTML from GitHub */}
              {(html) => <span class="shrink-0 [&>div]:inline" innerHTML={html()} />}
            </Show>
            <span class="truncate">{status().message}</span>
          </div>
        )}
      </Show>
      <div class="p-4">
        <div class="flex items-start justify-between gap-2">
          <a href={href()} class="flex shrink-0" aria-label={`@${d().login}`}>
            <Avatar src={d().avatarUrl} login={d().login} size={60} square={isOrg()} />
          </a>
          <Show when={!isOrg() && !d().isViewer && d().viewerCanFollow}>
            <FollowButton login={d().login} following={d().viewerIsFollowing} />
          </Show>
        </div>
        <div class="mt-2 leading-snug break-words">
          <a class="font-semibold text-fg link-plain hover:text-fg-accent!" href={href()}>
            {d().login}
          </a>
          <Show when={d().name}>
            <span class="text-fg-muted ml-1">{d().name}</span>
          </Show>
          <Show when={d().pronouns}>
            <span class="text-fg-muted"> · {d().pronouns}</span>
          </Show>
          <Show when={d().isVerified}>
            <span class="Label Label--success ml-1 align-middle">
              <Octicon icon={verifiedIcon} size={12} class="mr-1" />
              Verified
            </span>
          </Show>
        </div>
        <Show when={d().bio}>
          <p class="mt-1 text-sm break-words">{d().bio}</p>
        </Show>
        <ul class="mt-1">
          <Show when={d().location}>
            <Row icon={locationIcon}>{d().location}</Row>
          </Show>
          <Show when={isOrg()}>
            <Row icon={repoIcon}>
              <a class="link-muted text-fg-muted! hover:text-fg-accent!" href={`/orgs/${d().login}/repositories`}>
                {formatNumber(d().repositories ?? 0)} {d().repositories === 1 ? 'repository' : 'repositories'}
              </a>
            </Row>
            <Show when={d().members}>
              <Row icon={peopleIcon}>
                <a class="link-muted text-fg-muted! hover:text-fg-accent!" href={`/orgs/${d().login}/people`}>
                  {formatNumber(d().members ?? 0)} {d().members === 1 ? 'member' : 'members'}
                </a>
              </Row>
            </Show>
          </Show>
          <For each={d().contexts.filter((c) => c.octicon !== 'location')}>
            {(c) => (
              <Row icon={OCTICONS[c.octicon] ?? markGithubIcon}>
                <ContextMessage message={c.message} />
              </Row>
            )}
          </For>
        </ul>
      </div>
    </div>
  );
}
