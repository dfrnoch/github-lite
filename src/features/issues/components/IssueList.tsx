import { useLocation, useNavigate, useSearchParams } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, For, isPending, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Blankslate, Pagination, Spinner } from '../../../components/ui';
import {
  checkIcon,
  gitPullRequestIcon,
  issueClosedIcon,
  issueOpenedIcon,
  searchIcon,
  sortDescIcon,
  triangleDownIcon,
  xCircleFillIcon,
} from '../../../icons/octicons';
import { formatNumber } from '../../../lib/format';
import { getAssignableUsers, getMilestones, getRepoLabels, PER_PAGE, searchIssues } from '../api';
import { qualifier, qualifiers, setQualifier, SORTS, stateOf, tokenize, withState } from '../query';
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

  const hrefFor = (query: string) => `${location.pathname}?q=${encodeURIComponent(query)}`;
  const go = (query: string) => navigate(hrefFor(query));
  const [input, setInput] = createSignal(() => q());

  const labelHref = (name: string) => hrefFor(setQualifier(withState(q(), 'open'), 'label', name));
  const state = () => stateOf(q());
  const lastPage = () => Math.max(1, Math.ceil(Math.min(result().total, 1000) / PER_PAGE));

  const filterClass = 'btn-invisible btn-sm text-fg-muted! font-normal! px-2!';
  const caret = (label: string) => (
    <>
      {label} <Octicon icon={triangleDownIcon} />
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
        <div class="relative flex-1">
          <input
            class="form-control w-full pr-8! rounded-r-none! text-sm"
            aria-label={props.kind === 'pr' ? 'Search pull requests' : 'Search issues'}
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
          />
          <Show when={params.q != null && q() !== props.defaultQuery}>
            <a
              class="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-accent flex"
              href={location.pathname}
              aria-label="Clear filter"
            >
              <Octicon icon={xCircleFillIcon} />
            </a>
          </Show>
        </div>
        <button type="submit" class="btn rounded-l-none! border-l-0! px-3!" aria-label="Search">
          <Octicon icon={searchIcon} />
        </button>
      </form>

      <div class="Box">
        <div class="Box-header flex flex-wrap items-center gap-x-4 gap-y-2 py-2! px-4!">
          <div class="flex items-center gap-4 text-sm">
            <Loading fallback={<span class="text-fg-muted">Loading…</span>}>
              <a class={['flex items-center gap-1.5', state() === 'open' ? 'link-plain font-semibold' : 'link-muted']} href={hrefFor(withState(q(), 'open'))}>
                <Octicon icon={props.kind === 'pr' ? gitPullRequestIcon : issueOpenedIcon} />
                Open <span class="Counter">{formatNumber(result().open)}</span>
              </a>
              <a class={['flex items-center gap-1.5', state() === 'closed' ? 'link-plain font-semibold' : 'link-muted']} href={hrefFor(withState(q(), 'closed'))}>
                <Octicon icon={props.kind === 'pr' ? checkIcon : issueClosedIcon} />
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
            <SelectPanel
              triggerClass={filterClass}
              trigger={
                <span class="inline-flex items-center gap-1">
                  <Octicon icon={sortDescIcon} />
                  {SORTS.find((s) => s.value === (qualifier(q(), 'sort') ?? 'created-desc'))?.label ?? 'Sort'}
                  <Octicon icon={triangleDownIcon} />
                </span>
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
              {(item) => <IssueRow item={item} showRepo={!repoScoped()} labelHref={repoScoped() ? labelHref : undefined} />}
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
