import type { JSX } from '@solidjs/web';
import { For } from 'solid-js';
import type { OcticonData } from '../icons/octicons';

/**
 * Renders a Primer Octicon. Icons are imported individually from
 * src/icons/octicons.ts (e.g. `import { repoIcon } from '../icons/octicons'`)
 * so only the ones used end up in the bundle.
 *
 *   <Octicon icon={repoIcon} />            16px
 *   <Octicon icon={repoIcon} size={24} />  uses the 24px design when available
 */
export default function Octicon(props: {
  icon: OcticonData;
  size?: number;
  class?: JSX.SvgSVGAttributes<SVGSVGElement>['class'];
  'aria-label'?: string;
}) {
  const design = () => {
    const size = props.size ?? 16;
    const sizes = props.icon.sizes;
    // Prefer the 24px drawing at 24+; otherwise the 16px one.
    return (size >= 24 && sizes[24]) || sizes[16] || sizes[24]!;
  };
  const height = () => props.size ?? 16;
  const designHeight = () => (design() === props.icon.sizes[24] ? 24 : 16);
  const width = () => (design().width * height()) / designHeight();
  return (
    <svg
      class={['octicon', props.class]}
      width={width()}
      height={height()}
      viewBox={`0 0 ${design().width} ${designHeight()}`}
      role={props['aria-label'] ? 'img' : undefined}
      aria-label={props['aria-label']}
      aria-hidden={props['aria-label'] ? undefined : 'true'}
    >
      <For each={design().d}>{(d) => <path d={d} />}</For>
    </svg>
  );
}
