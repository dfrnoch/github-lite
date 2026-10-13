import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createMemo, For, Show } from 'solid-js';
import { Avatar, Markdown, RelativeTime } from '../../../../../components/ui';
import { renderMarkdown } from '../../../../../lib/markdown';
import { getAdvisory } from '../../../../../features/security/api';
import Severity from '../../../../../features/security/Severity';
import { useRepo } from '../../../../../features/repo/context';

/** /:owner/:repo/security/advisories/:ghsa */
export default function AdvisoryPage() {
  const ctx = useRepo();
  const params = useParams<{ ghsa: string }>();
  const advisory = createMemo(() => getAdvisory(ctx.owner(), ctx.name(), params.ghsa));
  const html = createMemo(() => renderMarkdown(advisory().description ?? '', ctx.fullName()));
  return (
    <>
      <Title>{`${advisory().summary} · Advisory · ${ctx.fullName()}`}</Title>
      <div class="pb-4 mb-4 border-b border-line-muted">
        <h2 class="text-2xl font-normal">{advisory().summary}</h2>
        <p class="text-sm text-fg-muted mt-1 flex flex-wrap items-center gap-2">
          <Severity severity={advisory().severity} />
          <Show when={advisory().publisher ?? advisory().author}>
            {(u) => (
              <span class="flex items-center gap-1">
                <Avatar src={u().avatar_url} size={16} /> <strong>{u().login}</strong>
              </span>
            )}
          </Show>
          <Show when={advisory().published_at} fallback={<span>{advisory().state}</span>}>
            published <RelativeTime datetime={advisory().published_at} />
          </Show>
          <span class="font-mono text-xs">{advisory().ghsa_id}</span>
        </p>
      </div>
      <div class="flex flex-col lg:flex-row gap-6">
        <div class="flex-1 min-w-0">
          <div class="Box mb-4">
            <div class="Box-header font-semibold text-sm">Package</div>
            <For each={advisory().vulnerabilities ?? []}>
              {(v) => (
                <div class="Box-row grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div class="text-xs text-fg-muted">{v.package?.ecosystem}</div>
                    <strong>{v.package?.name ?? '—'}</strong>
                  </div>
                  <div>
                    <div class="text-xs text-fg-muted">Affected versions</div>
                    <code class="font-mono">{v.vulnerable_version_range ?? '—'}</code>
                  </div>
                  <div>
                    <div class="text-xs text-fg-muted">Patched versions</div>
                    <code class="font-mono">{v.patched_versions || 'None'}</code>
                  </div>
                </div>
              )}
            </For>
          </div>
          <div class="Box">
            <div class="Box-header font-semibold text-sm">Description</div>
            <div class="Box-body">
              <Markdown html={html()} />
            </div>
          </div>
        </div>
        <aside class="w-full lg:w-[296px] shrink-0 text-sm">
          <Show when={advisory().cvss?.score != null}>
            <h3 class="font-semibold mb-1">Severity</h3>
            <p class="mb-4">
              {advisory().cvss!.score} / 10
              <span class="block text-xs text-fg-muted break-all">{advisory().cvss!.vector_string}</span>
            </p>
          </Show>
          <h3 class="font-semibold mb-1">CVE ID</h3>
          <p class="mb-4">{advisory().cve_id ?? 'No known CVE'}</p>
          <Show when={advisory().cwes?.length}>
            <h3 class="font-semibold mb-1">Weaknesses</h3>
            <ul class="mb-4">
              <For each={advisory().cwes}>
                {(c) => (
                  <li>
                    <span class="Label">{c.cwe_id}</span> {c.name}
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <Show when={advisory().credits?.length}>
            <h3 class="font-semibold mb-1">Credits</h3>
            <ul>
              <For each={advisory().credits}>
                {(c) => (
                  <li class="flex items-center gap-1 mb-1">
                    <Avatar login={c.login} size={16} />
                    <a href={`/${c.login}`}>{c.login}</a> <span class="text-fg-muted text-xs">{c.type}</span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </aside>
      </div>
    </>
  );
}
