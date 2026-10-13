import { useNavigate, useParams } from '@solidjs/router';
import { untrack } from 'solid-js';

/** github.com's org settings live at /organizations/:org/settings/* — map them onto /orgs/:org/settings/*. */
export default function OrganizationSettingsRedirect() {
  const params = useParams<{ org: string; rest?: string }>();
  const { org, rest } = untrack(() => ({ org: params.org, rest: params.rest }));
  useNavigate()(`/orgs/${org}/settings/${rest || 'profile'}`, { replace: true });
  return null;
}
