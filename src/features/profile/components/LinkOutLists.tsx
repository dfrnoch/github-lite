import { createMemo, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Blankslate, RelativeTime } from '../../../components/ui';
import { linkExternalIcon, packageIcon, tableIcon } from '../../../icons/octicons';
import { getOwnerPackages, getOwnerProjects } from '../api';

/**
 * Projects (v2) of a user or organization. The project boards themselves
 * aren't reimplemented here — each row links out to github.com.
 */
export function ProjectsList(props: { login: string; isOrg: boolean }) {
  const projects = createMemo(() => getOwnerProjects(props.login, props.isOrg));
  const allUrl = () => `https://github.com/${props.isOrg ? 'orgs' : 'users'}/${props.login}/projects`;
  return (
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-semibold">Projects</h2>
        <a class="btn btn-sm" href={allUrl()} target="_blank" rel="noreferrer">
          Open on github.com <Octicon icon={linkExternalIcon} />
        </a>
      </div>
      <Show
        when={projects().length}
        fallback={<Blankslate icon={tableIcon} title="No open projects" class="Box" />}
      >
        <ul class="Box">
          <For each={projects()}>
            {(p) => (
              <li class="Box-row flex items-start gap-3">
                <Octicon icon={tableIcon} class="text-fg-muted mt-1" />
                <div class="min-w-0 flex-1">
                  <a class="font-semibold link-plain" href={p.url} target="_blank" rel="noreferrer">
                    {p.title}
                  </a>
                  <span class="text-fg-muted text-xs ml-2">#{p.number}</span>
                  <Show when={p.shortDescription}>
                    <p class="text-fg-muted text-sm">{p.shortDescription}</p>
                  </Show>
                </div>
                <span class="text-xs text-fg-muted whitespace-nowrap">
                  Updated <RelativeTime datetime={p.updatedAt} />
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}

/** Packages (GitHub Packages) — listed here, details on github.com. */
export function PackagesList(props: { login: string; isOrg: boolean }) {
  const packages = createMemo(() => getOwnerPackages(props.login, props.isOrg));
  const base = () => `https://github.com/${props.isOrg ? 'orgs' : 'users'}/${props.login}/packages`;
  return (
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-semibold">Packages</h2>
        <a class="btn btn-sm" href={base()} target="_blank" rel="noreferrer">
          Open on github.com <Octicon icon={linkExternalIcon} />
        </a>
      </div>
      <Show
        when={packages().length}
        fallback={
          <Blankslate icon={packageIcon} title="No packages published" class="Box">
            Packages published to GitHub Packages will appear here.
          </Blankslate>
        }
      >
        <ul class="Box">
          <For each={packages()}>
            {(p) => (
              <li class="Box-row flex items-center gap-3">
                <Octicon icon={packageIcon} class="text-fg-muted" />
                <a
                  class="font-semibold link-plain"
                  href={`${base()}/${p.packageType.toLowerCase()}/package/${encodeURIComponent(p.name)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {p.name}
                </a>
                <span class="Label">{p.packageType.toLowerCase()}</span>
                <Show when={p.version}>
                  <span class="text-xs text-fg-muted">{p.version}</span>
                </Show>
                <span class="flex-1" />
                <Show when={p.repository}>
                  {(r) => (
                    <a class="text-xs link-muted" href={`/${r()}`}>
                      {r()}
                    </a>
                  )}
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
