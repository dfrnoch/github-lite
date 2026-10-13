import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, For, Match, onSettled, Show, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Dropdown, Markdown, RelativeTime, StateBadge, itemState, toast } from '../../../components/ui';
import {
  bookIcon,
  checkIcon,
  commentIcon,
  dotFillIcon,
  eyeClosedIcon,
  eyeIcon,
  fileDiffIcon,
  gitBranchIcon,
  gitCommitIcon,
  gitMergeIcon,
  gitPullRequestClosedIcon,
  gitPullRequestIcon,
  issueClosedIcon,
  issueOpenedIcon,
  kebabHorizontalIcon,
  linkIcon,
  personAddIcon,
  pinIcon,
  repoForkedIcon,
  repoIcon,
  repoPushIcon,
  skipIcon,
  smileyIcon,
  starFillIcon,
  starIcon,
  tagIcon,
  trashIcon,
  triangleDownIcon,
} from '../../../icons/octicons';
import type { OcticonData } from '../../../icons/octicons';
import { compactNumber, shortSha } from '../../../lib/format';
import type { RepoSummary } from '../../profile/api';
import { LanguageBadge, StarButton } from '../../profile/components/RepoListItem';
import { type FeedExtras, type FeedItem, type FeedReaction, type GitHubEvent, eventCommentId, eventItemNumber } from '../feed';
import { hideFeedRepo } from '../feedPrefs';
import { isPinned, togglePin } from '../pins';

/** Consecutive events of the same kind by the same actor collapse into one card ("starred 3 repositories"). */
export interface FeedGroup {
  key: string;
  type: string;
  actor: GitHubEvent['actor'];
  events: GitHubEvent[];
}

const REPO_EVENTS = new Set(['WatchEvent', 'ForkEvent', 'PublicEvent']);
const PULL_EVENTS = new Set(['PullRequestEvent', 'PullRequestReviewEvent', 'PullRequestReviewCommentEvent']);
const isRepoEvent = (e: GitHubEvent) => REPO_EVENTS.has(e.type) || (e.type === 'CreateEvent' && e.payload.ref_type === 'repository');

const groupKind = (e: GitHubEvent) => {
  if (isRepoEvent(e)) return `${e.type}:${e.actor.login}`;
  // A review and its review comments on one PR are a single card.
  if (PULL_EVENTS.has(e.type)) return `pull:${e.actor.login}:${e.repo.name}#${eventItemNumber(e)}`;
  return null;
};

export function groupEvents(events: GitHubEvent[]): FeedGroup[] {
  const out: FeedGroup[] = [];
  for (const e of events) {
    const kind = groupKind(e);
    const last = out[out.length - 1];
    if (kind && last && groupKind(last.events[0]!) === kind) last.events.push(e);
    else out.push({ key: e.id, type: e.type, actor: e.actor, events: [e] });
  }
  return out;
}

const EMOJI: Record<string, string> = {
  THUMBS_UP: '👍',
  THUMBS_DOWN: '👎',
  LAUGH: '😄',
  HOORAY: '🎉',
  CONFUSED: '😕',
  HEART: '❤️',
  ROCKET: '🚀',
  EYES: '👀',
};

const refName = (ref: string) => ref.replace(/^refs\/(heads|tags)\//, '');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const strong = (text: string, href: string) => (
  <a class="font-semibold link-plain" href={href}>
    {text}
  </a>
);

/** Logins @mentioned in rendered HTML (release notes credit contributors that way). */
function mentionedLogins(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/class="[^"]*\buser-mention\b[^"]*"[^>]*>@([A-Za-z\d-]+(?:\[bot\])?)</g)) out.add(m[1]!);
  return [...out];
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** 40px avatar with a small colored event badge at its bottom-right. */
function BadgedAvatar(props: { href: string; src?: string; login: string; square?: boolean; icon: OcticonData; badge: string; label: string }) {
  return (
    <a href={props.href} class="relative block shrink-0 w-10 h-10" aria-label={props.login}>
      <Avatar src={props.src} login={props.login} size={40} square={props.square} />
      <span
        class={['absolute -right-1.5 -bottom-1.5 flex items-center justify-center w-5 h-5 rounded-full text-fg-on-emphasis', props.badge]}
        style={{ 'box-shadow': '0 0 0 2px var(--bgColor-default)' }}
        title={props.label}
      >
        <Octicon icon={props.icon} size={12} />
      </span>
    </a>
  );
}

/** Rendered markdown in a muted box, clamped to ~4 lines with a "Read more" link when it overflows. */
function Excerpt(props: { html: string; href: string }) {
  const [overflows, setOverflows] = createSignal(false, { name: 'excerptOverflows' });
  let box!: HTMLDivElement;
  onSettled(() => {
    const check = () => setOverflows(box.scrollHeight > box.clientHeight + 2);
    const ro = new ResizeObserver(check);
    ro.observe(box);
    if (box.firstElementChild) ro.observe(box.firstElementChild);
    check();
    return () => ro.disconnect();
  });
  return (
    <div class="mt-3 rounded-md bg-canvas-muted px-4 py-3">
      <div
        ref={box}
        class={['max-h-[96px] overflow-hidden', { '[mask-image:linear-gradient(to_bottom,black_55%,transparent)]': overflows() }]}
      >
        <Markdown html={props.html} />
      </div>
      <Show when={overflows()}>
        <a class="inline-block mt-1 text-sm font-semibold" href={props.href}>
          Read more
        </a>
      </Show>
    </div>
  );
}

/** Reactions row (read-only pills) plus a comment count on the right. */
function CardFooter(props: { reactions: FeedReaction[] | undefined; href: string; comments?: number; commentsHref?: string }) {
  return (
    <div class="flex flex-wrap items-center gap-2 mt-3">
      <a class="btn-octicon w-7! h-7! rounded-full! border border-line" href={props.href} title="Add a reaction" aria-label="Add a reaction">
        <Octicon icon={smileyIcon} />
      </a>
      <For each={props.reactions ?? []}>
        {(r) => (
          <span
            class={[
              'inline-flex items-center gap-1.5 h-7 px-2 rounded-full border text-xs font-medium',
              r.viewerHasReacted ? 'bg-accent-muted border-line-accent text-fg-accent' : 'border-line text-fg-muted',
            ]}
            title={`${r.count} ${r.content.toLowerCase().replace('_', ' ')}`}
          >
            <span class="text-sm">{EMOJI[r.content] ?? ''}</span>
            {r.count}
          </span>
        )}
      </For>
      <span class="flex-1" />
      <Show when={props.comments !== undefined}>
        <a class="inline-flex items-center gap-1.5 text-sm link-muted" href={props.commentsHref ?? props.href}>
          <Octicon icon={commentIcon} />
          {plural(props.comments ?? 0, 'comment')}
        </a>
      </Show>
    </div>
  );
}

/** Star + ▾ button group (the ▾ menu pins the repo to the dashboard). */
export function StarGroup(props: { repo: RepoSummary }) {
  return (
    <div class="BtnGroup shrink-0">
      <StarButton repo={props.repo} />
      <Dropdown class="btn btn-sm px-1.5!" align="right" menuClass="w-60" title="More actions" button={<Octicon icon={triangleDownIcon} />}>
        {(close) => (
          <>
            <button
              type="button"
              class="SelectMenu-item"
              onClick={() => {
                close();
                togglePin(props.repo.fullName);
              }}
            >
              <Octicon icon={pinIcon} />
              {isPinned(props.repo.fullName) ? 'Unpin from dashboard' : 'Pin to dashboard'}
            </button>
            <a class="SelectMenu-item" href="/stars" onClick={close}>
              <Octicon icon={starIcon} />
              Your stars
            </a>
          </>
        )}
      </Dropdown>
    </div>
  );
}

/** Compact repository row: avatar + name, description, language · stars, Star group on the right. */
export function RepoRow(props: { repo: RepoSummary; class?: string }) {
  return (
    <div class={['flex gap-4 items-start', props.class]}>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 min-w-0">
          <Avatar src={props.repo.owner.avatarUrl} size={20} square={props.repo.owner.isOrg} />
          <a class="font-semibold link-plain truncate" href={`/${props.repo.fullName}`}>
            {props.repo.fullName}
          </a>
        </div>
        <Show when={props.repo.description}>
          <p class="text-sm text-fg-muted mt-1.5 break-words line-clamp-2">
            <Show when={props.repo.descriptionHTML} fallback={props.repo.description}>
              {/* oxlint-disable-next-line solid/no-innerhtml -- shortDescriptionHTML is rendered + sanitized by GitHub */}
              {(html) => <span innerHTML={html()} />}
            </Show>
          </p>
        </Show>
        <div class="flex flex-wrap items-center gap-4 mt-2 text-xs text-fg-muted">
          <Show when={props.repo.language}>{(l) => <LanguageBadge name={l().name} color={l().color} />}</Show>
          <a class="inline-flex items-center gap-1 link-muted" href={`/${props.repo.fullName}/stargazers`}>
            <Octicon icon={starIcon} />
            {compactNumber(props.repo.stars)}
          </a>
        </div>
      </div>
      <StarGroup repo={props.repo} />
    </div>
  );
}

function RepoCard(props: { repo: RepoSummary | undefined; name: string }) {
  return (
    <Show
      when={props.repo}
      fallback={
        <div class="Box rounded-md p-4 text-sm">
          {strong(props.name, `/${props.name}`)}
        </div>
      }
    >
      {(r) => <RepoRow repo={r()} class="Box rounded-md p-4" />}
    </Show>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

interface Badge {
  icon: OcticonData;
  cls: string;
  label: string;
}

const NEUTRAL = 'bg-neutral-emphasis';

export default function EventCard(props: { group: FeedGroup; extras: FeedExtras }) {
  // For a PR card, the opening/review event names the card; comments ride along.
  const ev = createMemo(
    () =>
      props.group.events.find((e) => e.type === 'PullRequestEvent') ??
      props.group.events.find((e) => e.type === 'PullRequestReviewEvent') ??
      props.group.events[0]!,
  );
  const p = () => ev().payload;
  const repo = () => ev().repo.name;
  const count = () => props.group.events.length;
  const number = () => eventItemNumber(ev());
  const item = (): FeedItem | undefined => props.extras.items[`${repo()}#${number()}`];
  const isPull = () => (item() ? item()!.kind === 'pull' : PULL_EVENTS.has(ev().type) || !!p().issue?.pull_request);
  const itemHref = () => `/${repo()}/${isPull() ? 'pull' : 'issues'}/${number()}`;
  const release = () => (ev().type === 'ReleaseEvent' ? props.extras.releases[`${repo()}@${p().release?.tag_name}`] : undefined);
  const releaseHref = () => `/${repo()}/releases/tag/${encodeURIComponent(p().release?.tag_name ?? '')}`;
  const owner = () => props.extras.owners[repo()];
  const isItem = () => number() !== undefined && /^(PullRequest|PullRequestReview|PullRequestReviewComment|Issues|IssueComment)Event$/.test(ev().type);

  /** The comment / review shown in the excerpt box (first one in the group with a body). */
  const comment = () => {
    for (const e of props.group.events) {
      const id = eventCommentId(e);
      if (id && props.extras.comments[id]?.bodyHTML) return props.extras.comments[id];
    }
    return undefined;
  };

  /** Canonical link for the card (kebab "Copy link"). */
  const href = () => {
    if (isItem()) return comment()?.url ? new URL(comment()!.url!).pathname + new URL(comment()!.url!).hash : itemHref();
    if (ev().type === 'ReleaseEvent') return releaseHref();
    return `/${repo()}`;
  };

  const badge = (): Badge => {
    const e = ev();
    const action = p().action as string | undefined;
    switch (e.type) {
      case 'WatchEvent':
        return { icon: starFillIcon, cls: 'bg-attention-emphasis', label: 'Starred' };
      case 'ForkEvent':
        return { icon: repoForkedIcon, cls: NEUTRAL, label: 'Forked' };
      case 'PublicEvent':
        return { icon: repoIcon, cls: 'bg-accent-emphasis', label: 'Made public' };
      case 'CreateEvent':
        if (p().ref_type === 'repository') return { icon: repoIcon, cls: 'bg-accent-emphasis', label: 'Created' };
        return { icon: p().ref_type === 'tag' ? tagIcon : gitBranchIcon, cls: NEUTRAL, label: `Created ${p().ref_type}` };
      case 'DeleteEvent':
        return { icon: trashIcon, cls: NEUTRAL, label: `Deleted ${p().ref_type}` };
      case 'PushEvent':
        return { icon: repoPushIcon, cls: NEUTRAL, label: 'Pushed' };
      case 'ReleaseEvent':
        return { icon: tagIcon, cls: 'bg-success-emphasis', label: 'Released' };
      case 'MemberEvent':
        return { icon: personAddIcon, cls: 'bg-accent-emphasis', label: 'Member added' };
      case 'GollumEvent':
        return { icon: bookIcon, cls: NEUTRAL, label: 'Wiki' };
      case 'IssueCommentEvent':
      case 'PullRequestReviewCommentEvent':
      case 'CommitCommentEvent':
        return { icon: commentIcon, cls: 'bg-accent-emphasis', label: 'Commented' };
      case 'PullRequestReviewEvent': {
        const state = p().review?.state;
        if (state === 'approved') return { icon: checkIcon, cls: 'bg-success-emphasis', label: 'Approved' };
        if (state === 'changes_requested') return { icon: fileDiffIcon, cls: 'bg-danger-emphasis', label: 'Changes requested' };
        return { icon: eyeIcon, cls: NEUTRAL, label: 'Reviewed' };
      }
      case 'PullRequestEvent': {
        if (action === 'merged' || item()?.merged) return { icon: gitMergeIcon, cls: 'bg-done-emphasis', label: 'Merged' };
        if (action === 'closed' || item()?.state === 'CLOSED') return { icon: gitPullRequestClosedIcon, cls: 'bg-closed-emphasis', label: 'Closed' };
        return { icon: gitPullRequestIcon, cls: 'bg-open-emphasis', label: 'Opened' };
      }
      case 'IssuesEvent': {
        if (action === 'closed' || item()?.state === 'CLOSED') {
          const reason = (item()?.stateReason ?? p().issue?.state_reason ?? '').toLowerCase();
          return reason === 'not_planned' || reason === 'duplicate'
            ? { icon: skipIcon, cls: NEUTRAL, label: 'Closed as not planned' }
            : { icon: issueClosedIcon, cls: 'bg-done-emphasis', label: 'Closed' };
        }
        return { icon: issueOpenedIcon, cls: 'bg-open-emphasis', label: 'Opened' };
      }
      default:
        return { icon: dotFillIcon, cls: NEUTRAL, label: e.type.replace(/Event$/, '') };
    }
  };

  /** Releases are attributed to the repository (github.com: "owner/repo released"). */
  const subjectIsRepo = () => ev().type === 'ReleaseEvent';

  const headline = (): JSX.Element => {
    const e = ev();
    const action = p().action as string | undefined;
    const r = strong(e.repo.name, `/${e.repo.name}`);
    const prNoun = isPull() ? 'a pull request' : 'an issue';
    switch (e.type) {
      case 'WatchEvent':
        return count() > 1 ? <>starred {count()} repositories</> : <>starred {r}</>;
      case 'ForkEvent':
        return count() > 1 ? <>forked {count()} repositories</> : <>forked {r}</>;
      case 'PublicEvent':
        return count() > 1 ? <>made {count()} repositories public</> : <>made {r} public</>;
      case 'CreateEvent':
        if (p().ref_type === 'repository') return count() > 1 ? <>created {count()} repositories</> : <>created {r}</>;
        return (
          <>
            created {p().ref_type} <code class="font-mono text-sm px-1 rounded bg-accent-muted text-fg-accent">{p().ref}</code> in {r}
          </>
        );
      case 'DeleteEvent':
        return (
          <>
            deleted {p().ref_type} <code class="font-mono text-sm px-1 rounded bg-canvas-muted">{p().ref}</code> in {r}
          </>
        );
      case 'PushEvent':
        return (
          <>
            pushed to{' '}
            <a class="font-mono text-sm px-1 rounded bg-accent-muted text-fg-accent" href={`/${e.repo.name}/tree/${refName(p().ref ?? '')}`}>
              {refName(p().ref ?? '')}
            </a>{' '}
            in {r}
          </>
        );
      case 'PullRequestEvent':
        if (action === 'merged' || (action === 'closed' && item()?.merged)) return <>contributed to {r}</>;
        return (
          <>
            {action === 'labeled' || action === 'unlabeled' ? 'labeled' : action} a pull request in {r}
          </>
        );
      case 'PullRequestReviewEvent': {
        const state = p().review?.state;
        if (state === 'approved') return <>approved a pull request in {r}</>;
        if (state === 'changes_requested') return <>requested changes in {r}</>;
        return <>reviewed a pull request in {r}</>;
      }
      case 'PullRequestReviewCommentEvent':
        return <>commented on a pull request in {r}</>;
      case 'IssuesEvent':
        return (
          <>
            {action} an issue in {r}
          </>
        );
      case 'IssueCommentEvent':
        return (
          <>
            commented on {prNoun} in {r}
          </>
        );
      case 'ReleaseEvent':
        return <>released</>;
      case 'MemberEvent':
        return (
          <>
            added {strong(p().member?.login ?? '', `/${p().member?.login}`)} to {r}
          </>
        );
      case 'GollumEvent':
        return <>updated the wiki in {r}</>;
      case 'CommitCommentEvent':
        return <>commented on a commit in {r}</>;
      default:
        return (
          <>
            {e.type.replace(/Event$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()} in {r}
          </>
        );
    }
  };

  /** "medvednikov merged 1 commit" under a PR / issue title. */
  const stateLine = () => {
    const it = item();
    if (!it) return '';
    const actor = ev().actor.login;
    if (it.kind === 'pull') {
      if (it.merged) return `${it.mergedBy ?? (ev().type === 'PullRequestEvent' ? actor : 'ghost')} merged ${plural(it.commits, 'commit')}`;
      if (it.state === 'OPEN') return `${it.author ?? 'ghost'} wants to merge ${plural(it.commits, 'commit')}`;
      return `${it.author ?? 'ghost'}’s pull request was closed`;
    }
    if (it.state === 'OPEN') return `${it.author ?? 'ghost'} opened this issue`;
    const reason = it.stateReason?.toLowerCase();
    return reason === 'not_planned' ? 'Closed as not planned' : reason === 'duplicate' ? 'Closed as duplicate' : 'Closed as completed';
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(new URL(href(), location.origin).href);
      toast('Link copied');
    } catch {
      toast('Could not copy the link', 'error');
    }
  };

  const contributors = createMemo(() => {
    const rel = release();
    if (!rel) return [];
    if (rel.mentions.length) return rel.mentions;
    return mentionedLogins(rel.descriptionHTML)
      .slice(0, 12)
      .map((login) => ({ login, avatarUrl: null as string | null }));
  });

  return (
    <article class="Box rounded-xl! p-4 sm:p-5">
      <header class="flex items-start gap-3">
        <Show
          when={subjectIsRepo()}
          fallback={
            <BadgedAvatar
              href={`/${props.group.actor.login}`}
              src={props.group.actor.avatar_url}
              login={props.group.actor.login}
              square={props.group.actor.login.endsWith('[bot]')}
              icon={badge().icon}
              badge={badge().cls}
              label={badge().label}
            />
          }
        >
          <BadgedAvatar
            href={`/${repo()}`}
            src={owner()?.avatarUrl ?? props.group.events[0]!.org?.avatar_url}
            login={repo().split('/')[0]!}
            square={owner()?.isOrg ?? !!props.group.events[0]!.org}
            icon={badge().icon}
            badge={badge().cls}
            label={badge().label}
          />
        </Show>
        <div class="flex-1 min-w-0">
          <div class="text-base leading-6 break-words">
            <Show
              when={subjectIsRepo()}
              fallback={strong(props.group.actor.display_login ?? props.group.actor.login, `/${props.group.actor.login}`)}
            >
              {strong(repo(), `/${repo()}`)}
            </Show>{' '}
            {headline()}
          </div>
          <div class="text-sm text-fg-muted">
            <RelativeTime datetime={ev().created_at} relative />
          </div>
        </div>
        <Dropdown
          class="btn-octicon -mr-2 -mt-1"
          align="right"
          menuClass="w-72"
          title="More options"
          button={<Octicon icon={kebabHorizontalIcon} aria-label="More options" />}
        >
          {(close) => (
            <>
              <button
                type="button"
                class="SelectMenu-item"
                onClick={() => {
                  close();
                  hideFeedRepo(repo());
                  toast(`Events from ${repo()} are hidden. Undo from the Filter menu.`);
                }}
              >
                <Octicon icon={eyeClosedIcon} />
                <span class="truncate">Hide events from {repo()}</span>
              </button>
              <button
                type="button"
                class="SelectMenu-item"
                onClick={() => {
                  close();
                  void copyLink();
                }}
              >
                <Octicon icon={linkIcon} />
                Copy link
              </button>
            </>
          )}
        </Dropdown>
      </header>

      <Switch>
        <Match when={isRepoEvent(ev())}>
          <div class="mt-4 flex flex-col gap-3">
            <For each={props.group.events}>{(e) => <RepoCard name={e.repo.name} repo={props.extras.repos[e.repo.name]} />}</For>
          </div>
        </Match>

        <Match when={isItem()}>
          <div class="mt-4">
            <h3 class="text-xl leading-7 font-semibold break-words">
              <a class="link-plain" href={itemHref()}>
                {item()?.title ?? p().issue?.title ?? `${repo()}#${number()}`}
              </a>{' '}
              <span class="font-normal text-fg-muted">#{number()}</span>
            </h3>
            <Show when={item()}>
              {(it) => (
                <div class="flex flex-wrap items-center gap-2 mt-2 text-sm text-fg-muted">
                  <StateBadge
                    small
                    state={itemState({ isPull: it().kind === 'pull', state: it().state, stateReason: it().stateReason, merged: it().merged, draft: it().isDraft })}
                  />
                  <span>{stateLine()}</span>
                </div>
              )}
            </Show>
            <Show when={comment()?.bodyHTML || item()?.bodyHTML}>
              {(html) => <Excerpt html={html()} href={href()} />}
            </Show>
            <CardFooter
              reactions={comment() ? comment()!.reactions : item()?.reactions}
              href={href()}
              comments={item()?.comments ?? p().issue?.comments}
              commentsHref={itemHref()}
            />
          </div>
        </Match>

        <Match when={ev().type === 'ReleaseEvent'}>
          <div class="mt-4">
            <h3 class="text-xl leading-7 font-semibold break-words flex flex-wrap items-center gap-2">
              <a class="link-plain" href={releaseHref()}>
                {release()?.name || p().release?.name || p().release?.tag_name}
              </a>
              <Show when={release()?.isPrerelease ?? p().release?.prerelease}>
                <span class="Label Label--attention">Pre-release</span>
              </Show>
            </h3>
            <Show when={release()?.descriptionHTML}>{(html) => <Excerpt html={html()} href={releaseHref()} />}</Show>
            <Show when={contributors().length}>
              <div class="mt-3">
                <div class="text-sm font-semibold mb-2">Contributors</div>
                <div class="flex flex-wrap gap-1">
                  <For each={contributors()}>
                    {(u) => (
                      <a href={`/${u.login}`} title={u.login}>
                        <Avatar src={u.avatarUrl} login={u.login} size={24} />
                      </a>
                    )}
                  </For>
                </div>
              </div>
            </Show>
            <CardFooter reactions={release()?.reactions} href={releaseHref()} />
          </div>
        </Match>

        <Match when={ev().type === 'PushEvent'}>
          <div class="mt-4 rounded-md bg-canvas-muted px-4 py-3 text-sm flex items-center gap-2 min-w-0">
            <Octicon icon={gitCommitIcon} class="text-fg-muted shrink-0" />
            <a class="font-mono text-xs link-muted shrink-0" href={`/${repo()}/commit/${p().head}`}>
              {shortSha(p().head ?? '')}
            </a>
            <span class="truncate">{props.extras.commits[p().head]?.messageHeadline ?? ''}</span>
            <span class="flex-1" />
            <Show when={p().before && !/^0+$/.test(p().before)}>
              <a class="text-xs whitespace-nowrap" href={`/${repo()}/compare/${shortSha(p().before)}...${shortSha(p().head)}`}>
                Compare changes
              </a>
            </Show>
          </div>
        </Match>

        <Match when={ev().type === 'CreateEvent' && p().ref_type === 'branch'}>
          <a class="mt-3 text-sm inline-flex items-center gap-1" href={`/${repo()}/compare/${encodeURIComponent(p().ref)}`}>
            <Octicon icon={gitBranchIcon} /> Compare &amp; pull request
          </a>
        </Match>
      </Switch>
    </article>
  );
}
