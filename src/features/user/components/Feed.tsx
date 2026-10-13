import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, For, Loading, Match, Show, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Blankslate, Markdown, RelativeTime, StateIcon, itemState } from '../../../components/ui';
import { commentIcon, gitBranchIcon, gitCommitIcon, rssIcon, starIcon, tagIcon } from '../../../icons/octicons';
import { compactNumber, shortSha } from '../../../lib/format';
import type { RepoSummary } from '../../profile/api';
import { LanguageBadge, StarButton } from '../../profile/components/RepoListItem';
import { type FeedExtras, type GitHubEvent, getFeedPage } from '../feed';

/** Consecutive events of the same kind by the same actor collapse into one card ("starred 3 repositories"). */
interface FeedGroup {
  key: string;
  type: string;
  actor: GitHubEvent['actor'];
  events: GitHubEvent[];
}

const GROUPABLE = new Set(['WatchEvent', 'ForkEvent', 'PublicEvent']);
const PULL_EVENTS = new Set(['PullRequestEvent', 'PullRequestReviewEvent', 'PullRequestReviewCommentEvent']);
const groupKind = (e: GitHubEvent) => {
  if (GROUPABLE.has(e.type) || (e.type === 'CreateEvent' && e.payload.ref_type === 'repository')) return `${e.type}:${e.actor.login}`;
  // A review and its review comments on one PR are a single card.
  if (PULL_EVENTS.has(e.type)) return `pull:${e.actor.login}:${e.repo.name}#${e.payload.number ?? e.payload.pull_request?.number}`;
  return null;
};

function groupEvents(events: GitHubEvent[]): FeedGroup[] {
  const out: FeedGroup[] = [];
  for (const e of events) {
    const kind = groupKind(e);
    const last = out[out.length - 1];
    if (kind && last && groupKind(last.events[0]!) === kind) last.events.push(e);
    else out.push({ key: e.id, type: e.type, actor: e.actor, events: [e] });
  }
  return out;
}

const repoLink = (name: string) => (
  <a class="font-semibold link-plain" href={`/${name}`}>
    {name}
  </a>
);
const refName = (ref: string) => ref.replace(/^refs\/(heads|tags)\//, '');
const excerpt = (text: string | null | undefined, n = 240) => {
  const t = (text ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

/** Mini repository card used by star / fork / create events. */
function RepoCard(props: { repo: RepoSummary | undefined; name: string }) {
  return (
    <Show
      when={props.repo}
      fallback={
        <div class="Box p-3 text-sm">
          {repoLink(props.name)}
        </div>
      }
    >
      {(r) => (
        <div class="Box p-4 flex gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <Avatar src={r().owner.avatarUrl} size={20} square={r().owner.isOrg} />
              <a class="font-semibold link-plain truncate" href={`/${r().fullName}`}>
                {r().fullName}
              </a>
            </div>
            <Show when={r().description}>
              <p class="text-sm text-fg-muted mt-2 break-words">
                <Show when={r().descriptionHTML} fallback={r().description}>
                  {/* oxlint-disable-next-line solid/no-innerhtml -- shortDescriptionHTML is rendered + sanitized by GitHub */}
                  {(html) => <span innerHTML={html()} />}
                </Show>
              </p>
            </Show>
            <div class="flex flex-wrap items-center gap-4 mt-2 text-xs text-fg-muted">
              <Show when={r().language}>{(l) => <LanguageBadge name={l().name} color={l().color} />}</Show>
              <span class="inline-flex items-center gap-1">
                <Octicon icon={starIcon} />
                {compactNumber(r().stars)}
              </span>
              <span>
                Updated <RelativeTime datetime={r().updatedAt} />
              </span>
            </div>
          </div>
          <div class="shrink-0">
            <StarButton repo={r()} />
          </div>
        </div>
      )}
    </Show>
  );
}

/** Issue / PR line: state icon, title, number. */
function ItemLine(props: {
  repo: string;
  number: number;
  isPull: boolean;
  title: string | undefined;
  state: string | undefined;
  stateReason?: string | null;
  merged?: boolean;
  draft?: boolean;
  meta?: JSX.Element;
}) {
  const href = () => `/${props.repo}/${props.isPull ? 'pull' : 'issues'}/${props.number}`;
  return (
    <div class="flex items-start gap-2">
      <Show when={props.state}>
        {(state) => (
          <StateIcon
            class="mt-0.5"
            state={itemState({ isPull: props.isPull, state: state(), stateReason: props.stateReason, merged: props.merged, draft: props.draft })}
          />
        )}
      </Show>
      <div class="min-w-0">
        <a class="font-semibold link-plain break-words" href={href()}>
          {props.title ?? `${props.repo}#${props.number}`}
        </a>{' '}
        <span class="text-fg-muted">#{props.number}</span>
        <Show when={props.meta}>
          <div class="text-xs text-fg-muted mt-1 flex flex-wrap gap-3">{props.meta}</div>
        </Show>
      </div>
    </div>
  );
}

function EventCard(props: { group: FeedGroup; extras: FeedExtras }) {
  // For a PR card, the opening/review event names the card; comments ride along.
  const ev = () =>
    props.group.events.find((e) => e.type === 'PullRequestEvent') ??
    props.group.events.find((e) => e.type === 'PullRequestReviewEvent') ??
    props.group.events[0]!;
  const reviewText = () => {
    for (const e of props.group.events) {
      const text = excerpt(e.payload.review?.body ?? e.payload.comment?.body);
      if (text) return text;
    }
    return '';
  };
  const p = () => ev().payload;
  const count = () => props.group.events.length;
  const pr = () => {
    const n = p().number ?? p().pull_request?.number;
    return { number: n as number, data: props.extras.pulls[`${ev().repo.name}#${n}`] };
  };

  const header = (): JSX.Element => {
    const e = ev();
    const action = p().action as string | undefined;
    switch (e.type) {
      case 'WatchEvent':
        return count() > 1 ? <>starred {count()} repositories</> : <>starred a repository</>;
      case 'ForkEvent':
        return count() > 1 ? <>forked {count()} repositories</> : <>forked {repoLink(e.repo.name)}</>;
      case 'PublicEvent':
        return count() > 1 ? <>made {count()} repositories public</> : <>made a repository public</>;
      case 'CreateEvent':
        if (p().ref_type === 'repository') return count() > 1 ? <>created {count()} repositories</> : <>created a repository</>;
        return (
          <>
            created {p().ref_type} <code class="font-mono text-xs px-1 rounded bg-accent-muted text-fg-accent">{p().ref}</code> in {repoLink(e.repo.name)}
          </>
        );
      case 'DeleteEvent':
        return (
          <>
            deleted {p().ref_type} <code class="font-mono text-xs px-1 rounded bg-canvas-muted">{p().ref}</code> in {repoLink(e.repo.name)}
          </>
        );
      case 'PushEvent':
        return (
          <>
            pushed to{' '}
            <a class="font-mono text-xs px-1 rounded bg-accent-muted text-fg-accent" href={`/${e.repo.name}/tree/${refName(p().ref ?? '')}`}>
              {refName(p().ref ?? '')}
            </a>{' '}
            in {repoLink(e.repo.name)}
          </>
        );
      case 'PullRequestEvent': {
        const verb = action === 'closed' && pr().data?.merged ? 'merged' : action;
        return (
          <>
            {verb} a pull request in {repoLink(e.repo.name)}
          </>
        );
      }
      case 'PullRequestReviewEvent':
        return <>reviewed a pull request in {repoLink(e.repo.name)}</>;
      case 'PullRequestReviewCommentEvent':
        return <>commented on a pull request review in {repoLink(e.repo.name)}</>;
      case 'IssuesEvent':
        return (
          <>
            {action} an issue in {repoLink(e.repo.name)}
          </>
        );
      case 'IssueCommentEvent':
        return (
          <>
            commented on {p().issue?.pull_request ? 'a pull request' : 'an issue'} in {repoLink(e.repo.name)}
          </>
        );
      case 'ReleaseEvent':
        return (
          <>
            released{' '}
            <a class="font-semibold link-plain" href={`/${e.repo.name}/releases/tag/${encodeURIComponent(p().release?.tag_name ?? '')}`}>
              {p().release?.name || p().release?.tag_name}
            </a>{' '}
            of {repoLink(e.repo.name)}
          </>
        );
      case 'MemberEvent':
        return (
          <>
            {action === 'added' ? 'added' : action}{' '}
            <a class="font-semibold link-plain" href={`/${p().member?.login}`}>
              {p().member?.login}
            </a>{' '}
            to {repoLink(e.repo.name)}
          </>
        );
      case 'GollumEvent':
        return <>updated the wiki in {repoLink(e.repo.name)}</>;
      case 'CommitCommentEvent':
        return <>commented on a commit in {repoLink(e.repo.name)}</>;
      default:
        return (
          <>
            {e.type.replace(/Event$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()} in {repoLink(e.repo.name)}
          </>
        );
    }
  };

  return (
    <article class="Box p-4">
      <header class="flex items-start gap-3">
        <a href={`/${props.group.actor.login}`} class="shrink-0">
          <Avatar src={props.group.actor.avatar_url} size={32} login={props.group.actor.login} square={props.group.actor.login.endsWith('[bot]')} />
        </a>
        <div class="flex-1 min-w-0 text-sm leading-8 break-words">
          <a class="font-semibold link-plain" href={`/${props.group.actor.login}`}>
            {props.group.actor.display_login ?? props.group.actor.login}
          </a>{' '}
          <span class="text-fg-muted">{header()}</span>
          <span class="text-fg-muted">
            {' · '}
            <RelativeTime datetime={ev().created_at} />
          </span>
        </div>
      </header>
      <div class="mt-3 ml-11 empty:hidden flex flex-col gap-2">
        <Switch>
          <Match when={['WatchEvent', 'ForkEvent', 'PublicEvent'].includes(ev().type) || (ev().type === 'CreateEvent' && p().ref_type === 'repository')}>
            <For each={props.group.events}>{(e) => <RepoCard name={e.repo.name} repo={props.extras.repos[e.repo.name]} />}</For>
          </Match>
          <Match when={ev().type === 'PushEvent'}>
            <div class="Box p-3 text-sm flex items-center gap-2">
              <Octicon icon={gitCommitIcon} class="text-fg-muted" />
              <a class="font-mono text-xs link-muted" href={`/${ev().repo.name}/commit/${p().head}`}>
                {shortSha(p().head ?? '')}
              </a>
              <span class="truncate">{props.extras.commits[p().head]?.messageHeadline ?? ''}</span>
              <span class="flex-1" />
              <Show when={p().before && !/^0+$/.test(p().before)}>
                <a class="text-xs whitespace-nowrap" href={`/${ev().repo.name}/compare/${shortSha(p().before)}...${shortSha(p().head)}`}>
                  Compare changes
                </a>
              </Show>
            </div>
          </Match>
          <Match when={['PullRequestEvent', 'PullRequestReviewEvent', 'PullRequestReviewCommentEvent'].includes(ev().type)}>
            <div class="Box p-3 text-sm">
              <ItemLine
                repo={ev().repo.name}
                number={pr().number}
                isPull
                title={pr().data?.title}
                state={pr().data?.state}
                merged={pr().data?.merged}
                draft={pr().data?.isDraft}
                meta={
                  <Show when={pr().data}>
                    {(d) => (
                      <>
                        <span>
                          <span class="text-fg-success">+{d().additions}</span> <span class="text-fg-danger">−{d().deletions}</span>
                        </span>
                        <span class="inline-flex items-center gap-1">
                          <Octicon icon={commentIcon} /> {d().comments}
                        </span>
                      </>
                    )}
                  </Show>
                }
              />
              <Show when={ev().type !== 'PullRequestEvent' && reviewText()}>
                <p class="text-fg-muted mt-2 break-words">{reviewText()}</p>
              </Show>
            </div>
          </Match>
          <Match when={ev().type === 'IssuesEvent' || ev().type === 'IssueCommentEvent'}>
            <div class="Box p-3 text-sm">
              <ItemLine
                repo={ev().repo.name}
                number={p().issue?.number}
                isPull={!!p().issue?.pull_request}
                title={p().issue?.title}
                state={p().issue?.state}
                stateReason={p().issue?.state_reason}
                merged={!!p().issue?.pull_request?.merged_at}
                draft={p().issue?.draft}
                meta={
                  <span class="inline-flex items-center gap-1">
                    <Octicon icon={commentIcon} /> {p().issue?.comments ?? 0}
                  </span>
                }
              />
              <Show when={excerpt(ev().type === 'IssueCommentEvent' ? p().comment?.body : p().action === 'opened' ? p().issue?.body : '')}>
                {(text) => <p class="text-fg-muted mt-2 break-words">{text()}</p>}
              </Show>
            </div>
          </Match>
          <Match when={ev().type === 'ReleaseEvent'}>
            <div class="Box p-4 text-sm">
              <div class="flex items-center gap-2 mb-1">
                <Octicon icon={tagIcon} class="text-fg-success" />
                <a class="font-semibold link-plain" href={`/${ev().repo.name}/releases/tag/${encodeURIComponent(p().release?.tag_name ?? '')}`}>
                  {p().release?.name || p().release?.tag_name}
                </a>
                <Show when={p().release?.prerelease}>
                  <span class="Label Label--attention">Pre-release</span>
                </Show>
              </div>
              <Show when={p().release?.short_description_html}>
                {(html) => <Markdown html={html()} class="text-sm max-h-48 overflow-hidden" />}
              </Show>
            </div>
          </Match>
          <Match when={ev().type === 'CreateEvent' && p().ref_type === 'branch'}>
            <a class="text-sm inline-flex items-center gap-1" href={`/${ev().repo.name}/compare/${encodeURIComponent(p().ref)}`}>
              <Octicon icon={gitBranchIcon} /> Compare &amp; pull request
            </a>
          </Match>
        </Switch>
      </div>
    </article>
  );
}

function FeedPageView(props: { login: string; page: number; isLast: boolean; onMore: () => void }) {
  const data = createMemo(() => getFeedPage(props.login, props.page));
  const groups = createMemo(() => groupEvents(data().events));
  return (
    <>
      <Show
        when={groups().length || props.page > 1}
        fallback={
          <Blankslate icon={rssIcon} title="Your feed is empty" class="Box">
            Follow people and star repositories to see their activity here.
          </Blankslate>
        }
      >
        <For each={groups()}>{(g) => <EventCard group={g} extras={data().extras} />}</For>
      </Show>
      <Show when={props.isLast}>
        <Show
          when={data().hasNext}
          fallback={
            <Show when={props.page > 1}>
              <p class="text-center text-xs text-fg-muted py-4">That’s all the recent activity GitHub keeps (90 days).</p>
            </Show>
          }
        >
          <button type="button" class="btn btn-block" onClick={() => props.onMore()}>
            More
          </button>
        </Show>
      </Show>
    </>
  );
}

/** The dashboard feed: events received by the viewer, paged with "More". */
export default function Feed(props: { login: string }) {
  const [pages, setPages] = createSignal(1);
  const list = () => Array.from({ length: pages() }, (_, i) => i + 1);
  return (
    <div class="flex flex-col gap-4">
      <For each={list()}>
        {(n) => (
          <Loading fallback={<FeedSkeleton />}>
            <FeedPageView login={props.login} page={n} isLast={n === pages()} onMore={() => setPages((p) => p + 1)} />
          </Loading>
        )}
      </For>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <For each={[1, 2, 3]}>
      {() => (
        <div class="Box p-4">
          <div class="flex items-center gap-3">
            <span class="w-8 h-8 rounded-full Skeleton" />
            <span class="h-3 w-1/2 rounded Skeleton" />
          </div>
          <div class="ml-11 mt-3 h-16 rounded-md Skeleton" />
        </div>
      )}
    </For>
  );
}
