import { useLocation, useNavigate } from '@solidjs/router';
import { createMemo, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Blankslate, Dropdown, IssueLabel, PageSpinner, RelativeTime } from '../../../components/ui';
import {
  checkCircleFillIcon,
  checkCircleIcon,
  checkIcon,
  chevronLeftIcon,
  chevronRightIcon,
  commentDiscussionIcon,
  commentIcon,
  lockIcon,
  searchIcon,
  triangleDownIcon,
  xIcon,
} from '../../../icons/octicons';
import { formatNumber } from '../../../lib/format';
import { useRepo } from '../../repo/context';
import {
  buildDiscussionQuery,
  categoryEmoji,
  type DiscussionListItem,
  type DiscussionQuery,
  getDiscussionCategories,
  getDiscussions,
  parseDiscussionQuery,
} from '../api';
import { UpvoteButton } from './Reactions';

const DEFAULT_QUERY = 'is:open';

/** /discussions and /discussions/categories/:slug — categories sidebar + list. */
export default function DiscussionsIndex(props: { categorySlug: string }) {
  const ctx = useRepo();
  const location = useLocation();
  const navigate = useNavigate();
  const q = createMemo(() => (location.query.discussions_q == null ? DEFAULT_QUERY : String(location.query.discussions_q)));
  const parsed = createMemo(() => parseDiscussionQuery(q()));
  const categories = createMemo(() => getDiscussionCategories(ctx.owner(), ctx.name()));
  const base = () => `${ctx.base()}/discussions`;

  const go = (next: Partial<DiscussionQuery>) => {
    const nq = buildDiscussionQuery({ ...parsed(), ...next });
    navigate(`${location.pathname}?discussions_q=${encodeURIComponent(nq)}`);
  };

  const sortLabel = () => ({ latest: 'Latest activity', created: 'Date created', top: 'Top' })[parsed().sort];
  const filterLabel = () => {
    const p = parsed();
    if (p.answered === true) return 'Answered';
    if (p.answered === false) return 'Unanswered';
    if (p.locked === true) return 'Locked';
    if (p.locked === false) return 'Unlocked';
    return p.state === 'open' ? 'Open' : p.state === 'closed' ? 'Closed' : 'All';
  };
  const FILTERS: { label: string; next: Partial<DiscussionQuery> }[] = [
    { label: 'Open', next: { state: 'open', answered: null, locked: null } },
    { label: 'Closed', next: { state: 'closed', answered: null, locked: null } },
    { label: 'Locked', next: { state: 'all', answered: null, locked: true } },
    { label: 'Unlocked', next: { state: 'all', answered: null, locked: false } },
    { label: 'Answered', next: { state: 'all', answered: true, locked: null } },
    { label: 'Unanswered', next: { state: 'all', answered: false, locked: null } },
    { label: 'All', next: { state: 'all', answered: null, locked: null } },
  ];

  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <div class="flex flex-wrap items-center gap-2 mb-6">
        <form
          class="relative flex-1 min-w-[240px]"
          onSubmit={(e) => {
            e.preventDefault();
            const value = String(new FormData(e.currentTarget).get('q') ?? '');
            navigate(`${location.pathname}?discussions_q=${encodeURIComponent(value.trim())}`);
          }}
        >
          <Octicon icon={searchIcon} class="absolute left-2 top-2 text-fg-muted" />
          <input name="q" class="form-control w-full pl-8! pr-8!" aria-label="Search all discussions" value={q()} />
          <Show when={q()}>
            <a class="absolute right-2 top-1.5 text-fg-muted" href={`${location.pathname}?discussions_q=`} aria-label="Clear filters">
              <Octicon icon={xIcon} />
            </a>
          </Show>
        </form>
        <Dropdown
          align="right"
          header="Sort by"
          button={
            <>
              <span class="text-fg-muted">Sort by:</span> {sortLabel()} <Octicon icon={triangleDownIcon} />
            </>
          }
        >
          {(close) => (
            <For each={['latest', 'created', 'top'] as const}>
              {(s) => (
                <button type="button" class="SelectMenu-item" onClick={() => (close(), go({ sort: s }))}>
                  <span class="w-4">
                    <Show when={parsed().sort === s}>
                      <Octicon icon={checkIcon} />
                    </Show>
                  </span>
                  {{ latest: 'Latest activity', created: 'Date created', top: 'Top' }[s]}
                </button>
              )}
            </For>
          )}
        </Dropdown>
        <Dropdown
          align="right"
          header="Filter by"
          button={
            <>
              <span class="text-fg-muted">Filter:</span> {filterLabel()} <Octicon icon={triangleDownIcon} />
            </>
          }
        >
          {(close) => (
            <For each={FILTERS}>
              {(f) => (
                <button type="button" class="SelectMenu-item" onClick={() => (close(), go(f.next))}>
                  <span class="w-4">
                    <Show when={filterLabel() === f.label}>
                      <Octicon icon={checkIcon} />
                    </Show>
                  </span>
                  {f.label}
                </button>
              )}
            </For>
          )}
        </Dropdown>
        <a
          class="btn btn-primary"
          href={`${base()}/new${props.categorySlug ? `?category=${encodeURIComponent(props.categorySlug)}` : ''}`}
        >
          New discussion
        </a>
      </div>

      <div class="flex flex-col md:flex-row gap-6">
        <aside class="md:w-[336px] shrink-0">
          <h2 class="font-semibold text-base mb-3 px-2">Categories</h2>
          <Loading fallback={<div class="px-2 text-sm text-fg-muted">Loading…</div>}>
            <ul class="NavList">
              <li>
                <a class="NavList-item" href={base()} aria-current={!props.categorySlug ? 'page' : undefined}>
                  <Octicon icon={commentDiscussionIcon} />
                  View all discussions
                </a>
              </li>
              <For each={categories().categories}>
                {(c) => (
                  <li>
                    <a
                      class="NavList-item"
                      href={`${base()}/categories/${c.slug}`}
                      aria-current={props.categorySlug === c.slug ? 'page' : undefined}
                      title={c.description ?? undefined}
                    >
                      <span class="w-4 text-center">{categoryEmoji(c.emojiHTML)}</span>
                      {c.name}
                    </a>
                  </li>
                )}
              </For>
            </ul>
          </Loading>
        </aside>
        <div class="flex-1 min-w-0">
          <Loading fallback={<PageSpinner />}>
            <List q={q()} categorySlug={props.categorySlug} />
          </Loading>
        </div>
      </div>
    </div>
  );
}

function List(props: { q: string; categorySlug: string }) {
  const ctx = useRepo();
  const location = useLocation();
  const cursor = createMemo(() => ({
    after: location.query.after ? String(location.query.after) : undefined,
    before: location.query.before ? String(location.query.before) : undefined,
  }));
  const page = createMemo(() => getDiscussions(ctx.owner(), ctx.name(), props.q, props.categorySlug, cursor()));
  const categories = createMemo(() => getDiscussionCategories(ctx.owner(), ctx.name()));
  const heading = () =>
    props.categorySlug ? (categories().categories.find((c) => c.slug === props.categorySlug)?.name ?? 'Discussions') : 'Discussions';
  const pageHref = (key: 'after' | 'before', value: string | null) => {
    const p = new URLSearchParams(location.search);
    p.delete('after');
    p.delete('before');
    if (value) p.set(key, value);
    return `${location.pathname}?${p.toString()}`;
  };
  return (
    <>
      <h2 class="font-semibold text-base mb-3">
        {heading()}
        <span class="Counter ml-2">{formatNumber(page().totalCount)}</span>
      </h2>
      <Show
        when={page().items.length}
        fallback={
          <Blankslate icon={commentDiscussionIcon} title="There aren't any discussions." class="Box">
            Try a different filter, or start a new discussion.
          </Blankslate>
        }
      >
        <div class="Box">
          <ul>
            <For each={page().items}>{(d) => <Row item={d} />}</For>
          </ul>
        </div>
      </Show>
      <Show when={page().pageInfo.hasNextPage || page().pageInfo.hasPreviousPage}>
        <nav class="pagination mt-4" aria-label="Pagination">
          <Show
            when={page().pageInfo.hasPreviousPage}
            fallback={
              <span class="disabled">
                <Octicon icon={chevronLeftIcon} /> Previous
              </span>
            }
          >
            <a href={pageHref('before', page().pageInfo.startCursor)} rel="prev">
              <Octicon icon={chevronLeftIcon} /> Previous
            </a>
          </Show>
          <Show
            when={page().pageInfo.hasNextPage}
            fallback={
              <span class="disabled">
                Next <Octicon icon={chevronRightIcon} />
              </span>
            }
          >
            <a href={pageHref('after', page().pageInfo.endCursor)} rel="next">
              Next <Octicon icon={chevronRightIcon} />
            </a>
          </Show>
        </nav>
      </Show>
    </>
  );
}

function Row(props: { item: DiscussionListItem }) {
  const ctx = useRepo();
  const href = () => `${ctx.base()}/discussions/${props.item.number}`;
  return (
    <li class="Box-row Box-row--hover flex items-center gap-3 py-3!">
      <UpvoteButton
        subjectId={props.item.id}
        count={props.item.upvoteCount}
        upvoted={props.item.viewerHasUpvoted}
        canUpvote={props.item.viewerCanUpvote}
      />
      <span class="w-10 h-10 shrink-0 flex items-center justify-center rounded-md bg-canvas-muted text-lg" aria-hidden="true">
        {categoryEmoji(props.item.category.emojiHTML)}
      </span>
      <div class="flex-1 min-w-0">
        <a class="block font-semibold text-base link-plain break-words" href={href()}>
          <Show when={props.item.locked}>
            <Octicon icon={lockIcon} class="text-fg-muted mr-1" />
          </Show>
          {props.item.title}
        </a>
        <Show when={props.item.labels?.nodes.length}>
          <span class="inline-flex flex-wrap gap-1 my-0.5">
            <For each={props.item.labels!.nodes}>{(l) => <IssueLabel name={l.name} color={l.color} />}</For>
          </span>
        </Show>
        <div class="text-xs text-fg-muted mt-0.5">
          <Show when={props.item.author}>
            {(a) => (
              <a class="link-muted underline" href={`/${a().login}`}>
                {a().login}
              </a>
            )}
          </Show>{' '}
          {props.item.category.isAnswerable ? 'asked' : 'started'} <RelativeTime datetime={props.item.createdAt} /> in{' '}
          <a class="link-muted underline" href={`${ctx.base()}/discussions/categories/${props.item.category.slug}`}>
            {props.item.category.name}
          </a>
          <Show when={props.item.category.isAnswerable}>
            {' · '}
            <Show when={props.item.isAnswered} fallback={<span class="font-semibold">Unanswered</span>}>
              <span class="font-semibold text-fg-success">Answered</span>
            </Show>
          </Show>
          <Show when={props.item.closed}>
            {' · '}
            <span class="font-semibold">Closed</span>
          </Show>
        </div>
      </div>
      <div class="hidden md:flex -space-x-1.5 shrink-0">
        <For each={props.item.participants.slice(0, 4)}>
          {(p) => <img class="avatar avatar-user ring-2 ring-[var(--bgColor-default)]" src={`${p.avatarUrl}${p.avatarUrl.includes('?') ? '&' : '?'}s=40`} width={20} height={20} alt={`@${p.login}`} title={p.login} />}
        </For>
      </div>
      <a class="flex items-center gap-1 text-sm text-fg-muted w-14 justify-end shrink-0 link-muted" href={href()}>
        <Show
          when={props.item.category.isAnswerable}
          fallback={<Octicon icon={commentIcon} />}
        >
          <Show when={props.item.isAnswered} fallback={<Octicon icon={checkCircleIcon} />}>
            <Octicon icon={checkCircleFillIcon} class="text-fg-success" />
          </Show>
        </Show>
        {props.item.comments.totalCount}
      </a>
    </li>
  );
}
