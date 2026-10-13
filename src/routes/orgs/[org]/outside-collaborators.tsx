import { useParams } from '@solidjs/router';
import OutsideCollaboratorsPage from '../../../features/orgs/manage/components/OutsideCollaboratorsPage';
import PeopleShell from '../../../features/orgs/manage/components/PeopleShell';

/** /orgs/:org/outside-collaborators — shares the People sub-navigation. */
export default function OrgOutsideCollaborators() {
  const params = useParams<{ org: string }>();
  return (
    <PeopleShell org={params.org}>
      <OutsideCollaboratorsPage org={params.org} />
    </PeopleShell>
  );
}
