import { Match, Switch } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { checkIcon, dotFillIcon, xIcon } from '../../../icons/octicons';

/** ✓ / ✗ / ● for a commit's combined check state (statusCheckRollup.state). */
export default function CommitStatusIcon(props: { state: string | null | undefined; href?: string }) {
  return (
    <Switch>
      <Match when={props.state === 'SUCCESS'}>
        <a href={props.href} title="All checks have passed" class="text-fg-success inline-flex">
          <Octicon icon={checkIcon} />
        </a>
      </Match>
      <Match when={props.state === 'FAILURE' || props.state === 'ERROR'}>
        <a href={props.href} title="Some checks were not successful" class="text-fg-danger inline-flex">
          <Octicon icon={xIcon} />
        </a>
      </Match>
      <Match when={props.state === 'PENDING' || props.state === 'EXPECTED'}>
        <a href={props.href} title="Some checks haven't completed yet" class="text-fg-attention inline-flex">
          <Octicon icon={dotFillIcon} />
        </a>
      </Match>
    </Switch>
  );
}
