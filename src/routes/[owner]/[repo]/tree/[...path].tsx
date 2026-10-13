import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createMemo } from 'solid-js';
import { resolveRefPath } from '../../../../features/repo/api';
import CodeLayout from '../../../../features/repo/components/CodeLayout';
import DirectoryView from '../../../../features/repo/components/DirectoryView';
import { useRepo } from '../../../../features/repo/context';

/** /:owner/:repo/tree/:ref/:path* — a directory at a branch, tag or commit. */
export default function TreePage() {
  const ctx = useRepo();
  const params = useParams<{ path: string }>();
  const resolved = createMemo(() =>
    resolveRefPath(ctx.owner(), ctx.name(), params.path ?? '', ctx.repo().default_branch),
  );
  return (
    <CodeLayout repo={ctx.repo()} gitRef={resolved().ref} path={resolved().path} isDir>
      <Title>{`${ctx.fullName()}${resolved().path ? `/${resolved().path}` : ''} at ${resolved().ref}`}</Title>
      <DirectoryView repo={ctx.repo()} gitRef={resolved().ref} path={resolved().path} />
    </CodeLayout>
  );
}
