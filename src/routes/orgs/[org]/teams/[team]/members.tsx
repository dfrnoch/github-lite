import { useParams } from '@solidjs/router';
import TeamMembers from '../../../../../features/orgs/manage/components/TeamMembers';

/** /orgs/:org/teams/:team/members */
export default function TeamMembersRoute() {
  const params = useParams<{ org: string; team: string }>();
  return <TeamMembers org={params.org} slug={params.team} />;
}
