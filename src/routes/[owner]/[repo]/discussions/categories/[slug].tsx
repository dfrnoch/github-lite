import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import DiscussionsIndex from '../../../../../features/discussions/components/DiscussionsIndex';
import { useRepo } from '../../../../../features/repo/context';

/** /:owner/:repo/discussions/categories/:slug */
export default function DiscussionCategoryPage() {
  const ctx = useRepo();
  const params = useParams<{ slug: string }>();
  return (
    <>
      <Title>{`${params.slug} · Discussions · ${ctx.fullName()}`}</Title>
      <DiscussionsIndex categorySlug={params.slug} />
    </>
  );
}
