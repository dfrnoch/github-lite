import { Title } from '@solidjs/meta';
import { useNavigate, useParams, useSearchParams } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, onSettled, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { PageSpinner } from '../../../../components/ui';
import { getAllPaths } from '../../../../features/code/api';
import { fuzzyFilter, type FuzzyMatch } from '../../../../features/code/fuzzy';
import RefPicker from '../../../../features/repo/components/RefPicker';
import { useRepo } from '../../../../features/repo/context';
import { fileIcon } from '../../../../icons/octicons';
import { encodePath } from '../../../../lib/github';

/** /:owner/:repo/find/:ref — fuzzy file finder (the `t` hotkey). */
export default function FindPage() {
  const ctx = useRepo();
  const params = useParams<{ ref?: string }>();
  const [search, setSearch] = useSearchParams<{ q?: string }>();
  const gitRef = () => params.ref || ctx.repo().default_branch;
  const [query, setQuery] = createSignal(() => search.q ?? '');
  let input: HTMLInputElement | undefined;
  onSettled(() => input?.focus());

  return (
    <div class="container-lg px-4 py-6">
      <Title>{`Find file · ${ctx.fullName()}`}</Title>
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <RefPicker
          owner={ctx.owner()}
          repo={ctx.name()}
          current={gitRef()}
          defaultBranch={ctx.repo().default_branch}
          hrefFor={(ref) => `${ctx.base()}/find/${encodePath(ref)}`}
        />
        <a class="font-semibold text-base ml-2" href={`${ctx.base()}/tree/${encodePath(gitRef())}`}>
          {ctx.name()}
        </a>
        <span class="text-fg-muted">/</span>
        <input
          ref={(el) => (input = el)}
          class="form-control flex-1 min-w-48"
          placeholder="Search for a file"
          aria-label="Find file"
          autocomplete="off"
          spellcheck="false"
          value={query()}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            setSearch({ q: e.currentTarget.value || undefined }, { replace: true, scroll: false });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') history.back();
          }}
        />
      </div>
      <Loading fallback={<PageSpinner />}>
        <Results owner={ctx.owner()} repo={ctx.name()} gitRef={gitRef()} query={query()} input={() => input} />
      </Loading>
    </div>
  );
}

function Results(props: { owner: string; repo: string; gitRef: string; query: string; input: () => HTMLInputElement | undefined }) {
  const navigate = useNavigate();
  const all = createMemo(() => getAllPaths(props.owner, props.repo, props.gitRef));
  const matches = createMemo(() => fuzzyFilter(all().paths, props.query));
  // Back to the first result whenever the matches change.
  const [active, setActive] = createSignal<number>(() => (matches().length ? 0 : -1));
  const base = () => `/${props.owner}/${props.repo}`;
  const href = (m: FuzzyMatch) => `${base()}/blob/${encodePath(props.gitRef)}/${encodePath(m.path)}`;

  // Arrow keys / Enter from the search box drive the list.
  onSettled(() => {
    const el = props.input();
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      const n = matches().length;
      if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
        e.preventDefault();
        setActive((i) => Math.min(n - 1, i + 1));
      } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        const m = matches()[active()];
        if (m) navigate(href(m));
      } else return;
      queueMicrotask(() => document.querySelector('[data-finder-active="true"]')?.scrollIntoView({ block: 'nearest' }));
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <Show when={all().truncated}>
        <div class="flash flash-warn mb-3 text-sm">This repository is too large to list every file; some files are missing.</div>
      </Show>
      <ul class="Box" role="listbox" aria-label="Matching files">
        <For
          each={matches()}
          fallback={<li class="Box-row text-fg-muted text-center">No matching files found.</li>}
        >
          {(m, i) => (
            <li
              role="option"
              aria-selected={i() === active() ? 'true' : 'false'}
              data-finder-active={i() === active() ? 'true' : 'false'}
              class={['Box-row py-2! flex items-center gap-2', { 'bg-accent-muted': i() === active() }]}
              onMouseEnter={() => setActive(i())}
            >
              <Octicon icon={fileIcon} class="text-fg-muted shrink-0" />
              <a class="link-plain truncate font-mono text-sm" href={href(m)}>
                <Highlighted match={m} />
              </a>
            </li>
          )}
        </For>
      </ul>
      <p class="text-xs text-fg-muted mt-2">
        Tip: use <kbd class="border border-line rounded px-1">↑</kbd> <kbd class="border border-line rounded px-1">↓</kbd> to
        move and <kbd class="border border-line rounded px-1">Enter</kbd> to open.
      </p>
    </>
  );
}

function Highlighted(props: { match: FuzzyMatch }) {
  const parts = createMemo(() => {
    const out: { text: string; hit: boolean }[] = [];
    const hits = new Set(props.match.positions);
    for (let i = 0; i < props.match.path.length; i++) {
      const hit = hits.has(i);
      const last = out[out.length - 1];
      if (last && last.hit === hit) last.text += props.match.path[i];
      else out.push({ text: props.match.path[i]!, hit });
    }
    return out;
  });
  return <For each={parts()}>{(p) => (p.hit ? <mark class="bg-transparent font-bold text-fg">{p.text}</mark> : <>{p.text}</>)}</For>;
}
