import type { JSX } from '@solidjs/web';
import Octicon from '../../../components/Octicon';
import { milestoneIcon, tagIcon } from '../../../icons/octicons';

/** "Labels | Milestones" switch used on the labels and milestones pages, plus page controls. */
export default function IssuesSubnav(props: { base: string; active: 'labels' | 'milestones'; children?: JSX.Element }) {
  return (
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <nav class="flex" aria-label="Issue metadata">
        <a
          class={['subnav-item flex items-center gap-2', { 'font-semibold': props.active === 'labels' }]}
          href={`${props.base}/labels`}
          aria-current={props.active === 'labels' ? 'page' : undefined}
        >
          <Octicon icon={tagIcon} /> Labels
        </a>
        <a
          class={['subnav-item flex items-center gap-2', { 'font-semibold': props.active === 'milestones' }]}
          href={`${props.base}/milestones`}
          aria-current={props.active === 'milestones' ? 'page' : undefined}
        >
          <Octicon icon={milestoneIcon} /> Milestones
        </a>
      </nav>
      {props.children}
    </div>
  );
}
