import { Title } from '@solidjs/meta';
import SecretForm from '../../../../../../features/repo-settings/components/SecretForm';
import { useRepo } from '../../../../../../features/repo/context';

/** /:owner/:repo/settings/secrets/actions/new */
export default function NewSecret() {
  const ctx = useRepo();
  return (
    <>
      <Title>{`New secret · ${ctx.fullName()}`}</Title>
      <SecretForm kind="secret" owner={ctx.owner()} repo={ctx.name()} base={ctx.base()} />
    </>
  );
}
