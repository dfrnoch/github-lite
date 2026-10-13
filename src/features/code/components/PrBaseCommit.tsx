import { createMemo, Loading, Show } from 'solid-js';
import { feature } from '../../refined';
import { getPullBehind } from '../refinedApi';

/**
 * pr-base-commit: "It’s 3 commits behind (base commit: abc1234)" for an open
 * PR whose branch is out of date. Renders nothing otherwise (or while the
 * feature is off).
 */
export default function PrBaseCommit(props: { owner: string; repo: string; baseRef: string; baseRefOid: string; headSha: string }) {
  return (
    <Show when={feature('pr-base-commit') && props.baseRefOid}>
      <Loading>
        <Notice {...props} />
      </Loading>
    </Show>
  );
}

function Notice(props: { owner: string; repo: string; baseRef: string; baseRefOid: string; headSha: string }) {
  const info = createMemo(() => getPullBehind(props.owner, props.repo, props.baseRef, props.headSha).catch(() => null));
  const base = () => `/${props.owner}/${props.repo}`;
  return (
    <Show when={info()?.needsUpdate && info()}>
      {(i) => (
        <div class="rgh-pr-base-commit">
          It’s{' '}
          <a href={`${base()}/compare/${props.baseRefOid.slice(0, 8)}...${encodeURIComponent(props.baseRef)}`}>
            {i().behindBy} commit{i().behindBy === 1 ? '' : 's'}
          </a>{' '}
          behind (base commit:{' '}
          <a class="font-mono text-xs" href={`${base()}/commit/${props.baseRefOid}`}>
            {props.baseRefOid.slice(0, 7)}
          </a>
          )
        </div>
      )}
    </Show>
  );
}
