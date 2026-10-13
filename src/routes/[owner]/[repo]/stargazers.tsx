import { Title } from '@solidjs/meta';
import InsightsLayout from '../../../features/insights/components/InsightsLayout';
import PeopleGrid from '../../../features/insights/components/PeopleGrid';
import { useRepo } from '../../../features/repo/context';

/** /:owner/:repo/stargazers */
export default function StargazersPage() {
  const ctx = useRepo();
  return (
    <InsightsLayout>
      <Title>{`Stargazers · ${ctx.fullName()}`}</Title>
      <PeopleGrid kind="stargazers" />
    </InsightsLayout>
  );
}
