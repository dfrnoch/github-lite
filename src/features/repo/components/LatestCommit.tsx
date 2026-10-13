import { createMemo, createSignal, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, RelativeTime } from '../../../components/ui';
import { ellipsisIcon, historyIcon } from '../../../icons/octicons';
import { formatNumber } from '../../../lib/format';
import { getLastCommit } from '../api';
import CommitStatusIcon from './CommitStatusIcon';

/** Commit message headline with #123 references linked into the repo. */
export function CommitMessage(props: { message: string; base: string; href: string; class?: string }) {
  const parts = createMemo(() => props.message.split(/(#\d+)/g));
  return (
    <span class={props.class}>
      <For each={parts()}>
        {(part) =>
          /^#\d+$/.test(part) ? (
            <a href={`${props.base}/issues/${part.slice(1)}`}>{part}</a>
          ) : (
            <a class="link-muted text-fg-muted! hover:text-fg-accent!" href={props.href}>
              {part}
            </a>
          )
        }
      </For>
    </span>
  );
}

/** The "author  message  ✓  abc1234 · 2 days ago  🕒 1,947 Commits" bar above file lists. */
export default function LatestCommit(props: { owner: string; repo: string; gitRef: string; path?: string }) {
  const commit = createMemo(() => getLastCommit(props.owner, props.repo, props.gitRef, props.path ?? ''));
  const [expanded, setExpanded] = createSignal(false);
  const base = () => `/${props.owner}/${props.repo}`;
  const historyHref = () => `${base()}/commits/${props.gitRef}${props.path ? `/${props.path}` : ''}`;

  return (
    <Show when={commit()}>
      {(c) => (
        <div class="Box-header flex items-center gap-2 py-3! text-sm flex-wrap">
          <span class="AvatarStack">
            <For each={c().authors.slice(0, 2)}>{(a) => <Avatar src={a.avatarUrl} size={24} />}</For>
          </span>
          <span class="font-semibold">
            <For each={c().authors.slice(0, 2)}>
              {(a, i) => (
                <>
                  {i() > 0 ? <span class="font-normal text-fg-muted"> and </span> : ''}
                  {a.user ? (
                    <a class="link-plain" href={`/${a.user.login}`}>
                      {a.user.login}
                    </a>
                  ) : (
                    a.name
                  )}
                </>
              )}
            </For>
          </span>
          <CommitMessage
            message={c().message.split('\n', 1)[0] ?? c().messageHeadline}
            base={base()}
            href={`${base()}/commit/${c().oid}`}
            class="truncate min-w-0 flex-1 basis-40"
          />
          <Show when={c().message.includes('\n')}>
            <button type="button" class="btn btn-sm h-5! px-1!" aria-label="Show description" onClick={() => setExpanded(!expanded())}>
              <Octicon icon={ellipsisIcon} />
            </button>
          </Show>
          <CommitStatusIcon state={c().status} href={`${base()}/commit/${c().oid}`} />
          <span class="text-fg-muted text-xs whitespace-nowrap">
            <a class="link-muted font-mono" href={`${base()}/commit/${c().oid}`}>
              {c().abbreviatedOid}
            </a>{' '}
            · <RelativeTime datetime={c().committedDate} relative />
          </span>
          <a class="btn btn-sm btn-invisible text-fg! font-semibold" href={historyHref()}>
            <Octicon icon={historyIcon} />
            {formatNumber(c().historyCount)} Commits
          </a>
          <Show when={expanded()}>
            <pre class="w-full whitespace-pre-wrap text-xs text-fg-muted font-mono mt-1">
              {c().message.split('\n').slice(1).join('\n').trim()}
            </pre>
          </Show>
        </div>
      )}
    </Show>
  );
}

