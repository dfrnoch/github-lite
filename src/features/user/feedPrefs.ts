import { createSignal } from 'solid-js';
import type { GitHubEvent } from './feed';

/**
 * Dashboard feed preferences, local to this browser: which event types the
 * "Filter" menu shows, and repositories hidden from the feed via a card's
 * "⋯" menu. Synced across tabs through the `storage` event.
 */
export type FeedFilterId = 'releases' | 'stars' | 'repositories' | 'activity';

/** Only the kinds the events API actually delivers (no follows / sponsors / recommendations). */
export const FEED_FILTERS: { id: FeedFilterId; label: string; description: string }[] = [
  { id: 'releases', label: 'Releases', description: 'New releases in repositories' },
  { id: 'stars', label: 'Stars', description: 'Repositories people starred' },
  { id: 'repositories', label: 'Repositories', description: 'New, forked and newly public repositories' },
  { id: 'activity', label: 'Repository activity', description: 'Issues, pull requests, reviews, comments and pushes' },
];

export function eventCategory(e: GitHubEvent): FeedFilterId {
  switch (e.type) {
    case 'ReleaseEvent':
      return 'releases';
    case 'WatchEvent':
      return 'stars';
    case 'ForkEvent':
    case 'PublicEvent':
      return 'repositories';
    case 'CreateEvent':
      return e.payload.ref_type === 'repository' ? 'repositories' : 'activity';
    default:
      return 'activity';
  }
}

const KEY = 'gh-lite:feed-prefs';
interface Stored {
  /** Filter categories switched off. */
  hidden: FeedFilterId[];
  /** `owner/name` (lower-cased) whose events are hidden. */
  hiddenRepos: string[];
}
const load = (): Stored => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as Partial<Stored>) : {};
    return { hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [], hiddenRepos: Array.isArray(parsed.hiddenRepos) ? parsed.hiddenRepos : [] };
  } catch {
    return { hidden: [], hiddenRepos: [] };
  }
};

const [prefs, setPrefs] = createSignal<Stored>(load(), { name: 'feedPrefs' });

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) setPrefs(load());
  });
}

const save = (next: Stored) => {
  localStorage.setItem(KEY, JSON.stringify(next));
  setPrefs(next);
};

/** Whether a filter category is shown. Reactive. */
export const feedFilterOn = (id: FeedFilterId) => !prefs().hidden.includes(id);
/** How many categories are switched off (for the Filter button's counter). */
export const feedFiltersOff = () => prefs().hidden.length;

export function setFeedFilter(id: FeedFilterId, on: boolean) {
  const p = prefs();
  save({ ...p, hidden: on ? p.hidden.filter((h) => h !== id) : [...new Set([...p.hidden, id])] });
}

export const hiddenFeedRepos = () => prefs().hiddenRepos;

export function hideFeedRepo(name: string, hide = true) {
  const p = prefs();
  const key = name.toLowerCase();
  save({ ...p, hiddenRepos: hide ? [...new Set([...p.hiddenRepos, key])] : p.hiddenRepos.filter((r) => r !== key) });
}

/** Whether an event passes the filter menu and the hidden-repository list. Reactive. */
export const eventVisible = (e: GitHubEvent) => feedFilterOn(eventCategory(e)) && !prefs().hiddenRepos.includes(e.repo.name.toLowerCase());
