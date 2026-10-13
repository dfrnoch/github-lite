import { useParams } from '@solidjs/router';
import TeamRepos from '../../../../../features/orgs/manage/components/TeamRepos';

/** /orgs/:org/teams/:team/repositories */
export default function TeamReposRoute() {
  const params = useParams<{ org: string; team: string }>();
  return <TeamRepos org={params.org} slug={params.team} />;
}
