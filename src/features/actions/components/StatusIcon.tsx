import { Match, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import {
  alertIcon,
  checkCircleFillIcon,
  dotFillIcon,
  skipIcon,
  squareFillIcon,
  stopIcon,
  xCircleFillIcon,
} from '../../../icons/octicons';
import { type RunState, runState, stateLabel } from '../status';

/** GitHub's in-progress indicator: an amber ring with a spinning arc. */
function ProgressIcon(props: { size: number; class?: string; label: string }) {
  return (
    <svg
      class={['octicon text-fg-attention!', props.class]}
      width={props.size}
      height={props.size}
      viewBox="0 0 16 16"
      fill="none"
      role="img"
      aria-label={props.label}
    >
      {/* `.octicon` sets fill: currentColor, so the rings opt out inline. */}
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-opacity="0.35" stroke-width="2" style={{ fill: 'none' }} />
      <path
        class="anim-rotate"
        style={{ fill: 'none', 'transform-origin': '8px 8px' }}
        d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}

/** Status icon for a workflow run, job, step or check run. */
export default function StatusIcon(props: {
  status?: string | null;
  conclusion?: string | null;
  /** Precomputed state (wins over status/conclusion). */
  state?: RunState;
  size?: number;
  class?: string;
}) {
  const state = () => props.state ?? runState(props.status, props.conclusion);
  const size = () => props.size ?? 16;
  const label = () => stateLabel(state());
  // Octicon takes a plain class string; `!` beats container rules like `.NavList-item .octicon`.
  const iconClass = (color: string) => `${color}! shrink-0 ${props.class ?? ''}`;
  const Icon = (p: { icon: typeof checkCircleFillIcon; color: string }) => (
    <Octicon icon={p.icon} size={size()} class={iconClass(p.color)} aria-label={label()} />
  );
  return (
    <Switch fallback={<Icon icon={squareFillIcon} color="text-fg-muted" />}>
      <Match when={state() === 'success'}>
        <Icon icon={checkCircleFillIcon} color="text-fg-success" />
      </Match>
      <Match when={state() === 'failure' || state() === 'timed_out' || state() === 'startup_failure'}>
        <Icon icon={xCircleFillIcon} color="text-fg-danger" />
      </Match>
      <Match when={state() === 'cancelled'}>
        <Icon icon={stopIcon} color="text-fg-muted" />
      </Match>
      <Match when={state() === 'skipped'}>
        <Icon icon={skipIcon} color="text-fg-muted" />
      </Match>
      <Match when={state() === 'action_required'}>
        <Icon icon={alertIcon} color="text-fg-attention" />
      </Match>
      <Match when={state() === 'in_progress'}>
        <ProgressIcon size={size()} class={iconClass('text-fg-attention')} label={label()} />
      </Match>
      <Match when={state() === 'queued' || state() === 'waiting'}>
        <Icon icon={dotFillIcon} color="text-fg-attention" />
      </Match>
    </Switch>
  );
}
