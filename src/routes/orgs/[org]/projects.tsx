import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { ProjectsList } from '../../../features/profile/components/LinkOutLists';

/** /orgs/:org/projects — the organization's projects (boards open on github.com). */
export default function OrgProjects() {
  const params = useParams<{ org: string }>();
  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`Projects · ${params.org}`}</Title>
      <ProjectsList login={params.org} isOrg />
    </div>
  );
}
