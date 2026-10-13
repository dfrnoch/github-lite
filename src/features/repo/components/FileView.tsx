import { action, useAction, useLocation, useNavigate } from '@solidjs/router';
import { createEffect, createMemo, createSignal, Loading, Match, Show, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { CopyButton, Dialog, Markdown, PageSpinner, toastError } from '../../../components/ui';
import { downloadIcon, pencilIcon, trashIcon } from '../../../icons/octicons';
import { formatBytes } from '../../../lib/format';
import { encodePath, gh, GitHubError } from '../../../lib/github';
import { escapeLines, highlightLines } from '../../../lib/highlight';
import type { Repository } from '../../../lib/types';
import { getFile, getRawFile, getRenderedFile } from '../api';
import Breadcrumbs from './Breadcrumbs';
import LatestCommit from './LatestCommit';
import RefPicker from './RefPicker';

const IMAGE = /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg)$/i;
const RENDERABLE = /\.(md|markdown|mdown|mkd|rst|adoc|asciidoc|org|textile)$/i;

export const deleteFile = action(
  async (owner: string, repo: string, path: string, sha: string, branch: string, message: string) => {
    await gh(`/repos/${owner}/${repo}/contents/${encodePath(path)}`, {
      method: 'DELETE',
      body: { message, sha, branch },
    });
  },
  'delete-file',
);

/** Parse "#L10" / "#L10-L20" into a line range. */
function parseLineHash(hash: string): [number, number] | null {
  const m = hash.match(/^#L(\d+)(?:-L(\d+))?$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2] ?? m[1]);
  return [Math.min(a, b), Math.max(a, b)];
}

/** A single file: header with actions, then code / rendered markdown / image. */
export default function FileView(props: { repo: Repository; gitRef: string; path: string }) {
  const owner = () => props.repo.owner.login;
  const name = () => props.repo.name;
  const base = () => `/${props.repo.full_name}`;
  const location = useLocation();
  const navigate = useNavigate();
  const meta = createMemo(() =>
    getFile(owner(), name(), props.gitRef, props.path).then((f) => {
      if (!f) throw new GitHubError(404, 'Not Found');
      return f;
    }),
  );
  const isImage = () => IMAGE.test(props.path);
  const renderable = () => RENDERABLE.test(props.path);
  const [mode, setMode] = createSignal<'preview' | 'code' | 'blame'>(() => (renderable() ? 'preview' : 'code'));
  const canPush = () => !!props.repo.permissions?.push;
  const [deleting, setDeleting] = createSignal(false);

  return (
    <>
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <RefPicker
          owner={owner()}
          repo={name()}
          current={props.gitRef}
          defaultBranch={props.repo.default_branch}
          hrefFor={(ref) => `${base()}/blob/${encodePath(ref)}/${encodePath(props.path)}`}
        />
        <div class="min-w-0 ml-2">
          <Breadcrumbs owner={owner()} repo={name()} gitRef={props.gitRef} path={props.path} isFile />
        </div>
      </div>

      <div class="Box mb-4">
        <Loading fallback={<div class="Box-header h-[49px] border-0!" />}>
          <LatestCommit owner={owner()} repo={name()} gitRef={props.gitRef} path={props.path} />
        </Loading>
      </div>

      <div class="Box">
        <div class="Box-header flex flex-wrap items-center gap-3 py-2!">
          <div class="SegmentedControl">
            <Show when={renderable()}>
              <button type="button" class={['SegmentedControl-item', { selected: mode() === 'preview' }]} onClick={() => setMode('preview')}>
                Preview
              </button>
            </Show>
            <button type="button" class={['SegmentedControl-item', { selected: mode() === 'code' }]} onClick={() => setMode('code')}>
              Code
            </button>
            <a class="SegmentedControl-item" href={`${base()}/blame/${encodePath(props.gitRef)}/${encodePath(props.path)}`}>
              Blame
            </a>
          </div>
          <Loading>
            <span class="text-xs text-fg-muted font-mono">{formatBytes(meta().size)}</span>
          </Loading>
          <div class="flex-1" />
          <Loading>
            <div class="flex items-center gap-1">
              <a class="btn btn-sm" href={meta().download_url ?? '#'} target="_blank" rel="noreferrer">
                Raw
              </a>
              <Show when={!isImage()}>
                <CopyRawButton owner={owner()} repo={name()} gitRef={props.gitRef} path={props.path} />
              </Show>
              <a class="btn-octicon" href={meta().download_url ?? '#'} download={props.path.split('/').pop()} aria-label="Download raw file">
                <Octicon icon={downloadIcon} />
              </a>
              <Show when={canPush()}>
                <a class="btn-octicon" href={`${base()}/edit/${encodePath(props.gitRef)}/${encodePath(props.path)}`} aria-label="Edit this file">
                  <Octicon icon={pencilIcon} />
                </a>
                <button type="button" class="btn-octicon btn-octicon-danger" aria-label="Delete this file" onClick={() => setDeleting(true)}>
                  <Octicon icon={trashIcon} />
                </button>
              </Show>
            </div>
          </Loading>
        </div>
        <Loading fallback={<PageSpinner />}>
          <Switch>
            <Match when={isImage()}>
              <div class="p-6 flex justify-center bg-[length:20px_20px] bg-canvas-muted">
                <img src={meta().download_url ?? ''} alt={props.path} class="max-w-full" />
              </div>
            </Match>
            <Match when={renderable() && mode() === 'preview'}>
              <RenderedFile owner={owner()} repo={name()} gitRef={props.gitRef} path={props.path} />
            </Match>
            <Match when={true}>
              <CodeView
                owner={owner()}
                repo={name()}
                gitRef={props.gitRef}
                path={props.path}
                hash={location.hash}
                onSelectLine={(hash) => navigate(`${location.pathname}${hash}`, { replace: true, scroll: false })}
              />
            </Match>
          </Switch>
        </Loading>
      </div>

      <Show when={canPush()}>
        <Loading>
          <DeleteFileDialog
            open={deleting()}
            onClose={() => setDeleting(false)}
            onDeleted={() => {
              const dir = props.path.split('/').slice(0, -1).join('/');
              navigate(`${base()}/tree/${encodePath(props.gitRef)}${dir ? `/${encodePath(dir)}` : ''}`);
            }}
            owner={owner()}
            repo={name()}
            path={props.path}
            sha={meta().sha}
            branch={props.gitRef}
          />
        </Loading>
      </Show>
    </>
  );
}

function CopyRawButton(props: { owner: string; repo: string; gitRef: string; path: string }) {
  const raw = createMemo(() => getRawFile(props.owner, props.repo, props.gitRef, props.path));
  return (
    <Loading fallback={<span class="btn-octicon" />}>
      <CopyButton value={raw()} label="Copy raw file" />
    </Loading>
  );
}

function RenderedFile(props: { owner: string; repo: string; gitRef: string; path: string }) {
  const html = createMemo(() => getRenderedFile(props.owner, props.repo, props.gitRef, props.path));
  return (
    <div class="p-6 md:p-8">
      <Markdown html={html()} />
    </div>
  );
}

/** Line-numbered, syntax highlighted source with #L10-L20 line selection. */
function CodeView(props: {
  owner: string;
  repo: string;
  gitRef: string;
  path: string;
  hash: string;
  onSelectLine: (hash: string) => void;
}) {
  const raw = createMemo(() => getRawFile(props.owner, props.repo, props.gitRef, props.path));
  const binary = () => raw().slice(0, 8000).includes('\0');
  const text = () => raw().replace(/\n$/, '');
  const lines = createMemo(async () => {
    const code = text();
    return (await highlightLines(code, props.path)) ?? escapeLines(code);
  });
  const table = createMemo(() =>
    lines()
      .map(
        (html, i) =>
          `<tr><td id="L${i + 1}" class="blob-num" data-line-number="${i + 1}"></td><td class="blob-code" id="LC${i + 1}">${html || ' '}</td></tr>`,
      )
      .join(''),
  );
  let tbody: HTMLTableSectionElement | undefined;
  let anchor = 0;

  // Mirror the URL's #L.. range onto the rows and bring it into view.
  createEffect(
    () => [parseLineHash(props.hash), table()] as const,
    ([range]) => {
      if (!tbody) return;
      tbody.querySelectorAll('.highlighted-line').forEach((el) => el.classList.remove('highlighted-line'));
      if (!range) return;
      for (let n = range[0]; n <= range[1]; n++) tbody.querySelector(`#LC${n}`)?.classList.add('highlighted-line');
      tbody.querySelector(`#L${range[0]}`)?.scrollIntoView({ block: 'center' });
    },
  );

  return (
    <Show
      when={!binary()}
      fallback={<div class="p-8 text-center text-fg-muted">Binary file not shown.</div>}
    >
      <div class="px-4 py-1 text-xs text-fg-muted font-mono border-b border-line-muted">
        {raw().split('\n').length - (raw().endsWith('\n') ? 1 : 0)} lines ({raw().split('\n').filter((l) => l.trim()).length} loc)
      </div>
      <div class="overflow-auto py-2">
        <table class="w-full border-collapse">
          <tbody
            ref={(el) => (tbody = el)}
            // oxlint-disable-next-line solid/no-innerhtml -- escaped/highlighted source
            innerHTML={table()}
            onClick={(e) => {
              const cell = (e.target as HTMLElement).closest('.blob-num') as HTMLElement | null;
              if (!cell) return;
              const n = Number(cell.dataset.lineNumber);
              if (e.shiftKey && anchor) props.onSelectLine(`#L${Math.min(anchor, n)}-L${Math.max(anchor, n)}`);
              else {
                anchor = n;
                props.onSelectLine(`#L${n}`);
              }
            }}
          />
        </table>
      </div>
    </Show>
  );
}

function DeleteFileDialog(props: {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
  owner: string;
  repo: string;
  path: string;
  sha: string;
  branch: string;
}) {
  const remove = useAction(deleteFile);
  const [message, setMessage] = createSignal(() => `Delete ${props.path.split('/').pop()}`);
  const [busy, setBusy] = createSignal(false);
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title="Delete file"
      footer={
        <>
          <button type="button" class="btn" onClick={() => props.onClose()}>
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-danger"
            disabled={busy()}
            onClick={async () => {
              setBusy(true);
              try {
                await remove(props.owner, props.repo, props.path, props.sha, props.branch, message());
                props.onClose();
                props.onDeleted();
              } catch (e) {
                toastError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy() ? 'Deleting…' : 'Commit changes'}
          </button>
        </>
      }
    >
      <p class="mb-3">
        Delete <code class="font-mono">{props.path}</code> on branch <strong>{props.branch}</strong>.
      </p>
      <label class="form-label" for="delete-message">
        Commit message
      </label>
      <input id="delete-message" class="form-control" value={message()} onInput={(e) => setMessage(e.currentTarget.value)} />
    </Dialog>
  );
}
