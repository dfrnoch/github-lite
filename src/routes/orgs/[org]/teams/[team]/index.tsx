import { useParams } from '@solidjs/router';
import TeamOverview from '../../../../../features/orgs/manage/components/TeamOverview';

/** /orgs/:org/teams/:team */
export default function TeamIndex() {
  const params = useParams<{ org: string; team: string }>();
  return <TeamOverview org={params.org} slug={params.team} />;
}
