import { createSignal, For } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dropdown } from '../../../components/ui';
import {
  checkCircleIcon,
  checkIcon,
  dotFillIcon,
  dotIcon,
  gitMergeIcon,
  gitPullRequestDraftIcon,
  gitPullRequestIcon,
  hubotIcon,
  issueOpenedIcon,
  squirrelIcon,
  triangleDownIcon,
  xCircleIcon,
  type OcticonData,
} from '../../../icons/octicons';
import { useHotkey } from '../../../lib/hotkeys';
import type { NotificationThread, SubjectState } from '../api';

export type Filter = 'Pull requests' | 'Issues' | 'Others' | 'Bots' | 'Open' | 'Closed' | 'Merged' | 'Draft' | 'Read' | 'Unread';
type Category = 'Type' | 'Status' | 'Read';
export type Selection = Record<Category, Filter[]>;

const CATEGORIES: Record<Category, Filter[]> = {
  Type: ['Pull requests', 'Issues', 'Others', 'Bots'],
  Status: ['Open', 'Closed', 'Merged', 'Draft'],
  Read: ['Read', 'Unread'],
};

const ICONS: Record<Filter, { icon: OcticonData; class?: string }> = {
  'Pull requests': { icon: gitPullRequestIcon },
  Issues: { icon: issueOpenedIcon },
  Others: { icon: squirrelIcon },
  Bots: { icon: hubotIcon },
  Open: { icon: checkCircleIcon, class: 'text-fg-success!' },
  Closed: { icon: xCircleIcon, class: 'text-fg-danger!' },
  Merged: { icon: gitMergeIcon, class: 'text-fg-done!' },
  Draft: { icon: gitPullRequestDraftIcon, class: 'text-fg-muted' },
  Read: { icon: dotIcon, class: 'text-fg-accent!' },
  Unread: { icon: dotFillIcon, class: 'text-fg-accent!' },
};

export interface ThreadFacts {
  thread: NotificationThread;
  unread: boolean;
  state: SubjectState | undefined;
}

function matches(f: Filter, t: ThreadFacts): boolean {
  const type = t.thread.subject.type;
  const s = t.state;
  switch (f) {
    case 'Pull requests':
      return type === 'PullRequest';
    case 'Issues':
      return type === 'Issue';
    case 'Others':
      return type !== 'PullRequest' && type !== 'Issue';
    case 'Bots':
      return !!s?.isBot;
    case 'Open':
      return s?.state === 'OPEN' && !s.isDraft;
    case 'Closed':
      return s?.state === 'CLOSED' && !s.merged;
    case 'Merged':
      return !!s?.merged || s?.state === 'MERGED';
    case 'Draft':
      return s?.state === 'OPEN' && !!s.isDraft;
    case 'Read':
      return !t.unread;
    case 'Unread':
      return t.unread;
  }
}

/** Threads matching every category that has a pick (any pick within a category), like Refined GitHub. */
export function selectMatching(selection: Selection, threads: ThreadFacts[]): string[] {
  const groups = Object.values(selection).filter((g) => g.length > 0);
  if (!groups.length) return [];
  return threads.filter((t) => groups.every((g) => g.some((f) => matches(f, t)))).map((t) => t.thread.id);
}

/**
 * A "Select by" menu next to the select-all checkbox (`S` opens it). Picks
 * combine as (any type) AND (any status) AND (any read state).
 */
export default function SelectBy(props: { onChange: (selection: Selection) => void }) {
  const [selection, setSelection] = createSignal<Selection>({ Type: [], Status: [], Read: [] });
  let root!: HTMLSpanElement;
  useHotkey({
    keys: 'S',
    description: 'Open the "Select by" menu',
    group: 'Notifications',
    handler: () => root.querySelector('button')?.click(),
  });

  const toggle = (category: Category, f: Filter) => {
    const cur = selection();
    const list = cur[category].includes(f) ? cur[category].filter((x) => x !== f) : [...cur[category], f];
    const next = { ...cur, [category]: list };
    setSelection(next);
    props.onChange(next);
  };

  return (
    <span ref={root} class="inline-flex items-center gap-2">
      <span class="text-fg-muted" aria-hidden="true">
        ·
      </span>
      <Dropdown
        class="btn btn-sm btn-invisible text-fg-muted! px-1!"
        menuClass="w-[220px]"
        title="Select notifications by type and status (S)"
        button={
          <>
            Select by <Octicon icon={triangleDownIcon} />
          </>
        }
      >
        {() => (
          <For each={Object.entries(CATEGORIES) as [Category, Filter[]][]}>
            {([category, filters], i) => (
              <>
                {i() > 0 && <hr class="SelectMenu-divider" />}
                <div class="SelectMenu-header py-1!">{category}</div>
                <For each={filters}>
                  {(f) => (
                    <button
                      type="button"
                      class="SelectMenu-item"
                      role="menuitemcheckbox"
                      aria-checked={selection()[category].includes(f) ? 'true' : 'false'}
                      onClick={() => toggle(category, f)}
                    >
                      <span class="w-4 flex">
                        {selection()[category].includes(f) && <Octicon icon={checkIcon} />}
                      </span>
                      <Octicon icon={ICONS[f].icon} class={ICONS[f].class} />
                      {f}
                    </button>
                  )}
                </For>
              </>
            )}
          </For>
        )}
      </Dropdown>
    </span>
  );
}
