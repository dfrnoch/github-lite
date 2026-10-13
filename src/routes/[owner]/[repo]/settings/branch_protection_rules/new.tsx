import { Title } from '@solidjs/meta';
import { createMemo } from 'solid-js';
import { getBranchProtectionRules } from '../../../../../features/repo-settings/api';
import BranchProtectionForm from '../../../../../features/repo-settings/components/BranchProtectionForm';
import { useRepo } from '../../../../../features/repo/context';

/** /:owner/:repo/settings/branch_protection_rules/new */
export default function NewBranchProtectionRule() {
  const ctx = useRepo();
  const data = createMemo(() => getBranchProtectionRules(ctx.owner(), ctx.name()));
  return (
    <>
      <Title>{`New branch protection rule · ${ctx.fullName()}`}</Title>
      <BranchProtectionForm repositoryId={data().repositoryId} rule={null} base={ctx.base()} />
    </>
  );
}
