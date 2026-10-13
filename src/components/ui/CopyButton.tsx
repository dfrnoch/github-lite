import { createSignal } from 'solid-js';
import { checkIcon, copyIcon } from '../../icons/octicons';
import Octicon from '../Octicon';

export default function CopyButton(props: { value: string; class?: string; label?: string }) {
  const [copied, setCopied] = createSignal(false);
  return (
    <button
      type="button"
      class={props.class ?? 'btn-octicon'}
      aria-label={props.label ?? 'Copy to clipboard'}
      title={copied() ? 'Copied!' : (props.label ?? 'Copy to clipboard')}
      onClick={async () => {
        await navigator.clipboard.writeText(props.value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <Octicon icon={copied() ? checkIcon : copyIcon} class={copied() ? 'text-fg-success' : undefined} />
    </button>
  );
}
