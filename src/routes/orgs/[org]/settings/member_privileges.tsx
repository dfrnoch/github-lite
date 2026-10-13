import { useParams } from '@solidjs/router';
import MemberPrivileges from '../../../../features/orgs/manage/components/MemberPrivileges';

/** /orgs/:org/settings/member_privileges */
export default function OrgSettingsMemberPrivileges() {
  const params = useParams<{ org: string }>();
  return <MemberPrivileges org={params.org} />;
}
