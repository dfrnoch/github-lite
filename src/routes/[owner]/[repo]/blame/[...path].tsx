import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createMemo } from 'solid-js';
import BlameView from '../../../../features/code/components/BlameView';
import { resolveRefPath } from '../../../../features/repo/api';
import CodeLayout from '../../../../features/repo/components/CodeLayout';
import { useRepo } from '../../../../features/repo/context';

/** /:owner/:repo/blame/:ref/:path* — line-by-line history of a file. */
export default function BlamePage() {
  const ctx = useRepo();
  const params = useParams<{ path: string }>();
  const resolved = createMemo(() => resolveRefPath(ctx.owner(), ctx.name(), params.path ?? '', ctx.repo().default_branch));
  return (
    <CodeLayout repo={ctx.repo()} gitRef={resolved().ref} path={resolved().path}>
      <Title>{`Blaming ${ctx.fullName()}/${resolved().path} at ${resolved().ref}`}</Title>
      <BlameView repo={ctx.repo()} gitRef={resolved().ref} path={resolved().path} />
    </CodeLayout>
  );
}
