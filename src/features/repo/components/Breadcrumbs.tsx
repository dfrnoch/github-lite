import { For } from 'solid-js';
import CopyButton from '../../../components/ui/CopyButton';
import { encodePath } from '../../../lib/github';

/** "repo / src / components / File.tsx" path crumbs with a copy-path button. */
export default function Breadcrumbs(props: { owner: string; repo: string; gitRef: string; path: string; isFile?: boolean }) {
  const parts = () => props.path.split('/').filter(Boolean);
  const base = () => `/${props.owner}/${props.repo}`;
  return (
    <h2 class="flex flex-wrap items-center text-base min-w-0 break-all">
      <a class="font-semibold" href={`${base()}/tree/${encodePath(props.gitRef)}`}>
        {props.repo}
      </a>
      <For each={parts()}>
        {(part, i) => (
          <>
            <span class="px-1 text-fg-muted">/</span>
            {i() === parts().length - 1 ? (
              <strong class="font-semibold">{part}</strong>
            ) : (
              <a href={`${base()}/tree/${encodePath(props.gitRef)}/${encodePath(parts().slice(0, i() + 1).join('/'))}`}>{part}</a>
            )}
          </>
        )}
      </For>
      <span class="ml-1">
        <CopyButton value={props.path} label="Copy path" class="btn-octicon w-7 h-7" />
      </span>
    </h2>
  );
}
