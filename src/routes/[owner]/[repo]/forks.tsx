import { Title } from '@solidjs/meta';
import { useLocation, useSearchParams } from '@solidjs/router';
import { createMemo, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Avatar, Blankslate, Pagination, pageHref, RelativeTime } from '../../../components/ui';
import { getForks } from '../../../features/insights/api';
import InsightsLayout from '../../../features/insights/components/InsightsLayout';
import { useRepo } from '../../../features/repo/context';
import { eyeIcon, issueOpenedIcon, repoForkedIcon, starIcon } from '../../../icons/octicons';
import { compactNumber } from '../../../lib/format';

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'stargazers', label: 'Most starred' },
  { value: 'watchers', label: 'Most watched' },
];

/** /:owner/:repo/forks — forks list with sort. */
export default function ForksPage() {
  const ctx = useRepo();
  const location = useLocation();
  const [search, setSearch] = useSearchParams<{ sort?: string; page?: string }>();
  const sort = () => (SORTS.some((s) => s.value === search.sort) ? search.sort! : 'newest');
  const page = () => Math.max(1, Number(search.page) || 1);
  const forks = createMemo(() => getForks(ctx.owner(), ctx.name(), sort(), page()));
  return (
    <InsightsLayout>
      <Title>{`Forks · ${ctx.fullName()}`}</Title>
      <div class="flex flex-wrap items-center gap-2 pb-2 mb-4 border-b border-line-muted">
        <h2 class="text-2xl font-normal flex-1">Forks</h2>
        <label class="text-sm flex items-center gap-2">
          <span class="text-fg-muted">Sort</span>
          <select class="form-select form-control-sm w-auto!" value={sort()} onChange={(e) => setSearch({ sort: e.currentTarget.value, page: undefined })}>
            <For each={SORTS}>{(s) => <option value={s.value}>{s.label}</option>}</For>
          </select>
        </label>
      </div>
      <div class="Box">
        <For each={forks().items} fallback={<Blankslate icon={repoForkedIcon} title="No one has forked this repository yet" />}>
          {(f) => (
            <div class="Box-row">
              <div class="flex items-center gap-2">
                <Avatar src={f.owner.avatar_url} size={20} square={f.owner.type === 'Organization'} />
                <a class="font-semibold" href={`/${f.full_name}`}>
                  {f.full_name}
                </a>
                <Show when={f.private}>
                  <span class="Label">Private</span>
                </Show>
              </div>
              <Show when={f.description}>
                <p class="text-sm text-fg-muted mt-1">{f.description}</p>
              </Show>
              <div class="flex flex-wrap gap-4 mt-2 text-xs text-fg-muted">
                <span class="flex items-center gap-1">
                  <Octicon icon={starIcon} /> {compactNumber(f.stargazers_count)}
                </span>
                <span class="flex items-center gap-1">
                  <Octicon icon={repoForkedIcon} /> {compactNumber(f.forks_count)}
                </span>
                <span class="flex items-center gap-1">
                  <Octicon icon={eyeIcon} /> {compactNumber(f.watchers_count)}
                </span>
                <span class="flex items-center gap-1">
                  <Octicon icon={issueOpenedIcon} /> {compactNumber(f.open_issues_count)}
                </span>
                <span>
                  Created <RelativeTime datetime={f.created_at} />
                </span>
                <span>
                  Updated <RelativeTime datetime={f.pushed_at} />
                </span>
              </div>
            </div>
          )}
        </For>
      </div>
      <Pagination pageInfo={forks().pageInfo} href={(p) => pageHref(location, p)} />
    </InsightsLayout>
  );
}
