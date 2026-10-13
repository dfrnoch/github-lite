import { useParams } from '@solidjs/router';
import TeamsPage from '../../../../features/orgs/manage/components/TeamsPage';

/** /orgs/:org/teams — the organization's teams. */
export default function OrgTeams() {
  const params = useParams<{ org: string }>();
  return <TeamsPage org={params.org} />;
}
