import type { JSX } from '@solidjs/web';
import { createMemo, For, isPending, Loading, Match, Show, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Blankslate, Dropdown, Pagination } from '../../../components/ui';
import { alertIcon, checkIcon, searchIcon, triangleDownIcon } from '../../../icons/octicons';
import { compactNumber, formatNumber } from '../../../lib/format';
import {
  MAX_RESULTS,
  PER_PAGE,
  getOwnerDetails,
  searchCode,
  searchCommits,
  searchDiscussions,
  searchIssues,
  searchRepos,
  searchTopics,
  searchUsers,
  type SearchPage,
  type SearchType,
  type UserHit,
} from '../api';
import { searchHref } from '../href';
import { freeTerms } from '../query';
import { CodeCard, CommitCard, DiscussionCard, IssueCard, RepoCard, TopicCard, UserCard } from './ResultCards';

export interface SearchProps {
  q: string;
  type: SearchType;
  sort: string;
  order: string;
  page: number;
}

interface SortOption {
  label: string;
  sort: string;
  order: string;
}

const best = { label: 'Best match', sort: '', order: '' };
const SORTS: Partial<Record<SearchType, SortOption[]>> = {
  repositories: [
    best,
    { label: 'Most stars', sort: 'stars', order: 'desc' },
    { label: 'Fewest stars', sort: 'stars', order: 'asc' },
    { label: 'Most forks', sort: 'forks', order: 'desc' },
    { label: 'Fewest forks', sort: 'forks', order: 'asc' },
    { label: 'Recently updated', sort: 'updated', order: 'desc' },
    { label: 'Least recently updated', sort: 'updated', order: 'asc' },
  ],
  issues: [
    best,
    { label: 'Most commented', sort: 'comments', order: 'desc' },
    { label: 'Least commented', sort: 'comments', order: 'asc' },
    { label: 'Newest', sort: 'created', order: 'desc' },
    { label: 'Oldest', sort: 'created', order: 'asc' },
    { label: 'Recently updated', sort: 'updated', order: 'desc' },
    { label: 'Least recently updated', sort: 'updated', order: 'asc' },
  ],
  users: [
    best,
    { label: 'Most followers', sort: 'followers', order: 'desc' },
    { label: 'Fewest followers', sort: 'followers', order: 'asc' },
    { label: 'Most recently joined', sort: 'joined', order: 'desc' },
    { label: 'Least recently joined', sort: 'joined', order: 'asc' },
    { label: 'Most repositories', sort: 'repositories', order: 'desc' },
    { label: 'Fewest repositories', sort: 'repositories', order: 'asc' },
  ],
  commits: [
    best,
    { label: 'Recently committed', sort: 'committer-date', order: 'desc' },
    { label: 'Least recently committed', sort: 'committer-date', order: 'asc' },
    { label: 'Recently authored', sort: 'author-date', order: 'desc' },
    { label: 'Least recently authored', sort: 'author-date', order: 'asc' },
  ],
};
SORTS.pullrequests = SORTS.issues;

/** The result list for the active type (header with count + sort, cards, pagination). */
export default function SearchResults(props: SearchProps) {
  return (
    <Switch>
      <Match when={props.type === 'repositories'}>
        <RepoResults {...props} />
      </Match>
      <Match when={props.type === 'code'}>
        <CodeResults {...props} />
      </Match>
      <Match when={props.type === 'issues' || props.type === 'pullrequests'}>
        <IssueResults {...props} />
      </Match>
      <Match when={props.type === 'discussions'}>
        <DiscussionResults {...props} />
      </Match>
      <Match when={props.type === 'users'}>
        <UserResults {...props} />
      </Match>
      <Match when={props.type === 'commits'}>
        <CommitResults {...props} />
      </Match>
      <Match when={props.type === 'topics'}>
        <TopicResults {...props} />
      </Match>
    </Switch>
  );
}

function RepoResults(props: SearchProps) {
  const res = createMemo(() => searchRepos(props.q, props.page, props.sort, props.order));
  const terms = createMemo(() => freeTerms(props.q));
  return (
    <ResultsFrame search={props} result={res()} pending={isPending(() => res())}>
      {(items) => <For each={items}>{(repo) => <RepoCard repo={repo} terms={terms()} />}</For>}
    </ResultsFrame>
  );
}

function CodeResults(props: SearchProps) {
  const res = createMemo(() => searchCode(props.q, props.page));
  return (
    <ResultsFrame search={props} result={res()} pending={isPending(() => res())} unit="files">
      {(items) => <For each={items}>{(hit) => <CodeCard hit={hit} />}</For>}
    </ResultsFrame>
  );
}

function IssueResults(props: SearchProps) {
  const res = createMemo(() =>
    searchIssues(props.q, props.type === 'pullrequests' ? 'pr' : 'issue', props.page, props.sort, props.order),
  );
  const terms = createMemo(() => freeTerms(props.q));
  return (
    <ResultsFrame search={props} result={res()} pending={isPending(() => res())}>
      {(items) => <For each={items}>{(issue) => <IssueCard issue={issue} terms={terms()} />}</For>}
    </ResultsFrame>
  );
}

function DiscussionResults(props: SearchProps) {
  const res = createMemo(() => searchDiscussions(props.q, props.page));
  const terms = createMemo(() => freeTerms(props.q));
  return (
    <ResultsFrame search={props} result={res()} pending={isPending(() => res())}>
      {(items) => <For each={items}>{(d) => <DiscussionCard discussion={d} terms={terms()} />}</For>}
    </ResultsFrame>
  );
}

function UserResults(props: SearchProps) {
  const res = createMemo(() => searchUsers(props.q, props.page, props.sort, props.order));
  const terms = createMemo(() => freeTerms(props.q));
  return (
    <ResultsFrame search={props} result={res()} pending={isPending(() => res())}>
      {(items) => <UserList users={items} terms={terms()} />}
    </ResultsFrame>
  );
}

/** Users render right away; names/bios (one GraphQL batch) fill in when they arrive. */
function UserList(props: { users: UserHit[]; terms: string[] }) {
  const details = createMemo(() => getOwnerDetails(props.users.map((u) => u.login)));
  return (
    <Loading fallback={<For each={props.users}>{(u) => <UserCard user={u} terms={props.terms} />}</For>}>
      <For each={props.users}>{(u) => <UserCard user={u} details={details()[u.login]} terms={props.terms} />}</For>
    </Loading>
  );
}

function CommitResults(props: SearchProps) {
  const res = createMemo(() => searchCommits(props.q, props.page, props.sort, props.order));
  const terms = createMemo(() => freeTerms(props.q));
  return (
    <ResultsFrame search={props} result={res()} pending={isPending(() => res())}>
      {(items) => <For each={items}>{(c) => <CommitCard commit={c} terms={terms()} />}</For>}
    </ResultsFrame>
  );
}

function TopicResults(props: SearchProps) {
  const res = createMemo(() => searchTopics(props.q, props.page));
  const terms = createMemo(() => freeTerms(props.q));
  return (
    <ResultsFrame search={props} result={res()} pending={isPending(() => res())}>
      {(items) => <For each={items}>{(t) => <TopicCard topic={t} terms={terms()} />}</For>}
    </ResultsFrame>
  );
}

function ResultsFrame<T>(props: {
  search: SearchProps;
  result: SearchPage<T>;
  pending: boolean;
  unit?: string;
  children: (items: T[]) => JSX.Element;
}) {
  const lastPage = () => Math.max(1, Math.ceil(Math.min(props.result.total, MAX_RESULTS) / PER_PAGE));
  const sorts = () => SORTS[props.search.type];
  return (
    <div>
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 class="text-base font-semibold">
          <Show when={!props.result.error} fallback="0 results">
            <span title={formatNumber(props.result.total)}>{compactNumber(props.result.total)}</span> {props.unit ?? 'results'}
          </Show>
        </h2>
        <Show when={sorts()}>{(list) => <SortMenu search={props.search} options={list()} />}</Show>
      </div>
      <Show when={props.result.error}>{(err) => <SearchErrorFlash status={err().status} message={err().message} />}</Show>
      <Show when={!props.result.error}>
        <Show
          when={props.result.items.length}
          fallback={
            <Blankslate icon={searchIcon} title={`Your search did not match any ${props.unit ?? 'results'}`} class="Box">
              Try different keywords, or remove some filters.
            </Blankslate>
          }
        >
          <div class={['flex flex-col gap-4 transition-opacity', { 'opacity-50': props.pending }]}>
            {props.children(props.result.items)}
          </div>
          <div class="mt-6">
            <Pagination
              pageInfo={{
                page: props.search.page,
                lastPage: lastPage(),
                hasNext: props.search.page < lastPage(),
                hasPrev: props.search.page > 1,
              }}
              href={(p) => searchHref({ ...props.search, page: p })}
            />
          </div>
        </Show>
      </Show>
    </div>
  );
}

function SortMenu(props: { search: SearchProps; options: SortOption[] }) {
  const current = () =>
    props.options.find((o) => o.sort === props.search.sort && (!o.sort || o.order === (props.search.order || 'desc'))) ??
    props.options[0]!;
  return (
    <Dropdown
      class="btn btn-sm"
      align="right"
      menuClass="w-64"
      header="Sort by"
      button={
        <>
          <span class="text-fg-muted">Sort by:</span> {current().label}
          <Octicon icon={triangleDownIcon} />
        </>
      }
    >
      {(close) => (
        <For each={props.options}>
          {(o) => (
            <a
              class="SelectMenu-item"
              role="menuitemradio"
              aria-checked={o === current() ? 'true' : 'false'}
              href={searchHref({ q: props.search.q, type: props.search.type, sort: o.sort, order: o.order })}
              onClick={close}
            >
              <span class="w-4">
                <Show when={o === current()}>
                  <Octicon icon={checkIcon} />
                </Show>
              </span>
              {o.label}
            </a>
          )}
        </For>
      )}
    </Dropdown>
  );
}

export function SearchErrorFlash(props: { status: number; message: string }) {
  const limited = () => props.status === 403 || props.status === 429;
  return (
    <div class="flash flash-error mb-4">
      <Octicon icon={alertIcon} />
      <div class="flex-1 min-w-0">
        <strong>{limited() ? 'You have exceeded a rate limit.' : 'We could not perform this search.'}</strong>
        <div class="mt-1 break-words">
          {limited() ? 'Please wait a minute before you try again. ' : ''}
          {props.message}
        </div>
      </div>
    </div>
  );
}
