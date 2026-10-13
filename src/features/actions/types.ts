import type { SimpleUser } from '../../lib/types';

/** REST shapes for GitHub Actions / Checks (only the fields this app reads). */

export type RunStatus = 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending';
export type RunConclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'skipped'
  | 'timed_out'
  | 'action_required'
  | 'stale'
  | 'startup_failure'
  | null;

export interface Workflow {
  id: number;
  node_id: string;
  name: string;
  path: string;
  state: 'active' | 'deleted' | 'disabled_fork' | 'disabled_inactivity' | 'disabled_manually';
  created_at: string;
  updated_at: string;
  html_url: string;
  badge_url: string;
}

export interface WorkflowRun {
  id: number;
  name: string | null;
  display_title: string;
  run_number: number;
  run_attempt: number;
  event: string;
  status: RunStatus | null;
  conclusion: RunConclusion;
  workflow_id: number;
  check_suite_id: number;
  head_branch: string | null;
  head_sha: string;
  path: string;
  actor: SimpleUser | null;
  triggering_actor: SimpleUser | null;
  created_at: string;
  updated_at: string;
  run_started_at?: string;
  html_url: string;
  jobs_url: string;
  pull_requests: { number: number; head: { ref: string; sha: string }; base: { ref: string } }[];
  head_commit: { id: string; message: string; timestamp: string; author: { name: string; email: string } | null } | null;
  head_repository: { full_name: string } | null;
  repository: { full_name: string };
}

export interface JobStep {
  name: string;
  status: RunStatus;
  conclusion: RunConclusion;
  number: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface Job {
  id: number;
  run_id: number;
  run_attempt: number;
  name: string;
  workflow_name?: string;
  head_branch?: string;
  head_sha: string;
  status: RunStatus;
  conclusion: RunConclusion;
  created_at: string;
  started_at: string;
  completed_at: string | null;
  html_url: string;
  check_run_url: string;
  labels: string[];
  runner_name: string | null;
  steps?: JobStep[];
}

export interface Artifact {
  id: number;
  name: string;
  size_in_bytes: number;
  archive_download_url: string;
  expired: boolean;
  created_at: string | null;
  expires_at: string | null;
  digest?: string | null;
}

export interface CheckRun {
  id: number;
  name: string;
  head_sha: string;
  status: RunStatus;
  conclusion: RunConclusion;
  started_at: string | null;
  completed_at: string | null;
  html_url: string | null;
  details_url: string | null;
  output: { title: string | null; summary: string | null; text: string | null; annotations_count: number };
  app: { id: number; slug: string; name: string; owner: SimpleUser | null } | null;
  check_suite: { id: number } | null;
}

export interface Annotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: 'notice' | 'warning' | 'failure';
  title: string | null;
  message: string;
  raw_details: string | null;
  blob_href?: string;
}

export interface CommitStatus {
  id: number;
  context: string;
  state: 'error' | 'failure' | 'pending' | 'success';
  description: string | null;
  target_url: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/** A `workflow_dispatch` input declared in the workflow YAML. */
export interface DispatchInput {
  name: string;
  description?: string;
  required?: boolean;
  default?: string;
  type: 'string' | 'boolean' | 'choice' | 'environment' | 'number';
  options?: string[];
}
