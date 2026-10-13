import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { PackagesList } from '../../../features/profile/components/LinkOutLists';

/** /orgs/:org/packages — packages published by the organization. */
export default function OrgPackages() {
  const params = useParams<{ org: string }>();
  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`Packages · ${params.org}`}</Title>
      <PackagesList login={params.org} isOrg />
    </div>
  );
}
