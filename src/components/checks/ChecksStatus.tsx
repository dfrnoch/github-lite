import { createMemo, createSignal, For, Loading, Match, Show, Switch } from 'solid-js';
import { checkIcon, dotFillIcon, skipIcon, xIcon } from '../../icons/octicons';
import { toAppUrl } from '../../lib/markdown';
import Octicon from '../Octicon';
import Avatar from '../ui/Avatar';
import Popover from '../ui/Popover';
import Spinner from '../ui/Spinner';
import {
  type CheckOutcome,
  contextDescription,
  contextName,
  contextOutcome,
  getCommitRollup,
  type RollupContext,
  rollupLook,
  rollupSummary,
} from './api';

/** ✓ / ✗ / ● glyph for a rollup state (SUCCESS / FAILURE|ERROR / anything else). */
export function RollupGlyph(props: { state: string | null | undefined; class?: string }) {
  return (
    <Switch>
      <Match when={props.state === 'SUCCESS'}>
        <Octicon icon={checkIcon} class={['text-fg-success', props.class]} />
      </Match>
      <Match when={props.state === 'FAILURE' || props.state === 'ERROR'}>
        <Octicon icon={xIcon} class={['text-fg-danger', props.class]} />
      </Match>
      <Match when={true}>
        <Octicon icon={dotFillIcon} class={['text-fg-attention', props.class]} />
      </Match>
    </Switch>
  );
}

/** Per-check icon in the popover rows. */
export function OutcomeIcon(props: { outcome: CheckOutcome }) {
  return (
    <Switch>
      <Match when={props.outcome === 'success'}>
        <Octicon icon={checkIcon} class="text-fg-success" aria-label="Successful" />
      </Match>
      <Match when={props.outcome === 'failure'}>
        <Octicon icon={xIcon} class="text-fg-danger" aria-label="Failing" />
      </Match>
      <Match when={props.outcome === 'neutral'}>
        <Octicon icon={skipIcon} class="text-fg-muted" aria-label="Skipped or cancelled" />
      </Match>
      <Match when={props.outcome === 'pending'}>
        <Octicon icon={dotFillIcon} class="text-fg-attention" aria-label="Pending" />
      </Match>
    </Switch>
  );
}

export interface ChecksStatusProps {
  owner: string;
  repo: string;
  /** The commit whose checks to list… */
  sha?: string;
  /** …or a pull request (its head commit). */
  pull?: number;
  /** Combined state (statusCheckRollup.state); nothing renders without one. */
  state: string | null | undefined;
  /** Show "passed / total" after the icon (commit lists). */
  passed?: number;
  total?: number;
  class?: string;
}

/**
 * A commit's combined check status — the ✓ / ✗ / ● (optionally "3 / 4")
 * button of github.com's commit rows. Clicking opens a popover listing every
 * check run and status, fetched on open.
 */
export default function ChecksStatus(props: ChecksStatusProps) {
  const [open, setOpen] = createSignal(false);
  let button: HTMLButtonElement | undefined;
  const look = () => rollupLook(props.state);
  return (
    <Show when={props.state}>
      <button
        ref={button}
        type="button"
        class={[
          'inline-flex items-center gap-1 align-middle p-0 border-0 bg-transparent cursor-pointer text-fg-muted hover:text-fg-accent text-xs leading-none',
          props.class,
        ]}
        title={look().title}
        aria-label={look().title}
        aria-haspopup="dialog"
        aria-expanded={open() ? 'true' : 'false'}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open());
        }}
      >
        <RollupGlyph state={props.state} />
        <Show when={props.total}>
          <span class="whitespace-nowrap">
            {props.passed ?? 0} / {props.total}
          </span>
        </Show>
      </button>
      <Popover
        anchor={button}
        open={open()}
        onClose={() => setOpen(false)}
        class="w-[440px] max-w-[calc(100vw-16px)]"
        aria-label="Checks"
        focus
      >
        <ChecksPanel owner={props.owner} repo={props.repo} sha={props.sha} pull={props.pull} onClose={() => setOpen(false)} />
      </Popover>
    </Show>
  );
}

const RANK: Record<CheckOutcome, number> = { failure: 0, pending: 1, success: 2, neutral: 3 };

/** Popover body: colored title, "N pending and M successful checks", one row per check. */
export function ChecksPanel(props: { owner: string; repo: string; sha?: string; pull?: number; onClose?: () => void }) {
  const rollup = createMemo(() =>
    getCommitRollup(props.owner, props.repo, props.sha ? { sha: props.sha } : { pull: props.pull }),
  );
  const sorted = createMemo(() =>
    [...(rollup()?.contexts ?? [])].sort((a, b) => RANK[contextOutcome(a)] - RANK[contextOutcome(b)]),
  );
  return (
    <Loading
      fallback={
        <div class="flex justify-center p-6 text-fg-muted">
          <Spinner size={24} />
        </div>
      }
    >
      <Show when={rollup()} fallback={<div class="p-4 text-sm text-fg-muted">No checks for this commit.</div>}>
        {(r) => (
          <>
            <div class="flex items-start gap-2 pl-4 pr-2 py-3 border-b border-line">
              <div class="flex-1 min-w-0">
                <div class={['font-semibold text-sm', rollupLook(r().state).class]}>{rollupLook(r().state).title}</div>
                <div class="text-xs text-fg-muted mt-0.5">{rollupSummary(r().contexts)}</div>
              </div>
              <Show when={props.onClose}>
                <button type="button" class="btn-octicon w-7 h-7 -mt-1" aria-label="Close" onClick={() => props.onClose?.()}>
                  <Octicon icon={xIcon} />
                </button>
              </Show>
            </div>
            <ul class="max-h-[360px] overflow-auto py-1">
              <For each={sorted()}>{(c) => <CheckRow check={c} onNavigate={() => props.onClose?.()} />}</For>
            </ul>
          </>
        )}
      </Show>
    </Loading>
  );
}

function CheckRow(props: { check: RollupContext; onNavigate: () => void }) {
  const url = () => props.check.detailsUrl ?? props.check.targetUrl ?? null;
  const appUrl = () => (url() ? toAppUrl(url()!) : null);
  const external = () => !!appUrl() && /^https?:/.test(appUrl()!);
  const avatar = () => props.check.checkSuite?.app?.logoUrl ?? props.check.avatarUrl ?? null;
  const desc = () => contextDescription(props.check);
  return (
    <li class="flex items-center gap-2 px-4 py-1.5 text-xs">
      <span class="flex shrink-0">
        <OutcomeIcon outcome={contextOutcome(props.check)} />
      </span>
      <Show when={avatar()} fallback={<span class="w-5 h-5 shrink-0 rounded-md bg-canvas-muted" />}>
        {(src) => <Avatar src={src()} size={20} square class="shrink-0" />}
      </Show>
      <span class="flex-1 min-w-0 truncate" title={`${contextName(props.check)} — ${desc()}`}>
        <strong class="text-fg">{contextName(props.check)}</strong> <em class="text-fg-muted">{desc()}</em>
      </span>
      <Show when={appUrl()}>
        {(href) => (
          <a
            class="shrink-0 font-semibold"
            href={href()}
            target={external() ? '_blank' : undefined}
            rel={external() ? 'noreferrer' : undefined}
            onClick={() => props.onNavigate()}
          >
            Details
          </a>
        )}
      </Show>
    </li>
  );
}
