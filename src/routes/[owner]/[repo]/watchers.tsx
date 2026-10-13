import { Title } from '@solidjs/meta';
import InsightsLayout from '../../../features/insights/components/InsightsLayout';
import PeopleGrid from '../../../features/insights/components/PeopleGrid';
import { useRepo } from '../../../features/repo/context';

/** /:owner/:repo/watchers */
export default function WatchersPage() {
  const ctx = useRepo();
  return (
    <InsightsLayout>
      <Title>{`Watchers · ${ctx.fullName()}`}</Title>
      <PeopleGrid kind="watchers" />
    </InsightsLayout>
  );
}
