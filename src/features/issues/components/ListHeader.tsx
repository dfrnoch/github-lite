import { createMemo, Loading, Show } from 'solid-js';
import Octicon from '../../../components/Octicon';
import { milestoneIcon, tagIcon } from '../../../icons/octicons';
import { formatNumber } from '../../../lib/format';
import { getListCounts } from '../api';

/** Heading row of the repo issue / PR lists: title, Labels, Milestones, New button. */
export default function ListHeader(props: { owner: string; repo: string; title: string; newHref?: string; newLabel: string }) {
  const counts = createMemo(() => getListCounts(props.owner, props.repo));
  const base = () => `/${props.owner}/${props.repo}`;
  return (
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <h1 class="text-xl font-semibold flex-1">{props.title}</h1>
      <a class="btn btn-sm" href={`${base()}/labels`}>
        <Octicon icon={tagIcon} /> Labels
        <Loading>
          <span class="Counter">{formatNumber(counts().labels)}</span>
        </Loading>
      </a>
      <a class="btn btn-sm" href={`${base()}/milestones`}>
        <Octicon icon={milestoneIcon} /> Milestones
        <Loading>
          <span class="Counter">{formatNumber(counts().milestones)}</span>
        </Loading>
      </a>
      <Show when={props.newHref}>
        <a class="btn btn-sm btn-primary" href={props.newHref}>
          {props.newLabel}
        </a>
      </Show>
    </div>
  );
}
