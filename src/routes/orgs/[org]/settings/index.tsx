import { useNavigate, useParams } from '@solidjs/router';
import { untrack } from 'solid-js';

/** /orgs/:org/settings → /orgs/:org/settings/profile (github.com does the same). */
export default function OrgSettingsIndex() {
  const params = useParams<{ org: string }>();
  useNavigate()(`/orgs/${untrack(() => params.org)}/settings/profile`, { replace: true });
  return null;
}
