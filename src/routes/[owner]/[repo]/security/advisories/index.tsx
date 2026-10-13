import { Title } from '@solidjs/meta';
import { createMemo, For, Show } from 'solid-js';
import Octicon from '../../../../../components/Octicon';
import { Blankslate, RelativeTime } from '../../../../../components/ui';
import { getAdvisories } from '../../../../../features/security/api';
import Severity from '../../../../../features/security/Severity';
import { useRepo } from '../../../../../features/repo/context';
import { shieldIcon } from '../../../../../icons/octicons';

/** /:owner/:repo/security/advisories */
export default function Advisories() {
  const ctx = useRepo();
  const advisories = createMemo(() => getAdvisories(ctx.owner(), ctx.name()));
  return (
    <>
      <Title>{`Security Advisories · ${ctx.fullName()}`}</Title>
      <div class="pb-2 mb-4 border-b border-line-muted flex items-center">
        <h2 class="text-2xl font-normal flex-1">Security advisories</h2>
        <Show when={ctx.repo().permissions?.admin}>
          <a class="btn btn-sm" href={`https://github.com/${ctx.fullName()}/security/advisories/new`} target="_blank" rel="noreferrer">
            New draft security advisory
          </a>
        </Show>
      </div>
      <div class="Box">
        <For each={advisories()} fallback={<Blankslate icon={shieldIcon} title="There aren’t any published security advisories" />}>
          {(a) => (
            <div class="Box-row flex items-start gap-3">
              <Octicon icon={shieldIcon} class="text-fg-muted mt-1" />
              <div class="flex-1 min-w-0">
                <a class="font-semibold link-plain" href={`${ctx.base()}/security/advisories/${a.ghsa_id}`}>
                  {a.summary}
                </a>{' '}
                <Severity severity={a.severity} />
                <Show when={a.state !== 'published'}>
                  <span class="Label ml-1">{a.state}</span>
                </Show>
                <p class="text-xs text-fg-muted mt-1">
                  {a.ghsa_id}
                  <Show when={a.cve_id}> · {a.cve_id}</Show> ·{' '}
                  <Show when={a.published_at} fallback={<>created <RelativeTime datetime={a.created_at} /></>}>
                    published <RelativeTime datetime={a.published_at} />
                  </Show>
                  <Show when={a.publisher ?? a.author}>{(u) => <> by {u().login}</>}</Show>
                </p>
              </div>
            </div>
          )}
        </For>
      </div>
    </>
  );
}
