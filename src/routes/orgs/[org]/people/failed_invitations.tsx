import { useParams } from '@solidjs/router';
import InvitationsPage from '../../../../features/orgs/manage/components/InvitationsPage';

/** /orgs/:org/people/failed_invitations */
export default function OrgFailedInvitations() {
  const params = useParams<{ org: string }>();
  return <InvitationsPage org={params.org} which="failed" />;
}
