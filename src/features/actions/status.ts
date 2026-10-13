import { formatDuration } from '../../lib/format';
import type { RunConclusion, RunStatus } from './types';

/** One state for icons/labels out of a (status, conclusion) pair. */
export type RunState =
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'skipped'
  | 'neutral'
  | 'action_required'
  | 'timed_out'
  | 'startup_failure'
  | 'stale'
  | 'in_progress'
  | 'queued'
  | 'waiting';

export function runState(status: RunStatus | string | null | undefined, conclusion: RunConclusion | string | null | undefined): RunState {
  if (status === 'completed' || (!status && conclusion)) {
    switch (conclusion) {
      case 'success':
      case 'failure':
      case 'cancelled':
      case 'skipped':
      case 'neutral':
      case 'action_required':
      case 'timed_out':
      case 'startup_failure':
      case 'stale':
        return conclusion;
      default:
        return 'neutral';
    }
  }
  if (status === 'in_progress') return 'in_progress';
  if (status === 'waiting') return 'waiting';
  return 'queued';
}

const LABELS: Record<RunState, string> = {
  success: 'Success',
  failure: 'Failure',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
  neutral: 'Neutral',
  action_required: 'Action required',
  timed_out: 'Timed out',
  startup_failure: 'Startup failure',
  stale: 'Stale',
  in_progress: 'In progress',
  queued: 'Queued',
  waiting: 'Waiting',
};
export const stateLabel = (s: RunState) => LABELS[s];

/** Past-tense verb for "failed 4 hours ago in 15s". */
export function stateVerb(s: RunState) {
  switch (s) {
    case 'success':
      return 'succeeded';
    case 'failure':
    case 'startup_failure':
      return 'failed';
    case 'cancelled':
      return 'was cancelled';
    case 'skipped':
      return 'was skipped';
    case 'timed_out':
      return 'timed out';
    case 'in_progress':
      return 'started';
    case 'queued':
    case 'waiting':
      return 'queued';
    default:
      return 'completed';
  }
}

export const isDone = (status: string | null | undefined) => status === 'completed';

/** Milliseconds between two timestamps (end defaults to now while running). */
export function elapsed(start: string | null | undefined, end: string | null | undefined, now = Date.now()) {
  if (!start) return 0;
  return Math.max(0, (end ? new Date(end).getTime() : now) - new Date(start).getTime());
}

export const duration = (start: string | null | undefined, end: string | null | undefined, now?: number) =>
  start ? formatDuration(elapsed(start, end, now)) : '';

/** Human wording of what triggered a run, e.g. "pull request", "push", "schedule". */
export const eventLabel = (event: string) => event.replace(/_/g, ' ');

/** Events offered by the runs list filter (github.com lists these too). */
export const RUN_EVENTS = [
  'branch_protection_rule',
  'check_run',
  'check_suite',
  'create',
  'delete',
  'deployment',
  'deployment_status',
  'discussion',
  'discussion_comment',
  'dynamic',
  'fork',
  'gollum',
  'issue_comment',
  'issues',
  'label',
  'merge_group',
  'milestone',
  'page_build',
  'public',
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
  'pull_request_target',
  'push',
  'registry_package',
  'release',
  'repository_dispatch',
  'schedule',
  'status',
  'watch',
  'workflow_call',
  'workflow_dispatch',
  'workflow_run',
];

export const RUN_STATUSES: { value: string; label: string }[] = [
  { value: 'queued', label: 'Queued' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'completed', label: 'Completed' },
  { value: 'action_required', label: 'Action required' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'failure', label: 'Failure' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'stale', label: 'Stale' },
  { value: 'success', label: 'Success' },
  { value: 'timed_out', label: 'Timed out' },
];

/** Parse github.com's `?query=event:push status:success branch:main actor:octocat workflow:CI` string. */
export function parseRunQuery(q: string | undefined) {
  const out: { event?: string; status?: string; branch?: string; actor?: string; workflow?: string; text: string } = {
    text: '',
  };
  if (!q) return out;
  const rest: string[] = [];
  const re = /(\w+):("[^"]*"|\S+)|(\S+)/g;
  for (const m of q.matchAll(re)) {
    if (m[1]) {
      const key = m[1].toLowerCase();
      const value = m[2]!.replace(/^"|"$/g, '');
      if (key === 'event' || key === 'status' || key === 'branch' || key === 'actor' || key === 'workflow') out[key] = value;
      else if (key === 'is') out.status = value;
      else rest.push(m[0]);
    } else if (m[3]) rest.push(m[3]);
  }
  out.text = rest.join(' ');
  return out;
}

/** Inverse of parseRunQuery. */
export function buildRunQuery(f: { event?: string; status?: string; branch?: string; actor?: string; workflow?: string }) {
  const quote = (v: string) => (/\s/.test(v) ? `"${v}"` : v);
  return (['workflow', 'event', 'status', 'branch', 'actor'] as const)
    .filter((k) => f[k])
    .map((k) => `${k}:${quote(f[k]!)}`)
    .join(' ');
}
