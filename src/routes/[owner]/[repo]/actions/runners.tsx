import { Title } from '@solidjs/meta';
import ActionsShell from '../../../../features/actions/components/ActionsShell';
import { RunnersView } from '../../../../features/actions/components/Management';
import { useRepo } from '../../../../features/repo/context';

/** /:owner/:repo/actions/runners */
export default function RunnersPage() {
  const ctx = useRepo();
  return (
    <ActionsShell active=":runners">
      <Title>{`Runners · ${ctx.fullName()}`}</Title>
      <RunnersView />
    </ActionsShell>
  );
}
