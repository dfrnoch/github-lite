import { useNavigate } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { MarkdownEditor, Spinner, toast, toastError } from '../../../components/ui';
import { alertIcon, checkCircleFillIcon, packageIcon, tagIcon, trashIcon, undoIcon, uploadIcon } from '../../../icons/octicons';
import { formatBytes } from '../../../lib/format';
import { getRefNames } from '../../repo/api';
import { ConfirmDialog } from '../../repo-settings/components/ui';
import type { Release, ReleaseInput } from '../api';
import { checkTagExists, deleteRelease, deleteReleaseAsset, generateReleaseNotes, saveRelease, uploadReleaseAsset } from '../api';
import { tagHref } from './ReleaseCard';

/**
 * Draft / edit a release: tag picker (existing or new on a target branch),
 * title, notes with "Generate release notes", binaries, pre-release /
 * latest flags; publish, save as draft, or delete.
 */
export default function ReleaseForm(props: {
  owner: string;
  repo: string;
  base: string;
  defaultBranch: string;
  release: Release | null;
  /** Prefilled tag (?tag= on /releases/new). */
  initialTag?: string;
  /** Whether this release is currently the "Latest" one. */
  isLatest?: boolean;
}) {
  const navigate = useNavigate();
  const refs = createMemo(() => getRefNames(props.owner, props.repo));
  const [tag, setTag] = createSignal(() => props.release?.tag_name ?? props.initialTag ?? '');
  const [target, setTarget] = createSignal(() => props.release?.target_commitish ?? props.defaultBranch);
  const [previousTag, setPreviousTag] = createSignal('');
  const [title, setTitle] = createSignal(() => props.release?.name ?? '');
  const [body, setBody] = createSignal(() => props.release?.body ?? '');
  const [prerelease, setPrerelease] = createSignal(() => props.release?.prerelease ?? false);
  const [latest, setLatest] = createSignal(() => (props.release ? !!props.isLatest : true));
  const [files, setFiles] = createSignal<File[]>([]);
  const [removedAssets, setRemovedAssets] = createSignal<number[]>([]);
  const [busy, setBusy] = createSignal<string | null>(null);
  const [generating, setGenerating] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);

  // Debounced server check (the datalist only holds the newest 100 tags).
  const [checkedTag, setCheckedTag] = createSignal(() => props.release?.tag_name ?? props.initialTag ?? '');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const exists = createMemo(() => (checkedTag().trim() ? checkTagExists(props.owner, props.repo, checkedTag().trim()) : false));
  const tagExists = () => refs().tags.includes(tag().trim()) || (checkedTag() === tag() && exists());
  const isPublished = () => !!props.release && !props.release.draft;

  const generate = async () => {
    if (!tag().trim()) return toastError('Choose a tag first');
    setGenerating(true);
    try {
      const notes = await generateReleaseNotes(props.owner, props.repo, {
        tag_name: tag().trim(),
        target_commitish: tagExists() ? undefined : target(),
        previous_tag_name: previousTag() || undefined,
      });
      if (!title().trim()) setTitle(notes.name);
      setBody(body().trim() ? `${body().trim()}\n\n${notes.body}` : notes.body);
    } catch (e) {
      toastError(e);
    } finally {
      setGenerating(false);
    }
  };

  const submit = async (draft: boolean) => {
    if (!tag().trim()) return toastError('Choose or create a tag');
    // Publishing (a new release or a draft) is hard to take back.
    if (!draft && !isPublished() && !confirm('Are you sure you want to publish this release?')) return;
    setBusy(draft ? 'Saving draft…' : props.release ? 'Updating…' : 'Publishing…');
    try {
      const input: ReleaseInput = {
        tag_name: tag().trim(),
        target_commitish: tagExists() ? undefined : target(),
        name: title().trim(),
        body: body(),
        draft,
        prerelease: prerelease(),
      };
      if (!draft && !prerelease()) input.make_latest = latest() ? 'true' : 'false';
      const saved = await saveRelease(props.owner, props.repo, props.release?.id ?? null, input);
      for (const id of removedAssets()) await deleteReleaseAsset(props.owner, props.repo, id);
      for (const [i, file] of files().entries()) {
        setBusy(`Uploading ${file.name} (${i + 1}/${files().length})…`);
        await uploadReleaseAsset(saved, file);
      }
      toast(draft ? 'Draft saved' : 'Release published', 'success');
      navigate(draft ? `${props.base}/releases` : tagHref(props.base, saved.tag_name));
    } catch (e) {
      toastError(e);
      setBusy(null);
    }
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        <div class="flex flex-wrap items-end gap-3 mb-2">
          <div>
            <label class="form-label" for="release-tag">
              <Octicon icon={tagIcon} /> Tag
            </label>
            <input
              id="release-tag"
              class="form-control w-[260px]!"
              list="release-tags"
              placeholder="Choose a tag or type a new one"
              autocomplete="off"
              required
              value={tag()}
              onInput={(e) => {
                const v = e.currentTarget.value;
                setTag(v);
                clearTimeout(timer);
                timer = setTimeout(() => setCheckedTag(v), 400);
              }}
            />
            <Loading>
              <datalist id="release-tags">
                <For each={refs().tags}>{(t) => <option value={t} />}</For>
              </datalist>
            </Loading>
          </div>
          <Loading fallback={<Spinner size={16} />}>
            <Show when={tag().trim() && !tagExists()}>
              <div>
                <label class="form-label" for="release-target">
                  Target
                </label>
                <select id="release-target" class="form-select w-auto!" value={target()} onChange={(e) => setTarget(e.currentTarget.value)}>
                  <For each={refs().branches}>{(b) => <option value={b}>{b}</option>}</For>
                </select>
              </div>
            </Show>
            <div>
              <label class="form-label" for="release-prev">
                Previous tag
              </label>
              <select id="release-prev" class="form-select w-auto!" value={previousTag()} onChange={(e) => setPreviousTag(e.currentTarget.value)}>
                <option value="">auto</option>
                <For each={refs().tags.filter((t: string) => t !== tag())}>{(t) => <option value={t}>{t}</option>}</For>
              </select>
            </div>
          </Loading>
        </div>
        <Loading>
          <Show when={tag().trim()}>
            <p class="text-xs mb-4 flex items-center gap-1">
              <Show
                when={tagExists()}
                fallback={
                  <>
                    <Octicon icon={checkCircleFillIcon} class="text-fg-success" />
                    <span>
                      <strong>Excellent!</strong> This tag will be created from the target when you publish this release.
                    </span>
                  </>
                }
              >
                <Octicon icon={tagIcon} class="text-fg-muted" />
                <span class="text-fg-muted">Existing tag</span>
              </Show>
            </p>
          </Show>
        </Loading>

        <div class="flex items-center gap-2 mt-4 mb-2">
          <input
            class="form-control flex-1 text-base!"
            aria-label="Release title"
            placeholder="Release title"
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
          />
          <button type="button" class="btn" disabled={generating() || !tag().trim()} onClick={generate}>
            {generating() ? 'Generating…' : 'Generate release notes'}
          </button>
        </div>
        <MarkdownEditor
          value={body()}
          onInput={setBody}
          repo={`${props.owner}/${props.repo}`}
          placeholder="Describe this release"
          minHeight={260}
          monospace
        />

        <div class="mt-4">
          <label
            class="block border-2 border-dashed border-line rounded-md p-4 text-center text-sm text-fg-muted cursor-pointer hover:bg-canvas-muted"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const list = [...(e.dataTransfer?.files ?? [])];
              setFiles((f) => [...f, ...list]);
            }}
          >
            <Octicon icon={uploadIcon} /> Attach binaries by dropping them here or <span class="text-fg-accent">selecting them</span>.
            <input
              type="file"
              multiple
              class="sr-only"
              onChange={(e) => {
                const list = [...(e.currentTarget.files ?? [])];
                setFiles((f) => [...f, ...list]);
                e.currentTarget.value = '';
              }}
            />
          </label>
          <Show when={(props.release?.assets.length ?? 0) > 0 || files().length > 0}>
            <div class="Box mt-2">
              <For each={props.release?.assets ?? []}>
                {(a) => (
                  <div class={['Box-row flex items-center gap-2 py-2!', { 'opacity-50 line-through': removedAssets().includes(a.id) }]}>
                    <Octicon icon={packageIcon} class="text-fg-muted" />
                    <span class="flex-1 text-sm font-semibold truncate">{a.name}</span>
                    <span class="text-xs text-fg-muted">{formatBytes(a.size)}</span>
                    <button
                      type="button"
                      class="btn-octicon"
                      aria-label={removedAssets().includes(a.id) ? `Keep ${a.name}` : `Delete ${a.name}`}
                      onClick={() =>
                        setRemovedAssets((ids) => (ids.includes(a.id) ? ids.filter((x) => x !== a.id) : [...ids, a.id]))
                      }
                    >
                      <Octicon icon={removedAssets().includes(a.id) ? undoIcon : trashIcon} />
                    </button>
                  </div>
                )}
              </For>
              <For each={files()}>
                {(f) => (
                  <div class="Box-row flex items-center gap-2 py-2!">
                    <Octicon icon={uploadIcon} class="text-fg-accent" />
                    <span class="flex-1 text-sm truncate">{f.name}</span>
                    <span class="text-xs text-fg-muted">{formatBytes(f.size)} · will be uploaded</span>
                    <button type="button" class="btn-octicon" aria-label={`Remove ${f.name}`} onClick={() => setFiles((l) => l.filter((x) => x !== f))}>
                      <Octicon icon={trashIcon} />
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        <div class="mt-4 text-sm">
          <label class="flex items-start gap-2 py-1">
            <input type="checkbox" class="mt-1" checked={prerelease()} onChange={(e) => setPrerelease(e.currentTarget.checked)} />
            <span>
              <strong>Set as a pre-release</strong>
              <span class="note">This release will be labeled as non-production ready.</span>
            </span>
          </label>
          <Show when={!prerelease()}>
            <label class="flex items-start gap-2 py-1">
              <input type="checkbox" class="mt-1" checked={latest()} onChange={(e) => setLatest(e.currentTarget.checked)} />
              <span>
                <strong>Set as the latest release</strong>
                <span class="note">This release will be labeled as the latest release for this repository.</span>
              </span>
            </label>
          </Show>
        </div>

        <Show when={props.release?.draft === false && tag().trim() !== props.release?.tag_name}>
          <p class="flash flash-warn text-sm mt-3 flex items-center gap-2">
            <Octicon icon={alertIcon} /> Changing the tag of a published release can break links to it.
          </p>
        </Show>

        <div class="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-line-muted">
          <button type="submit" class="btn btn-primary" disabled={!!busy()}>
            {busy() ?? (isPublished() ? 'Update release' : 'Publish release')}
          </button>
          <Show when={!isPublished()}>
            <button type="button" class="btn" disabled={!!busy()} onClick={() => void submit(true)}>
              Save draft
            </button>
          </Show>
          <div class="flex-1" />
          <Show when={props.release}>
            <button type="button" class="btn btn-danger" onClick={() => setDeleting(true)}>
              Delete
            </button>
          </Show>
        </div>
      </form>
      <ConfirmDialog
        open={deleting()}
        onClose={() => setDeleting(false)}
        title="Delete this release?"
        button="Delete this release"
        onConfirm={() =>
          deleteRelease(props.owner, props.repo, props.release!.id).then(() => {
            toast('Release deleted');
            navigate(`${props.base}/releases`);
          })
        }
      >
        <p>This will delete the information for this release. The tag is kept.</p>
      </ConfirmDialog>
    </>
  );
}
