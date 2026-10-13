import { createContext, useContext } from 'solid-js';
import type { Job, WorkflowRun } from './types';

/** Provided by the run layout (/actions/runs/:id) to the summary and job pages. */
export interface RunContextValue {
  id: () => string;
  /** Attempt shown (0 = latest). */
  attempt: () => number;
  run: () => WorkflowRun;
  jobs: () => Job[];
  /** "/owner/repo/actions/runs/:id" */
  href: () => string;
}

export const RunContext = createContext<RunContextValue>();

export const useRun = () => useContext(RunContext);
