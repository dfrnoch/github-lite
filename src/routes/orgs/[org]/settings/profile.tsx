import { useParams } from '@solidjs/router';
import OrgProfileSettings from '../../../../features/orgs/manage/components/OrgProfileSettings';

/** /orgs/:org/settings/profile — General. */
export default function OrgSettingsProfile() {
  const params = useParams<{ org: string }>();
  return <OrgProfileSettings org={params.org} />;
}
