import { Title } from '@solidjs/meta';
import { createMemo, For } from 'solid-js';
import Octicon from '../../../../../components/Octicon';
import { Blankslate } from '../../../../../components/ui';
import { getRulesets } from '../../../../../features/repo-settings/api';
import { Subhead } from '../../../../../features/repo-settings/components/ui';
import { useRepo } from '../../../../../features/repo/context';
import { gitBranchIcon, organizationIcon, repoPushIcon, tagIcon } from '../../../../../icons/octicons';

const ENFORCEMENT: Record<string, string> = { active: 'Active', disabled: 'Disabled', evaluate: 'Evaluate' };

/** /:owner/:repo/settings/rules — rulesets list. */
export default function RulesetsSettings() {
  const ctx = useRepo();
  const rulesets = createMemo(() => getRulesets(ctx.owner(), ctx.name()));
  return (
    <>
      <Title>{`Rulesets · ${ctx.fullName()}`}</Title>
      <Subhead
        title="Rulesets"
        actions={
          <a class="btn btn-sm btn-primary" href={`${ctx.base()}/settings/rules/new`}>
            New ruleset
          </a>
        }
        description="Rulesets define whether collaborators can delete or force push and set requirements for any pushes, such as passing status checks or a linear commit history."
      />
      <div class="Box">
        <For each={rulesets()} fallback={<Blankslate icon={repoPushIcon} title="You haven't created any rulesets" />}>
          {(rs) => (
            <div class="Box-row flex items-center gap-3">
              <Octicon icon={rs.target === 'tag' ? tagIcon : rs.source_type === 'Organization' ? organizationIcon : gitBranchIcon} class="text-fg-muted" />
              <div class="flex-1 min-w-0">
                <a class="font-semibold" href={`${ctx.base()}/settings/rules/${rs.id}`}>
                  {rs.name}
                </a>
                <p class="text-xs text-fg-muted">
                  {rs.target === 'tag' ? 'Tag' : rs.target === 'push' ? 'Push' : 'Branch'} ruleset
                  {rs.source_type === 'Organization' ? ` · managed by ${rs.source}` : ''}
                </p>
              </div>
              <span class={['Label', { 'Label--success': rs.enforcement === 'active', 'Label--attention': rs.enforcement === 'evaluate' }]}>
                {ENFORCEMENT[rs.enforcement] ?? rs.enforcement}
              </span>
            </div>
          )}
        </For>
      </div>
    </>
  );
}
