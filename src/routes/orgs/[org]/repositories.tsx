import { Title } from '@solidjs/meta';
import { useParams, useSearchParams } from '@solidjs/router';
import { createMemo, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { PageSpinner } from '../../../components/ui';
import { repoIcon } from '../../../icons/octicons';
import { getOrgMeta } from '../../../features/orgs/api';
import { getOwnerLanguages, getOwnerRepos } from '../../../features/profile/api';
import RepoFiltersBar, { FilterSummary, type FilterOption } from '../../../features/profile/components/RepoFiltersBar';
import { page, REPO_SORTS, RepoList } from '../../../features/profile/components/RepoList';

const ORG_TYPES: FilterOption[] = [
  { value: '', label: 'All' },
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'source', label: 'Sources' },
  { value: 'forks', label: 'Forks' },
  { value: 'archived', label: 'Archived' },
  { value: 'mirror', label: 'Mirrors' },
  { value: 'template', label: 'Templates' },
];

/** /orgs/:org/repositories — every repository of an organization, with filters. */
export default function OrgRepositories() {
  const params = useParams<{ org: string }>();
  const [sp] = useSearchParams<{ q?: string; type?: string; language?: string; sort?: string; page?: string }>();
  const meta = createMemo(() => getOrgMeta(params.org));
  const languages = createMemo(() => getOwnerLanguages(params.org, true));
  const result = createMemo(() =>
    getOwnerRepos(params.org, true, false, { q: sp.q, type: sp.type, language: sp.language, sort: sp.sort }, page(sp.page)),
  );
  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`${params.org} repositories`}</Title>
      <Loading fallback={<PageSpinner />}>
        <RepoFiltersBar placeholder="Find a repository…" types={ORG_TYPES} languages={languages()} sorts={REPO_SORTS}>
          <Show when={meta().viewerIsAMember}>
            <a class="btn btn-primary" href="/new">
              <Octicon icon={repoIcon} class="text-fg-on-emphasis!" />
              New
            </a>
          </Show>
        </RepoFiltersBar>
        <FilterSummary
          total={result().total}
          noun="repositories"
          types={ORG_TYPES}
          languages={languages()}
          sorts={REPO_SORTS}
          clearHref={`/orgs/${params.org}/repositories`}
        />
        <RepoList result={result()} empty="This organization has no repositories that match." />
      </Loading>
    </div>
  );
}
