import { Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Markdown } from '../../../components/ui';
import type { RepoFileContext } from '../../../lib/markdown';
import { bookIcon, pencilIcon } from '../../../icons/octicons';

/** The README panel under the file list. */
export default function ReadmeBox(props: { html: string; editHref?: string; title?: string; file?: RepoFileContext }) {
  return (
    <div class="Box mt-4" id="readme">
      <div class="flex items-center gap-2 px-4 py-2 border-b border-line-muted sticky top-0 bg-canvas rounded-t-md z-1">
        <span class="flex items-center gap-2 py-1 font-semibold text-sm border-b-2 border-[var(--underlineNav-borderColor-active)] -mb-[9px] pb-2">
          <Octicon icon={bookIcon} class="text-fg-muted" />
          {props.title ?? 'README'}
        </span>
        <span class="flex-1" />
        <Show when={props.editHref}>
          <a class="btn-octicon" href={props.editHref} aria-label="Edit file">
            <Octicon icon={pencilIcon} />
          </a>
        </Show>
      </div>
      <div class="p-6 md:p-8">
        <Markdown html={props.html} file={props.file} />
      </div>
    </div>
  );
}
