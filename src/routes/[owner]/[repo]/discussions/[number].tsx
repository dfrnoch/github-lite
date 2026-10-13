import { useParams } from '@solidjs/router';
import DiscussionView from '../../../../features/discussions/components/DiscussionView';

/** /:owner/:repo/discussions/:number */
export default function DiscussionPage() {
  const params = useParams<{ number: string }>();
  return <DiscussionView number={Number(params.number)} />;
}
