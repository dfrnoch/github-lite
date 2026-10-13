import { Title } from '@solidjs/meta';
import { createMemo, Loading, Show } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Spinner } from '../../../../components/ui';
import { getAdvisories, getDependabotAlerts, getSecurityPolicy } from '../../../../features/security/api';
import { useRepo } from '../../../../features/repo/context';
import { checkCircleFillIcon, dependabotIcon, lawIcon, shieldIcon } from '../../../../icons/octicons';
import { pluralize } from '../../../../lib/format';

/** /:owner/:repo/security — overview. */
export default function SecurityOverview() {
  const ctx = useRepo();
  const policy = createMemo(() => getSecurityPolicy(ctx.owner(), ctx.name()));
  const advisories = createMemo(() => getAdvisories(ctx.owner(), ctx.name()));
  const dependabot = createMemo(() => getDependabotAlerts(ctx.owner(), ctx.name(), 'open'));

  const Row = (p: { icon: typeof shieldIcon; title: string; href: string; children: any }) => (
    <div class="Box-row flex items-start gap-3">
      <Octicon icon={p.icon} class="text-fg-muted mt-0.5" />
      <div class="flex-1 min-w-0">
        <a class="font-semibold link-plain" href={p.href}>
          {p.title}
        </a>
        <div class="text-sm text-fg-muted">
          <Loading fallback={<Spinner size={14} />}>{p.children}</Loading>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Title>{`Security Overview · ${ctx.fullName()}`}</Title>
      <div class="pb-2 mb-4 border-b border-line-muted">
        <h2 class="text-2xl font-normal">Security overview</h2>
      </div>
      <div class="Box">
        <Row icon={lawIcon} title="Security policy" href={`${ctx.base()}/security/policy`}>
          <Show when={policy()} fallback="Disabled · Define how users should report security vulnerabilities for this repository">
            <span class="flex items-center gap-1">
              <Octicon icon={checkCircleFillIcon} class="text-fg-success" /> Enabled · View how to securely report security vulnerabilities
            </span>
          </Show>
        </Row>
        <Row icon={shieldIcon} title="Security advisories" href={`${ctx.base()}/security/advisories`}>
          {advisories().length ? `${pluralize(advisories().length, 'advisory', 'advisories')} published` : 'No security advisories'}
        </Row>
        <Row icon={dependabotIcon} title="Dependabot alerts" href={`${ctx.base()}/security/dependabot`}>
          <Show when={!dependabot().error} fallback={`Not available — ${dependabot().error}`}>
            {dependabot().alerts.length ? `${pluralize(dependabot().alerts.length, 'open alert')}` : 'No open alerts'}
          </Show>
        </Row>
      </div>
    </>
  );
}
