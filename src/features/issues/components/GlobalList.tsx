import { Title } from '@solidjs/meta';
import { useSearchParams } from '@solidjs/router';
import { For } from 'solid-js';
import { feature } from '../../refined';
import { qualifier, setQualifier } from '../query';
import IssueList from './IssueList';

interface Tab {
  label: string;
  key: string;
  value: string;
}

/** Global /issues and /pulls: the viewer's items across all repositories. */
export default function GlobalList(props: { kind: 'issue' | 'pr' }) {
  const [params] = useSearchParams<{ q?: string }>();
  const type = () => (props.kind === 'pr' ? 'is:pr' : 'is:issue');
  const tabs = (): Tab[] => [
    { label: 'Created', key: 'author', value: '@me' },
    { label: 'Assigned', key: 'assignee', value: '@me' },
    { label: 'Mentioned', key: 'mentions', value: '@me' },
    ...(props.kind === 'pr' ? [{ label: 'Review requests', key: 'review-requested', value: '@me' }] : []),
    // global-conversation-list-filters
    ...(feature('global-conversation-list-filters')
      ? [
          { label: 'Commented', key: 'commenter', value: '@me' },
          { label: 'Yours', key: 'user', value: '@me' },
        ]
      : []),
  ];
  const defaultQuery = () => `is:open ${type()} author:@me archived:false sort:updated-desc`;
  const q = () => params.q ?? defaultQuery();
  const keys = () => tabs().map((t) => t.key);
  const active = () => tabs().find((t) => qualifier(q(), t.key) === t.value)?.key;
  const tabHref = (t: Tab) => {
    // Swap the role qualifier, keep the rest of the query.
    const base = setQualifier(q(), keys(), null);
    return `?q=${encodeURIComponent(`${base} ${t.key}:${t.value}`.trim())}`;
  };
  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{props.kind === 'pr' ? 'Pull requests' : 'Issues'}</Title>
      <IssueList
        kind={props.kind}
        defaultQuery={defaultQuery()}
        header={
          <div class="flex flex-wrap items-center gap-2 mb-4">
            <h1 class="text-xl font-semibold mr-4">{props.kind === 'pr' ? 'Pull requests' : 'Issues'}</h1>
            <nav class="flex" aria-label="Filters">
              <For each={tabs()}>
                {(t) => (
                  <a class="subnav-item" href={tabHref(t)} aria-current={active() === t.key ? 'page' : undefined}>
                    {t.label}
                  </a>
                )}
              </For>
            </nav>
          </div>
        }
      />
    </div>
  );
}
