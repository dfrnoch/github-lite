import {
  alertIcon,
  commentDiscussionIcon,
  gitCommitIcon,
  gitPullRequestIcon,
  issueOpenedIcon,
  playIcon,
  shieldIcon,
  tagIcon,
  bellIcon,
  type OcticonData,
} from '../../icons/octicons';
import type { NotificationThread } from './api';

/** A parsed inbox query (`is:unread reason:mention repo:solidjs/solid fix`). */
export interface InboxQuery {
  is?: 'unread' | 'read' | 'done';
  reason?: string;
  repo?: string;
  /** Free text, matched against titles client-side. */
  text: string;
}

export function parseInboxQuery(raw: string): InboxQuery {
  const out: InboxQuery = { text: '' };
  const words: string[] = [];
  for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
    const m = token.match(/^(is|reason|repo):(.+)$/i);
    if (!m) {
      words.push(token);
      continue;
    }
    const key = m[1]!.toLowerCase();
    const value = m[2]!;
    if (key === 'is' && ['unread', 'read', 'done'].includes(value.toLowerCase())) out.is = value.toLowerCase() as InboxQuery['is'];
    else if (key === 'reason') out.reason = value.toLowerCase().replace(/-/g, '_');
    else if (key === 'repo') out.repo = value;
    else words.push(token);
  }
  out.text = words.join(' ');
  return out;
}

/** Reasons the API can't filter on are filtered client-side; `participating` maps to the API flag. */
export function matchesReason(n: NotificationThread, reason: string | undefined) {
  if (!reason || reason === 'participating') return true;
  return n.reason === reason;
}

const REASONS: Record<string, string> = {
  approval_requested: 'approval requested',
  assign: 'assign',
  author: 'author',
  ci_activity: 'ci activity',
  comment: 'comment',
  invitation: 'invitation',
  manual: 'subscribed',
  member_feature_requested: 'feature requested',
  mention: 'mention',
  review_requested: 'review requested',
  security_alert: 'security alert',
  security_advisory_credit: 'security advisory credit',
  state_change: 'state change',
  subscribed: 'subscribed',
  team_mention: 'team mention',
};

/** "review_requested" → "review requested", like the inbox's reason column. */
export const reasonLabel = (reason: string) => REASONS[reason] ?? reason.replace(/_/g, ' ');

/** `#123` for issues/PRs, read from the subject API URL. */
export function subjectNumber(n: NotificationThread): number | null {
  const m = n.subject.url?.match(/\/(?:issues|pulls)\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

/** In-app URL for a notification's subject (api.github.com → this app's github.com-shaped paths). */
export function subjectHref(n: NotificationThread): string {
  const repo = n.repository.full_name;
  const url = n.subject.url;
  if (url) {
    const m = url.match(/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/(.+)$/);
    const rest = m?.[1] ?? '';
    let r: RegExpMatchArray | null;
    if ((r = rest.match(/^issues\/(\d+)/))) return `/${repo}/issues/${r[1]}`;
    if ((r = rest.match(/^pulls\/(\d+)/))) return `/${repo}/pull/${r[1]}`;
    if ((r = rest.match(/^commits\/([0-9a-f]+)/))) return `/${repo}/commit/${r[1]}`;
    if (rest.startsWith('releases/')) return `/${repo}/releases`;
    if ((r = rest.match(/^discussions\/(\d+)/))) return `/${repo}/discussions/${r[1]}`;
  }
  switch (n.subject.type) {
    case 'Discussion':
      return `/${repo}/discussions`;
    case 'CheckSuite':
    case 'WorkflowRun':
      return `/${repo}/actions`;
    case 'RepositoryVulnerabilityAlert':
    case 'RepositoryDependabotAlertsThread':
      return `/${repo}/security/dependabot`;
    case 'Release':
      return `/${repo}/releases`;
    default:
      return `/${repo}`;
  }
}

/** Icon for the subject type (CheckSuite failures read as an alert, like github.com). */
export function subjectIcon(n: NotificationThread): { icon: OcticonData; class: string } {
  switch (n.subject.type) {
    case 'Issue':
      return { icon: issueOpenedIcon, class: 'text-fg-muted' };
    case 'PullRequest':
      return { icon: gitPullRequestIcon, class: 'text-fg-muted' };
    case 'Release':
      return { icon: tagIcon, class: 'text-fg-muted' };
    case 'Commit':
      return { icon: gitCommitIcon, class: 'text-fg-muted' };
    case 'Discussion':
      return { icon: commentDiscussionIcon, class: 'text-fg-muted' };
    case 'CheckSuite':
    case 'WorkflowRun':
      return /fail/i.test(n.subject.title) ? { icon: alertIcon, class: 'text-fg-danger' } : { icon: playIcon, class: 'text-fg-muted' };
    case 'RepositoryVulnerabilityAlert':
    case 'RepositoryDependabotAlertsThread':
    case 'SecurityAdvisory':
      return { icon: shieldIcon, class: 'text-fg-danger' };
    default:
      return { icon: bellIcon, class: 'text-fg-muted' };
  }
}

/** Builds `/notifications?query=…` (plus page). */
export function inboxHref(query: string, page = 1) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('query', query.trim());
  if (page > 1) params.set('page', String(page));
  const qs = params.toString().replace(/%3A/gi, ':').replace(/%2F/gi, '/');
  return `/notifications${qs ? `?${qs}` : ''}`;
}
