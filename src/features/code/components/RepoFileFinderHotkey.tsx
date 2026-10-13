import { useNavigate } from '@solidjs/router';
import { encodePath } from '../../../lib/github';
import { useHotkey } from '../../../lib/hotkeys';
import { hasCodeFinderHotkey } from '../../repo/components/CodeLayout';
import { useRepo } from '../../repo/context';

/**
 * repo-wide-file-finder: `t` opens the file finder on every repository page
 * (issues, pull requests, actions…), not only on the code pages that bind it
 * themselves. Rendered once by the repo layout.
 */
export default function RepoFileFinderHotkey() {
  const ctx = useRepo();
  const navigate = useNavigate();
  useHotkey({
    keys: 't',
    description: 'Open the file finder',
    group: 'Repository',
    feature: 'repo-wide-file-finder',
    when: () => !hasCodeFinderHotkey(),
    handler: () => navigate(`${ctx.base()}/find/${encodePath(ctx.repo().default_branch)}`),
  });
  return null;
}
