import { useLocation, useNavigate, useSearchParams } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, createSignal, For, isPending, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Blankslate, ISSUE_QUALIFIERS, itemState, Pagination, QueryInput, RelativeTime, Spinner, StateIcon } from '../../../components/ui';
import {
  commentIcon,
  gitPullRequestIcon,
  pinIcon,
  issueOpenedIcon,
  searchIcon,
  sortDescIcon,
  triangleDownIcon,
  xCircleFillIcon,
} from '../../../icons/octicons';
import { formatNumber } from '../../../lib/format';
import { feature } from '../../refined';
import { getViewer } from '../../user/api';
import { getAssignableUsers, getListCounts, getMilestones, getPinnedIssues, getRepoLabels, type PinnedIssue, PER_PAGE, searchIssues } from '../api';
import { qualifier, qualifiers, setQualifier, SORTS, stateOf, tokenize, withState } from '../query';
import { TITLE_CODE } from './IssueRow';
import IssueRow from './IssueRow';
import SelectPanel from './SelectPanel';

export interface IssueListProps {
  /** `all` = issues and pull requests (milestone page). */
  kind: 'issue' | 'pr' | 'all';
  /** Repo scope; omitted on the global /issues and /pulls pages. */
  owner?: string;
  repo?: string;
  /** Query when the URL has no ?q=. */
  defaultQuery: string;
  /** Extra qualifiers always added (global tabs add e.g. `archived:false`). */
  scope?: string;
  /** Buttons / heading row above the search box. */
  header?: JSX.Element;
}

const CHECK_FILTERS = [
  { key: 'success', label: 'Success' },
  { key: 'failure', label: 'Failure' },
  { key: 'pending', label: 'Pending' },
];
const DRAFT_FILTERS = [
  { key: 'false', label: 'Ready for review' },
  { key: 'true', label: 'Not ready for review (Draft PR)' },
];

const REVIEW_FILTERS = [
  { key: 'review:none', label: 'No reviews' },
  { key: 'review:required', label: 'Review required' },
  { key: 'review:approved', label: 'Approved review' },
  { key: 'review:changes_requested', label: 'Changes requested' },
  { key: 'reviewed-by:@me', label: 'Reviewed by you' },
  { key: 'review-requested:@me', label: 'Awaiting review from you' },
];

/**
 * GitHub's issue / PR list: query box with search syntax, Open / Closed
 * counts, filter menus that rewrite the query, rows and pagination.
 */
export default function IssueList(props: IssueListProps) {
  const [params] = useSearchParams<{ q?: string; page?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const q = () => (params.q ?? props.defaultQuery).trim();
  const page = () => Math.max(1, Number(params.page) || 1);
  const repoScoped = () => !!(props.owner && props.repo);

  /** The query actually sent: repo + type added when missing. */
  const fullQuery = () => {
    let s = q();
    const tokens = tokenize(s);
    if (repoScoped() && !tokens.some((t) => t.key === 'repo' || t.key === 'org' || t.key === 'user')) s = `repo:${props.owner}/${props.repo} ${s}`;
    if (props.kind !== 'all' && !tokens.some((t) => (t.key === 'is' || t.key === 'type') && /^(issue|pr|pull-request|pullrequest)$/i.test(t.value!)))
      s = `${s} ${props.kind === 'pr' ? 'is:pr' : 'is:issue'}`;
    if (props.scope) s = `${s} ${props.scope}`;
    return s;
  };
  const result = createMemo(() => searchIssues(fullQuery(), page()));
  const viewer = createMemo(() => getViewer());
  // Shared (deduped) with ListHeader's buttons; clean-conversation-filters hides empty filters.
  const counts = createMemo(() => (repoScoped() ? getListCounts(props.owner!, props.repo!) : null));
  // Pinned issues above the default repo issue list (like github.com).
  const showPinned = () => repoScoped() && props.kind === 'issue' && params.q == null && page() === 1;
  const pinned = createMemo(() => (showPinned() ? getPinnedIssues(props.owner!, props.repo!) : []));

  // fix-no-pr-search: an issue search on the PR list belongs on the issue list.
  createEffect(
    () => {
      if (props.kind !== 'pr' || !repoScoped() || !feature('fix-no-pr-search')) return null;
      const types = tokenize(q()).filter((t) => (t.key === 'is' || t.key === 'type') && !t.negated).map((t) => t.value!.toLowerCase());
      return types.includes('issue') && !types.some((t) => t === 'pr' || t === 'pull-request') ? `/${props.owner}/${props.repo}/issues?q=${encodeURIComponent(q())}` : null;
    },
    (to) => {
      if (to) navigate(to, { replace: true });
    },
  );

  const hrefFor = (query: string) => `${location.pathname}?q=${encodeURIComponent(query)}`;
  const go = (query: string) => navigate(hrefFor(query));
  const [input, setInput] = createSignal(() => q());

  const labelHref = (name: string) => hrefFor(setQualifier(withState(q(), 'open'), 'label', name));
  /** The current query with `key:value` replacing any `key:` qualifier. */
  const filterHref = (qual: string) => {
    const [key, value] = qual.split(':') as [string, string];
    return hrefFor(setQualifier(q(), key, value));
  };
  const state = () => stateOf(q());
  const lastPage = () => Math.max(1, Math.ceil(Math.min(result().total, 1000) / PER_PAGE));

  /** A repo count once loaded (undefined while loading, so filters stay visible). */
  const latestCount = (key: 'labels' | 'milestones') => {
    try {
      return counts()?.[key];
    } catch {
      return undefined;
    }
  };
  // github.com's ListView toolbar: invisible buttons, muted label + caret.
  const filterClass = 'ListToolbar-button';
  const caret = (label: string) => (
    <>
      <span>{label}</span>
      <Octicon icon={triangleDownIcon} />
    </>
  );

  return (
    <div>
      {props.header}
      <form
        class="flex mb-4"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(input());
        }}
      >
        <QueryInput
          class="form-control flex-1 pr-8! rounded-r-none! text-sm"
          label={props.kind === 'pr' ? 'Search pull requests' : 'Search issues'}
          value={input()}
          onInput={setInput}
          suggestions={ISSUE_QUALIFIERS}
        >
          <Show when={params.q != null && q() !== props.defaultQuery}>
            <a
              class="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-accent flex"
              href={location.pathname}
              aria-label="Clear filter"
            >
              <Octicon icon={xCircleFillIcon} />
            </a>
          </Show>
        </QueryInput>
        <button type="submit" class="btn rounded-l-none! border-l-0! px-3!" aria-label="Search">
          <Octicon icon={searchIcon} />
        </button>
      </form>

      <Show when={showPinned()}>
        <Loading>
          <PinnedIssues items={pinned()} base={`/${props.owner}/${props.repo}`} />
        </Loading>
      </Show>
      <div class="Box">
        <div
          class={[
            'Box-header ListToolbar',
            { 'rgh-sticky-list-toolbar sticky top-0 z-10 rounded-t-md': feature('sticky-conversation-list-toolbar') },
          ]}
        >
          <div class="flex items-center">
            <Loading fallback={<span class="ListToolbar-state">Loading…</span>}>
              <a class="ListToolbar-state" aria-current={state() === 'open' ? 'page' : undefined} href={hrefFor(withState(q(), 'open'))}>
                Open <span class="Counter">{formatNumber(result().open)}</span>
              </a>
              <a class="ListToolbar-state" aria-current={state() === 'closed' ? 'page' : undefined} href={hrefFor(withState(q(), 'closed'))}>
                Closed <span class="Counter">{formatNumber(result().closed)}</span>
              </a>
            </Loading>
          </div>
          <div class="flex-1" />
          <div class="flex flex-wrap items-center gap-1">
            <Show when={repoScoped()}>
              <SelectPanel
                triggerClass={filterClass}
                trigger={caret('Author')}
                title="Filter by author"
                align="right"
                placeholder="Filter users"
                load={() => getAssignableUsers(props.owner!, props.repo!)}
                key={(u) => u.login}
                text={(u) => `${u.login} ${u.name ?? ''}`}
                custom={(text) => ({ login: text, avatarUrl: '', name: null })}
                render={(u) => <UserOption login={u.login} avatarUrl={u.avatarUrl} name={u.name} />}
                selected={qualifiers(q(), 'author')}
                onApply={(keys) => go(setQualifier(q(), 'author', keys[0] ?? null))}
              />
              <Show when={!feature('clean-conversation-filters') || latestCount('labels') !== 0}>
              <SelectPanel
                triggerClass={filterClass}
                trigger={caret('Labels')}
                title="Filter by label"
                align="right"
                multiple
                placeholder="Filter labels"
                load={() => getRepoLabels(props.owner!, props.repo!)}
                key={(l) => l.name}
                text={(l) => `${l.name} ${l.description ?? ''}`}
                render={(l) => (
                  <span class="flex items-start gap-2">
                    <span class="mt-1 w-3.5 h-3.5 rounded-full shrink-0" style={{ 'background-color': `#${l.color}` }} />
                    <span class="min-w-0">
                      <span class="block">{l.name}</span>
                      <Show when={l.description}>
                        <span class="block text-xs text-fg-muted font-normal">{l.description}</span>
                      </Show>
                    </span>
                  </span>
                )}
                selected={qualifiers(q(), 'label')}
                onApply={(keys) => go(setQualifier(q(), 'label', keys))}
              />
              </Show>
              <Show when={!feature('clean-conversation-filters') || latestCount('milestones') !== 0}>
              <SelectPanel
                triggerClass={filterClass}
                trigger={caret('Milestones')}
                title="Filter by milestone"
                align="right"
                placeholder="Filter milestones"
                load={() => getMilestones(props.owner!, props.repo!, 'open')}
                key={(m) => m.title}
                text={(m) => m.title}
                render={(m) => <span>{m.title}</span>}
                selected={qualifiers(q(), 'milestone')}
                onApply={(keys) => go(setQualifier(q(), 'milestone', keys[0] ?? null))}
              />
              </Show>
              <Show when={props.kind === 'pr'}>
                <SelectPanel
                  triggerClass={filterClass}
                  trigger={caret('Reviews')}
                  title="Filter by reviews"
                  align="right"
                  load={() => REVIEW_FILTERS}
                  key={(r) => r.key}
                  text={(r) => r.label}
                  render={(r) => <span>{r.label}</span>}
                  selected={REVIEW_FILTERS.filter((r) => q().split(/\s+/).includes(r.key)).map((r) => r.key)}
                  onApply={(keys) => {
                    const base = setQualifier(q(), ['review', 'reviewed-by', 'review-requested'], null);
                    go(keys[0] ? `${base} ${keys[0]}` : base);
                  }}
                />
              </Show>
              <SelectPanel
                triggerClass={filterClass}
                trigger={caret(props.kind === 'pr' ? 'Assignee' : 'Assignees')}
                title="Filter by assignee"
                align="right"
                placeholder="Filter users"
                load={() => getAssignableUsers(props.owner!, props.repo!)}
                key={(u) => u.login}
                text={(u) => `${u.login} ${u.name ?? ''}`}
                render={(u) => <UserOption login={u.login} avatarUrl={u.avatarUrl} name={u.name} />}
                selected={qualifiers(q(), 'assignee')}
                onApply={(keys) => go(setQualifier(q(), 'assignee', keys[0] ?? null))}
              />
            </Show>
            <Show when={props.kind === 'pr' && feature('pr-filters')}>
              <SelectPanel
                triggerClass={filterClass}
                trigger={caret('Checks')}
                title="Filter by checks status"
                align="right"
                load={() => CHECK_FILTERS}
                key={(r) => r.key}
                text={(r) => r.label}
                render={(r) => <span>{r.label}</span>}
                selected={qualifiers(q(), 'status')}
                onApply={(keys) => go(setQualifier(q(), 'status', keys[0] ?? null))}
              />
              <SelectPanel
                triggerClass={filterClass}
                trigger={caret('Draft')}
                title="Filter by draft pull requests"
                align="right"
                load={() => DRAFT_FILTERS}
                key={(r) => r.key}
                text={(r) => r.label}
                render={(r) => <span>{r.label}</span>}
                selected={qualifiers(q(), 'draft')}
                onApply={(keys) => go(setQualifier(q(), 'draft', keys[0] ?? null))}
              />
            </Show>
            <SelectPanel
              triggerClass={filterClass}
              trigger={
                <>
                  <Octicon icon={sortDescIcon} />
                  <span>{SORTS.find((s) => s.value === (qualifier(q(), 'sort') ?? 'created-desc'))?.label ?? 'Sort'}</span>
                  <Octicon icon={triangleDownIcon} />
                </>
              }
              title="Sort by"
              align="right"
              width={240}
              load={() => [...SORTS]}
              key={(s) => s.value}
              text={(s) => s.label}
              render={(s) => <span>{s.label}</span>}
              selected={[qualifier(q(), 'sort') ?? 'created-desc']}
              onApply={(keys) => go(setQualifier(q(), 'sort', keys[0] && keys[0] !== 'created-desc' ? keys[0] : null))}
            />
          </div>
        </div>
        <Loading
          fallback={
            <div class="flex justify-center py-16 text-fg-muted">
              <Spinner />
            </div>
          }
        >
          <div class={{ 'opacity-60 transition-opacity': isPending(() => result()) }}>
            <For
              each={result().items}
              fallback={
                <Blankslate icon={props.kind === 'pr' ? gitPullRequestIcon : issueOpenedIcon} title="No results">
                  Try adjusting your search filters.
                </Blankslate>
              }
            >
              {(item) => (
                <IssueRow
                  item={item}
                  showRepo={!repoScoped()}
                  labelHref={repoScoped() ? labelHref : undefined}
                  filterHref={filterHref}
                  viewerLogin={viewer().login}
                />
              )}
            </For>
          </div>
        </Loading>
      </div>
      <Loading>
        <Pagination
          pageInfo={{ page: page(), lastPage: lastPage(), hasNext: page() < lastPage(), hasPrev: page() > 1 }}
          href={(p) => {
            const sp = new URLSearchParams(location.search);
            if (p <= 1) sp.delete('page');
            else sp.set('page', String(p));
            const qs = sp.toString();
            return `${location.pathname}${qs ? `?${qs}` : ''}`;
          }}
        />
      </Loading>
    </div>
  );
}

function UserOption(props: { login: string; avatarUrl: string; name: string | null }) {
  return (
    <span class="flex items-center gap-2">
      <Show when={props.avatarUrl} fallback={<Avatar login={props.login} size={20} />}>
        <Avatar src={props.avatarUrl} size={20} />
      </Show>
      <span class="font-semibold">{props.login}</span>
      <span class="text-fg-muted truncate font-normal">{props.name}</span>
    </span>
  );
}

/**
 * Pinned issues: cards side by side like github.com, or (clean-pinned-issues)
 * a standard list. pinned-issues-update-time shows when they were last updated.
 */
function PinnedIssues(props: { items: PinnedIssue[]; base: string }) {
  const time = (i: PinnedIssue) =>
    feature('pinned-issues-update-time') ? (
      <>
        updated <RelativeTime datetime={i.updatedAt} />
      </>
    ) : (
      <>
        opened <RelativeTime datetime={i.createdAt} />
      </>
    );
  const meta = (i: PinnedIssue) => (
    <>
      #{i.number} · {i.author?.login ?? 'ghost'} {time(i)}
    </>
  );
  return (
    <Show when={props.items.length}>
      <Show
        when={feature('clean-pinned-issues')}
        fallback={
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 rgh-pinned-cards">
            <For each={props.items}>
              {(i) => (
                <div class="Box p-3 flex flex-col gap-2">
                  <div class="flex items-center gap-2 text-xs text-fg-muted">
                    <StateIcon state={itemState({ isPull: false, state: i.state, stateReason: i.stateReason })} />
                    <span class="flex-1">{meta(i)}</span>
                    <Octicon icon={pinIcon} />
                  </div>
                  {/* oxlint-disable-next-line solid/no-innerhtml -- titleHTML is rendered + sanitized by GitHub */}
                  <a class={['link-plain font-semibold break-words', TITLE_CODE]} href={`${props.base}/issues/${i.number}`} innerHTML={i.titleHTML || i.title} />
                  <Show when={i.comments.totalCount}>
                    <span class="text-xs text-fg-muted inline-flex items-center gap-1">
                      <Octicon icon={commentIcon} size={12} /> {i.comments.totalCount}
                    </span>
                  </Show>
                </div>
              )}
            </For>
          </div>
        }
      >
        <div class="Box mb-4 rgh-clean-pinned-issues">
          <div class="Box-header py-2! px-4! text-sm font-semibold flex items-center gap-2">
            <Octicon icon={pinIcon} /> Pinned issues
          </div>
          <For each={props.items}>
            {(i) => (
              <div class="Box-row Box-row--hover flex items-start gap-3 py-2! px-4!">
                <StateIcon class="mt-1 shrink-0" state={itemState({ isPull: false, state: i.state, stateReason: i.stateReason })} />
                <div class="flex-1 min-w-0">
                  {/* oxlint-disable-next-line solid/no-innerhtml -- titleHTML is rendered + sanitized by GitHub */}
                  <a class={['link-plain font-semibold text-base break-words', TITLE_CODE]} href={`${props.base}/issues/${i.number}`} innerHTML={i.titleHTML || i.title} />
                  <div class="mt-1 text-xs text-fg-muted">{meta(i)}</div>
                </div>
                <Show when={i.comments.totalCount}>
                  <a class="link-muted text-xs inline-flex items-center gap-1 pt-1" href={`${props.base}/issues/${i.number}`}>
                    <Octicon icon={commentIcon} /> {i.comments.totalCount}
                  </a>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </Show>
  );
}
