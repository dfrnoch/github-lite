import { createContext, useContext } from 'solid-js';
import type { PullRequest } from '../../lib/types';

/**
 * Provided by the pull request layout (src/routes/[owner]/[repo]/pull/[number].tsx)
 * to its tabs (Conversation, Commits, Checks, Files changed). `pull()` is the
 * REST pull request and is async — read it under a <Loading>.
 */
export interface PullContextValue {
  owner: () => string;
  repo: () => string;
  number: () => number;
  /** GET /repos/{owner}/{repo}/pulls/{number}. */
  pull: () => PullRequest;
  /** "/owner/repo/pull/123" — base for tab links. */
  base: () => string;
}

export const PullContext = createContext<PullContextValue>();

export const usePull = () => useContext(PullContext);
