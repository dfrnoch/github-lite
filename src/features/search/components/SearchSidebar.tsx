import { createMemo, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import {
  codeIcon,
  commentDiscussionIcon,
  gitCommitIcon,
  gitPullRequestIcon,
  hashIcon,
  issueClosedIcon,
  issueOpenedIcon,
  peopleIcon,
  repoIcon,
} from '../../../icons/octicons';
import type { OcticonData } from '../../../icons/octicons';
import { compactNumber } from '../../../lib/format';
import { languageColor } from '../../../lib/languages';
import { getSearchCounts, type SearchCounts, type SearchType } from '../api';
import { searchHref } from '../href';
import { hasQualifier, toggleQualifier } from '../query';

const TYPES: { type: SearchType; label: string; icon: OcticonData }[] = [
  { type: 'code', label: 'Code', icon: codeIcon },
  { type: 'repositories', label: 'Repositories', icon: repoIcon },
  { type: 'issues', label: 'Issues', icon: issueOpenedIcon },
  { type: 'pullrequests', label: 'Pull requests', icon: gitPullRequestIcon },
  { type: 'discussions', label: 'Discussions', icon: commentDiscussionIcon },
  { type: 'users', label: 'Users', icon: peopleIcon },
  { type: 'commits', label: 'Commits', icon: gitCommitIcon },
  { type: 'topics', label: 'Topics', icon: hashIcon },
];

const LANGUAGES = ['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Java', 'C#', 'C++', 'PHP', 'Ruby', 'HTML', 'CSS'];

/** Left "Filter by" column of /search: result types with counts, languages, state. */
export default function SearchSidebar(props: { q: string; type: SearchType }) {
  const counts = createMemo(() => getSearchCounts(props.q));
  const withLanguages = () => !['users', 'topics', 'discussions', 'commits'].includes(props.type);
  const withState = () => props.type === 'issues' || props.type === 'pullrequests';

  return (
    <nav aria-label="Filter by" class="text-sm">
      <h2 class="text-base font-semibold px-2 mb-3">Filter by</h2>
      <ul class="NavList">
        <For each={TYPES}>
          {(t) => (
            <li>
              <a
                class="NavList-item"
                href={searchHref({ q: props.q, type: t.type })}
                aria-current={props.type === t.type ? 'page' : undefined}
              >
                <Octicon icon={t.icon} />
                <span class="flex-1">{t.label}</span>
                <Loading fallback={<span class="Counter">…</span>}>
                  <Count counts={counts()} type={t.type} />
                </Loading>
              </a>
            </li>
          )}
        </For>
      </ul>

      <Show when={withState()}>
        <hr class="NavList-divider" />
        <div class="NavList-heading">State</div>
        <ul class="NavList">
          <QualifierItem q={props.q} type={props.type} keyName="state" value="open" icon={issueOpenedIcon} label="Open" />
          <QualifierItem q={props.q} type={props.type} keyName="state" value="closed" icon={issueClosedIcon} label="Closed" />
        </ul>
      </Show>

      <Show when={withLanguages()}>
        <hr class="NavList-divider" />
        <div class="NavList-heading">Languages</div>
        <ul class="NavList">
          <For each={LANGUAGES}>
            {(lang) => (
              <li>
                <a
                  class="NavList-item"
                  href={searchHref({ q: toggleQualifier(props.q, 'language', lang), type: props.type })}
                  aria-current={hasQualifier(props.q, 'language', lang) ? 'true' : undefined}
                >
                  <span class="repo-language-color" style={{ 'background-color': languageColor(lang) }} />
                  {lang}
                </a>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </nav>
  );
}

function Count(props: { counts: SearchCounts | null; type: SearchType }) {
  const n = () => (props.counts && props.type in props.counts ? props.counts[props.type as keyof SearchCounts] : null);
  return (
    <Show when={n() != null} fallback={props.type === 'code' ? <span class="Counter">…</span> : undefined}>
      <span class="Counter">{compactNumber(n())}</span>
    </Show>
  );
}

function QualifierItem(props: { q: string; type: SearchType; keyName: string; value: string; icon: OcticonData; label: string }) {
  return (
    <li>
      <a
        class="NavList-item"
        href={searchHref({ q: toggleQualifier(props.q, props.keyName, props.value), type: props.type })}
        aria-current={hasQualifier(props.q, props.keyName, props.value) ? 'true' : undefined}
      >
        <Octicon icon={props.icon} />
        {props.label}
      </a>
    </li>
  );
}
