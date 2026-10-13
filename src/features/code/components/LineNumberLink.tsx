import { Show } from 'solid-js';
import { diffAnchor } from '../../diff/parse';

/**
 * A line number in a review-comment snippet that links
 * to that line in the PR's "Files changed" tab (`#diff-<sha256(path)>R12`).
 * Plain text when the file is unknown.
 */
export default function LineNumberLink(props: { n?: number; side: 'L' | 'R'; path?: string; filesHref?: string }) {
  return (
    <Show when={props.n != null}>
      <Show when={props.path && props.filesHref} fallback={props.n}>
        <a class="link-plain rgh-linkify-line-numbers" href={`${props.filesHref}#${diffAnchor(props.path!)}${props.side}${props.n}`}>
          {props.n}
        </a>
      </Show>
    </Show>
  );
}
