import { Title } from '@solidjs/meta';
import ActionsShell from '../../../../features/actions/components/ActionsShell';
import { CachesView } from '../../../../features/actions/components/Management';
import { useRepo } from '../../../../features/repo/context';

/** /:owner/:repo/actions/caches */
export default function CachesPage() {
  const ctx = useRepo();
  return (
    <ActionsShell active=":caches">
      <Title>{`Caches · ${ctx.fullName()}`}</Title>
      <CachesView />
    </ActionsShell>
  );
}
