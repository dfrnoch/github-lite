import { useParams } from '@solidjs/router';
import InvitationsPage from '../../../../features/orgs/manage/components/InvitationsPage';

/** /orgs/:org/people/pending_invitations */
export default function OrgPendingInvitations() {
  const params = useParams<{ org: string }>();
  return <InvitationsPage org={params.org} which="pending" />;
}
