import { createContext, useContext } from 'solid-js';
import type { Repository } from '../../lib/types';

/**
 * Provided by the repo layout (src/routes/[owner]/[repo].tsx) to every page
 * under /:owner/:repo. `repo()` is async — read it under a <Loading>.
 */
export interface RepoContextValue {
  owner: () => string;
  name: () => string;
  /** "owner/name" as written in the URL. */
  fullName: () => string;
  repo: () => Repository;
  /** Base path for links: "/owner/name". */
  base: () => string;
}

export const RepoContext = createContext<RepoContextValue>();

export const useRepo = () => useContext(RepoContext);
