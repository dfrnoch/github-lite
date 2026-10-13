import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createMemo, Show } from 'solid-js';
import { Blankslate } from '../../../../../components/ui';
import { getBranchProtectionRules } from '../../../../../features/repo-settings/api';
import BranchProtectionForm from '../../../../../features/repo-settings/components/BranchProtectionForm';
import { useRepo } from '../../../../../features/repo/context';

/** /:owner/:repo/settings/branch_protection_rules/:id (database id, like github.com). */
export default function EditBranchProtectionRule() {
  const ctx = useRepo();
  const params = useParams<{ id: string }>();
  const data = createMemo(() => getBranchProtectionRules(ctx.owner(), ctx.name()));
  const rule = createMemo(() => data().rules.find((r) => String(r.databaseId) === params.id || r.id === params.id) ?? null);
  return (
    <>
      <Title>{`Branch protection rule · ${ctx.fullName()}`}</Title>
      <Show when={rule()} fallback={<Blankslate title="Branch protection rule not found" />}>
        {(r) => <BranchProtectionForm repositoryId={data().repositoryId} rule={r()} base={ctx.base()} />}
      </Show>
    </>
  );
}
