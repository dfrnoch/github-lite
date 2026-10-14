import { For, Show } from 'solid-js';
import { chevronLeftIcon, chevronRightIcon } from '../../icons/octicons';
import type { PageInfo } from '../../lib/github';
import Octicon from '../Octicon';

/** Visible page numbers with gaps: 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(page: number, last: number): (number | null)[] {
  const pages = new Set([1, 2, last - 1, last, page - 2, page - 1, page, page + 1, page + 2]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const p of sorted) {
    if (out.length && p - (out[out.length - 1] as number) > 1) out.push(null);
    out.push(p);
  }
  return out;
}

/**
 * GitHub-style "‹ Previous 1 2 3 … Next ›" pagination. `href(page)` builds the
 * link for a page (usually the current URL with ?page=N).
 */
export default function Pagination(props: { pageInfo: PageInfo; href: (page: number) => string }) {
  const page = () => props.pageInfo.page;
  return (
    <Show when={props.pageInfo.hasNext || props.pageInfo.hasPrev || page() > 1}>
      <nav class="pagination" aria-label="Pagination">
        <Show
          when={page() > 1}
          fallback={
            <span class="disabled">
              <Octicon icon={chevronLeftIcon} /> Previous
            </span>
          }
        >
          <a href={props.href(page() - 1)} rel="prev">
            <Octicon icon={chevronLeftIcon} /> Previous
          </a>
        </Show>
        <Show when={props.pageInfo.lastPage}>
          {(last) => (
            <For each={pageWindow(page(), last())}>
              {(p) =>
                p == null ? (
                  <span class="disabled gap">…</span>
                ) : (
                  // Read page() inside JSX (the For callback body is not a tracking scope).
                  <Show when={p !== page()} fallback={<em aria-current="page">{p}</em>}>
                    <a href={props.href(p)}>{p}</a>
                  </Show>
                )
              }
            </For>
          )}
        </Show>
        <Show
          when={props.pageInfo.hasNext}
          fallback={
            <span class="disabled">
              Next <Octicon icon={chevronRightIcon} />
            </span>
          }
        >
          <a href={props.href(page() + 1)} rel="next">
            Next <Octicon icon={chevronRightIcon} />
          </a>
        </Show>
      </nav>
    </Show>
  );
}

/** Builds `?page=N` hrefs that keep the rest of the current query string. */
export function pageHref(location: { pathname: string; search: string }, page: number) {
  const params = new URLSearchParams(location.search);
  if (page <= 1) params.delete('page');
  else params.set('page', String(page));
  const qs = params.toString();
  return `${location.pathname}${qs ? `?${qs}` : ''}`;
}
