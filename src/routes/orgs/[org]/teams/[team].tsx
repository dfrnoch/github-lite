import { useParams } from '@solidjs/router';
import type { ParentProps } from 'solid-js';
import TeamShell from '../../../../features/orgs/manage/components/TeamShell';

/** Layout for /orgs/:org/teams/:team/* — team header + tabs. */
export default function TeamLayout(props: ParentProps) {
  const params = useParams<{ org: string; team: string }>();
  return (
    <TeamShell org={params.org} slug={params.team}>
      {props.children}
    </TeamShell>
  );
}
