import { useLocation } from '@solidjs/router';
import { For, Show } from 'solid-js';
import { Blankslate, Pagination, pageHref } from '../../../components/ui';
import { repoIcon } from '../../../icons/octicons';
import type { PageInfo } from '../../../lib/github';
import { PER_PAGE, type RepoListResult } from '../api';
import type { FilterOption } from './RepoFiltersBar';
import RepoListItem from './RepoListItem';

/** Pagination info for a repo list result (search results know their last page). */
export function listPageInfo(r: { page: number; hasNext: boolean; total?: number | null }, perPage = PER_PAGE): PageInfo {
  return {
    page: r.page,
    hasNext: r.hasNext,
    hasPrev: r.page > 1,
    lastPage: r.total != null ? Math.max(1, Math.ceil(Math.min(r.total, 1000) / perPage)) : undefined,
  };
}

export const page = (raw: string | undefined) => Math.max(1, Number(raw) || 1);

export const REPO_SORTS: FilterOption[] = [
  { value: '', label: 'Last updated' },
  { value: 'name', label: 'Name' },
  { value: 'stargazers', label: 'Stars' },
];

/** List body shared by the Repositories / Stars tabs. */
export function RepoList(props: { result: RepoListResult; showOwner?: boolean; empty: string }) {
  const location = useLocation();
  return (
    <>
      <Show
        when={props.result.items.length}
        fallback={<Blankslate icon={repoIcon} title={props.empty} class="border-b border-line-muted" />}
      >
        <ul>
          <For each={props.result.items}>{(repo) => <RepoListItem repo={repo} showOwner={props.showOwner} />}</For>
        </ul>
      </Show>
      <div class="mt-4">
        <Pagination pageInfo={listPageInfo(props.result)} href={(n) => pageHref(location, n)} />
      </div>
    </>
  );
}

