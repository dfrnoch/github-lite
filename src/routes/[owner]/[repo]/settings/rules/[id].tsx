import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createMemo } from 'solid-js';
import { getRuleset } from '../../../../../features/repo-settings/api';
import RulesetForm from '../../../../../features/repo-settings/components/RulesetForm';
import { useRepo } from '../../../../../features/repo/context';

/** /:owner/:repo/settings/rules/:id */
export default function EditRuleset() {
  const ctx = useRepo();
  const params = useParams<{ id: string }>();
  const ruleset = createMemo(() => getRuleset(ctx.owner(), ctx.name(), Number(params.id)));
  return (
    <>
      <Title>{`${ruleset().name} · Rulesets · ${ctx.fullName()}`}</Title>
      <RulesetForm owner={ctx.owner()} repo={ctx.name()} base={ctx.base()} ruleset={ruleset()} />
    </>
  );
}
