import type { JSX } from '@solidjs/web';

export function hexToVars(hex: string): JSX.CSSProperties {
  const h = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let hue = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hue = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
    hue *= 60;
  }
  return {
    '--label-r': String(r),
    '--label-g': String(g),
    '--label-b': String(b),
    '--label-h': String(Math.round(hue)),
    '--label-s': String(Math.round(s * 100)),
    '--label-l': String(Math.round(l * 100)),
  };
}

/** An issue/PR label token, colored like GitHub (see .IssueLabel in primer.css). */
export default function IssueLabel(props: { name: string; color: string; href?: string; title?: string | null; class?: string }) {
  return (
    <a
      class={['IssueLabel', props.class]}
      style={hexToVars(props.color)}
      href={props.href}
      title={props.title ?? props.name}
    >
      {props.name}
    </a>
  );
}
