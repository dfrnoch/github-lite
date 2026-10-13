import { useLocation, useParams } from '@solidjs/router';
import type { ParentProps } from 'solid-js';
import { createMemo, Errored, Loading } from 'solid-js';
import { ErrorView, PageSpinner } from '../../components/ui';
import OrgTabs, { type OrgTab } from '../../features/orgs/components/OrgTabs';

function tabFor(section: string | undefined): OrgTab {
  switch (section) {
    case 'repositories':
    case 'projects':
    case 'packages':
    case 'teams':
    case 'settings':
      return section;
    case 'people':
    case 'outside-collaborators':
      return 'people';
    default:
      return 'overview';
  }
}

/** Layout for /orgs/:org/* — the organization tab bar above every org page. */
export default function OrgLayout(props: ParentProps) {
  const params = useParams<{ org: string }>();
  const location = useLocation();
  const active = createMemo(() => tabFor(location.pathname.split('/')[3]));
  return (
    <>
      <OrgTabs login={params.org} active={active()} />
      <Errored fallback={(err, reset) => <ErrorView error={err()} reset={reset} />}>
        <Loading fallback={<PageSpinner />}>{props.children}</Loading>
      </Errored>
    </>
  );
}
