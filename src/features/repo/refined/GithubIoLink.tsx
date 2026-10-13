import { Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { linkIcon } from '../../../icons/octicons';

/** "user.github.io" (or the legacy ".github.com") repos → their GitHub Pages site. */
export const githubIoUrl = (name: string) => (/\.github\.(?:io|com)$/i.test(name) ? `https://${name.replace(/com$/i, 'io')}` : null);

/** 🔗 after a github.io repo's name (repo header and repo lists). */
export default function GithubIoLink(props: { name: string; class?: string }) {
  return (
    <Show when={githubIoUrl(props.name)}>
      {(url) => (
        <a class={['link-muted inline-flex', props.class]} href={url()} target="_blank" rel="noreferrer" title={`Visit ${url().slice(8)}`}>
          <Octicon icon={linkIcon} />
        </a>
      )}
    </Show>
  );
}
