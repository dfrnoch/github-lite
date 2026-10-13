import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createMemo } from 'solid-js';
import { getActionsVariable } from '../../../../../../features/repo-settings/api';
import SecretForm from '../../../../../../features/repo-settings/components/SecretForm';
import { useRepo } from '../../../../../../features/repo/context';

/** /:owner/:repo/settings/variables/actions/:name */
export default function UpdateVariable() {
  const ctx = useRepo();
  const params = useParams<{ name: string }>();
  const variable = createMemo(() => getActionsVariable(ctx.owner(), ctx.name(), decodeURIComponent(params.name)));
  return (
    <>
      <Title>{`Update variable · ${ctx.fullName()}`}</Title>
      <SecretForm
        kind="variable"
        owner={ctx.owner()}
        repo={ctx.name()}
        base={ctx.base()}
        name={variable().name}
        value={variable().value}
      />
    </>
  );
}
