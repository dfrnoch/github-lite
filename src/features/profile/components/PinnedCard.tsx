import { Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { codeSquareIcon, repoForkedIcon, repoIcon, repoTemplateIcon, starIcon } from '../../../icons/octicons';
import { compactNumber } from '../../../lib/format';
import type { PinnedItem, RepoSummary } from '../api';
import { LanguageBadge, repoVisibilityLabel } from './RepoListItem';

/** A pinned / popular repository (or gist) card on a profile overview. */
export default function PinnedCard(props: { item: PinnedItem; owner: string }) {
  return (
    <li class="Box p-4 flex flex-col list-none min-w-0">
      <Show
        when={props.item.kind === 'repo' ? (props.item as RepoSummary & { kind: 'repo' }) : undefined}
        fallback={<GistCard item={props.item as Extract<PinnedItem, { kind: 'gist' }>} />}
      >
        {(repo) => (
          <>
            <div class="flex items-center gap-2 min-w-0">
              <Octicon icon={repo().isTemplate ? repoTemplateIcon : repoIcon} class="text-fg-muted" />
              <a class="font-semibold truncate" href={`/${repo().fullName}`}>
                {repo().owner.login.toLowerCase() === props.owner.toLowerCase() ? repo().name : repo().fullName}
              </a>
              <span class="Label shrink-0">{repoVisibilityLabel(repo())}</span>
            </div>
            <Show when={repo().parent}>
              {(p) => (
                <p class="text-xs text-fg-muted mt-1">
                  Forked from <a class="link-muted underline" href={`/${p()}`}>{p()}</a>
                </p>
              )}
            </Show>
            <p class="text-xs text-fg-muted mt-2 mb-4 flex-1 break-words">
              <Show when={repo().descriptionHTML} fallback={repo().description}>
                {/* oxlint-disable-next-line solid/no-innerhtml -- shortDescriptionHTML is rendered + sanitized by GitHub */}
                {(html) => <span innerHTML={html()} />}
              </Show>
            </p>
            <p class="flex items-center gap-4 text-xs text-fg-muted">
              <Show when={repo().language}>{(l) => <LanguageBadge name={l().name} color={l().color} />}</Show>
              <Show when={repo().stars}>
                <a class="link-muted inline-flex items-center gap-1" href={`/${repo().fullName}/stargazers`}>
                  <Octicon icon={starIcon} />
                  {compactNumber(repo().stars)}
                </a>
              </Show>
              <Show when={repo().forks}>
                <a class="link-muted inline-flex items-center gap-1" href={`/${repo().fullName}/forks`}>
                  <Octicon icon={repoForkedIcon} />
                  {compactNumber(repo().forks)}
                </a>
              </Show>
            </p>
          </>
        )}
      </Show>
    </li>
  );
}

function GistCard(props: { item: Extract<PinnedItem, { kind: 'gist' }> }) {
  return (
    <>
      <div class="flex items-center gap-2 min-w-0">
        <Octicon icon={codeSquareIcon} class="text-fg-muted" />
        <a class="font-semibold truncate" href={props.item.url} target="_blank" rel="noreferrer">
          {props.item.name}
        </a>
      </div>
      <p class="text-xs text-fg-muted mt-2 mb-4 flex-1">{props.item.description}</p>
      <p class="flex items-center gap-4 text-xs text-fg-muted">
        <Show when={props.item.language}>{(l) => <LanguageBadge name={l().name} color={l().color} />}</Show>
        <Show when={props.item.stars}>
          <span class="inline-flex items-center gap-1">
            <Octicon icon={starIcon} />
            {compactNumber(props.item.stars)}
          </span>
        </Show>
      </p>
    </>
  );
}
