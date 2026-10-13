import { useParams } from '@solidjs/router';
import MembersPage from '../../../../features/orgs/manage/components/MembersPage';

/** /orgs/:org/people — organization members. */
export default function OrgPeople() {
  const params = useParams<{ org: string }>();
  return <MembersPage org={params.org} />;
}
