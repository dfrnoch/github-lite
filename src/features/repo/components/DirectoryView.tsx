import { createMemo, Loading, Show, untrack } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dropdown, PageSpinner } from '../../../components/ui';
import { gitBranchIcon, plusIcon, searchIcon, tagIcon, triangleDownIcon, uploadIcon } from '../../../icons/octicons';
import { formatNumber } from '../../../lib/format';
import { encodePath, GitHubError } from '../../../lib/github';
import type { Repository } from '../../../lib/types';
import { getReadme, getRepoOverview, getTree } from '../api';
import Breadcrumbs from './Breadcrumbs';
import CodeButton from './CodeButton';
import { useFileTreeOpen, useFinderHotkey } from './CodeLayout';
import FileTable from './FileTable';
import LatestCommit from './LatestCommit';
import ReadmeBox from './ReadmeBox';
import { readmePathFromHtml } from '../../../lib/markdown';
import RefPicker from './RefPicker';

/** File list + README for a directory at a ref (repo root or any sub-folder). */
export default function DirectoryView(props: { repo: Repository; gitRef: string; path: string }) {
  const owner = () => props.repo.owner.login;
  const name = () => props.repo.name;
  const base = () => `/${props.repo.full_name}`;
  const entries = createMemo(() => {
    return getTree(owner(), name(), props.gitRef, props.path).then((t) => {
      if (!t) throw new GitHubError(404, 'Not Found');
      return t;
    });
  });
  const readme = createMemo(() => getReadme(owner(), name(), props.gitRef, props.path));
  const overview = createMemo(() => getRepoOverview(owner(), name()));
  const isRoot = () => !props.path;
  const canPush = () => !!props.repo.permissions?.push;
  const inTree = useFileTreeOpen();
  const findHref = () => `${base()}/find/${encodePath(props.gitRef)}`;
  // The tree/blob layout registers the `t` hotkey itself; the repo home does it here.
  if (!untrack(inTree)) useFinderHotkey(findHref);

  return (
    <>
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <div class={{ 'lg:hidden': inTree() }}>
          <RefPicker
          owner={owner()}
          repo={name()}
          current={props.gitRef}
          defaultBranch={props.repo.default_branch}
            hrefFor={(ref) => (props.path ? `${base()}/tree/${encodePath(ref)}/${encodePath(props.path)}` : `${base()}/tree/${encodePath(ref)}`)}
          />
        </div>
        <Show
          when={isRoot()}
          fallback={
            <div class="min-w-0 ml-2">
              <Breadcrumbs owner={owner()} repo={name()} gitRef={props.gitRef} path={props.path} />
            </div>
          }
        >
          <Loading>
            <a class="btn btn-sm btn-invisible text-fg-muted! hidden md:inline-flex" href={`${base()}/branches`}>
              <Octicon icon={gitBranchIcon} />
              <strong class="text-fg">{formatNumber(overview().branches)}</strong> Branches
            </a>
            <a class="btn btn-sm btn-invisible text-fg-muted! hidden md:inline-flex" href={`${base()}/tags`}>
              <Octicon icon={tagIcon} />
              <strong class="text-fg">{formatNumber(overview().tags)}</strong> Tags
            </a>
          </Loading>
        </Show>
        <div class="flex-1" />
        <Show when={isRoot() && !inTree()}>
          <a class="form-control form-control-sm hidden! md:flex! items-center gap-2 w-56 text-fg-muted! no-underline!" href={findHref()}>
            <Octicon icon={searchIcon} />
            <span class="flex-1">Go to file</span>
            <kbd class="text-xs border border-line rounded px-1">t</kbd>
          </a>
        </Show>
        <Show when={canPush()}>
          <Dropdown
            class="btn btn-sm"
            align="right"
            button={
              <>
                <Octicon icon={plusIcon} />
                <span class="hidden md:inline">Add file</span>
                <Octicon icon={triangleDownIcon} />
              </>
            }
          >
            {(close) => (
              <>
                <a class="SelectMenu-item" href={`${base()}/new/${encodePath(props.gitRef)}${props.path ? `/${encodePath(props.path)}` : ''}`} onClick={close}>
                  <Octicon icon={plusIcon} /> Create new file
                </a>
                <a
                  class="SelectMenu-item"
                  href={`https://github.com/${props.repo.full_name}/upload/${encodePath(props.gitRef)}${props.path ? `/${encodePath(props.path)}` : ''}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={close}
                >
                  <Octicon icon={uploadIcon} /> Upload files
                </a>
              </>
            )}
          </Dropdown>
        </Show>
        <Show when={isRoot()}>
          <CodeButton repo={props.repo} gitRef={props.gitRef} />
        </Show>
      </div>

      <div class="Box">
        <Loading fallback={<div class="Box-header h-[49px]" />}>
          <LatestCommit owner={owner()} repo={name()} gitRef={props.gitRef} path={props.path} />
        </Loading>
        <Loading fallback={<PageSpinner />}>
          <FileTable owner={owner()} repo={name()} gitRef={props.gitRef} path={props.path} entries={entries()} />
        </Loading>
      </div>

      <Loading>
        <Show when={readme()}>
          {(html) => (
            <ReadmeBox
              html={html()}
              file={{
                owner: owner(),
                repo: name(),
                gitRef: props.gitRef,
                path: readmePathFromHtml(html()) ?? (props.path ? `${props.path}/README.md` : 'README.md'),
                private: props.repo.private,
              }}
            />
          )}
        </Show>
      </Loading>
    </>
  );
}
