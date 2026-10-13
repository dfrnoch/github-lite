import { For } from 'solid-js';
import { fragmentParts, highlightParts } from '../query';

/** Text with the query's free-text terms in bold, like github.com search results. */
export function Highlight(props: { text: string | null | undefined; terms: string[] }) {
  return (
    <For each={highlightParts(props.text ?? '', props.terms)}>
      {(part) => (part.match ? <strong class="font-semibold">{part.text}</strong> : part.text)}
    </For>
  );
}

/** A text-match fragment with the API-reported matches marked. */
export function Fragment(props: { fragment: string; matches: { indices: [number, number] }[]; mark?: boolean }) {
  return (
    <For each={fragmentParts(props.fragment, props.matches)}>
      {(part) =>
        part.match ? (
          props.mark ? (
            <mark class="bg-attention-muted text-fg rounded-sm">{part.text}</mark>
          ) : (
            <strong class="font-semibold">{part.text}</strong>
          )
        ) : (
          part.text
        )
      }
    </For>
  );
}
