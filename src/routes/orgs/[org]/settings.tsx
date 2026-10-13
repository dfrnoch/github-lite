import { useParams } from '@solidjs/router';
import type { ParentProps } from 'solid-js';
import OrgSettingsShell from '../../../features/orgs/manage/components/OrgSettingsShell';

/** Layout for /orgs/:org/settings/* — org header + settings navigation. */
export default function OrgSettingsLayout(props: ParentProps) {
  const params = useParams<{ org: string }>();
  return <OrgSettingsShell org={params.org}>{props.children}</OrgSettingsShell>;
}
