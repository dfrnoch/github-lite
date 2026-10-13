import { Title } from '@solidjs/meta';
import { useAction } from '@solidjs/router';
import { createMemo, createSignal, For } from 'solid-js';
import Octicon from '../../../../components/Octicon';
import { Blankslate } from '../../../../components/ui';
import { deleteBranchProtectionRule, getBranchProtectionRules } from '../../../../features/repo-settings/api';
import { ConfirmDialog, Subhead } from '../../../../features/repo-settings/components/ui';
import { useRepo } from '../../../../features/repo/context';
import { gitBranchIcon, shieldLockIcon } from '../../../../icons/octicons';
import { pluralize } from '../../../../lib/format';

/** /:owner/:repo/settings/branches — classic branch protection rules. */
export default function BranchesSettings() {
  const ctx = useRepo();
  const data = createMemo(() => getBranchProtectionRules(ctx.owner(), ctx.name()));
  const remove = useAction(deleteBranchProtectionRule);
  const [deleting, setDeleting] = createSignal<{ id: string; pattern: string } | null>(null);
  const base = () => `${ctx.base()}/settings/branch_protection_rules`;

  return (
    <>
      <Title>{`Branches · ${ctx.fullName()}`}</Title>
      <Subhead title="Branch protection rules" actions={<a class="btn btn-sm" href={`${base()}/new`}>Add classic branch protection rule</a>} />
      <p class="text-sm text-fg-muted mb-4">
        Define branch protection rules to disable force pushing, prevent branches from being deleted, and optionally require
        status checks before merging. New to branch protection rules? Consider using{' '}
        <a href={`${ctx.base()}/settings/rules`}>rulesets</a> instead.
      </p>
      <div class="Box">
        <For
          each={data().rules}
          fallback={
            <Blankslate icon={shieldLockIcon} title="No branch protection rules defined yet">
              Protect your most important branches.
            </Blankslate>
          }
        >
          {(rule) => (
            <div class="Box-row flex items-center gap-3">
              <Octicon icon={gitBranchIcon} class="text-fg-muted" />
              <div class="flex-1 min-w-0">
                <code class="font-mono text-sm font-semibold">{rule.pattern}</code>
                <p class="text-xs text-fg-muted">
                  Currently applies to {pluralize(rule.matchingRefs.totalCount, 'branch', 'branches')}
                </p>
              </div>
              <a class="btn btn-sm" href={`${base()}/${rule.databaseId}`}>
                Edit
              </a>
              <button type="button" class="btn btn-sm btn-danger" onClick={() => setDeleting({ id: rule.id, pattern: rule.pattern })}>
                Delete
              </button>
            </div>
          )}
        </For>
      </div>
      <ConfirmDialog
        open={deleting() != null}
        onClose={() => setDeleting(null)}
        title="Delete this branch protection rule?"
        button="I understand, delete this rule."
        onConfirm={() => remove(deleting()!.id)}
      >
        <p>
          Branches matching <code class="font-mono">{deleting()?.pattern}</code> will no longer be protected.
        </p>
      </ConfirmDialog>
    </>
  );
}
