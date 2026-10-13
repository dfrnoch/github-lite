import { Title } from '@solidjs/meta';
import { useParams } from '@solidjs/router';
import { createMemo } from 'solid-js';
import FileEditor from '../../../../features/code/components/FileEditor';
import { resolveRefPath } from '../../../../features/repo/api';
import { useRepo } from '../../../../features/repo/context';

/** /:owner/:repo/new/:ref/:dir* — create a new file (`?filename=` / `?value=` prefill like github.com). */
export default function NewFilePage() {
  const ctx = useRepo();
  const params = useParams<{ path: string }>();
  const resolved = createMemo(() => resolveRefPath(ctx.owner(), ctx.name(), params.path ?? '', ctx.repo().default_branch));
  return (
    <div class="container-xl px-4 md:px-6 lg:px-8 py-6">
      <Title>{`New File at ${resolved().path || '/'} · ${ctx.fullName()}`}</Title>
      <FileEditor repo={ctx.repo()} gitRef={resolved().ref} path={resolved().path} mode="new" />
    </div>
  );
}
