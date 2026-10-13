import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createMemo } from 'solid-js';
import { resolveRefPath } from '../../../../features/repo/api';
import FileView from '../../../../features/repo/components/FileView';
import { useRepo } from '../../../../features/repo/context';

/** /:owner/:repo/blob/:ref/:path* — a single file. */
export default function BlobPage() {
  const ctx = useRepo();
  const params = useParams<{ path: string }>();
  const resolved = createMemo(() =>
    resolveRefPath(ctx.owner(), ctx.name(), params.path ?? '', ctx.repo().default_branch),
  );
  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`${ctx.fullName()}/${resolved().path} at ${resolved().ref}`}</Title>
      <FileView repo={ctx.repo()} gitRef={resolved().ref} path={resolved().path} />
    </div>
  );
}
