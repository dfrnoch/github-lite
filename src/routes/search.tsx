import { Title } from '@solidjs/meta';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { Loading, Show } from 'solid-js';
import Octicon from '../components/Octicon';
import { PageSpinner } from '../components/ui';
import { searchIcon } from '../icons/octicons';
import SearchResults from '../features/search/components/SearchResults';
import SearchSidebar from '../features/search/components/SearchSidebar';
import { normalizeType, param, searchHref } from '../features/search/href';

/** /search?q=&type=&s=&o=&p= — github.com's search results page. */
export default function SearchPage() {
  const [sp] = useSearchParams();
  const q = () => param(sp.q).trim();
  const type = () => normalizeType(param(sp.type) || undefined);
  const page = () => Math.max(1, Math.min(100, Number(param(sp.p)) || 1));

  return (
    <Show when={q()} fallback={<SearchLanding />}>
      <Title>{`Search · ${q()}`}</Title>
      <div class="flex flex-col md:flex-row min-h-[calc(100vh-64px)]">
        <aside class="md:w-[296px] shrink-0 md:border-r border-line-muted px-4 py-6">
          <SearchSidebar q={q()} type={type()} />
        </aside>
        <div class="flex-1 min-w-0 px-4 md:px-6 py-6">
          <div class="max-w-[1012px]">
            <SearchInput q={q()} type={type()} />
            <Loading fallback={<PageSpinner />}>
              <SearchResults q={q()} type={type()} sort={param(sp.s)} order={param(sp.o)} page={page()} />
            </Loading>
          </div>
        </div>
      </div>
    </Show>
  );
}

function SearchInput(props: { q: string; type: ReturnType<typeof normalizeType>; large?: boolean }) {
  const navigate = useNavigate();
  return (
    <form
      role="search"
      class="flex gap-2 mb-4"
      onSubmit={(e) => {
        e.preventDefault();
        const value = (new FormData(e.currentTarget).get('q') as string).trim();
        if (value) navigate(searchHref({ q: value, type: props.type }));
      }}
    >
      <label class="relative flex-1">
        <span class="sr-only">Search GitHub</span>
        <Octicon icon={searchIcon} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
        <input
          name="q"
          type="search"
          class={['form-control w-full pl-8!', { 'text-base! py-2!': props.large }]}
          value={props.q}
          placeholder="Search GitHub"
          autocomplete="off"
          spellcheck="false"
        />
      </label>
      <button type="submit" class="btn">
        Search
      </button>
    </form>
  );
}

function SearchLanding() {
  return (
    <div class="container-md px-4 py-16">
      <Title>Search · GitHub</Title>
      <h1 class="text-3xl font-semibold text-center mb-2">Search GitHub</h1>
      <p class="text-center text-fg-muted mb-8">Search code, repositories, users, issues, pull requests, and more.</p>
      <SearchInput q="" type="repositories" large />
      <div class="Box p-4 mt-6 text-sm">
        <h2 class="font-semibold mb-2">Search syntax tips</h2>
        <ul class="flex flex-col gap-1 text-fg-muted">
          <li>
            <code class="font-mono text-fg">repo:owner/name</code> — search within a repository
          </li>
          <li>
            <code class="font-mono text-fg">user:login</code> or <code class="font-mono text-fg">org:name</code> — search an owner's repositories
          </li>
          <li>
            <code class="font-mono text-fg">language:TypeScript</code>, <code class="font-mono text-fg">stars:&gt;1000</code>,{' '}
            <code class="font-mono text-fg">topic:solidjs</code> — narrow repository results
          </li>
          <li>
            <code class="font-mono text-fg">is:open is:pr author:@me</code> — filter issues and pull requests
          </li>
        </ul>
      </div>
    </div>
  );
}
