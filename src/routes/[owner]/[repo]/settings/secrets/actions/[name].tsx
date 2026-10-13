import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import SecretForm from '../../../../../../features/repo-settings/components/SecretForm';
import { useRepo } from '../../../../../../features/repo/context';

/** /:owner/:repo/settings/secrets/actions/:name — set a new value (secrets can't be read back). */
export default function UpdateSecret() {
  const ctx = useRepo();
  const params = useParams<{ name: string }>();
  return (
    <>
      <Title>{`Update secret · ${ctx.fullName()}`}</Title>
      <SecretForm kind="secret" owner={ctx.owner()} repo={ctx.name()} base={ctx.base()} name={decodeURIComponent(params.name)} />
    </>
  );
}
