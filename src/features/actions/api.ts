import { action, query } from '@solidjs/router';
import { encodePath, gh, ghAll, ghPage, GitHubError } from '../../lib/github';
import { getToken } from '../../lib/auth';
import type { Annotation, Artifact, CheckRun, CommitStatus, Job, Workflow, WorkflowRun } from './types';

/** Filters of the runs list — github.com spells them `?query=event:push status:success branch:main actor:x`. */
export interface RunFilters {
  event?: string;
  status?: string;
  branch?: string;
  actor?: string;
  workflow?: string;
}

const repoPath = (owner: string, repo: string) => `/repos/${owner}/${repo}`;

/** All workflows of the repo (the Actions sidebar). */
export const getWorkflows = query(
  (owner: string, repo: string) =>
    ghAll<Workflow>(`${repoPath(owner, repo)}/actions/workflows`, { pick: (d) => d.workflows, max: 500 }),
  'actions-workflows',
);

/** One workflow by id or file name (`main-ci.yml`). */
export const getWorkflow = query(
  (owner: string, repo: string, idOrFile: string) =>
    gh<Workflow>(`${repoPath(owner, repo)}/actions/workflows/${encodeURIComponent(idOrFile)}`),
  'actions-workflow',
);

/** A page of runs, for the whole repo or one workflow (`workflow` = id or file name, '' for all). */
export const getRuns = query(
  (owner: string, repo: string, workflow: string, filters: RunFilters, page: number) =>
    ghPage<WorkflowRun>(
      workflow
        ? `${repoPath(owner, repo)}/actions/workflows/${encodeURIComponent(workflow)}/runs`
        : `${repoPath(owner, repo)}/actions/runs`,
      {
        page,
        perPage: 25,
        pick: (d) => d.workflow_runs,
        query: { event: filters.event, status: filters.status, branch: filters.branch, actor: filters.actor },
      },
    ),
  'actions-runs',
);

/** A run (a specific attempt when `attempt` > 0). */
export const getRun = query(
  (owner: string, repo: string, id: string, attempt: number) =>
    gh<WorkflowRun>(`${repoPath(owner, repo)}/actions/runs/${id}${attempt ? `/attempts/${attempt}` : ''}`),
  'actions-run',
);

/** Jobs of a run (latest attempt, or a specific one). */
export const getRunJobs = query(
  (owner: string, repo: string, id: string, attempt: number) =>
    ghAll<Job>(`${repoPath(owner, repo)}/actions/runs/${id}${attempt ? `/attempts/${attempt}` : ''}/jobs`, {
      pick: (d) => d.jobs,
      query: attempt ? undefined : { filter: 'latest' },
    }),
  'actions-run-jobs',
);

export const getRunArtifacts = query(
  (owner: string, repo: string, id: string) =>
    ghAll<Artifact>(`${repoPath(owner, repo)}/actions/runs/${id}/artifacts`, { pick: (d) => d.artifacts }),
  'actions-run-artifacts',
);

/** Check runs of a check suite (a workflow run's jobs as checks, with annotation counts). */
export const getSuiteCheckRuns = query(
  (owner: string, repo: string, suiteId: number) =>
    ghAll<CheckRun>(`${repoPath(owner, repo)}/check-suites/${suiteId}/check-runs`, {
      pick: (d) => d.check_runs,
      query: { filter: 'all' },
    }),
  'actions-suite-check-runs',
);

/** Annotations of several check runs (only those that report some), flattened with their check name. */
export const getAnnotations = query(
  async (owner: string, repo: string, checks: { id: number; name: string }[]) => {
    const lists = await Promise.all(
      checks.map(async (c) => {
        const items = await ghAll<Annotation>(`${repoPath(owner, repo)}/check-runs/${c.id}/annotations`, { max: 200 });
        return items.map((a) => ({ ...a, checkName: c.name, checkId: c.id }));
      }),
    );
    return lists.flat();
  },
  'actions-annotations',
);

export const getJob = query(
  (owner: string, repo: string, jobId: string) => gh<Job>(`${repoPath(owner, repo)}/actions/jobs/${jobId}`),
  'actions-job',
);

export interface JobLogResult {
  text: string | null;
  /** Why the log could not be loaded (not finished yet, expired, CORS…). */
  error?: string;
}

/**
 * Plain-text log of a job. The endpoint answers with a redirect to a signed
 * blob URL; fetch follows it (the blob store sends CORS headers). Logs only
 * exist once the job has finished (and expire after the retention period).
 */
export const getJobLogs = query(async (owner: string, repo: string, jobId: string): Promise<JobLogResult> => {
  try {
    const res = await fetch(`https://api.github.com${repoPath(owner, repo)}/actions/jobs/${jobId}/logs`, {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      if (res.status === 404) return { text: null, error: 'The logs for this job are not available (yet).' };
      if (res.status === 410) return { text: null, error: 'The logs for this job have expired.' };
      return { text: null, error: `Could not load the logs (${res.status} ${res.statusText}).` };
    }
    return { text: (await res.text()).replace(/^﻿/, '') };
  } catch (e) {
    return {
      text: null,
      error: `The browser could not download the log (${e instanceof Error ? e.message : String(e)}). It is served from a signed storage URL that may block cross-origin requests.`,
    };
  }
}, 'actions-job-logs');

/** Raw workflow file at a ref (null when it does not exist there). */
export const getWorkflowFile = query(async (owner: string, repo: string, path: string, ref: string) => {
  try {
    return await gh<string>(`${repoPath(owner, repo)}/contents/${encodePath(path)}`, {
      query: { ref },
      accept: 'application/vnd.github.raw',
    });
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}, 'actions-workflow-file');

/** Minimal pull request info for the Checks tab (head SHA). */
export const getPullHead = query(
  (owner: string, repo: string, number: string) =>
    gh<{ number: number; title: string; head: { sha: string; ref: string }; base: { ref: string } }>(
      `${repoPath(owner, repo)}/pulls/${number}`,
    ),
  'actions-pull-head',
);

export interface CommitChecks {
  checkRuns: CheckRun[];
  statuses: CommitStatus[];
  /** Workflow runs of the commit keyed by check suite id (names checks by workflow). */
  runsBySuite: Record<number, WorkflowRun>;
}

/** Everything that reports on a commit: check runs, commit statuses, and the Actions runs behind the checks. */
export const getCommitChecks = query(async (owner: string, repo: string, sha: string): Promise<CommitChecks> => {
  const [checkRuns, combined, runs] = await Promise.all([
    ghAll<CheckRun>(`${repoPath(owner, repo)}/commits/${sha}/check-runs`, { pick: (d) => d.check_runs, max: 500 }),
    gh<{ statuses: CommitStatus[] }>(`${repoPath(owner, repo)}/commits/${sha}/status`, { query: { per_page: 100 } }),
    ghAll<WorkflowRun>(`${repoPath(owner, repo)}/actions/runs`, {
      pick: (d) => d.workflow_runs,
      query: { head_sha: sha },
      max: 200,
    }).catch(() => [] as WorkflowRun[]),
  ]);
  const runsBySuite: Record<number, WorkflowRun> = {};
  for (const run of runs) if (!runsBySuite[run.check_suite_id]) runsBySuite[run.check_suite_id] = run;
  return { checkRuns, statuses: combined.statuses, runsBySuite };
}, 'actions-commit-checks');

// ── Mutations ────────────────────────────────────────────────────────────────

export const rerunRun = action(
  async (owner: string, repo: string, runId: number, failedOnly: boolean, debug: boolean) => {
    await gh(`${repoPath(owner, repo)}/actions/runs/${runId}/${failedOnly ? 'rerun-failed-jobs' : 'rerun'}`, {
      method: 'POST',
      body: { enable_debug_logging: debug },
    });
  },
  'actions-rerun',
);

export const rerunJob = action(async (owner: string, repo: string, jobId: number, debug: boolean) => {
  await gh(`${repoPath(owner, repo)}/actions/jobs/${jobId}/rerun`, {
    method: 'POST',
    body: { enable_debug_logging: debug },
  });
}, 'actions-rerun-job');

export const cancelRun = action(async (owner: string, repo: string, runId: number, force = false) => {
  await gh(`${repoPath(owner, repo)}/actions/runs/${runId}/${force ? 'force-cancel' : 'cancel'}`, { method: 'POST' });
}, 'actions-cancel');

export const deleteRun = action(async (owner: string, repo: string, runId: number) => {
  await gh(`${repoPath(owner, repo)}/actions/runs/${runId}`, { method: 'DELETE' });
}, 'actions-delete-run');

export const deleteRunLogs = action(async (owner: string, repo: string, runId: number) => {
  await gh(`${repoPath(owner, repo)}/actions/runs/${runId}/logs`, { method: 'DELETE' });
}, 'actions-delete-logs');

export const dispatchWorkflow = action(
  async (owner: string, repo: string, workflowId: number, ref: string, inputs: Record<string, string | boolean>) => {
    await gh(`${repoPath(owner, repo)}/actions/workflows/${workflowId}/dispatches`, {
      method: 'POST',
      body: { ref, inputs },
    });
  },
  'actions-dispatch',
);

export const setWorkflowEnabled = action(async (owner: string, repo: string, workflowId: number, enabled: boolean) => {
  await gh(`${repoPath(owner, repo)}/actions/workflows/${workflowId}/${enabled ? 'enable' : 'disable'}`, {
    method: 'PUT',
  });
}, 'actions-workflow-enable');

/**
 * Download an artifact zip. The archive URL needs the token, so it is fetched
 * here and handed to the browser as a blob. Throws when the browser cannot
 * fetch it (the caller then points to github.com).
 */
export async function downloadArtifact(artifact: Artifact) {
  const res = await fetch(artifact.archive_download_url, {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  });
  if (!res.ok) throw new GitHubError(res.status, `Download failed (${res.status} ${res.statusText})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${artifact.name}.zip`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
