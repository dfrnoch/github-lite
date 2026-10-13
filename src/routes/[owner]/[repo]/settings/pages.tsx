import { Title } from '@solidjs/meta';
import { useAction } from '@solidjs/router';
import { createMemo, createSignal, For, Loading, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Spinner, toast, toastError } from '../../../../components/ui';
import {
  disablePages,
  enablePages,
  getBranchNames,
  getPages,
  updatePages,
} from '../../../../features/repo-settings/api';
import { CheckboxSetting, ConfirmDialog, SectionHeading, Subhead } from '../../../../features/repo-settings/components/ui';
import { useRepo } from '../../../../features/repo/context';
import { checkCircleFillIcon, linkExternalIcon } from '../../../../icons/octicons';

/** /:owner/:repo/settings/pages — GitHub Pages source, custom domain, HTTPS. */
export default function PagesSettings() {
  const ctx = useRepo();
  const pages = createMemo(() => getPages(ctx.owner(), ctx.name()));
  const branches = createMemo(() => getBranchNames(ctx.owner(), ctx.name()));
  const enable = useAction(enablePages);
  const update = useAction(updatePages);
  const disable = useAction(disablePages);

  const [buildType, setBuildType] = createSignal<'legacy' | 'workflow'>(() => pages()?.build_type ?? 'legacy');
  const [branch, setBranch] = createSignal(() => pages()?.source?.branch ?? '');
  const [path, setPath] = createSignal<string>(() => pages()?.source?.path ?? '/');
  const [cname, setCname] = createSignal(() => pages()?.cname ?? '');
  const [busy, setBusy] = createSignal(false);
  const [unpublishing, setUnpublishing] = createSignal(false);

  const saveSource = async () => {
    setBusy(true);
    try {
      const source = buildType() === 'legacy' ? { branch: branch() || ctx.repo().default_branch, path: path() } : undefined;
      if (pages()) await update(ctx.owner(), ctx.name(), { build_type: buildType(), source });
      else await enable(ctx.owner(), ctx.name(), { build_type: buildType(), source });
      toast('GitHub Pages source saved', 'success');
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Title>{`Pages · ${ctx.fullName()}`}</Title>
      <Subhead class="mb-6" title="GitHub Pages" description="GitHub Pages is designed to host your personal, organization, or project pages from a GitHub repository." />
      <Show when={pages()?.html_url}>
        {(url) => (
          <div class="Box mb-6">
            <div class="Box-row flex items-center gap-3 bg-success-muted!">
              <Octicon icon={checkCircleFillIcon} class="text-fg-success" />
              <span class="flex-1 text-sm">
                Your site is live at{' '}
                <a href={url()} target="_blank" rel="noreferrer" class="font-semibold">
                  {url()}
                </a>
                <Show when={pages()?.status}> · build status: {pages()!.status}</Show>
              </span>
              <a class="btn btn-sm" href={url()} target="_blank" rel="noreferrer">
                <Octicon icon={linkExternalIcon} /> Visit site
              </a>
            </div>
          </div>
        )}
      </Show>

      <SectionHeading>Build and deployment</SectionHeading>
      <div class="form-group mt-0!">
        <label for="pages-source">Source</label>
        <select id="pages-source" class="form-select w-auto!" value={buildType()} onChange={(e) => setBuildType(e.currentTarget.value as 'legacy' | 'workflow')}>
          <option value="legacy">Deploy from a branch</option>
          <option value="workflow">GitHub Actions</option>
        </select>
      </div>
      <Show
        when={buildType() === 'legacy'}
        fallback={<p class="text-sm text-fg-muted mb-3">Use a workflow (e.g. actions/deploy-pages) to build and deploy your site.</p>}
      >
        <div class="form-group">
          <span class="form-label">Branch</span>
          <p class="note mb-2">Your GitHub Pages site is built from this branch and folder.</p>
          <div class="flex gap-2 items-center">
            <Loading fallback={<Spinner size={16} />}>
              <select class="form-select w-auto!" aria-label="Branch" value={branch() || ctx.repo().default_branch} onChange={(e) => setBranch(e.currentTarget.value)}>
                <For each={branches()}>{(b) => <option value={b}>{b}</option>}</For>
              </select>
            </Loading>
            <select class="form-select w-auto!" aria-label="Folder" value={path()} onChange={(e) => setPath(e.currentTarget.value)}>
              <option value="/">/ (root)</option>
              <option value="/docs">/docs</option>
            </select>
          </div>
        </div>
      </Show>
      <button type="button" class="btn" disabled={busy()} onClick={saveSource}>
        {pages() ? 'Save' : 'Enable GitHub Pages'}
      </button>

      <Show when={pages()}>
        {(p) => (
          <>
            <SectionHeading class="mt-8">Custom domain</SectionHeading>
            <p class="text-sm text-fg-muted mb-2">Custom domains allow you to serve your site from a domain other than github.io.</p>
            <form
              class="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await update(ctx.owner(), ctx.name(), { cname: cname().trim() || null });
                  toast('Custom domain saved', 'success');
                } catch (err) {
                  toastError(err);
                }
              }}
            >
              <input class="form-control max-w-[300px]" placeholder="example.com" value={cname()} onInput={(e) => setCname(e.currentTarget.value)} />
              <button type="submit" class="btn">
                Save
              </button>
              <Show when={p().cname}>
                <button
                  type="button"
                  class="btn"
                  onClick={() => update(ctx.owner(), ctx.name(), { cname: null }).then(() => setCname('')).catch(toastError)}
                >
                  Remove
                </button>
              </Show>
            </form>
            <Show when={p().https_certificate}>
              {(cert) => <p class="note">Certificate: {cert().description}</p>}
            </Show>
            <CheckboxSetting
              class="mt-4"
              label="Enforce HTTPS"
              description="HTTPS provides a layer of encryption that prevents others from snooping on or tampering with traffic to your site."
              checked={!!p().https_enforced}
              onSave={(v) => update(ctx.owner(), ctx.name(), { https_enforced: v })}
            />

            <SectionHeading class="mt-8">Unpublish site</SectionHeading>
            <button type="button" class="btn btn-danger" onClick={() => setUnpublishing(true)}>
              Unpublish site
            </button>
            <ConfirmDialog
              open={unpublishing()}
              onClose={() => setUnpublishing(false)}
              title="Unpublish site"
              button="Unpublish site"
              onConfirm={() => disable(ctx.owner(), ctx.name())}
            >
              <p>Your site will be taken down and GitHub Pages will be disabled for this repository.</p>
            </ConfirmDialog>
          </>
        )}
      </Show>
    </>
  );
}
