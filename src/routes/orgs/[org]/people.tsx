import { useParams } from '@solidjs/router';
import type { ParentProps } from 'solid-js';
import PeopleShell from '../../../features/orgs/manage/components/PeopleShell';

/** Layout for /orgs/:org/people/* — "Organization permissions" menu + content. */
export default function PeopleLayout(props: ParentProps) {
  const params = useParams<{ org: string }>();
  return <PeopleShell org={params.org}>{props.children}</PeopleShell>;
}
