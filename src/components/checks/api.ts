import { query } from '@solidjs/router';
import { gql } from '../../lib/github';

/** One check run or commit status of a statusCheckRollup. */
export interface RollupContext {
  __typename: 'CheckRun' | 'StatusContext';
  // CheckRun
  name?: string;
  status?: string;
  conclusion?: string | null;
  title?: string | null;
  summary?: string | null;
  detailsUrl?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  databaseId?: number | null;
  checkSuite?: {
    app: { name: string; logoUrl: string; slug: string } | null;
    workflowRun: { databaseId: number; event: string; workflow: { name: string } } | null;
  } | null;
  // StatusContext
  context?: string;
  state?: string;
  description?: string | null;
  targetUrl?: string | null;
  avatarUrl?: string | null;
  creator?: { login: string } | null;
}

export interface CommitRollup {
  state: string;
  totalCount: number;
  contexts: RollupContext[];
}

const ROLLUP_FIELDS = `statusCheckRollup{state contexts(first:100){totalCount nodes{__typename
  ... on CheckRun{name status conclusion title summary detailsUrl startedAt completedAt databaseId
    checkSuite{app{name logoUrl slug} workflowRun{databaseId event workflow{name}}}}
  ... on StatusContext{context state description targetUrl avatarUrl creator{login}}
}}}`;

const toRollup = (r: any): CommitRollup | null =>
  r ? { state: r.state, totalCount: r.contexts.totalCount, contexts: r.contexts.nodes.filter(Boolean) } : null;

/**
 * Every check run / status of a commit (or of a PR's head commit) — fetched
 * lazily when a checks popover opens.
 */
export const getCommitRollup = query(
  async (owner: string, repo: string, target: { sha?: string; pull?: number }): Promise<CommitRollup | null> => {
    if (target.sha) {
      const data = await gql<any>(
        `query($owner:String!,$name:String!,$oid:GitObjectID!){repository(owner:$owner,name:$name){
          object(oid:$oid){... on Commit{${ROLLUP_FIELDS}}}
        }}`,
        { owner, name: repo, oid: target.sha },
      );
      return toRollup(data.repository?.object?.statusCheckRollup);
    }
    const data = await gql<any>(
      `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){
        pullRequest(number:$number){commits(last:1){nodes{commit{${ROLLUP_FIELDS}}}}}
      }}`,
      { owner, name: repo, number: target.pull },
    );
    return toRollup(data.repository?.pullRequest?.commits.nodes[0]?.commit.statusCheckRollup);
  },
  'commit-rollup',
);

export type CheckOutcome = 'success' | 'failure' | 'neutral' | 'pending';

const FAIL = ['FAILURE', 'ERROR', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE'];
const NEUTRAL = ['CANCELLED', 'SKIPPED', 'NEUTRAL', 'STALE'];

export function contextOutcome(c: RollupContext): CheckOutcome {
  if (c.__typename === 'StatusContext') {
    if (c.state === 'SUCCESS') return 'success';
    if (c.state === 'FAILURE' || c.state === 'ERROR') return 'failure';
    return 'pending';
  }
  if (c.status !== 'COMPLETED') return 'pending';
  if (c.conclusion === 'SUCCESS') return 'success';
  if (FAIL.includes(c.conclusion ?? '')) return 'failure';
  if (NEUTRAL.includes(c.conclusion ?? '')) return 'neutral';
  return 'pending';
}

/** "8m", "13s", "1h 4m" — github.com's compact check durations. */
export function shortDuration(start?: string | null, end?: string | null) {
  if (!start || !end) return '';
  const s = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

const STATUS_WORD: Record<string, string> = {
  SUCCESS: 'Successful',
  PENDING: 'Pending',
  EXPECTED: 'Expected',
  FAILURE: 'Failing',
  ERROR: 'Errored',
};

/** "Successful in 8m - Base review", "Pending - Review in progress", "Failing after 13s". */
export function contextDescription(c: RollupContext) {
  const join = (head: string, tail?: string | null) => (tail ? `${head} - ${tail}` : head);
  if (c.__typename === 'StatusContext') return join(STATUS_WORD[c.state ?? ''] ?? 'Pending', c.description);
  const d = shortDuration(c.startedAt, c.completedAt);
  const after = (word: string) => (d ? `${word} after ${d}` : word);
  let head: string;
  if (c.status !== 'COMPLETED') {
    head = c.status === 'IN_PROGRESS' ? 'In progress' : c.status === 'QUEUED' ? 'Queued' : c.status === 'WAITING' ? 'Waiting' : 'Pending';
  } else {
    switch (c.conclusion) {
      case 'SUCCESS':
        head = d ? `Successful in ${d}` : 'Successful';
        break;
      case 'FAILURE':
        head = after('Failing');
        break;
      case 'CANCELLED':
        head = after('Cancelled');
        break;
      case 'TIMED_OUT':
        head = after('Timed out');
        break;
      case 'SKIPPED':
        head = 'Skipped';
        break;
      case 'NEUTRAL':
        head = d ? `Completed in ${d}` : 'Neutral';
        break;
      case 'ACTION_REQUIRED':
        head = 'Action required';
        break;
      case 'STARTUP_FAILURE':
        head = 'Startup failure';
        break;
      case 'STALE':
        head = 'Stale';
        break;
      default:
        head = 'Completed';
    }
  }
  return join(head, c.title);
}

/** "Solid CI / job (push)" for Actions runs, else the check / status name. */
export function contextName(c: RollupContext) {
  if (c.__typename === 'StatusContext') return c.context ?? '';
  const run = c.checkSuite?.workflowRun;
  if (!run) return c.name ?? '';
  return `${run.workflow.name} / ${c.name}${run.event ? ` (${run.event.replace(/_/g, ' ')})` : ''}`;
}

/** "1 pending and 1 successful checks", "2 failing, 1 skipped, and 10 successful checks". */
export function rollupSummary(contexts: RollupContext[]) {
  const n = { failure: 0, pending: 0, neutral: 0, success: 0 };
  for (const c of contexts) n[contextOutcome(c)]++;
  const parts = [
    n.failure && `${n.failure} failing`,
    n.pending && `${n.pending} pending`,
    n.neutral && `${n.neutral} skipped`,
    n.success && `${n.success} successful`,
  ].filter(Boolean) as string[];
  const list =
    parts.length <= 1 ? (parts[0] ?? '0') : parts.length === 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
  return `${list} check${contexts.length === 1 ? '' : 's'}`;
}

/** Title + color of the popover header for a rollup state. */
export function rollupLook(state: string | null | undefined) {
  switch (state) {
    case 'SUCCESS':
      return { title: 'All checks have passed', class: 'text-fg-success' };
    case 'FAILURE':
    case 'ERROR':
      return { title: 'Some checks were not successful', class: 'text-fg-danger' };
    default:
      return { title: 'Some checks haven’t completed yet', class: 'text-fg-attention' };
  }
}
