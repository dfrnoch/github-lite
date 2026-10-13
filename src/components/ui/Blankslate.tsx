import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import type { OcticonData } from '../../icons/octicons';
import Octicon from '../Octicon';

export default function Blankslate(props: {
  icon?: OcticonData;
  title: JSX.Element;
  children?: JSX.Element;
  action?: JSX.Element;
  class?: string;
}) {
  return (
    <div class={['blankslate', props.class]}>
      <Show when={props.icon}>{(icon) => <Octicon icon={icon()} size={24} class="blankslate-icon" />}</Show>
      <h3>{props.title}</h3>
      <Show when={props.children}>
        <p class="mt-1">{props.children}</p>
      </Show>
      <Show when={props.action}>
        <div class="mt-4">{props.action}</div>
      </Show>
    </div>
  );
}
