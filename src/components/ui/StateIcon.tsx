import Octicon from '../Octicon';
import {
  gitMergeIcon,
  gitPullRequestClosedIcon,
  gitPullRequestDraftIcon,
  gitPullRequestIcon,
  issueClosedIcon,
  issueDraftIcon,
  issueOpenedIcon,
  skipIcon,
} from '../../icons/octicons';

export type ItemState =
  | { kind: 'issue'; state: 'open' | 'closed'; reason?: string | null; draft?: boolean }
  | { kind: 'pull'; state: 'open' | 'closed'; merged?: boolean; draft?: boolean };

/** Normalize REST / GraphQL shapes (OPEN, CLOSED, MERGED, NOT_PLANNED…) into an ItemState. */
export function itemState(input: {
  isPull: boolean;
  state: string;
  stateReason?: string | null;
  merged?: boolean | null;
  draft?: boolean | null;
}): ItemState {
  const state = input.state.toLowerCase() === 'open' ? 'open' : 'closed';
  return input.isPull
    ? { kind: 'pull', state, merged: !!input.merged || input.state.toUpperCase() === 'MERGED', draft: !!input.draft }
    : { kind: 'issue', state, reason: input.stateReason?.toLowerCase() ?? null, draft: !!input.draft };
}

function look(s: ItemState) {
  if (s.kind === 'issue') {
    if (s.state === 'open') return s.draft ? { icon: issueDraftIcon, color: 'text-fg-muted', label: 'Draft' } : { icon: issueOpenedIcon, color: 'text-fg-open', label: 'Open' };
    if (s.reason === 'not_planned' || s.reason === 'duplicate') return { icon: skipIcon, color: 'text-fg-muted', label: 'Closed as not planned' };
    return { icon: issueClosedIcon, color: 'text-fg-done', label: 'Closed' };
  }
  if (s.merged) return { icon: gitMergeIcon, color: 'text-fg-done', label: 'Merged' };
  if (s.state === 'closed') return { icon: gitPullRequestClosedIcon, color: 'text-fg-closed', label: 'Closed' };
  if (s.draft) return { icon: gitPullRequestDraftIcon, color: 'text-fg-muted', label: 'Draft' };
  return { icon: gitPullRequestIcon, color: 'text-fg-open', label: 'Open' };
}

/** The colored open/closed/merged/draft icon shown in issue & PR lists. */
export default function StateIcon(props: { state: ItemState; size?: number; class?: string }) {
  return (
    <Octicon
      icon={look(props.state).icon}
      size={props.size}
      class={`${look(props.state).color} ${props.class ?? ''}`}
      aria-label={look(props.state).label}
    />
  );
}

/** The big rounded state pill at the top of an issue / PR page. */
export function StateBadge(props: { state: ItemState; small?: boolean }) {
  const cls = () => {
    const s = props.state;
    if (s.kind === 'pull' && s.merged) return 'State--merged';
    if (s.draft && s.state === 'open') return 'State--draft';
    if (s.state === 'open') return 'State--open';
    if (s.kind === 'issue') return s.reason === 'not_planned' || s.reason === 'duplicate' ? '' : 'State--done';
    return 'State--closed';
  };
  return (
    <span class={['State', cls(), { 'State--small': props.small }]}>
      <Octicon icon={look(props.state).icon} />
      {look(props.state).label}
    </span>
  );
}
