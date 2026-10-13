import { Title } from '@solidjs/meta';
import { useSearchParams } from '@solidjs/router';
import { createMemo, For, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Blankslate, RelativeTime } from '../../../../components/ui';
import { getDependabotAlerts } from '../../../../features/security/api';
import Severity from '../../../../features/security/Severity';
import { useRepo } from '../../../../features/repo/context';
import { dependabotIcon, shieldCheckIcon } from '../../../../icons/octicons';

/** /:owner/:repo/security/dependabot — Dependabot alerts (needs security_events scope / admin). */
export default function DependabotAlerts() {
  const ctx = useRepo();
  const [search] = useSearchParams<{ state?: string }>();
  const state = () => (search.state === 'closed' ? 'fixed,dismissed,auto_dismissed' : 'open');
  const data = createMemo(() => getDependabotAlerts(ctx.owner(), ctx.name(), state()));
  return (
    <>
      <Title>{`Dependabot alerts · ${ctx.fullName()}`}</Title>
      <div class="pb-2 mb-4 border-b border-line-muted">
        <h2 class="text-2xl font-normal">Dependabot alerts</h2>
      </div>
      <Show
        when={!data().error}
        fallback={
          <Blankslate icon={dependabotIcon} title="Dependabot alerts are not available">
            {data().error} — alerts need Dependabot enabled for this repository and a token with the{' '}
            <code class="font-mono">security_events</code> scope (or admin access).
          </Blankslate>
        }
      >
        <div class="Box">
          <div class="Box-header flex gap-4 text-sm">
            <a class={['link-plain', { 'font-semibold': state() === 'open' }]} href={`${ctx.base()}/security/dependabot`}>
              Open
            </a>
            <a class={['link-plain', { 'font-semibold': state() !== 'open' }]} href={`${ctx.base()}/security/dependabot?state=closed`}>
              Closed
            </a>
          </div>
          <For each={data().alerts} fallback={<Blankslate icon={shieldCheckIcon} title={state() === 'open' ? 'No open alerts' : 'No closed alerts'} />}>
            {(a) => (
              <div class="Box-row flex items-start gap-3">
                <Octicon icon={dependabotIcon} class="text-fg-muted mt-1" />
                <div class="flex-1 min-w-0">
                  <a class="font-semibold link-plain" href={a.html_url} target="_blank" rel="noreferrer">
                    {a.security_advisory.summary}
                  </a>{' '}
                  <Severity severity={a.security_advisory.severity} />
                  <p class="text-xs text-fg-muted mt-1">
                    #{a.number} · {a.dependency.package.name} ({a.dependency.package.ecosystem}) · {a.dependency.manifest_path} · opened{' '}
                    <RelativeTime datetime={a.created_at} />
                    <Show when={a.security_vulnerability.first_patched_version}>
                      {(v) => <> · patched in {v().identifier}</>}
                    </Show>
                  </p>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </>
  );
}
