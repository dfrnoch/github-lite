import { markGithubIcon } from '../../icons/octicons';
import { rateLimit } from '../../lib/github';
import Octicon from '../Octicon';

export default function Footer() {
  return (
    <footer class="container-xl px-4 py-10 mt-10 text-xs text-fg-muted flex flex-wrap items-center gap-x-4 gap-y-2">
      <span class="flex items-center gap-2">
        <Octicon icon={markGithubIcon} size={24} />
        GitHub Lite — a lightweight client for the GitHub API
      </span>
      <span class="flex-1" />
      <a class="link-muted" href="https://docs.github.com/rest" target="_blank" rel="noreferrer">
        API docs
      </a>
      <a class="link-muted" href="https://www.githubstatus.com" target="_blank" rel="noreferrer">
        Status
      </a>
      <span title="REST API rate limit remaining">
        {rateLimit() ? `API: ${rateLimit()!.remaining}/${rateLimit()!.limit} (${rateLimit()!.resource})` : ''}
      </span>
    </footer>
  );
}
