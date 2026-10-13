import { createMemo, createSignal, For, Loading, Match, Show, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import ChecksStatus, { RollupGlyph } from '../../../components/checks/ChecksStatus';
import { Avatar, CopyButton, RelativeTime, VerifiedBadge } from '../../../components/ui';
import { codeIcon, ellipsisIcon, gitCommitIcon, gitMergeIcon, tagIcon } from '../../../icons/octicons';
import { encodePath } from '../../../lib/github';
import { feature } from '../../refined';
import type { ChecksSummary, HistoryCommit } from '../api';
import { parseConventionalCommit } from '../refined';

/** "Oct 7, 2026" in the viewer's timezone. */
const dayLabel = (date: string) =>
  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function groupByDay<T>(items: T[], date: (item: T) => string) {
  const groups: { day: string; items: T[] }[] = [];
  for (const item of items) {
    const day = dayLabel(date(item));
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

/** Commit headline with `#123` references linked into the repo (and conventional-commit labels). */
export function CommitTitle(props: { message: string; base: string; href: string; class?: string }) {
  const conventional = createMemo(() => (feature('conventional-commits') ? parseConventionalCommit(props.message) : undefined));
  const parts = createMemo(() => (conventional()?.rest ?? props.message).split(/(#\d+)/g).filter(Boolean));
  return (
    <span class={props.class}>
      <Show when={conventional()}>
        {(cc) => (
          <>
            <span class="IssueLabel mr-2 align-middle" data-rgh-conventional-commits={cc().rawType}>
              {cc().type}
            </span>
            <Show when={cc().scope}>
              <span class="text-fg-muted">{cc().scope}</span>
            </Show>
          </>
        )}
      </Show>
      <For each={parts()}>
        {(part) =>
          /^#\d+$/.test(part) ? (
            <a class="text-fg-accent" href={`${props.base}/issues/${part.slice(1)}`}>
              {part}
            </a>
          ) : (
            <a class="link-plain hover:text-fg-accent hover:underline" href={props.href}>
              {part}
            </a>
          )
        }
      </For>
    </span>
  );
}

/**
 * "✓ 3 / 3" check summary. With `owner`/`repo`/`sha` it is a button opening
 * the checks popover (github.com's commit rows); otherwise a link to `href`.
 */
export function ChecksBadge(props: { checks: ChecksSummary | null; href?: string; owner?: string; repo?: string; sha?: string }) {
  return (
    <Show when={props.checks}>
      {(c) => (
        <Show
          when={props.owner && props.repo && props.sha}
          fallback={
            <a
              class="inline-flex items-center gap-1 text-xs text-fg-muted link-muted"
              href={props.href}
              title={`${c().passed} / ${c().total} checks OK`}
            >
              <RollupGlyph state={c().state} />
              <Show when={c().total}>
                {c().passed} / {c().total}
              </Show>
            </a>
          }
        >
          <ChecksStatus owner={props.owner!} repo={props.repo!} sha={props.sha} state={c().state ?? 'PENDING'} passed={c().passed} total={c().total} />
        </Show>
      )}
    </Show>
  );
}

/** Avatars + "alice and bob committed 3 days ago". */
export function CommitAuthors(props: {
  commit: HistoryCommit;
  size?: number;
  strong?: boolean;
  /** Where an author's name links (default: their profile). */
  authorHref?: (login: string) => string;
}) {
  const authors = () => props.commit.authors;
  const sameCommitter = () => {
    const first = authors()[0];
    const committer = props.commit.committer;
    if (!first || !committer) return true;
    if (first.user && committer.user) return first.user.login === committer.user.login;
    return first.name === committer.name;
  };
  const AuthorName = (p: { a: HistoryCommit['authors'][number] }) => (
    <Show when={p.a.user} fallback={<span class={props.strong ? 'font-semibold text-fg' : 'text-fg'}>{p.a.name}</span>}>
      {(u) => (
        <a
          class={['link-plain', { 'font-semibold': !!props.strong }]}
          href={props.authorHref ? props.authorHref(u().login) : `/${u().login}`}
          data-hovercard-user={u().login}
          title={props.authorHref ? `View all commits by ${u().login}` : `View ${u().login}'s profile`}
        >
          {u().login}
        </a>
      )}
    </Show>
  );
  return (
    <span class="inline-flex items-center gap-1.5 flex-wrap min-w-0">
      <span class="AvatarStack shrink-0">
        <For each={authors().slice(0, 3)}>{(a) => <Avatar src={a.avatarUrl} size={props.size ?? 16} login={a.user?.login} hovercard />}</For>
      </span>
      <Switch>
        <Match when={props.commit.authorCount > 2}>
          <span class={props.strong ? 'font-semibold text-fg' : 'text-fg'}>{props.commit.authorCount} people</span>
        </Match>
        <Match when={authors().length === 2}>
          <AuthorName a={authors()[0]!} />
          <span>and</span>
          <AuthorName a={authors()[1]!} />
        </Match>
        <Match when={authors()[0]}>{(a) => <AuthorName a={a()} />}</Match>
      </Switch>
      <span>
        {sameCommitter() ? 'committed' : 'authored'}{' '}
        <RelativeTime datetime={sameCommitter() ? props.commit.committedDate : props.commit.authoredDate} />
      </span>
    </span>
  );
}

export interface CommitListOptions {
  base: string;
  browsePath?: string;
  /** tags-on-commits-list: tag names by commit oid. */
  tags?: Record<string, string[]>;
  /** same-branch-author-commits: author link target. */
  authorHref?: (login: string) => string;
  /** Commit link (PR commit lists link to /pull/:n/commits/:sha). */
  commitHref?: (oid: string) => string;
}

/** One commit in a list: headline, authors, checks · verified, sha, copy, browse. */
export function CommitRow(props: CommitListOptions & { commit: HistoryCommit }) {
  const [open, setOpen] = createSignal(false);
  const href = () => (props.commitHref ? props.commitHref(props.commit.oid) : `${props.base}/commit/${props.commit.oid}`);
  const owner = () => props.base.split('/')[1];
  const repo = () => props.base.split('/')[2];
  const isMerge = () => feature('mark-merge-commits-in-list') && props.commit.parentCount > 1;
  const tags = () => (feature('tags-on-commits-list') ? (props.tags?.[props.commit.oid] ?? []) : []);
  /** easy-toggle-commit-messages: a click anywhere on the row (but not on a control or while selecting) toggles the body. */
  const onRowClick = (e: MouseEvent) => {
    if (!feature('easy-toggle-commit-messages') || !props.commit.messageBody) return;
    if ((e.target as HTMLElement).closest('a, button, input, details, summary')) return;
    if (getSelection()?.toString()) return;
    setOpen(!open());
  };
  return (
    <li class={['Box-row Box-row--hover flex items-start gap-3 py-2! px-4!', { 'rgh-merge-commit': isMerge() }]} onClick={onRowClick}>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1 min-w-0">
          <Show when={isMerge()}>
            <Octicon icon={gitMergeIcon} class="text-fg-muted shrink-0 mr-1" aria-label="Merge commit" />
          </Show>
          <Loading>
            <Show when={tags().length}>
              <Octicon icon={tagIcon} class="text-fg-muted shrink-0 mr-1" aria-label="Tagged" />
            </Show>
          </Loading>
          <h4 class="text-base font-medium truncate min-w-0">
            <CommitTitle message={props.commit.messageHeadline} base={props.base} href={href()} />
          </h4>
          <Show when={props.commit.messageBody}>
            <button
              type="button"
              class="btn btn-sm h-4! px-1! py-0! leading-none shrink-0"
              aria-label="Show description for this commit"
              aria-expanded={open() ? 'true' : 'false'}
              onClick={() => setOpen(!open())}
            >
              <Octicon icon={ellipsisIcon} size={12} />
            </button>
          </Show>
        </div>
        <div class="mt-1 text-xs text-fg-muted flex items-center gap-1 flex-wrap">
          <CommitAuthors commit={props.commit} authorHref={props.authorHref} />
          <Show when={props.commit.checks}>
            <span>·</span>
            <ChecksBadge checks={props.commit.checks} href={href()} owner={owner()} repo={repo()} sha={props.commit.oid} />
          </Show>
          <Loading>
          <Show when={tags().length}>
            <span class="ml-1 inline-flex items-center gap-1 rgh-tags-on-commits">
              <Octicon icon={tagIcon} />
              <For each={tags()}>
                {(tag) => (
                  <a class="link-muted" href={`${props.base}/releases/tag/${encodePath(tag)}`}>
                    <code class="px-1 rounded-md bg-neutral-muted">{tag}</code>
                  </a>
                )}
              </For>
            </span>
          </Show>
          </Loading>
        </div>
        <Show when={open()}>
          <pre class="mt-2 text-xs text-fg-muted whitespace-pre-wrap font-mono">{props.commit.messageBody}</pre>
        </Show>
      </div>
      <div class="flex items-center gap-2 shrink-0 pt-1">
        <VerifiedBadge signature={props.commit.signature} />
        <a class="font-mono text-xs link-muted text-fg-muted px-1" href={href()} title="View commit details">
          {props.commit.abbreviatedOid}
        </a>
        <CopyButton value={props.commit.oid} label="Copy full SHA" class="btn-octicon w-7 h-7" />
        <a
          class="btn-octicon w-7 h-7"
          href={`${props.base}/tree/${props.commit.oid}${props.browsePath ? `/${props.browsePath}` : ''}`}
          aria-label="Browse repository at this point in the history"
          title="Browse repository at this point in the history"
        >
          <Octicon icon={codeIcon} />
        </a>
      </div>
    </li>
  );
}

/** Commits grouped under "Commits on Oct 13, 2026" headings with a timeline rail. */
export default function CommitList(props: CommitListOptions & { commits: HistoryCommit[] }) {
  const groups = createMemo(() => groupByDay(props.commits, (c) => c.committedDate));
  return (
    <div class="relative">
      <For each={groups()}>
        {(group) => (
          <section class="relative pl-8 pb-4">
            <div class="absolute left-[15px] top-8 bottom-0 w-0.5 bg-[var(--borderColor-muted)]" aria-hidden="true" />
            <h3 class="-ml-8 flex items-center gap-2 py-2 text-sm text-fg-muted font-normal">
              <span class="w-8 flex justify-center bg-canvas">
                <Octicon icon={gitCommitIcon} />
              </span>
              Commits on {group.day}
            </h3>
            <ol class="Box">
              <For each={group.items}>
                {(c) => (
                  <CommitRow
                    commit={c}
                    base={props.base}
                    browsePath={props.browsePath}
                    tags={props.tags}
                    authorHref={props.authorHref}
                    commitHref={props.commitHref}
                  />
                )}
              </For>
            </ol>
          </section>
        )}
      </For>
    </div>
  );
}
