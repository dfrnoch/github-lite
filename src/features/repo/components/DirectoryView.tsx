import { useNavigate } from '@solidjs/router';
import { createMemo, createSignal, Loading, Show, untrack } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dropdown, PageSpinner, toast, toastError } from '../../../components/ui';
import {
  downloadIcon,
  gitBranchIcon,
  gitPullRequestIcon,
  plusIcon,
  searchIcon,
  tagIcon,
  trashIcon,
  triangleDownIcon,
  uploadIcon,
} from '../../../icons/octicons';
import { deleteBranch } from '../../code/api';
import { DefaultBranchButton } from '../../code/refined';
import { getBranchStatus } from '../../code/refinedApi';
import { feature } from '../../refined';
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
import RefPickerExtras from '../refined/RefExtras';

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
        <DefaultBranchButton
          gitRef={props.gitRef}
          defaultBranch={props.repo.default_branch}
          href={props.path ? `${base()}/tree/${encodePath(props.repo.default_branch)}/${encodePath(props.path)}` : base()}
        />
        <div class={{ 'lg:hidden': inTree() }}>
          <RefPicker
          owner={owner()}
          repo={name()}
          current={props.gitRef}
          defaultBranch={props.repo.default_branch}
            hrefFor={(ref) => (props.path ? `${base()}/tree/${encodePath(ref)}/${encodePath(props.path)}` : `${base()}/tree/${encodePath(ref)}`)}
          />
        </div>
        <RefPickerExtras repo={props.repo} gitRef={props.gitRef} path={props.path} />
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
        <Show when={feature('download-folder-button') && !isRoot()}>
          <a
            class="btn btn-sm"
            href={`https://download-directory.github.io/?url=${encodeURIComponent(`https://github.com/${props.repo.full_name}/tree/${props.gitRef}/${props.path}`)}`}
            target="_blank"
            rel="noreferrer"
            title="Download this directory as a ZIP file (via download-directory.github.io)"
          >
            <Octicon icon={downloadIcon} />
            <span class="hidden md:inline">Download</span>
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

      <Show when={isRoot() && props.gitRef !== props.repo.default_branch}>
        <Loading>
          <BranchInfoBar repo={props.repo} branch={props.gitRef} />
        </Loading>
      </Show>

      <div class="Box">
        <Loading fallback={<div class="Box-header h-[49px]" />}>
          <LatestCommit owner={owner()} repo={name()} gitRef={props.gitRef} path={props.path} route="tree" />
        </Loading>
        <Loading fallback={<PageSpinner />}>
          <FileTable owner={owner()} repo={name()} gitRef={props.gitRef} path={props.path} entries={entries()} archived={props.repo.archived} />
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

/**
 * github.com's bar above a branch's file list: "This branch is 3 commits ahead
 * of, 1 commit behind main." With `pr-from-branch` the "Contribute" menu
 * becomes a plain "Open pull request" button; `delete-branch` adds a delete
 * button for branches without an open PR.
 */
function BranchInfoBar(props: { repo: Repository; branch: string }) {
  const navigate = useNavigate();
  const status = createMemo(() => getBranchStatus(props.repo.owner.login, props.repo.name, props.branch, props.repo.default_branch));
  const base = () => `/${props.repo.full_name}`;
  const compareHref = () => `${base()}/compare/${encodePath(props.repo.default_branch)}...${encodePath(props.branch)}`;
  const [deleting, setDeleting] = createSignal(false);
  const openPull = () => (status()?.pull?.state === 'OPEN' ? status()!.pull : null);
  const remove = async () => {
    if (!confirm(`\`${props.branch}\` will be deleted. Are you sure?`)) return;
    setDeleting(true);
    try {
      await deleteBranch(props.repo.owner.login, props.repo.name, props.branch);
      toast('Branch deleted. Redirecting…', 'success');
      navigate(`${base()}/activity?activity_type=branch_deletion`);
    } catch (e) {
      toastError(e);
      setDeleting(false);
    }
  };
  const Count = (p: { n: number; what: string; href: string }) => (
    <a href={p.href}>
      {p.n} commit{p.n === 1 ? '' : 's'} {p.what}
    </a>
  );
  return (
    <Show when={status()}>
      {(s) => (
        <div class="Box bg-canvas-muted! px-4 py-2 mb-4 flex flex-wrap items-center gap-2 text-sm" data-testid="branch-info-bar">
          <span class="flex-1 min-w-0">
            This branch is{' '}
            <Show
              when={s().ahead || s().behind}
              fallback={
                <>
                  up to date with <span class="font-mono text-xs px-1.5 py-0.5 rounded-md bg-accent-muted text-fg-accent">{props.repo.default_branch}</span>.
                </>
              }
            >
              <Show when={s().ahead}>
                <Count n={s().ahead} what="ahead of" href={compareHref()} />
              </Show>
              <Show when={s().ahead && s().behind}>, </Show>
              <Show when={s().behind}>
                <Count n={s().behind} what="behind" href={`${base()}/compare/${encodePath(props.branch)}...${encodePath(props.repo.default_branch)}`} />
              </Show>{' '}
              <span class="font-mono text-xs px-1.5 py-0.5 rounded-md bg-accent-muted text-fg-accent">{props.repo.default_branch}</span>.
            </Show>
          </span>
          <Show when={props.repo.permissions?.push && !openPull()}>
            <button
              type="button"
              class="btn btn-sm btn-danger rgh-delete-branch"
              aria-label="Delete branch"
              title="Delete branch"
              disabled={deleting()}
              onClick={() => void remove()}
            >
              <Octicon icon={trashIcon} />
            </button>
          </Show>
          <Show
            when={openPull()}
            fallback={
              <Show when={s().ahead}>
                <a class="btn btn-sm" href={`${compareHref()}?expand=1`}>
                  <Octicon icon={gitPullRequestIcon} /> Open pull request
                </a>
              </Show>
            }
          >
            {(pr) => (
              <a class="btn btn-sm" href={`/${pr().repo}/pull/${pr().number}`} title={pr().title}>
                <Octicon icon={gitPullRequestIcon} class="text-fg-open" /> #{pr().number}
              </a>
            )}
          </Show>
        </div>
      )}
    </Show>
  );
}
