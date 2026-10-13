import { Show } from 'solid-js';
import ChecksStatus, { RollupGlyph } from '../../../components/checks/ChecksStatus';
import { rollupLook } from '../../../components/checks/api';

/**
 * ✓ / ✗ / ● for a commit's combined check state (statusCheckRollup.state).
 * Given `owner`/`repo` and a `sha` (or PR `pull` number) it opens the checks
 * popover on click, like github.com; otherwise it links to `href`.
 */
export default function CommitStatusIcon(props: {
  state: string | null | undefined;
  href?: string;
  owner?: string;
  repo?: string;
  sha?: string;
  pull?: number;
  /** "passed / total" after the icon. */
  passed?: number;
  total?: number;
}) {
  return (
    <Show
      when={props.owner && props.repo && (props.sha || props.pull)}
      fallback={
        <Show when={props.state}>
          <a href={props.href} title={rollupLook(props.state).title} class="inline-flex">
            <RollupGlyph state={props.state} />
          </a>
        </Show>
      }
    >
      <ChecksStatus
        owner={props.owner!}
        repo={props.repo!}
        sha={props.sha}
        pull={props.pull}
        state={props.state}
        passed={props.passed}
        total={props.total}
      />
    </Show>
  );
}
