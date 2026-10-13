import { Title } from '@solidjs/meta';
import { createMemo, For } from 'solid-js';
import { Avatar } from '../components/ui';
import { getTopRepos, getViewer } from '../features/user/api';

export default function Dashboard() {
  const viewer = createMemo(() => getViewer());
  const repos = createMemo(() => getTopRepos(20));
  return (
    <div class="container-xl px-4 py-6">
      <Title>Dashboard · GitHub</Title>
      <h2 class="text-base font-semibold mb-2">Hello {viewer().login}</h2>
      <ul>
        <For each={repos()}>
          {(repo) => (
            <li class="flex items-center gap-2 py-1">
              <Avatar src={repo.owner.avatar_url} size={20} />
              <a class="link-plain font-semibold" href={`/${repo.full_name}`}>{repo.full_name}</a>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}
