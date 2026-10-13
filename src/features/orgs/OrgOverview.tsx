import { Title } from '@solidjs/meta';
import { createMemo, For, Loading, Show } from 'solid-js';
import Octicon from '../../components/Octicon';
import { Avatar, Markdown } from '../../components/ui';
import { pencilIcon, personAddIcon } from '../../icons/octicons';
import { languageColor } from '../../lib/languages';
import { getProfileReadme, type OrgProfile } from '../profile/api';
import PinnedCard from '../profile/components/PinnedCard';
import RepoListItem from '../profile/components/RepoListItem';
import OrgInfo from './components/OrgInfo';
import OrgTabs from './components/OrgTabs';

/** /:org — organization overview (README, pinned/popular, repositories, people, languages, topics). */
export default function OrgOverview(props: { org: OrgProfile }) {
  const readme = createMemo(() => getProfileReadme(props.org.login, true));
  const pinned = () => (props.org.pinned.length ? props.org.pinned : props.org.popular.map((r) => ({ kind: 'repo' as const, ...r })));
  return (
    <>
      <Title>{`${props.org.name ?? props.org.login} · GitHub`}</Title>
      <OrgTabs login={props.org.login} active="overview" />
      <OrgInfo org={props.org} />
      <div class="container-xl px-4 md:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
        <div class="flex-1 min-w-0 flex flex-col gap-6">
          <Loading fallback={<div class="Box h-40 Skeleton" />}>
            <Show when={readme()}>
              {(r) => (
                <div class="Box p-6">
                  <div class="flex items-center justify-between text-xs font-mono mb-4">
                    <a class="link-plain" href={`/${r().repo}/blob/HEAD/${r().path}`}>
                      {r().path}
                    </a>
                    <Show when={props.org.viewerCanAdminister}>
                      <a class="btn-octicon" href={`/${r().repo}/edit/HEAD/${r().path}`} aria-label="Edit README">
                        <Octicon icon={pencilIcon} />
                      </a>
                    </Show>
                  </div>
                  <Markdown html={r().html} file={{ owner: r().repo.split('/')[0]!, repo: r().repo.split('/')[1]!, gitRef: 'HEAD', path: r().path }} />
                </div>
              )}
            </Show>
          </Loading>

          <Show when={pinned().length}>
            <section>
              <h2 class="text-base font-normal mb-2">{props.org.pinned.length ? 'Pinned' : 'Popular repositories'}</h2>
              <ol class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <For each={pinned()}>{(item) => <PinnedCard item={item} owner={props.org.login} />}</For>
              </ol>
            </section>
          </Show>

          <Show when={props.org.recent.length}>
            <section class="Box">
              <div class="Box-header flex items-center justify-between py-3!">
                <h2 class="Box-title">Repositories</h2>
                <Show when={props.org.viewerIsAMember}>
                  <a class="btn btn-sm btn-primary" href="/new">
                    New
                  </a>
                </Show>
              </div>
              <ul class="px-4 [&>li:last-child]:border-b-0">
                <For each={props.org.recent}>{(repo) => <RepoListItem repo={repo} />}</For>
              </ul>
              <div class="Box-footer text-center py-3!">
                <a class="font-semibold" href={`/orgs/${props.org.login}/repositories`}>
                  View all repositories
                </a>
              </div>
            </section>
          </Show>
        </div>

        <aside class="w-full md:w-[296px] shrink-0 text-sm">
          <Show when={props.org.viewerCanAdminister}>
            <section class="pb-4 mb-4 border-b border-line-muted">
              <a class="btn btn-block" href={`/orgs/${props.org.login}/people?invite=1`}>
                <Octicon icon={personAddIcon} /> Invite someone
              </a>
            </section>
          </Show>
          <Show when={props.org.people.length}>
            <section class="pb-4 mb-4 border-b border-line-muted">
              <h2 class="text-base font-semibold mb-2">
                <a class="link-plain" href={`/orgs/${props.org.login}/people`}>
                  People
                </a>
              </h2>
              <div class="flex flex-wrap gap-1">
                <For each={props.org.people}>
                  {(p) => (
                    <a href={`/${p.login}`} title={p.name ? `${p.login} (${p.name})` : p.login}>
                      <Avatar src={p.avatarUrl} size={32} login={p.login} />
                    </a>
                  )}
                </For>
              </div>
              <Show when={props.org.members > props.org.people.length}>
                <a class="block mt-2 text-xs" href={`/orgs/${props.org.login}/people`}>
                  View all
                </a>
              </Show>
            </section>
          </Show>
          <Show when={props.org.languages.length}>
            <section class="pb-4 mb-4 border-b border-line-muted">
              <h2 class="text-base font-semibold mb-2">Top languages</h2>
              <div class="flex flex-wrap gap-x-3 gap-y-1">
                <For each={props.org.languages.slice(0, 5)}>
                  {(l) => (
                    <a
                      class="link-muted inline-flex items-center gap-1"
                      href={`/orgs/${props.org.login}/repositories?language=${encodeURIComponent(l.name.toLowerCase())}`}
                    >
                      <span class="repo-language-color" style={{ 'background-color': l.color ?? languageColor(l.name) }} />
                      {l.name}
                    </a>
                  )}
                </For>
              </div>
            </section>
          </Show>
          <Show when={props.org.topics.length}>
            <section class="pb-4 mb-4">
              <h2 class="text-base font-semibold mb-2">Most used topics</h2>
              <div class="flex flex-wrap gap-1">
                <For each={props.org.topics.slice(0, 5)}>
                  {(t) => (
                    <a class="topic-tag" href={`/search?q=topic%3A${encodeURIComponent(t.name)}+org%3A${props.org.login}&type=repositories`}>
                      {t.name}
                    </a>
                  )}
                </For>
              </div>
            </section>
          </Show>
        </aside>
      </div>
    </>
  );
}
