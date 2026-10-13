import type { JSX } from '@solidjs/web';
import { For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, RelativeTime } from '../../../components/ui';
import { repoForkedIcon, repoIcon, starIcon } from '../../../icons/octicons';
import { compactNumber, formatNumber } from '../../../lib/format';
import { languageColor } from '../../../lib/languages';
import type { Repository } from '../../../lib/types';

/** github.com/trending-style row: "owner / name", description, language, stars, forks. */
export function TrendingRow(props: { repo: Repository; periodLabel: string }) {
  const r = () => props.repo;
  return (
    <article class="Box-row">
      <h2 class="text-xl leading-snug">
        <a class="inline-flex items-center gap-2 break-all" href={`/${r().full_name}`}>
          <Octicon icon={repoIcon} class="text-fg-muted shrink-0" />
          <span>
            <span class="font-normal">{r().owner.login} /</span> <strong class="font-semibold">{r().name}</strong>
          </span>
        </a>
      </h2>
      <Show when={r().description}>
        <p class="text-fg-muted text-sm mt-1 pr-6 break-words">{r().description}</p>
      </Show>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-fg-muted">
        <Show when={r().language}>
          {(lang) => (
            <span class="flex items-center gap-1">
              <span class="repo-language-color" style={{ 'background-color': languageColor(lang()) }} />
              {lang()}
            </span>
          )}
        </Show>
        <a class="link-muted flex items-center gap-1" href={`/${r().full_name}/stargazers`}>
          <Octicon icon={starIcon} /> {formatNumber(r().stargazers_count)}
        </a>
        <a class="link-muted flex items-center gap-1" href={`/${r().full_name}/forks`}>
          <Octicon icon={repoForkedIcon} /> {formatNumber(r().forks_count)}
        </a>
        <span class="flex items-center gap-1">
          Built by <Avatar src={r().owner.avatar_url} login={r().owner.login} size={20} square={r().owner.type === 'Organization'} />
        </span>
        <span class="flex items-center gap-1 sm:ml-auto">
          <Octicon icon={starIcon} /> {formatNumber(r().stargazers_count)} stars {props.periodLabel}
        </span>
      </div>
    </article>
  );
}

/** github.com/topics/:topic-style repository card: owner / name, star count, description, topics, footer. */
export function TopicRepoCard(props: { repo: Repository; topic: string; extra?: JSX.Element }) {
  const r = () => props.repo;
  return (
    <article class="Box overflow-hidden">
      <div class="flex items-start gap-3 p-4">
        <Avatar src={r().owner.avatar_url} login={r().owner.login} size={32} square={r().owner.type === 'Organization'} />
        <h3 class="flex-1 min-w-0 text-lg leading-snug break-all">
          <a href={`/${r().owner.login}`}>{r().owner.login}</a> <span class="text-fg-muted">/</span>{' '}
          <a class="font-semibold" href={`/${r().full_name}`}>
            {r().name}
          </a>
        </h3>
        <a class="link-muted shrink-0 flex items-center gap-1 text-sm mt-1" href={`/${r().full_name}/stargazers`} title={`${formatNumber(r().stargazers_count)} stars`}>
          <Octicon icon={starIcon} /> {compactNumber(r().stargazers_count)}
        </a>
      </div>
      <div class="px-4 pb-4">
        <Show when={r().description}>
          <p class="text-sm break-words">{r().description}</p>
        </Show>
        <Show when={r().topics?.length}>
          <div class="flex flex-wrap gap-1 mt-2">
            <For each={r().topics!.slice(0, 10)}>
              {(t) => (
                <a class={['topic-tag', { 'font-semibold': t === props.topic }]} href={`/topics/${t}`}>
                  {t}
                </a>
              )}
            </For>
          </div>
        </Show>
      </div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 border-t border-line-muted bg-canvas-muted text-xs text-fg-muted">
        <span>
          Updated <RelativeTime datetime={r().pushed_at ?? r().updated_at} />
        </span>
        <Show when={r().language}>
          {(lang) => (
            <span class="flex items-center gap-1">
              <span class="repo-language-color" style={{ 'background-color': languageColor(lang()) }} />
              {lang()}
            </span>
          )}
        </Show>
        <a class="link-muted flex items-center gap-1" href={`/${r().full_name}/forks`}>
          <Octicon icon={repoForkedIcon} /> {compactNumber(r().forks_count)}
        </a>
        {props.extra}
      </div>
    </article>
  );
}
