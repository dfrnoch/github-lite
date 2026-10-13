import { useNavigate, useParams } from '@solidjs/router';
import { untrack } from 'solid-js';

/** /orgs/:org → /:org (github.com redirects the same way). */
export default function OrgIndexRedirect() {
  const params = useParams<{ org: string }>();
  useNavigate()(`/${untrack(() => params.org)}`, { replace: true });
  return null;
}
