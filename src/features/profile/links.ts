import { feature } from '../refined';

/**
 * Links to an owner's Repositories tab. With Refined GitHub's
 * `hide-user-forks` they open on `type=source` (no forks or archived repos);
 * "All" in the Type menu still lists everything. Reactive — read in JSX.
 */
export const userReposHref = (login: string) => `/${login}?tab=repositories${feature('hide-user-forks') ? '&type=source' : ''}`;

export const orgReposHref = (org: string) => `/orgs/${org}/repositories${feature('hide-user-forks') ? '?type=source' : ''}`;

/** `linkify-user-location`: a location string → an OpenStreetMap search. */
export const locationMapHref = (location: string) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(location.trim())}`;
