import type { FeatureDef } from '../types';

/** Refined GitHub features owned by the conversations area. See ../types.ts for the fields. */
export const conversationsFeatures: FeatureDef[] = [
  { id: "reactions-avatars", section: "Reading comments", description: "Adds reaction avatars showing _who_ reacted to a comment.", status: 'done', note: "Reactors of every comment on the page are fetched in one batched GraphQL request; tooltips list who reacted.", options: [{ key: 'max', label: 'Avatars per reaction', type: 'number', default: 3, min: 1, max: 10 }] },
  { id: "show-names", section: "Reading comments", description: "Adds the real name of users by their usernames.", status: 'done', note: "In comment headers and timeline events; names are fetched in one batched GraphQL request per page." },
  { id: "hide-low-quality-comments", section: "Reading comments", description: "Hides reaction comments (\"+1\", \"\ud83d\udc4d\", \u2026) (except the maintainers\u2019) but they can still be shown.", status: 'done', note: "Issues only, like the extension. Comments by labelled users (owner, member, contributor…) and deep-linked comments are never hidden." },
  { id: "conversation-authors", section: "Conversations", description: "Highlights issues/PRs opened by you or the current repo\u2019s collaborators.", status: 'done', note: "Highlights your own items everywhere and collaborators' (owner / member / collaborator association) on repo lists — no extra request." },
  { id: "last-update-sort", section: "Conversations", description: "Changes the default sort order of issues/PRs to `Recently updated`.", status: 'done', note: "The repo issue / PR lists default to sort:updated-desc." },
  { id: "dim-bots", section: "Conversations", description: "Dims commits and PRs by bots to reduce noise.", status: 'done', note: "Issue / PR list rows and commits in PR timelines." },
  { id: "netiquette", section: "Netiquette", description: "Adds unobtrusive netiquette reminders (old closed issues, highly-active issues, draft PRs, \u2026).", status: 'done', note: "Above the comment box: draft PRs, highly active conversations (for non-moderators) and conversations closed over 3 months ago; plus a kinder placeholder." },
];
