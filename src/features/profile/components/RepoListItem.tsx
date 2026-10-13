import { useAction } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { RelativeTime, toastError } from '../../../components/ui';
import { gitPullRequestIcon, issueOpenedIcon, lawIcon, repoForkedIcon, starFillIcon, starIcon } from '../../../icons/octicons';
import { formatNumber } from '../../../lib/format';
import { languageColor } from '../../../lib/languages';
import { feature } from '../../refined';
import { starRepo } from '../../repo/api';
import GithubIoLink from '../../repo/refined/GithubIoLink';
import type { RepoSummary } from '../api';

/** "Public", "Private archive", "Public template"… — the label next to a repo name. */
export function repoVisibilityLabel(repo: Pick<RepoSummary, 'isPrivate' | 'isArchived' | 'isTemplate' | 'isMirror'>) {
  const base = repo.isPrivate ? 'Private' : 'Public';
  if (repo.isArchived) return `${base} archive`;
  if (repo.isTemplate) return `${base} template`;
  if (repo.isMirror) return `${base} mirror`;
  return base;
}

/** Language dot + name. */
export function LanguageBadge(props: { name: string; color?: string | null }) {
  return (
    <span class="inline-flex items-center gap-1">
      <span class="repo-language-color" style={{ 'background-color': props.color ?? languageColor(props.name) }} />
      <span>{props.name}</span>
    </span>
  );
}

/** Star / Unstar toggle for a repo in a list (optimistic). */
export function StarButton(props: { repo: RepoSummary; class?: string }) {
  // Writable derived: follows the list data, flips immediately on click.
  const [starred, setStarred] = createSignal(() => !!props.repo.viewerHasStarred);
  const [busy, setBusy] = createSignal(false);
  const star = useAction(starRepo);
  const toggle = async () => {
    const next = !starred();
    setStarred(next);
    setBusy(true);
    try {
      await star(props.repo.owner.login, props.repo.name, next);
    } catch (e) {
      setStarred(!next);
      toastError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      class={['btn btn-sm', props.class]}
      disabled={busy()}
      aria-pressed={starred() ? 'true' : 'false'}
      onClick={() => void toggle()}
    >
      <Octicon icon={starred() ? starFillIcon : starIcon} class={starred() ? 'text-[#e3b341]!' : undefined} />
      {starred() ? 'Starred' : 'Star'}
    </button>
  );
}

/**
 * One repository row as on a profile's Repositories / Stars tab (and org
 * repository lists): name + visibility label, fork source, description,
 * topics, then language · stars · forks · license · updated, with a Star
 * button on the right.
 */
export default function RepoListItem(props: {
  repo: RepoSummary;
  /** Show `owner/name` instead of just `name` (stars, search, org-less lists). */
  showOwner?: boolean;
  /** Hide the Star button (e.g. compact lists). */
  hideStar?: boolean;
  /** Issues / pull requests icon links before "Updated" (`conversation-links-on-repo-lists`). */
  conversationLinks?: boolean;
}) {
  const href = () => `/${props.repo.fullName}`;
  return (
    <li class="flex gap-4 py-6 border-b border-line-muted list-none">
      <div class="flex-1 min-w-0">
        <div class="flex flex-wrap items-center gap-2 mb-1">
          <h3 class="text-xl font-semibold break-all leading-tight">
            <a href={href()}>
              <Show when={props.showOwner} fallback={props.repo.name}>
                {props.repo.owner.login} / <span class="font-semibold">{props.repo.name}</span>
              </Show>
            </a>
          </h3>
          <GithubIoLink name={props.repo.name} />
          <span
            class={[
              'Label',
              {
                'Label--attention': props.repo.isArchived,
                // `mark-private-repos`: private repos stand out in the list.
                'rgh-private-repo': props.repo.isPrivate && !props.repo.isArchived && feature('mark-private-repos'),
              },
            ]}
          >
            {repoVisibilityLabel(props.repo)}
          </span>
        </div>
        <Show when={props.repo.parent}>
          {(parent) => (
            <p class="text-xs text-fg-muted mb-1">
              Forked from{' '}
              <a class="link-muted underline" href={`/${parent()}`}>
                {parent()}
              </a>
            </p>
          )}
        </Show>
        <Show when={props.repo.description}>
          <p class="text-fg-muted mt-2 mb-2 pr-6 break-words">
            <Show when={props.repo.descriptionHTML} fallback={props.repo.description}>
              {/* oxlint-disable-next-line solid/no-innerhtml -- shortDescriptionHTML is rendered + sanitized by GitHub */}
              {(html) => <span innerHTML={html()} />}
            </Show>
          </p>
        </Show>
        <Show when={props.repo.topics.length}>
          <div class="flex flex-wrap gap-1 my-2">
            <For each={props.repo.topics}>
              {(t) => (
                <a class="topic-tag" href={`/topics/${t}`}>
                  {t}
                </a>
              )}
            </For>
          </div>
        </Show>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-fg-muted">
          <Show when={props.repo.language}>{(l) => <LanguageBadge name={l().name} color={l().color} />}</Show>
          <Show when={props.repo.stars}>
            <a class="link-muted inline-flex items-center gap-1" href={`${href()}/stargazers`}>
              <Octicon icon={starIcon} />
              {formatNumber(props.repo.stars)}
            </a>
          </Show>
          <Show when={props.repo.forks}>
            <a class="link-muted inline-flex items-center gap-1" href={`${href()}/forks`}>
              <Octicon icon={repoForkedIcon} />
              {formatNumber(props.repo.forks)}
            </a>
          </Show>
          <Show when={props.repo.license}>
            {(l) => (
              <span class="inline-flex items-center gap-1">
                <Octicon icon={lawIcon} />
                {l()}
              </span>
            )}
          </Show>
          <Show when={props.conversationLinks}>
            <a class="link-muted inline-flex items-center" href={`${href()}/issues`} title="Issues" aria-label={`Issues of ${props.repo.fullName}`}>
              <Octicon icon={issueOpenedIcon} />
            </a>
            <a class="link-muted inline-flex items-center" href={`${href()}/pulls`} title="Pull requests" aria-label={`Pull requests of ${props.repo.fullName}`}>
              <Octicon icon={gitPullRequestIcon} />
            </a>
          </Show>
          <span>
            Updated <RelativeTime datetime={props.repo.updatedAt} />
          </span>
        </div>
      </div>
      <Show when={!props.hideStar}>
        <div class="shrink-0">
          <StarButton repo={props.repo} />
        </div>
      </Show>
    </li>
  );
}
