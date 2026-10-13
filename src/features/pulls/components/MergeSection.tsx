import type { JSX } from '@solidjs/web';
import { createMemo, For, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { Spinner } from '../../../components/ui';
import { chevronDownIcon, chevronUpIcon, type OcticonData } from '../../../icons/octicons';

export type Tone = 'success' | 'danger' | 'attention' | 'neutral' | 'done' | 'closed';

/** Literal class names so UnoCSS sees them. */
export const TONE_BG: Record<Tone, string> = {
  success: 'bg-success-emphasis',
  danger: 'bg-danger-emphasis',
  attention: 'bg-attention-emphasis',
  neutral: 'bg-neutral-emphasis',
  done: 'bg-done-emphasis',
  closed: 'bg-closed-emphasis',
};

/** 32px filled circle with a white octicon (github.com's merge box section icons). */
export function StatusCircle(props: { icon: OcticonData; tone: Tone; spinner?: boolean }) {
  return (
    <Show when={!props.spinner} fallback={<span class="MergeBox-icon text-fg-muted"><Spinner size={24} /></span>}>
      <span class={['MergeBox-icon', TONE_BG[props.tone]]}>
        <Octicon icon={props.icon} />
      </span>
    </Show>
  );
}

export interface CheckCounts {
  success: number;
  failure: number;
  pending: number;
  neutral: number;
}

const RING: { key: keyof CheckCounts; color: string }[] = [
  { key: 'success', color: 'var(--fgColor-success)' },
  { key: 'neutral', color: 'var(--fgColor-muted)' },
  { key: 'pending', color: 'var(--fgColor-attention)' },
  { key: 'failure', color: 'var(--fgColor-danger)' },
];

/** Ring split into passed / skipped / pending / failed arcs (the checks section icon). */
export function ChecksDonut(props: { counts: CheckCounts; label: string }) {
  const R = 13;
  const C = 2 * Math.PI * R;
  const arcs = createMemo(
    () => {
      const counts = props.counts;
      const total = RING.reduce((n, r) => n + counts[r.key], 0);
      const parts = RING.filter((r) => counts[r.key] > 0);
      const gap = parts.length > 1 ? 2 : 0;
      let start = 0;
      return parts.map((r) => {
        const len = (counts[r.key] / Math.max(total, 1)) * C;
        const arc = { color: r.color, dash: `${Math.max(len - gap, 0.75)} ${C}`, offset: -start };
        start += len;
        return arc;
      });
    },
    { name: 'checksDonutArcs' },
  );
  return (
    <svg class="MergeBox-donut" width="32" height="32" viewBox="0 0 32 32" role="img" aria-label={props.label}>
      <circle cx="16" cy="16" r={R} fill="none" stroke="var(--borderColor-muted)" stroke-width="4" />
      <g transform="rotate(-90 16 16)">
        <For each={arcs()}>
          {(a) => <circle cx="16" cy="16" r={R} fill="none" stroke={a.color} stroke-width="4" stroke-dasharray={a.dash} stroke-dashoffset={a.offset} />}
        </For>
      </g>
    </svg>
  );
}

/**
 * One section of the merge box: icon, bold title, muted description, optional
 * action on the right and an optional expand chevron. `children` render below
 * the header (callers decide when — e.g. only while expanded).
 */
export function MergeSection(props: {
  icon: JSX.Element;
  title: JSX.Element;
  desc?: JSX.Element;
  action?: JSX.Element;
  /** Show a chevron toggle (aria-expanded reflects `expanded`). */
  onToggle?: () => void;
  expanded?: boolean;
  toggleLabel?: string;
  children?: JSX.Element;
  class?: string;
}) {
  return (
    <section class={['MergeBox-section', props.class]}>
      <div class="MergeBox-head">
        <span class="shrink-0 flex">{props.icon}</span>
        <div class="flex-1 min-w-0 self-center">
          <h3 class="MergeBox-title">{props.title}</h3>
          <Show when={props.desc}>
            <div class="MergeBox-desc">{props.desc}</div>
          </Show>
        </div>
        <Show when={props.action}>
          <div class="shrink-0 self-center flex items-center gap-2">{props.action}</div>
        </Show>
        <Show when={props.onToggle}>
          <button
            type="button"
            class="btn-octicon shrink-0 self-center"
            aria-expanded={props.expanded ? 'true' : 'false'}
            aria-label={props.toggleLabel ?? (props.expanded ? 'Collapse' : 'Expand')}
            title={props.toggleLabel ?? (props.expanded ? 'Collapse' : 'Expand')}
            onClick={() => props.onToggle?.()}
          >
            <Octicon icon={props.expanded ? chevronUpIcon : chevronDownIcon} />
          </button>
        </Show>
      </div>
      {props.children}
    </section>
  );
}
