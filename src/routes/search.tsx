import { Title } from '@solidjs/meta';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { createSignal, Loading, Show } from 'solid-js';
import Octicon from '../components/Octicon';
import { PageSpinner, QUERY_KEYS, QueryInput } from '../components/ui';
import { searchIcon, xCircleFillIcon } from '../icons/octicons';
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
  const [value, setValue] = createSignal(() => props.q);
  let input: HTMLInputElement | undefined;
  return (
    <form
      role="search"
      class="flex gap-2 mb-4"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value().trim();
        if (q) navigate(searchHref({ q, type: props.type }));
      }}
    >
      <QueryInput
        class={['form-control flex-1 pl-8!', { 'pr-8!': !!value(), 'text-base! py-2!': props.large }]}
        name="q"
        label="Search GitHub"
        placeholder="Search GitHub"
        value={value()}
        onInput={setValue}
        inputRef={(el) => (input = el)}
        suggestions={QUERY_KEYS}
      >
        <Octicon icon={searchIcon} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" />
        <Show when={value()}>
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-accent flex bg-transparent border-0 p-0 cursor-pointer"
            aria-label="Clear"
            onClick={() => {
              setValue('');
              input?.focus();
            }}
          >
            <Octicon icon={xCircleFillIcon} />
          </button>
        </Show>
      </QueryInput>
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
