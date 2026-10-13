import { createMemo, createSignal, For, Match, Show, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, CopyButton, RelativeTime } from '../../../components/ui';
import { checkIcon, codeIcon, dotFillIcon, ellipsisIcon, gitCommitIcon, xIcon } from '../../../icons/octicons';
import type { ChecksSummary, HistoryCommit } from '../api';

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

/** Commit headline with `#123` references linked into the repo. */
export function CommitTitle(props: { message: string; base: string; href: string; class?: string }) {
  const parts = createMemo(() => props.message.split(/(#\d+)/g).filter(Boolean));
  return (
    <span class={props.class}>
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

/** "✓ 3 / 3" check summary. */
export function ChecksBadge(props: { checks: ChecksSummary | null; href?: string }) {
  return (
    <Show when={props.checks}>
      {(c) => (
        <a
          class="inline-flex items-center gap-1 text-xs text-fg-muted link-muted"
          href={props.href}
          title={`${c().passed} / ${c().total} checks OK`}
        >
          <Switch>
            <Match when={c().state === 'SUCCESS'}>
              <Octicon icon={checkIcon} class="text-fg-success" />
            </Match>
            <Match when={c().state === 'FAILURE' || c().state === 'ERROR'}>
              <Octicon icon={xIcon} class="text-fg-danger" />
            </Match>
            <Match when={true}>
              <Octicon icon={dotFillIcon} class="text-fg-attention" />
            </Match>
          </Switch>
          <Show when={c().total}>
            {c().passed} / {c().total}
          </Show>
        </a>
      )}
    </Show>
  );
}

/** Avatars + "alice and bob committed 3 days ago". */
export function CommitAuthors(props: { commit: HistoryCommit; size?: number; strong?: boolean }) {
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
        <a class={['link-plain', { 'font-semibold': !!props.strong }]} href={`/${u().login}`} title={`View ${u().login}'s profile`}>
          {u().login}
        </a>
      )}
    </Show>
  );
  return (
    <span class="inline-flex items-center gap-1.5 flex-wrap min-w-0">
      <span class="AvatarStack shrink-0">
        <For each={authors().slice(0, 3)}>{(a) => <Avatar src={a.avatarUrl} size={props.size ?? 16} login={a.user?.login} />}</For>
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

export function VerifiedBadge() {
  return (
    <span
      class="Label Label--success"
      title="This commit was signed with a verified signature."
    >
      Verified
    </span>
  );
}

/** One commit in a list: headline, authors, checks · verified, sha, copy, browse. */
export function CommitRow(props: { commit: HistoryCommit; base: string; browsePath?: string }) {
  const [open, setOpen] = createSignal(false);
  const href = () => `${props.base}/commit/${props.commit.oid}`;
  return (
    <li class="Box-row Box-row--hover flex items-start gap-3 py-2! px-4!">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1 min-w-0">
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
          <CommitAuthors commit={props.commit} />
          <Show when={props.commit.checks}>
            <span>·</span>
            <ChecksBadge checks={props.commit.checks} href={href()} />
          </Show>
        </div>
        <Show when={open()}>
          <pre class="mt-2 text-xs text-fg-muted whitespace-pre-wrap font-mono">{props.commit.messageBody}</pre>
        </Show>
      </div>
      <div class="flex items-center gap-2 shrink-0 pt-1">
        <Show when={props.commit.verified}>
          <VerifiedBadge />
        </Show>
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
export default function CommitList(props: { commits: HistoryCommit[]; base: string; browsePath?: string }) {
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
              <For each={group.items}>{(c) => <CommitRow commit={c} base={props.base} browsePath={props.browsePath} />}</For>
            </ol>
          </section>
        )}
      </For>
    </div>
  );
}
