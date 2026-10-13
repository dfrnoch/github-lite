import { Title } from '@solidjs/meta';
import { createMemo, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { CopyButton } from '../../../components/ui';
import type { RouteDefinition } from '@solidjs/router';
import { getCommunityFiles, getLastCommit, getReadme, getRepo, getRepoViewerState, getTree, getTreeCommits } from '../../../features/repo/api';
import AboutSidebar from '../../../features/repo/components/AboutSidebar';
import DirectoryView from '../../../features/repo/components/DirectoryView';
import RepoTitle from '../../../features/repo/components/RepoTitle';
import { useRepo } from '../../../features/repo/context';
import { repoForkedIcon, repoTemplateIcon } from '../../../icons/octicons';

// Everything on this page hangs off the default branch name, which only the
// repo response knows: start all of it the moment the repo lands (at
// navigation/hover time) instead of as each component renders.
export const route = {
  preload: ({ params }) => {
    const { owner, repo } = params as { owner: string; repo: string };
    void getRepoViewerState(owner, repo);
    void getCommunityFiles(owner, repo);
    void getRepo(owner, repo).then((r) => {
      const ref = r.default_branch;
      void getLastCommit(owner, repo, ref);
      void getLastCommit(owner, repo, ref, ''); // the bar above the file list
      void getReadme(owner, repo, ref, '');
      void getTree(owner, repo, ref, '').then((entries) => {
        if (entries) void getTreeCommits(owner, repo, ref, entries.map((e) => e.path));
      });
    });
  },
} satisfies RouteDefinition;

/** Repository home: /:owner/:repo */
export default function RepoHome() {
  const ctx = useRepo();
  const repo = () => ctx.repo();
  // An empty repository has no commits yet: show the quick setup instead.
  const head = createMemo(() => getLastCommit(ctx.owner(), ctx.name(), repo().default_branch));

  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`${repo().full_name}${repo().description ? `: ${repo().description}` : ''}`}</Title>
      <RepoTitle repo={repo()} />
      <Show when={repo().fork && repo().parent}>
        {(parent) => (
          <p class="-mt-3 mb-4 text-xs text-fg-muted flex items-center gap-1">
            <Octicon icon={repoForkedIcon} /> forked from <a href={`/${parent().full_name}`}>{parent().full_name}</a>
          </p>
        )}
      </Show>
      <Show when={repo().template_repository}>
        {(tpl) => (
          <p class="-mt-3 mb-4 text-xs text-fg-muted flex items-center gap-1">
            <Octicon icon={repoTemplateIcon} /> generated from <a href={`/${tpl().full_name}`}>{tpl().full_name}</a>
          </p>
        )}
      </Show>
      <div class="flex flex-col md:flex-row gap-6">
        <div class="flex-1 min-w-0">
          <Show when={head()} fallback={<QuickSetup cloneUrl={repo().clone_url} sshUrl={repo().ssh_url} />}>
            <DirectoryView repo={repo()} gitRef={repo().default_branch} path="" />
          </Show>
        </div>
        <aside class="w-full md:w-[296px] shrink-0">
          <AboutSidebar repo={repo()} />
        </aside>
      </div>
    </div>
  );
}

function QuickSetup(props: { cloneUrl: string; sshUrl: string }) {
  const script = () => `echo "# project" >> README.md
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin ${props.cloneUrl}
git push -u origin main`;
  return (
    <div class="Box">
      <div class="Box-header bg-accent-muted!">
        <h3 class="font-semibold">Quick setup — if you’ve done this kind of thing before</h3>
        <div class="input-group mt-2">
          <input class="form-control form-control-sm font-mono" readonly value={props.cloneUrl} />
          <CopyButton value={props.cloneUrl} class="btn btn-sm" />
        </div>
      </div>
      <div class="Box-body">
        <h3 class="font-semibold mb-2">…or create a new repository on the command line</h3>
        <pre class="bg-canvas-muted rounded-md p-4 text-xs font-mono overflow-auto">{script()}</pre>
        <h3 class="font-semibold mt-4 mb-2">…or push an existing repository from the command line</h3>
        <pre class="bg-canvas-muted rounded-md p-4 text-xs font-mono overflow-auto">{`git remote add origin ${props.cloneUrl}
git branch -M main
git push -u origin main`}</pre>
      </div>
    </div>
  );
}
