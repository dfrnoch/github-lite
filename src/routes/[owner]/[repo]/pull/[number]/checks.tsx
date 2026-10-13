import { useParams } from '@solidjs/router';
import PullChecks from '../../../../../features/actions/components/PullChecks';

/** /:owner/:repo/pull/:number/checks — rendered inside the pull request layout. */
export default function PullChecksPage() {
  const params = useParams<{ number: string }>();
  return <PullChecks number={params.number} />;
}
