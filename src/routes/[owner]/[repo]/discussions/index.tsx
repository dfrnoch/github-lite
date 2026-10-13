import { Title } from '@solidjs/meta';
import DiscussionsIndex from '../../../../features/discussions/components/DiscussionsIndex';
import { useRepo } from '../../../../features/repo/context';

/** /:owner/:repo/discussions */
export default function DiscussionsPage() {
  const ctx = useRepo();
  return (
    <>
      <Title>{`Discussions · ${ctx.fullName()}`}</Title>
      <DiscussionsIndex categorySlug="" />
    </>
  );
}
