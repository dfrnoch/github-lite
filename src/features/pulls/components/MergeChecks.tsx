import { useAction } from '@solidjs/router';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { OutcomeIcon } from '../../../components/checks/ChecksStatus';
import { type CheckOutcome, contextDescription, contextOutcome, type RollupContext } from '../../../components/checks/api';
import Octicon from '../../../components/Octicon';
import { Avatar, Popover, toast, toastError } from '../../../components/ui';
import { copyIcon, kebabHorizontalIcon, linkExternalIcon, syncIcon } from '../../../icons/octicons';
import { toAppUrl } from '../../../lib/markdown';
import { rerunJob } from '../../actions/api';
import type { CheckContext, PullDetail } from '../../issues/types';
import { type CheckCounts, ChecksDonut, MergeSection } from './MergeSection';

// The rollup helpers only read fields both shapes share.
const asRollup = (c: CheckContext) => c as unknown as RollupContext;
export const checkOutcome = (c: CheckContext): CheckOutcome => contextOutcome(asRollup(c));

/** "native-client / native (macos-latest) (pull_request)" for Actions jobs, else the check / status name. */
function checkName(c: CheckContext) {
  if (c.__typename === 'StatusContext') return c.context ?? '';
  const run = c.checkSuite?.workflowRun;
  if (!run) return c.name ?? '';
  return `${run.workflow.name} / ${c.name}${run.event ? ` (${run.event})` : ''}`;
}

/** Actions job id from a check run's details URL (…/actions/runs/1/job/2). */
const jobId = (c: CheckContext) => {
  const m = c.detailsUrl?.match(/\/actions\/runs\/\d+\/job\/(\d+)/);
  return m ? Number(m[1]) : null;
};

/** "1 failing, 2 in progress, 20 successful checks". */
function summary(n: CheckCounts, total: number) {
  const parts = [
    n.failure && `${n.failure} failing`,
    n.pending && `${n.pending} in progress`,
    n.neutral && `${n.neutral} skipped`,
    n.success && `${n.success} successful`,
  ].filter(Boolean);
  return `${parts.join(', ') || 'No'} check${total === 1 ? '' : 's'}`;
}

const RANK: Record<CheckOutcome, number> = { failure: 0, pending: 1, success: 2, neutral: 2 };

/** Checks section: donut, status title, summary, chevron; expands to a scrolling list of checks. */
export default function MergeChecks(props: { pull: PullDetail; owner: string; repo: string; conflicting: boolean; canPush: boolean }) {
  const rollup = () => props.pull.commits.nodes[0]?.commit.statusCheckRollup ?? null;
  const contexts = () => rollup()?.contexts.nodes ?? [];
  const [open, setOpen] = createSignal(() => rollup()?.state !== 'SUCCESS');
  const counts = createMemo(
    () => {
      const c: CheckCounts = { success: 0, failure: 0, neutral: 0, pending: 0 };
      for (const ctx of contexts()) c[checkOutcome(ctx)]++;
      return c;
    },
    { name: 'mergeChecksCounts' },
  );
  // Failing first, then running, then the rest (stable within each group); passing checks are dimmed
  // while something fails or is still running (hover the list to undim).
  const shown = createMemo(() => [...contexts()].sort((a, b) => RANK[checkOutcome(a)] - RANK[checkOutcome(b)]), {
    name: 'mergeChecksShown',
  });
  const dim = () => counts().failure > 0 || counts().pending > 0;
  const title = () => {
    if (props.conflicting) return 'Checks awaiting conflict resolution';
    switch (rollup()?.state) {
      case 'SUCCESS':
        return 'All checks have passed';
      case 'FAILURE':
      case 'ERROR':
        return 'Some checks were not successful';
      default:
        return 'Some checks haven’t completed yet';
    }
  };

  // One shared "…" menu for every row (portalled, so the scrolling list doesn't clip it).
  const [menu, setMenu] = createSignal<{ anchor: HTMLElement; check: CheckContext } | null>(null);
  const rerun = useAction(rerunJob);

  return (
    <Show when={rollup() && contexts().length > 0}>
      <MergeSection
        icon={<ChecksDonut counts={counts()} label={title()} />}
        title={title()}
        desc={summary(counts(), contexts().length)}
        expanded={open()}
        onToggle={() => setOpen(!open())}
        toggleLabel={open() ? 'Collapse checks' : 'Expand checks'}
      >
        <Show when={open()}>
          <ul class={['MergeBox-checks rgh-checks-list', { 'rgh-checks-dim': dim() }]} aria-label="Checks">
            <For each={shown()}>
              {(c) => (
                <li class={['MergeBox-check', { 'rgh-check-done': ['success', 'neutral'].includes(checkOutcome(c)) }]}>
                  <span class="flex shrink-0">
                    <OutcomeIcon outcome={checkOutcome(c)} />
                  </span>
                  <span class="MergeBox-app">
                    <Show when={c.checkSuite?.app?.logoUrl ?? c.avatarUrl}>{(src) => <Avatar src={src()} size={20} square />}</Show>
                  </span>
                  <span class="min-w-0 flex-1 break-words" title={`${checkName(c)} — ${contextDescription(asRollup(c))}`}>
                    <strong class="text-fg">{checkName(c)}</strong> <span class="text-fg-muted">{contextDescription(asRollup(c))}</span>
                  </span>
                  <Show when={c.isRequired}>
                    <span class="Label shrink-0">Required</span>
                  </Show>
                  <button
                    type="button"
                    class="btn-octicon w-7! h-7! shrink-0"
                    aria-label={`More actions for ${checkName(c)}`}
                    aria-haspopup="menu"
                    aria-expanded={menu()?.check === c ? 'true' : 'false'}
                    onClick={(e) => {
                      const anchor = e.currentTarget;
                      setMenu(menu()?.anchor === anchor ? null : { anchor, check: c });
                    }}
                  >
                    <Octicon icon={kebabHorizontalIcon} />
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </MergeSection>
      <Popover
        anchor={menu()?.anchor}
        open={!!menu()}
        onClose={() => setMenu(null)}
        caret={false}
        align="end"
        role="menu"
        aria-label="Check actions"
        class="py-2 w-48"
      >
        <Show when={menu()?.check}>
          {(check) => <CheckMenu check={check()} owner={props.owner} repo={props.repo} canPush={props.canPush} onDone={() => setMenu(null)} rerun={rerun} />}
        </Show>
      </Popover>
    </Show>
  );
}

function CheckMenu(props: {
  check: CheckContext;
  owner: string;
  repo: string;
  canPush: boolean;
  onDone: () => void;
  rerun: (owner: string, repo: string, jobId: number, debug: boolean) => Promise<unknown>;
}) {
  const url = () => props.check.detailsUrl ?? props.check.targetUrl ?? null;
  const href = () => (url() ? toAppUrl(url()!) : null);
  const external = () => !!href() && /^https?:/.test(href()!);
  const job = () => (props.check.__typename === 'CheckRun' && props.check.status === 'COMPLETED' ? jobId(props.check) : null);
  return (
    <>
      <Show when={href()}>
        {(h) => (
          <a
            class="SelectMenu-item no-underline!"
            role="menuitem"
            href={h()}
            target={external() ? '_blank' : undefined}
            rel={external() ? 'noreferrer' : undefined}
            onClick={() => props.onDone()}
          >
            <Octicon icon={linkExternalIcon} class="text-fg-muted" /> View details
          </a>
        )}
      </Show>
      <Show when={props.canPush && job()}>
        {(id) => (
          <button
            type="button"
            class="SelectMenu-item"
            role="menuitem"
            onClick={async () => {
              props.onDone();
              try {
                await props.rerun(props.owner, props.repo, id(), false);
                toast('Re-run requested', 'success');
              } catch (e) {
                toastError(e);
              }
            }}
          >
            <Octicon icon={syncIcon} class="text-fg-muted" /> Re-run
          </button>
        )}
      </Show>
      <Show when={url()}>
        {(u) => (
          <button
            type="button"
            class="SelectMenu-item"
            role="menuitem"
            onClick={async () => {
              props.onDone();
              try {
                await navigator.clipboard.writeText(u());
                toast('Link copied', 'success');
              } catch (e) {
                toastError(e);
              }
            }}
          >
            <Octicon icon={copyIcon} class="text-fg-muted" /> Copy link
          </button>
        )}
      </Show>
      <Show when={!url()}>
        <div class="px-4 py-1.5 text-xs text-fg-muted">No details for this check.</div>
      </Show>
    </>
  );
}
