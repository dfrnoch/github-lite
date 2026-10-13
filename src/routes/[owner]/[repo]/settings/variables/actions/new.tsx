import { Title } from '@solidjs/meta';
import SecretForm from '../../../../../../features/repo-settings/components/SecretForm';
import { useRepo } from '../../../../../../features/repo/context';

/** /:owner/:repo/settings/variables/actions/new */
export default function NewVariable() {
  const ctx = useRepo();
  return (
    <>
      <Title>{`New variable · ${ctx.fullName()}`}</Title>
      <SecretForm kind="variable" owner={ctx.owner()} repo={ctx.name()} base={ctx.base()} />
    </>
  );
}
