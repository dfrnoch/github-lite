import { Title } from '@solidjs/meta';
import NewDiscussion from '../../../../features/discussions/components/NewDiscussion';
import { useRepo } from '../../../../features/repo/context';

/** /:owner/:repo/discussions/new(?category=slug) */
export default function NewDiscussionPage() {
  const ctx = useRepo();
  return (
    <>
      <Title>{`New discussion · ${ctx.fullName()}`}</Title>
      <NewDiscussion />
    </>
  );
}
