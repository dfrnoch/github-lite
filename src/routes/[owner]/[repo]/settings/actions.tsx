import { Title } from '@solidjs/meta';
import { useAction } from '@solidjs/router';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { toast, toastError } from '../../../../components/ui';
import {
  getActionsPermissions,
  setActionsPermissions,
  setWorkflowPermissions,
  type ActionsPermissions,
} from '../../../../features/repo-settings/api';
import { CheckboxSetting, SectionHeading, Subhead } from '../../../../features/repo-settings/components/ui';
import { useRepo } from '../../../../features/repo/context';

const POLICIES = [
  { value: 'all', label: 'Allow all actions and reusable workflows', description: 'Any action or reusable workflow can be used, regardless of who authored it or where it is defined.' },
  { value: 'disabled', label: 'Disable actions', description: 'The Actions tab is hidden and no workflows can run.' },
  { value: 'local_only', label: `Allow actions and reusable workflows from this repository's owner`, description: 'Any action or reusable workflow defined in a repository within the owner can be used.' },
  { value: 'selected', label: 'Allow select actions and reusable workflows', description: 'Configured selection rules are kept as they are (edit them on github.com).' },
] as const;

/** /:owner/:repo/settings/actions — Actions permissions + workflow token permissions. */
export default function ActionsSettings() {
  const ctx = useRepo();
  const data = createMemo(() => getActionsPermissions(ctx.owner(), ctx.name()));
  const setPerms = useAction(setActionsPermissions);
  const setWorkflow = useAction(setWorkflowPermissions);
  const current = () => (data().perms.enabled ? (data().perms.allowed_actions ?? 'all') : 'disabled');
  const [policy, setPolicy] = createSignal<string>(current);
  const [tokenPerm, setTokenPerm] = createSignal<'read' | 'write'>(() => data().workflow?.default_workflow_permissions ?? 'read');
  const [approve, setApprove] = createSignal(() => !!data().workflow?.can_approve_pull_request_reviews);

  return (
    <>
      <Title>{`Actions settings · ${ctx.fullName()}`}</Title>
      <Subhead title="Actions permissions" />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const p = policy();
          const body: ActionsPermissions = p === 'disabled' ? { enabled: false } : { enabled: true, allowed_actions: p as ActionsPermissions['allowed_actions'] };
          try {
            await setPerms(ctx.owner(), ctx.name(), body);
            toast('Actions permissions saved', 'success');
          } catch (err) {
            toastError(err);
          }
        }}
      >
        <For each={POLICIES}>
          {(p) => (
            <label class="flex gap-2 py-2 text-sm">
              <input type="radio" name="actions-policy" class="mt-1" checked={policy() === p.value} onChange={() => setPolicy(p.value)} />
              <span>
                <span class="font-semibold block">{p.label}</span>
                <span class="note">{p.description}</span>
              </span>
            </label>
          )}
        </For>
        <button type="submit" class="btn mt-2" disabled={policy() === current()}>
          Save
        </button>
      </form>

      <Show when={data().workflow}>
        <SectionHeading class="mt-8">Workflow permissions</SectionHeading>
        <p class="text-sm text-fg-muted mb-2">Choose the default permissions granted to the GITHUB_TOKEN when running workflows in this repository.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await setWorkflow(ctx.owner(), ctx.name(), { default_workflow_permissions: tokenPerm(), can_approve_pull_request_reviews: approve() });
              toast('Workflow permissions saved', 'success');
            } catch (err) {
              toastError(err);
            }
          }}
        >
          <label class="flex gap-2 py-2 text-sm">
            <input type="radio" name="token-perm" class="mt-1" checked={tokenPerm() === 'write'} onChange={() => setTokenPerm('write')} />
            <span>
              <span class="font-semibold block">Read and write permissions</span>
              <span class="note">Workflows have read and write permissions in the repository for all scopes.</span>
            </span>
          </label>
          <label class="flex gap-2 py-2 text-sm">
            <input type="radio" name="token-perm" class="mt-1" checked={tokenPerm() === 'read'} onChange={() => setTokenPerm('read')} />
            <span>
              <span class="font-semibold block">Read repository contents and packages permissions</span>
              <span class="note">Workflows have read permissions in the repository for the contents and packages scopes only.</span>
            </span>
          </label>
          <CheckboxSetting
            class="mt-2"
            label="Allow GitHub Actions to create and approve pull requests"
            checked={approve()}
            onChange={setApprove}
          />
          <button type="submit" class="btn mt-2">
            Save
          </button>
        </form>
      </Show>
    </>
  );
}
