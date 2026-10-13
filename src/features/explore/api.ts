import { query } from '@solidjs/router';
import { ghPage } from '../../lib/github';
import type { Repository } from '../../lib/types';
import type { TopicHit } from '../search/api';

export type Since = 'daily' | 'weekly' | 'monthly';

const DAYS: Record<Since, number> = { daily: 1, weekly: 7, monthly: 30 };

/** YYYY-MM-DD of `days` ago (UTC) — the `created:>` cut-off for "trending". */
function since(days: number) {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Trending approximation: the API has no trending endpoint, so take the most
 * starred repositories created within the period.
 */
export const getTrendingRepos = query(
  async (range: Since, language = '') => {
    const q = [`created:>${since(DAYS[range])}`, language && `language:"${language}"`].filter(Boolean).join(' ');
    const res = await ghPage<Repository>('/search/repositories', { perPage: 25, query: { q, sort: 'stars', order: 'desc' } });
    return res.items;
  },
  'explore-trending',
);

/** Topics curated by GitHub (`is:featured` / `is:curated`). */
export const getCuratedTopics = query(
  async (which: 'featured' | 'curated', page = 1, perPage = 30) => {
    const res = await ghPage<TopicHit>('/search/topics', { page, perPage, query: { q: `is:${which}` } });
    return { items: res.items, total: res.total ?? res.items.length, pageInfo: res.pageInfo };
  },
  'explore-topics',
);

/** Topic metadata (display name, description, logo…) — null for topics GitHub knows nothing about. */
export const getTopic = query(async (name: string): Promise<TopicHit | null> => {
  const res = await ghPage<TopicHit>('/search/topics', { perPage: 10, query: { q: name } });
  return res.items.find((t) => t.name.toLowerCase() === name.toLowerCase()) ?? null;
}, 'explore-topic');

export type TopicSort = 'stars' | 'updated';

/** Public repositories tagged with the topic. */
export const getTopicRepos = query(
  (name: string, sort: TopicSort, page: number) =>
    ghPage<Repository>('/search/repositories', {
      page,
      perPage: 20,
      query: { q: `topic:${name}`, sort, order: 'desc' },
    }),
  'explore-topic-repos',
);
