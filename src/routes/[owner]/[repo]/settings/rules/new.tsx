import { Title } from '@solidjs/meta';
import RulesetForm from '../../../../../features/repo-settings/components/RulesetForm';
import { useRepo } from '../../../../../features/repo/context';

/** /:owner/:repo/settings/rules/new */
export default function NewRuleset() {
  const ctx = useRepo();
  return (
    <>
      <Title>{`New ruleset · ${ctx.fullName()}`}</Title>
      <RulesetForm owner={ctx.owner()} repo={ctx.name()} base={ctx.base()} ruleset={null} />
    </>
  );
}
