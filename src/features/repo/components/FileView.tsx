import { action, query, useAction, useLocation, useNavigate } from '@solidjs/router';
import { redirect } from '@solidjs/web';
import { createEffect, createMemo, createSignal, For, Loading, Match, Show, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { CopyButton, Dialog, Dropdown, Markdown, PageSpinner, toastError } from '../../../components/ui';
import { alertIcon, downloadIcon, gitPullRequestDraftIcon, gitPullRequestIcon, pencilIcon, trashIcon, triangleDownIcon } from '../../../icons/octicons';
import { formatBytes } from '../../../lib/format';
import { encodePath, gh } from '../../../lib/github';
import { escapeLines, highlightLines } from '../../../lib/highlight';
import { useHotkey } from '../../../lib/hotkeys';
import type { Repository } from '../../../lib/types';
import { codeTransformOptions, DefaultBranchButton, tabSizeStyle, transformCodeLine } from '../../code/refined';
import { getOpenPullsByFile } from '../../code/refinedApi';
import { feature } from '../../refined';
import { getFile, getRawFile, getRenderedFile } from '../api';
import Breadcrumbs from './Breadcrumbs';
import { useFileTreeOpen } from './CodeLayout';
import LatestCommit from './LatestCommit';
import RefPicker from './RefPicker';
import RefPickerExtras from '../refined/RefExtras';

const IMAGE = /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg)$/i;
const RENDERABLE = /\.(md|markdown|mdown|mkd|rst|adoc|asciidoc|org|textile)$/i;
const CSV = /\.(csv|tsv)$/i;
const HTML = /\.html?$/i;

export const deleteFile = action(
  async (owner: string, repo: string, path: string, sha: string, branch: string, message: string) => {
    await gh(`/repos/${owner}/${repo}/contents/${encodePath(path)}`, {
      method: 'DELETE',
      body: { message, sha, branch },
    });
  },
  'delete-file',
);

/** github.com submodule URLs stay in-app (at the pinned commit); others link out. */
function submoduleHref(url: string, sha: string) {
  const m = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? `/${m[1]}/${m[2]}/tree/${sha}` : url;
}

/** File metadata; a folder redirects to its /tree/ page like github.com (READMEs link folders via /blob/). */
const getBlobMeta = query(async (owner: string, repo: string, gitRef: string, path: string) => {
  const file = await getFile(owner, repo, gitRef, path);
  if (!file) throw redirect(`/${owner}/${repo}/tree/${encodePath(gitRef)}/${encodePath(path)}`);
  return file;
}, 'blob-meta');

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
  // Memos so a revalidated repo object (same values) doesn't refetch the file.
  const owner = createMemo(() => props.repo.owner.login);
  const name = createMemo(() => props.repo.name);
  const base = () => `/${props.repo.full_name}`;
  const location = useLocation();
  const navigate = useNavigate();
  const meta = createMemo(() => getBlobMeta(owner(), name(), props.gitRef, props.path));
  const isImage = () => IMAGE.test(props.path);
  const isCsv = () => CSV.test(props.path);
  const renderable = () => RENDERABLE.test(props.path) || isCsv();
  const [mode, setMode] = createSignal<'preview' | 'code' | 'blame'>(() => (renderable() ? 'preview' : 'code'));
  const canPush = () => !!props.repo.permissions?.push;
  const inTree = useFileTreeOpen();
  const [deleting, setDeleting] = createSignal(false);
  /** A symlink target is relative to the link's directory. */
  const symlinkHref = (target: string) => {
    const parts = props.path.split('/').slice(0, -1);
    for (const seg of target.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg && seg !== '.') parts.push(seg);
    }
    return `${base()}/blob/${encodePath(props.gitRef)}/${encodePath(parts.join('/'))}`;
  };

  return (
    <>
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <DefaultBranchButton
          gitRef={props.gitRef}
          defaultBranch={props.repo.default_branch}
          href={`${base()}/blob/${encodePath(props.repo.default_branch)}/${encodePath(props.path)}`}
        />
        <div class={{ 'lg:hidden': inTree() }}>
          <RefPicker
            owner={owner()}
            repo={name()}
            current={props.gitRef}
            defaultBranch={props.repo.default_branch}
            hrefFor={(ref) => `${base()}/blob/${encodePath(ref)}/${encodePath(props.path)}`}
          />
        </div>
        <RefPickerExtras repo={props.repo} gitRef={props.gitRef} path={props.path} />
        <div class="min-w-0 ml-2">
          <Breadcrumbs owner={owner()} repo={name()} gitRef={props.gitRef} path={props.path} isFile />
        </div>
      </div>

      <div class="Box mb-4">
        <Loading fallback={<div class="Box-header h-[49px] border-0!" />}>
          <LatestCommit owner={owner()} repo={name()} gitRef={props.gitRef} path={props.path} route="blob" />
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
              <Show when={feature('list-prs-for-file')}>
                <Loading>
                  <FilePullsMenu owner={owner()} repo={name()} base={props.repo.default_branch} path={props.path} />
                </Loading>
              </Show>
              <Show when={feature('html-preview-link') && HTML.test(props.path) && !props.repo.private}>
                <a
                  class="btn btn-sm"
                  href={`https://refined-github-html-preview.kidonng.workers.dev/${props.repo.full_name}/raw/${encodePath(props.gitRef)}/${encodePath(props.path)}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Preview the rendered HTML page"
                >
                  Preview
                </a>
              </Show>
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
            <Match when={meta().type === 'symlink'}>
              <div class="p-6 text-sm">
                <span class="text-fg-muted">Symbolic link to </span>
                <a class="font-mono" href={symlinkHref(meta().target ?? '')}>
                  {meta().target}
                </a>
              </div>
            </Match>
            <Match when={meta().type === 'submodule'}>
              <div class="p-6 text-sm">
                <span class="text-fg-muted">Submodule </span>
                <Show when={meta().submodule_git_url} fallback={<span class="font-mono">{props.path}</span>}>
                  {(url) => (
                    <a class="font-mono" href={submoduleHref(url(), meta().sha)}>
                      {url()} @ {meta().sha.slice(0, 7)}
                    </a>
                  )}
                </Show>
              </div>
            </Match>
            <Match when={isImage()}>
              <div class="p-6 flex justify-center bg-[length:20px_20px] bg-canvas-muted">
                <img src={meta().download_url ?? ''} alt={props.path} class="max-w-full" />
              </div>
            </Match>
            <Match when={isCsv() && mode() === 'preview'}>
              <CsvView owner={owner()} repo={name()} gitRef={props.gitRef} path={props.path} />
            </Match>
            <Match when={renderable() && mode() === 'preview'}>
              <RenderedFile owner={owner()} repo={name()} gitRef={props.gitRef} path={props.path} private={props.repo.private} />
            </Match>
            <Match when={true}>
              <CodeView
                owner={owner()}
                repo={name()}
                gitRef={props.gitRef}
                path={props.path}
                hash={location.hash}
                onDeselect={() => navigate(`${location.pathname}${location.search}`, { replace: true, scroll: false })}
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

function RenderedFile(props: { owner: string; repo: string; gitRef: string; path: string; private: boolean }) {
  const html = createMemo(() => getRenderedFile(props.owner, props.repo, props.gitRef, props.path));
  return (
    <div class="p-6 md:p-8">
      <Markdown
        html={html()}
        file={{ owner: props.owner, repo: props.repo, gitRef: props.gitRef, path: props.path, private: props.private }}
      />
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
  onDeselect: () => void;
}) {
  const raw = createMemo(() => getRawFile(props.owner, props.repo, props.gitRef, props.path));
  useHotkey({
    keys: 'Escape',
    description: 'Deselect the selected lines',
    group: 'Source code browsing',
    when: () => !!parseLineHash(window.location.hash),
    handler: () => props.onDeselect(),
  });
  const binary = () => raw().slice(0, 8000).includes('\0');
  const text = createMemo(() => raw().replace(/\n$/, ''));
  const path = createMemo(() => props.path);
  const lines = createMemo(async () => {
    const code = text();
    return (await highlightLines(code, path())) ?? escapeLines(code);
  });
  const transforms = createMemo(() => codeTransformOptions(`/${props.owner}/${props.repo}`));
  const table = createMemo(() => {
    const opts = transforms();
    return lines()
      .map(
        (html, i) =>
          `<tr><td id="L${i + 1}" class="blob-num" data-line-number="${i + 1}"></td><td class="blob-code" id="LC${i + 1}">${transformCodeLine(html, opts) || ' '}</td></tr>`,
      )
      .join('');
  });
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
      <div class="overflow-auto py-2" style={tabSizeStyle()}>
        <table class="w-full border-collapse shiki">
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

/** list-prs-for-file: "⎇ 2 ▾" — open PRs (against the default branch) that also change this file. */
export function FilePullsMenu(props: { owner: string; repo: string; base: string; path: string; exclude?: number; editing?: boolean }) {
  const byFile = createMemo(() => getOpenPullsByFile(props.owner, props.repo, props.base));
  const pulls = createMemo(() => (byFile()[props.path] ?? []).filter((p) => p.number !== props.exclude));
  return (
    <Show when={pulls().length}>
      <Dropdown
        class="btn btn-sm text-fg-muted!"
        align="right"
        menuClass="w-72"
        header="File also being edited in"
        title={`${pulls().length} open pull request${pulls().length === 1 ? '' : 's'} also change${pulls().length === 1 ? 's' : ''} this file`}
        button={
          <>
            <Octicon icon={props.editing ? alertIcon : gitPullRequestIcon} class={props.editing ? 'text-fg-attention' : undefined} />
            <span class="text-fg">{pulls().length}</span>
            <Octicon icon={triangleDownIcon} />
          </>
        }
      >
        {(close) => (
          <For each={pulls()}>
            {(pr) => (
              <a class="SelectMenu-item" href={`/${props.owner}/${props.repo}/pull/${pr.number}/files`} onClick={close} title={pr.title}>
                <Octicon icon={pr.isDraft ? gitPullRequestDraftIcon : gitPullRequestIcon} class={pr.isDraft ? 'text-fg-muted' : 'text-fg-open'} />
                <span class="text-fg-muted">#{pr.number}</span>
                <span class="truncate">{pr.title}</span>
              </a>
            )}
          </For>
        )}
      </Dropdown>
    </Show>
  );
}

/** Minimal RFC 4180 parser (quoted fields, escaped quotes, CRLF). */
function parseDelimited(text: string, sep: string, maxRows: number) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length && rows.length < maxRows; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if ((field || row.length) && rows.length < maxRows) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const CSV_MAX_ROWS = 5000;

/** CSV / TSV preview as a table (github.com renders these as searchable tables). */
function CsvView(props: { owner: string; repo: string; gitRef: string; path: string }) {
  const raw = createMemo(() => getRawFile(props.owner, props.repo, props.gitRef, props.path));
  const rows = createMemo(() => parseDelimited(raw(), /\.tsv$/i.test(props.path) ? '\t' : ',', CSV_MAX_ROWS + 1));
  const header = () => rows()[0] ?? [];
  const body = () => rows().slice(1, CSV_MAX_ROWS + 1);
  return (
    <div class="markdown-body overflow-auto max-h-[80vh]">
      <table class="csv-data m-0!">
        <thead>
          <tr>
            <th class="blob-num" />
            <For each={header()}>{(h) => <th>{h}</th>}</For>
          </tr>
        </thead>
        <tbody>
          <For each={body()}>
            {(r, i) => (
              <tr>
                <td class="blob-num" data-line-number={i() + 2} />
                <For each={r}>{(c) => <td>{c}</td>}</For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
      <Show when={rows().length > CSV_MAX_ROWS}>
        <p class="p-3 text-sm text-fg-muted">Only the first {CSV_MAX_ROWS.toLocaleString('en-US')} rows are shown. View the raw file for the rest.</p>
      </Show>
    </div>
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
