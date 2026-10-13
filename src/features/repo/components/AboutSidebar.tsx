import { action, useAction } from '@solidjs/router';
import { createMemo, createSignal, Errored, For, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Dialog, RelativeTime, toastError } from '../../../components/ui';
import {
  bookIcon,
  codeOfConductIcon,
  eyeIcon,
  gearIcon,
  lawIcon,
  linkIcon,
  peopleIcon,
  pulseIcon,
  repoIcon,
  repoForkedIcon,
  shieldIcon,
  starIcon,
  tagIcon,
} from '../../../icons/octicons';
import { compactNumber, formatNumber } from '../../../lib/format';
import { gh } from '../../../lib/github';
import { languageColor } from '../../../lib/languages';
import type { Repository } from '../../../lib/types';
import { feature } from '../../refined';
import { getCommunityFiles, getFirstCommit, getRepoOverview } from '../api';

export const updateRepoAbout = action(
  async (owner: string, repo: string, about: { description: string; homepage: string; topics: string[] }) => {
    await gh(`/repos/${owner}/${repo}`, {
      method: 'PATCH',
      body: { description: about.description, homepage: about.homepage },
    });
    await gh(`/repos/${owner}/${repo}/topics`, { method: 'PUT', body: { names: about.topics } });
  },
  'update-repo-about',
);

/** Right column of the repo home: About, Releases, Languages. */
export default function AboutSidebar(props: { repo: Repository }) {
  const owner = () => props.repo.owner.login;
  const name = () => props.repo.name;
  const base = () => `/${props.repo.full_name}`;
  const overview = createMemo(() => getRepoOverview(owner(), name()));
  const community = createMemo(() => getCommunityFiles(owner(), name()));
  const [editing, setEditing] = createSignal(false);
  const clean = () => feature('clean-repo-sidebar');

  const Link = (p: { icon: typeof bookIcon; href: string; children: any }) => (
    <a class="link-muted flex items-center gap-2 mt-2" href={p.href}>
      <Octicon icon={p.icon} />
      {p.children}
    </a>
  );

  return (
    <div class="text-sm">
      <section class="pb-6 border-b border-line-muted">
        {/* clean-repo-sidebar: the "About" heading only stays for its edit button. */}
        <Show when={!clean() || props.repo.permissions?.admin}>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold">About</h2>
            <Show when={props.repo.permissions?.admin}>
              <button type="button" class="btn-octicon" aria-label="Edit repository metadata" onClick={() => setEditing(true)}>
                <Octicon icon={gearIcon} />
              </button>
            </Show>
          </div>
        </Show>
        <Show
          when={props.repo.description || props.repo.homepage || props.repo.topics?.length}
          fallback={
            <Show when={!clean() || props.repo.permissions?.admin}>
              <p class="text-fg-muted italic">No description, website, or topics provided.</p>
            </Show>
          }
        >
          <Show when={props.repo.description}>
            <p class="text-base mb-4">{props.repo.description}</p>
          </Show>
          <Show when={props.repo.homepage}>
            {(url) => (
              <a class="flex items-center gap-2 font-semibold mb-4 break-all" href={url().startsWith('http') ? url() : `https://${url()}`} target="_blank" rel="noreferrer">
                <Octicon icon={linkIcon} class="text-fg-muted" />
                {url().replace(/^https?:\/\//, '')}
              </a>
            )}
          </Show>
          <Show when={props.repo.topics?.length}>
            <div class="flex flex-wrap gap-1 mb-4">
              <For each={props.repo.topics}>
                {(t) => (
                  <a class="topic-tag" href={`/topics/${t}`}>
                    {t}
                  </a>
                )}
              </For>
            </div>
          </Show>
        </Show>
        <Loading>
          <Show when={community()}>
            {(c) => (
              <>
                <Show when={c().files.readme && !clean()}>
                  <Link icon={bookIcon} href={`${base()}#readme`}>
                    Readme
                  </Link>
                </Show>
                <Show when={props.repo.license}>
                  {(l) => (
                    <Link icon={lawIcon} href={c().files.license ? new URL(c().files.license!.html_url).pathname : base()}>
                      {l().spdx_id && l().spdx_id !== 'NOASSERTION' ? `${l().spdx_id} license` : l().name}
                    </Link>
                  )}
                </Show>
                <Show when={c().files.code_of_conduct && !clean()}>
                  <Link icon={codeOfConductIcon} href={new URL(c().files.code_of_conduct!.html_url).pathname}>
                    Code of conduct
                  </Link>
                </Show>
                <Show when={c().files.contributing}>
                  <Link icon={peopleIcon} href={new URL(c().files.contributing!.html_url).pathname}>
                    Contributing
                  </Link>
                </Show>
              </>
            )}
          </Show>
        </Loading>
        <Link icon={shieldIcon} href={`${base()}/security`}>
          Security policy
        </Link>
        <Link icon={pulseIcon} href={`${base()}/activity`}>
          Activity
        </Link>
        <Link icon={starIcon} href={`${base()}/stargazers`}>
          <strong class="text-fg">{compactNumber(props.repo.stargazers_count)}</strong> stars
        </Link>
        <Link icon={eyeIcon} href={`${base()}/watchers`}>
          <strong class="text-fg">{compactNumber(props.repo.subscribers_count ?? 0)}</strong> watching
        </Link>
        <Link icon={repoForkedIcon} href={`${base()}/forks`}>
          <strong class="text-fg">{compactNumber(props.repo.forks_count)}</strong> forks
        </Link>
        <Show when={feature('repo-age')}>
          <Errored fallback={null}>
            <Loading>
              <RepoAge owner={owner()} repo={name()} />
            </Loading>
          </Errored>
        </Show>
      </section>

      <Loading>
        <Show when={!clean() || overview().releases.totalCount || props.repo.permissions?.push}>
        <section class="py-6 border-b border-line-muted">
          <h2 class="text-base font-semibold mb-3">
            <a class="link-plain" href={`${base()}/releases`}>
              Releases
            </a>{' '}
            <Show when={overview().releases.totalCount}>
              <span class="Counter">{formatNumber(overview().releases.totalCount)}</span>
            </Show>
          </h2>
          <Show
            when={overview().releases.latest}
            fallback={
              <p class="text-fg-muted">
                No releases published
                <Show when={props.repo.permissions?.push}>
                  <br />
                  <a href={`${base()}/releases/new`}>Create a new release</a>
                </Show>
              </p>
            }
          >
            {(rel) => (
              <a class="flex gap-2 link-plain" href={`${base()}/releases/tag/${encodeURIComponent(rel().tagName)}`}>
                <Octicon icon={tagIcon} class="text-fg-success mt-0.5" />
                <span>
                  <span class="font-semibold">{rel().name || rel().tagName}</span>{' '}
                  <span class="Label Label--success">Latest</span>
                  <span class="block text-xs text-fg-muted">
                    <RelativeTime datetime={rel().publishedAt} />
                  </span>
                </span>
              </a>
            )}
          </Show>
          <Show when={overview().releases.totalCount > 1 && !clean()}>
            <a class="block mt-3 text-xs" href={`${base()}/releases`}>
              + {formatNumber(overview().releases.totalCount - 1)} releases
            </a>
          </Show>
        </section>
        </Show>

        <Show when={overview().languages.items.length}>
          <section class="py-6">
            <h2 class={['text-base font-semibold mb-3', { 'sr-only': clean() }]}>Languages</h2>
            <div class="flex h-2 rounded-md overflow-hidden gap-0.5 mb-2">
              <For each={overview().languages.items}>
                {(lang) => (
                  <span
                    title={lang.name}
                    style={{
                      width: `${(lang.size / overview().languages.totalSize) * 100}%`,
                      'background-color': lang.color ?? languageColor(lang.name),
                    }}
                  />
                )}
              </For>
            </div>
            <ul class="flex flex-wrap gap-x-4 gap-y-1">
              <For each={overview().languages.items}>
                {(lang) => (
                  <li class="flex items-center gap-1.5 text-xs">
                    <span class="repo-language-color w-2! h-2!" style={{ 'background-color': lang.color ?? languageColor(lang.name) }} />
                    <span class="font-semibold">{lang.name}</span>
                    <span class="text-fg-muted">{((lang.size / overview().languages.totalSize) * 100).toFixed(1)}%</span>
                  </li>
                )}
              </For>
            </ul>
          </section>
        </Show>
      </Loading>

      <EditAboutDialog repo={props.repo} open={editing()} onClose={() => setEditing(false)} />
    </div>
  );
}

function EditAboutDialog(props: { repo: Repository; open: boolean; onClose: () => void }) {
  const save = useAction(updateRepoAbout);
  // Writable derived signals: start from the repo's values, editable locally.
  const [description, setDescription] = createSignal(() => props.repo.description ?? '');
  const [homepage, setHomepage] = createSignal(() => props.repo.homepage ?? '');
  const [topics, setTopics] = createSignal(() => (props.repo.topics ?? []).join(' '));
  const [busy, setBusy] = createSignal(false);

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await save(props.repo.owner.login, props.repo.name, {
        description: description(),
        homepage: homepage(),
        topics: topics()
          .split(/[\s,]+/)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      });
      props.onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={props.open} onClose={props.onClose} title="Edit repository details">
      <form onSubmit={submit}>
        <div class="form-group mt-0!">
          <label for="about-description">Description</label>
          <textarea id="about-description" class="form-control min-h-[80px]!" value={description()} onInput={(e) => setDescription(e.currentTarget.value)} />
        </div>
        <div class="form-group">
          <label for="about-homepage">Website</label>
          <input id="about-homepage" class="form-control" type="url" placeholder="Enter a valid URL" value={homepage()} onInput={(e) => setHomepage(e.currentTarget.value)} />
        </div>
        <div class="form-group">
          <label for="about-topics">Topics</label>
          <input id="about-topics" class="form-control" placeholder="separate with spaces" value={topics()} onInput={(e) => setTopics(e.currentTarget.value)} />
          <p class="note">Topics are lowercase, may include hyphens, and are limited to 50 characters.</p>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="btn" onClick={() => props.onClose()}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={busy()}>
            {busy() ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}


const FRESH = [
  'Freshly baked',
  'Freshly brewed',
  'Newly minted',
  'Hot off the presses',
  'Straight out of the oven',
  'Still hot',
  'Smells fresh',
  'Just a baby',
  'It’s my birthday',
  'Brand spanking new',
  'It’s a new world ✨',
  'Certified Fresh Repo™',
  'So it begins, the great battle of our time',
];

const AGE_UNITS: [string, number][] = [
  ['year', 365 * 24 * 3600e3],
  ['month', 30 * 24 * 3600e3],
  ['week', 7 * 24 * 3600e3],
  ['day', 24 * 3600e3],
];

/** repo-age: "5 years old" (age of the first commit), linking to that commit. */
function RepoAge(props: { owner: string; repo: string }) {
  const first = createMemo(() => getFirstCommit(props.owner, props.repo));
  const fresh = FRESH[Math.floor(Math.random() * FRESH.length)]!;
  const age = createMemo(() => {
    const c = first();
    if (!c) return null;
    const ms = Date.now() - new Date(c.date).getTime();
    // About a day old or less.
    if (ms < 10e7) return { fresh, value: '', unit: '' };
    const [unit, size] = AGE_UNITS.find(([, size]) => ms >= size) ?? AGE_UNITS.at(-1)!;
    const value = Math.max(1, Math.round(ms / size));
    return { fresh: '', value: String(value), unit: value === 1 ? unit : `${unit}s` };
  });
  return (
    <Show when={age()}>
      {(a) => (
        <>
          <h3 class="sr-only">Repository age</h3>
          <a
            class="link-muted flex items-center gap-2 mt-2"
            href={`/${props.owner}/${props.repo}/commit/${first()!.oid}`}
            title={`First commit dated ${new Date(first()!.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
          >
            <Octicon icon={repoIcon} />
            <Show when={!a().fresh} fallback={a().fresh}>
              <span>
                <strong class="text-fg">{a().value}</strong> {a().unit} old
              </span>
            </Show>
          </a>
        </>
      )}
    </Show>
  );
}
