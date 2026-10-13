import { useAction, useNavigate, useSearchParams } from '@solidjs/router';
import { createMemo, createOptimistic, createSignal, For, Loading, Match, onSettled, Show, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dialog, Markdown, PageSpinner, Spinner, toastError } from '../../../components/ui';
import { alertIcon, gitBranchIcon, gitPullRequestIcon } from '../../../icons/octicons';
import { encodePath } from '../../../lib/github';
import { renderMarkdown } from '../../../lib/markdown';
import type { DiffFile, Repository } from '../../../lib/types';
import DiffView from '../../diff/DiffView';
import { fitTextarea, monospaceField } from '../../refined/editor';
import { feature } from '../../refined';
import { getFile, getRawFile } from '../../repo/api';
import { FilePullsMenu } from '../../repo/components/FileView';
import { getViewer } from '../../user/api';
import { getProtectedBranches, saveFile } from '../api';
import { unifiedPatch } from '../linediff';
import { TitleLengthHint, titleTooLong } from '../refined';
import CodeEditor, { type EditorSettings } from './CodeEditor';

const MARKDOWN = /\.(md|markdown|mdown|mkd)$/i;
const SETTINGS_KEY = 'gh-lite:editor-settings';

function loadSettings(): EditorSettings {
  try {
    return { indentMode: 'spaces', indentSize: 2, wrap: false, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return { indentMode: 'spaces', indentSize: 2, wrap: false };
  }
}

/** Edit an existing file (`mode="edit"`) or create one in a directory (`mode="new"`). */
export default function FileEditor(props: { repo: Repository; gitRef: string; path: string; mode: 'edit' | 'new' }) {
  const [search] = useSearchParams<{ filename?: string; value?: string; message?: string; description?: string }>();
  const owner = createMemo(() => props.repo.owner.login);
  const name = createMemo(() => props.repo.name);
  const base = () => `/${props.repo.full_name}`;
  const isEdit = () => props.mode === 'edit';
  const original = createMemo(() => (isEdit() ? getRawFile(owner(), name(), props.gitRef, props.path) : ''));
  const meta = createMemo(() => (isEdit() ? getFile(owner(), name(), props.gitRef, props.path) : null));

  // Path being edited: directory segments as breadcrumbs + the file name input.
  const initialParts = () => {
    const parts = props.path.split('/').filter(Boolean);
    if (isEdit()) return { dirs: parts.slice(0, -1), file: parts[parts.length - 1] ?? '' };
    const extra = (search.filename ?? '').split('/').filter(Boolean);
    return { dirs: [...parts, ...extra.slice(0, -1)], file: extra[extra.length - 1] ?? '' };
  };
  const [dirs, setDirs] = createSignal<string[]>(() => initialParts().dirs);
  const [fileName, setFileName] = createSignal(() => initialParts().file);
  const newPath = () => [...dirs(), fileName().trim()].filter(Boolean).join('/');
  const [content, setContent] = createSignal(() => (isEdit() ? original() : (search.value ?? '')));
  const [tab, setTab] = createSignal<'edit' | 'preview'>('edit');
  const [settings, setSettings] = createSignal<EditorSettings>(loadSettings());
  const updateSettings = (patch: Partial<EditorSettings>) => {
    const next = { ...settings(), ...patch };
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };
  const [committing, setCommitting] = createSignal(false);
  const dirty = () => content() !== original() || newPath() !== props.path;
  const canPush = () => !!props.repo.permissions?.push;
  const navigate = useNavigate();
  let saved = false;

  onSettled(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!saved && dirty()) e.preventDefault();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  });

  const cancelHref = () =>
    isEdit()
      ? `${base()}/blob/${encodePath(props.gitRef)}/${encodePath(props.path)}`
      : `${base()}/tree/${encodePath(props.gitRef)}${props.path ? `/${encodePath(props.path)}` : ''}`;

  return (
    <div>
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <nav class="flex flex-wrap items-center gap-1 min-w-0 text-base" aria-label="File path">
          <a class="font-semibold" href={`${base()}/tree/${encodePath(props.gitRef)}`}>
            {props.repo.name}
          </a>
          <span class="text-fg-muted">/</span>
          <For each={dirs()}>
            {(d, i) => (
              <>
                <a href={`${base()}/tree/${encodePath(props.gitRef)}/${encodePath(dirs().slice(0, i() + 1).join('/'))}`}>{d}</a>
                <span class="text-fg-muted">/</span>
              </>
            )}
          </For>
          <input
            class="form-control form-control-sm w-64"
            aria-label="File name"
            placeholder="Name your file..."
            value={fileName()}
            autofocus={!isEdit()}
            onInput={(e) => {
              const v = e.currentTarget.value;
              if (v.includes('/')) {
                const parts = v.split('/');
                const head = parts.slice(0, -1).filter((p) => p && p !== '.');
                setDirs((d) => {
                  const next = [...d];
                  for (const p of head) {
                    if (p === '..') next.pop();
                    else next.push(p);
                  }
                  return next;
                });
                setFileName(parts[parts.length - 1]!);
                e.currentTarget.value = parts[parts.length - 1]!;
              } else setFileName(v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0 && dirs().length) {
                e.preventDefault();
                const last = dirs()[dirs().length - 1]!;
                setDirs((d) => d.slice(0, -1));
                setFileName(last + fileName());
              }
            }}
          />
          <span class="text-sm text-fg-muted ml-1">
            in <span class="font-mono text-xs px-1.5 py-0.5 rounded-md bg-accent-muted text-fg-accent">{props.gitRef}</span>
          </span>
        </nav>
        <div class="flex-1" />
        <Show when={isEdit() && feature('list-prs-for-file')}>
          <Loading>
            <FilePullsMenu owner={owner()} repo={name()} base={props.repo.default_branch} path={props.path} editing />
          </Loading>
        </Show>
        <a
          class="btn btn-sm"
          href={cancelHref()}
          onClick={(e) => {
            if (dirty() && !confirm('Discard your changes?')) e.preventDefault();
            else saved = true;
          }}
        >
          Cancel changes
        </a>
        <button
          type="button"
          class="btn btn-sm btn-primary"
          disabled={!canPush() || !fileName().trim()}
          onClick={() => setCommitting(true)}
        >
          Commit changes...
        </button>
      </div>

      <Show when={!canPush()}>
        <div class="flash flash-warn mb-4 text-sm">
          <Octicon icon={alertIcon} /> You need write access to <strong>{props.repo.full_name}</strong> to commit changes. Fork the
          repository to propose changes instead.
        </div>
      </Show>

      <div class="Box">
        <div class="Box-header flex flex-wrap items-center gap-2 py-2!">
          <div class="SegmentedControl">
            <button type="button" class={['SegmentedControl-item', { selected: tab() === 'edit' }]} onClick={() => setTab('edit')}>
              Edit
            </button>
            <button type="button" class={['SegmentedControl-item', { selected: tab() === 'preview' }]} onClick={() => setTab('preview')}>
              {MARKDOWN.test(fileName()) ? 'Preview' : 'Preview changes'}
            </button>
          </div>
          <div class="flex-1" />
          <Show when={tab() === 'edit'}>
            <label class="sr-only" for="indent-mode">
              Indent mode
            </label>
            <select
              id="indent-mode"
              class="form-select form-control-sm w-auto!"
              value={settings().indentMode}
              onChange={(e) => updateSettings({ indentMode: e.currentTarget.value as EditorSettings['indentMode'] })}
            >
              <option value="spaces">Spaces</option>
              <option value="tabs">Tabs</option>
            </select>
            <label class="sr-only" for="indent-size">
              Indent size
            </label>
            <select
              id="indent-size"
              class="form-select form-control-sm w-auto!"
              value={String(settings().indentSize)}
              onChange={(e) => updateSettings({ indentSize: Number(e.currentTarget.value) })}
            >
              <option value="2">2</option>
              <option value="4">4</option>
              <option value="8">8</option>
            </select>
            <label class="sr-only" for="wrap-mode">
              Line wrap mode
            </label>
            <select
              id="wrap-mode"
              class="form-select form-control-sm w-auto!"
              value={settings().wrap ? 'soft' : 'none'}
              onChange={(e) => updateSettings({ wrap: e.currentTarget.value === 'soft' })}
            >
              <option value="none">No wrap</option>
              <option value="soft">Soft wrap</option>
            </select>
          </Show>
        </div>
        <Loading fallback={<PageSpinner />}>
          <Switch>
            <Match when={tab() === 'edit'}>
              <CodeEditor
                value={content()}
                onInput={setContent}
                settings={settings()}
                autofocus={isEdit()}
                onSave={() => canPush() && fileName().trim() && setCommitting(true)}
              />
            </Match>
            <Match when={MARKDOWN.test(fileName())}>
              <MarkdownPreview text={content()} repo={props.repo.full_name} />
            </Match>
            <Match when={true}>
              <ChangesPreview before={original()} after={content()} path={newPath()} previous={isEdit() ? props.path : undefined} />
            </Match>
          </Switch>
        </Loading>
      </div>

      <Show when={canPush()}>
        <Loading>
          <CommitDialog
            open={committing()}
            onClose={() => setCommitting(false)}
            repo={props.repo}
            branch={props.gitRef}
            path={newPath()}
            originalPath={isEdit() ? props.path : undefined}
            sha={meta()?.sha}
            content={content()}
            isEdit={isEdit()}
            defaultMessage={search.message}
            defaultDescription={search.description}
            onDone={(branch, isNewBranch) => {
              saved = true;
              if (isNewBranch) navigate(`${base()}/compare/${encodePath(props.gitRef)}...${encodePath(branch)}?quick_pull=1`);
              else navigate(`${base()}/blob/${encodePath(branch)}/${encodePath(newPath())}`);
            }}
          />
        </Loading>
      </Show>
    </div>
  );
}

function MarkdownPreview(props: { text: string; repo: string }) {
  const html = createMemo(() => renderMarkdown(props.text, props.repo));
  return (
    <div class="p-6 md:p-8">
      <Loading fallback={<Spinner size={20} class="text-fg-muted" />}>
        <Show when={props.text.trim()} fallback={<p class="text-fg-muted">Nothing to preview</p>}>
          <Markdown html={html()} />
        </Show>
      </Loading>
    </div>
  );
}

function ChangesPreview(props: { before: string; after: string; path: string; previous?: string }) {
  const diff = createMemo(() => unifiedPatch(props.before, props.after));
  const file = createMemo((): DiffFile | null => {
    const d = diff();
    if (!d) return null;
    const renamed = !!props.previous && props.previous !== props.path;
    return {
      sha: '',
      filename: props.path || 'untitled',
      previous_filename: renamed ? props.previous : undefined,
      status: !props.previous ? 'added' : renamed ? 'renamed' : 'modified',
      additions: d.additions,
      deletions: d.deletions,
      changes: d.additions + d.deletions,
      patch: d.patch || undefined,
      blob_url: '',
    };
  });
  return (
    <div class="p-4">
      <Show when={file()} fallback={<p class="text-fg-muted text-sm">This file is too large to preview the changes.</p>}>
        {(f) => (
          <Show when={f().changes || f().status === 'renamed'} fallback={<p class="text-fg-muted text-sm">No changes to show.</p>}>
            <DiffView files={[f()]} />
          </Show>
        )}
      </Show>
    </div>
  );
}

function CommitDialog(props: {
  open: boolean;
  onClose: () => void;
  repo: Repository;
  branch: string;
  path: string;
  originalPath?: string;
  sha?: string;
  content: string;
  isEdit: boolean;
  defaultMessage?: string;
  defaultDescription?: string;
  onDone: (branch: string, isNewBranch: boolean) => void;
}) {
  const save = useAction(saveFile);
  const viewer = createMemo(() => getViewer().catch(() => null));
  const protectedSet = createMemo(() => getProtectedBranches(props.repo.owner.login, props.repo.name));
  const isProtected = () => protectedSet().has(props.branch);
  const fileLabel = () => props.path.split('/').pop() || 'file';
  const placeholder = () =>
    props.isEdit
      ? props.originalPath && props.originalPath !== props.path
        ? `Rename ${props.originalPath.split('/').pop()} to ${fileLabel()}`
        : `Update ${fileLabel()}`
      : `Create ${fileLabel()}`;
  const [message, setMessage] = createSignal(() => props.defaultMessage ?? '');
  const [description, setDescription] = createSignal(() => props.defaultDescription ?? '');
  const [target, setTarget] = createSignal<'direct' | 'new'>(() => (isProtected() ? 'new' : 'direct'));
  const [branchName, setBranchName] = createSignal(() => `${viewer()?.login ?? 'user'}-patch-1`);
  const [busy, setBusy] = createOptimistic(false);

  const submit = async () => {
    const title = message().trim() || placeholder();
    const full = description().trim() ? `${title}\n\n${description().trim()}` : title;
    const newBranch = target() === 'new' ? branchName().trim() : undefined;
    if (target() === 'new' && !newBranch) return;
    setBusy(true);
    try {
      const res = await save({
        owner: props.repo.owner.login,
        repo: props.repo.name,
        branch: props.branch,
        newBranch,
        path: props.path,
        originalPath: props.originalPath,
        sha: props.sha,
        content: props.content,
        message: full,
      });
      props.onClose();
      props.onDone(res.branch, !!newBranch);
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title="Commit changes"
      width="480px"
      footer={
        <>
          <button type="button" class="btn" onClick={() => props.onClose()}>
            Cancel
          </button>
          <button type="button" class="btn btn-primary" disabled={busy()} onClick={() => void submit()}>
            {busy() ? 'Committing…' : target() === 'new' ? 'Propose changes' : 'Commit changes'}
          </button>
        </>
      }
    >
      <label class="form-label" for="commit-message">
        Commit message
      </label>
      <input
        id="commit-message"
        ref={monospaceField}
        class={['form-control w-full', { 'rgh-title-too-long': titleTooLong(message() || placeholder()) }]}
        placeholder={placeholder()}
        value={message()}
        onInput={(e) => setMessage(e.currentTarget.value)}
      />
      <TitleLengthHint value={message() || placeholder()} />
      <div class="mb-3" />
      <label class="form-label" for="commit-description">
        Extended description
      </label>
      <textarea
        id="commit-description"
        ref={[monospaceField, fitTextarea]}
        class="form-control w-full mb-3 min-h-24"
        placeholder="Add an optional extended description.."
        value={description()}
        onInput={(e) => setDescription(e.currentTarget.value)}
      />
      <fieldset class="border border-line rounded-md">
        <label class="flex items-start gap-2 p-3 border-b border-line text-sm cursor-pointer">
          <input type="radio" name="commit-target" class="mt-1" checked={target() === 'direct'} onChange={() => setTarget('direct')} />
          <span>
            <Octicon icon={gitBranchIcon} class="text-fg-muted" /> Commit directly to the{' '}
            <span class="font-mono text-xs px-1.5 py-0.5 rounded-md bg-accent-muted text-fg-accent">{props.branch}</span> branch
            <Show when={isProtected()}>
              <span class="block text-xs text-fg-attention mt-1">This branch is protected; a direct commit may be rejected.</span>
            </Show>
          </span>
        </label>
        <label class="flex items-start gap-2 p-3 text-sm cursor-pointer">
          <input type="radio" name="commit-target" class="mt-1" checked={target() === 'new'} onChange={() => setTarget('new')} />
          <span class="flex-1">
            <Octicon icon={gitPullRequestIcon} class="text-fg-muted" /> Create a <strong>new branch</strong> for this commit and start a
            pull request
            <Show when={target() === 'new'}>
              <input
                class="form-control form-control-sm w-full mt-2 font-mono"
                aria-label="New branch name"
                value={branchName()}
                onInput={(e) => setBranchName(e.currentTarget.value)}
              />
            </Show>
          </span>
        </label>
      </fieldset>
    </Dialog>
  );
}
