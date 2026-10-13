import type { JSX } from '@solidjs/web';
import { For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, IssueLabel, RelativeTime, StateIcon, itemState } from '../../../components/ui';
import {
  checkCircleIcon,
  commentDiscussionIcon,
  commentIcon,
  locationIcon,
  repoForkedIcon,
  repoIcon,
  starIcon,
} from '../../../icons/octicons';
import { compactNumber, commitTitle, shortSha } from '../../../lib/format';
import { languageColor } from '../../../lib/languages';
import { toAppUrl } from '../../../lib/markdown';
import type { Repository } from '../../../lib/types';
import type { CodeHit, CommitHit, DiscussionHit, IssueHit, OwnerDetails, TopicHit, UserHit } from '../api';
import { Fragment, Highlight } from './Highlight';

/** A meta row: items separated by GitHub's middle dot. */
export function MetaRow(props: { children: JSX.Element; class?: string }) {
  return <ul class={['flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted', props.class]}>{props.children}</ul>;
}

function Dot() {
  return (
    <li aria-hidden="true" class="select-none">
      ·
    </li>
  );
}

export function LanguageItem(props: { language: string }) {
  return (
    <li class="flex items-center gap-1">
      <span class="repo-language-color" style={{ 'background-color': languageColor(props.language) }} />
      <span>{props.language}</span>
    </li>
  );
}

/** GitHub search-style repository card (also used by Explore and Topics). */
export function RepoCard(props: { repo: Repository; terms?: string[]; showForks?: boolean; extra?: JSX.Element }) {
  const repo = () => props.repo;
  return (
    <div class="Box p-4">
      <div class="flex items-center gap-2 min-w-0">
        <Avatar src={repo().owner.avatar_url} size={20} square={repo().owner.type === 'Organization'} />
        <a class="text-base min-w-0 truncate" href={`/${repo().full_name}`}>
          <Highlight text={repo().full_name} terms={props.terms ?? []} />
        </a>
        <Show when={repo().archived}>
          <span class="Label Label--attention">Public archive</span>
        </Show>
        <Show when={repo().private}>
          <span class="Label">Private</span>
        </Show>
      </div>
      <Show when={repo().description}>
        <p class="mt-1 text-sm break-words">
          <Highlight text={repo().description} terms={props.terms ?? []} />
        </p>
      </Show>
      <Show when={repo().topics?.length}>
        <div class="flex flex-wrap gap-1 mt-2">
          <For each={repo().topics!.slice(0, 8)}>
            {(t) => (
              <a class="topic-tag" href={`/topics/${t}`}>
                {t}
              </a>
            )}
          </For>
        </div>
      </Show>
      <MetaRow class="mt-2">
        <Show when={repo().language}>
          {(lang) => (
            <>
              <LanguageItem language={lang()} />
              <Dot />
            </>
          )}
        </Show>
        <li>
          <a class="link-muted flex items-center gap-1" href={`/${repo().full_name}/stargazers`}>
            <Octicon icon={starIcon} />
            {compactNumber(repo().stargazers_count)}
          </a>
        </li>
        <Show when={props.showForks}>
          <Dot />
          <li>
            <a class="link-muted flex items-center gap-1" href={`/${repo().full_name}/forks`}>
              <Octicon icon={repoForkedIcon} />
              {compactNumber(repo().forks_count)}
            </a>
          </li>
        </Show>
        <Dot />
        <li>
          Updated <RelativeTime datetime={repo().pushed_at ?? repo().updated_at} />
        </li>
        {props.extra}
      </MetaRow>
    </div>
  );
}

export function CodeCard(props: { hit: CodeHit }) {
  const hit = () => props.hit;
  const href = () => toAppUrl(hit().html_url);
  return (
    <div class="Box overflow-hidden">
      <div class="px-4 pt-3 pb-2">
        <div class="flex items-center gap-2 text-sm min-w-0">
          <Avatar src={hit().repository.owner.avatar_url} size={16} square={hit().repository.owner.type === 'Organization'} />
          <a class="link-plain truncate" href={`/${hit().repository.full_name}`}>
            {hit().repository.full_name}
          </a>
          <span class="text-fg-muted">·</span>
          <a class="font-semibold truncate" href={href()}>
            {hit().path}
          </a>
        </div>
      </div>
      <For each={hit().text_matches?.filter((m) => m.property === 'content') ?? []}>
        {(m) => (
          <pre class="font-mono text-xs leading-5 px-4 py-2 border-t border-line-muted bg-canvas overflow-x-auto whitespace-pre">
            <Fragment fragment={m.fragment} matches={m.matches} mark />
          </pre>
        )}
      </For>
    </div>
  );
}

export function IssueCard(props: { issue: IssueHit; terms: string[] }) {
  const issue = () => props.issue;
  const repo = () => issue().repository_url.replace(/^.*\/repos\//, '');
  const isPull = () => !!issue().pull_request;
  const href = () => `/${repo()}/${isPull() ? 'pull' : 'issues'}/${issue().number}`;
  const bodyMatch = () => issue().text_matches?.find((m) => m.property === 'body');
  return (
    <div class="Box p-4">
      <a class="link-muted text-xs" href={`/${repo()}`}>
        {repo()}
      </a>
      <div class="flex items-start gap-2 mt-1">
        <StateIcon
          class="mt-1 shrink-0"
          state={itemState({
            isPull: isPull(),
            state: issue().state,
            stateReason: issue().state_reason,
            merged: !!issue().pull_request?.merged_at,
            draft: issue().draft,
          })}
        />
        <a class="text-base font-semibold break-words" href={href()}>
          <Highlight text={issue().title} terms={props.terms} />
        </a>
      </div>
      <Show when={bodyMatch()}>
        {(m) => (
          <p class="mt-1 text-sm line-clamp-2 break-words">
            … <HighlightFragment text={m().fragment} terms={props.terms} /> …
          </p>
        )}
      </Show>
      <Show when={issue().labels.length}>
        <div class="flex flex-wrap gap-1 mt-2">
          <For each={issue().labels}>
            {(l) => <IssueLabel name={l.name} color={l.color} title={l.description} href={`/${repo()}/issues?q=label:"${l.name}"`} />}
          </For>
        </div>
      </Show>
      <MetaRow class="mt-2">
        <li class="flex items-center gap-1">
          <Avatar src={issue().user.avatar_url} size={16} square={issue().user.type !== 'User'} />
          <a class="link-muted" href={`/${issue().user.login}`}>
            {issue().user.login}
          </a>
        </li>
        <Show when={issue().comments}>
          <Dot />
          <li class="flex items-center gap-1">
            <Octicon icon={commentIcon} />
            {issue().comments}
          </li>
        </Show>
        <Dot />
        <li>
          Opened <RelativeTime datetime={issue().created_at} />
        </li>
        <Dot />
        <li>#{issue().number}</li>
      </MetaRow>
    </div>
  );
}

/** Text-match fragment highlighted by the query terms (issue bodies collapse whitespace). */
function HighlightFragment(props: { text: string; terms: string[] }) {
  return <Highlight text={props.text.replace(/\s+/g, ' ').trim()} terms={props.terms} />;
}

export function DiscussionCard(props: { discussion: DiscussionHit; terms: string[] }) {
  const d = () => props.discussion;
  const repo = () => d().repository.nameWithOwner;
  const emoji = () => d().category?.emojiHTML.replace(/<[^>]+>/g, '') ?? '';
  return (
    <div class="Box p-4">
      <a class="link-muted text-xs" href={`/${repo()}/discussions`}>
        {repo()}
      </a>
      <div class="flex items-start gap-2 mt-1">
        <Octicon icon={commentDiscussionIcon} class={d().isAnswered ? 'mt-1 shrink-0 text-fg-success' : 'mt-1 shrink-0 text-fg-muted'} />
        <a class="text-base font-semibold break-words" href={`/${repo()}/discussions/${d().number}`}>
          <Highlight text={d().title} terms={props.terms} />
        </a>
      </div>
      <Show when={d().bodyText.trim()}>
        <p class="mt-1 text-sm line-clamp-2 break-words">
          <Highlight text={d().bodyText.replace(/\s+/g, ' ').slice(0, 300)} terms={props.terms} />
        </p>
      </Show>
      <MetaRow class="mt-2">
        <Show when={d().author}>
          {(a) => (
            <>
              <li class="flex items-center gap-1">
                <Avatar src={a().avatarUrl} size={16} />
                <a class="link-muted" href={`/${a().login}`}>
                  {a().login}
                </a>
              </li>
              <Dot />
            </>
          )}
        </Show>
        <Show when={d().category}>
          {(c) => (
            <>
              <li>
                {emoji()} {c().name}
              </li>
              <Dot />
            </>
          )}
        </Show>
        <Show when={d().isAnswered}>
          <li class="flex items-center gap-1 text-fg-success">
            <Octicon icon={checkCircleIcon} />
            Answered
          </li>
          <Dot />
        </Show>
        <li class="flex items-center gap-1">
          <Octicon icon={commentIcon} />
          {d().comments.totalCount}
        </li>
        <Dot />
        <li>
          Updated <RelativeTime datetime={d().updatedAt} />
        </li>
      </MetaRow>
    </div>
  );
}

export function UserCard(props: { user: UserHit; details?: OwnerDetails; terms: string[] }) {
  const u = () => props.user;
  return (
    <div class="Box p-4 flex gap-3">
      <Avatar src={u().avatar_url} size={20} square={u().type === "Organization"} class="mt-0.5 self-start" />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-baseline gap-x-2">
          <Show when={props.details?.name}>
            {(name) => (
              <a class="text-base font-semibold" href={`/${u().login}`}>
                <Highlight text={name()} terms={props.terms} />
              </a>
            )}
          </Show>
          <a class={props.details?.name ? 'link-muted text-sm' : 'text-base font-semibold'} href={`/${u().login}`}>
            <Highlight text={u().login} terms={props.terms} />
          </a>
        </div>
        <Show when={props.details?.bio}>
          {(bio) => (
            <p class="mt-1 text-sm break-words">
              <Highlight text={bio()} terms={props.terms} />
            </p>
          )}
        </Show>
        <MetaRow class="mt-1">
          <Show when={props.details?.location}>
            {(loc) => (
              <>
                <li class="flex items-center gap-1">
                  <Octicon icon={locationIcon} />
                  {loc()}
                </li>
                <Dot />
              </>
            )}
          </Show>
          <Show when={props.details?.repositories != null}>
            <li class="flex items-center gap-1">
              <Octicon icon={repoIcon} />
              {compactNumber(props.details!.repositories)}
            </li>
          </Show>
          <Show when={props.details?.followers != null}>
            <Dot />
            <li>{compactNumber(props.details!.followers)} followers</li>
          </Show>
        </MetaRow>
      </div>
    </div>
  );
}

export function CommitCard(props: { commit: CommitHit; terms: string[] }) {
  const c = () => props.commit;
  const repo = () => c().repository.full_name;
  const href = () => `/${repo()}/commit/${c().sha}`;
  return (
    <div class="Box p-4">
      <a class="link-muted text-xs" href={`/${repo()}`}>
        {repo()}
      </a>
      <div class="flex items-start gap-2 mt-1">
        <a class="text-base font-semibold break-words flex-1 min-w-0" href={href()}>
          <Highlight text={commitTitle(c().commit.message)} terms={props.terms} />
        </a>
        <a class="font-mono text-xs link-muted shrink-0 mt-1" href={href()}>
          {shortSha(c().sha)}
        </a>
      </div>
      <MetaRow class="mt-2">
        <li class="flex items-center gap-1">
          <Show when={c().author} fallback={<span>{c().commit.author.name}</span>}>
            {(a) => (
              <>
                <Avatar src={a().avatar_url} size={16} />
                <a class="link-muted font-semibold" href={`/${a().login}`}>
                  {a().login}
                </a>
              </>
            )}
          </Show>
          <span>
            committed <RelativeTime datetime={c().commit.committer.date} />
          </span>
        </li>
      </MetaRow>
    </div>
  );
}

export function TopicCard(props: { topic: TopicHit; terms?: string[] }) {
  const t = () => props.topic;
  return (
    <div class="Box p-4 flex gap-3">
      <TopicLogo name={t().name} size={32} />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <a class="text-base font-semibold" href={`/topics/${t().name}`}>
            <Highlight text={t().display_name || t().name} terms={props.terms ?? []} />
          </a>
          <Show when={t().display_name && t().display_name !== t().name}>
            <span class="text-fg-muted text-sm">#{t().name}</span>
          </Show>
          <Show when={t().featured}>
            <span class="Label Label--accent">Featured</span>
          </Show>
          <Show when={t().curated}>
            <span class="Label Label--success">Curated</span>
          </Show>
        </div>
        <Show when={t().short_description}>
          {(d) => (
            <p class="mt-1 text-sm">
              <Highlight text={d()} terms={props.terms ?? []} />
            </p>
          )}
        </Show>
        <Show when={t().created_by || t().released}>
          <MetaRow class="mt-1">
            <Show when={t().created_by}>
              <li>Created by {t().created_by}</li>
            </Show>
            <Show when={t().created_by && t().released}>
              <Dot />
            </Show>
            <Show when={t().released}>
              <li>Released {t().released}</li>
            </Show>
          </MetaRow>
        </Show>
      </div>
    </div>
  );
}

/**
 * Topic logo from github/explore (curated topics have one); falls back to
 * GitHub's "#" tile when the image does not exist.
 */
export function TopicLogo(props: { name: string; size: number }) {
  const src = () => `https://raw.githubusercontent.com/github/explore/main/topics/${props.name}/${props.name}.png`;
  return (
    <span
      class="relative inline-flex items-center justify-center shrink-0 rounded-md bg-accent-muted text-fg-accent font-semibold overflow-hidden"
      style={{ width: `${props.size}px`, height: `${props.size}px`, 'font-size': `${Math.round(props.size / 2.6)}px` }}
    >
      #
      <img
        class="absolute inset-0 w-full h-full object-contain bg-canvas"
        src={src()}
        alt=""
        loading="lazy"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
    </span>
  );
}
