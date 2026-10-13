import { revalidate } from '@solidjs/router';
import Octicon from '../../../components/Octicon';
import { Blankslate } from '../../../components/ui';
import { graphIcon } from '../../../icons/octicons';

/** Shown when GitHub is still computing /stats/* (it answered 202 for every retry). */
export default function StatsPending(props: { queryKey: string }) {
  return (
    <Blankslate
      icon={graphIcon}
      title="Crunching the latest data, just for you."
      action={
        <button type="button" class="btn" onClick={() => revalidate(props.queryKey)}>
          <Octicon icon={graphIcon} /> Try again
        </button>
      }
    >
      GitHub is computing these statistics. Check back in a moment.
    </Blankslate>
  );
}
