import type { FeatureDef } from '../types';

/** Refined GitHub features owned by the pulls area. See ../types.ts for the fields. */
export const pullsFeatures: FeatureDef[] = [
  { id: "pr-filters", section: "Viewing pull requests", description: "Adds Checks and Draft PR dropdown filters in PR lists.", status: 'todo' },
  { id: "unclip-checks", section: "Viewing pull requests", description: "Automatically shows all checks without scrolling when expanding the checks panel.", status: 'todo' },
  { id: "pr-approvals-count", section: "Viewing pull requests", description: "Shows color-coded review counts in PR lists.", status: 'todo' },
  { id: "highlight-non-default-base-branch", section: "Viewing pull requests", description: "Shows the base branch in PR lists if it\u2019s not the default branch.", status: 'todo' },
  { id: "hide-inactive-deployments", section: "Viewing pull requests", description: "Hides inactive or failed deployments in PRs.", status: 'todo' },
  { id: "conflict-marker", section: "Viewing pull requests", description: "Shows which PRs have conflicts in PR lists.", status: 'todo' },
  { id: "cross-deleted-pr-branches", section: "Viewing pull requests", description: "Adds a line-through to the deleted branches in PRs.", status: 'todo' },
  { id: "closing-remarks", section: "Viewing pull requests", description: "Shows the first Git tag a merged PR was included in or suggests creating a release if not yet released.", status: 'todo' },
  { id: "view-last-pr-deployment", section: "Viewing pull requests", description: "Adds a link to open the latest deployment to the PR header.", status: 'todo' },
  { id: "emphasize-draft-pr-label", section: "Viewing pull requests", description: "Makes it easier to distinguish draft PR in lists.", status: 'todo' },
  { id: "clean-checks-list", section: "Viewing pull requests", description: "Prioritizes failing and pending checks in the merge checks list, and untruncates long check names.", status: 'todo' },
  { id: "mobile-tabs-pr", section: "Viewing pull requests", description: "Makes the PR tabs smaller so they fit in the screen without scrolling.", status: 'todo' },
  { id: "linkify-pr-review-state", section: "Viewing pull requests", description: "Linkifies the PR review state labels (\"Draft\", \"Changes requested\", etc) in PR lists to filter by that state.", status: 'todo' },
  { id: "sync-pr-commit-title", section: "Editing pull requests", description: "Uses the PR\u2019s title as the default squash commit title and updates the PR\u2019s title to match the commit title, if changed.", status: 'todo' },
  { id: "update-pr-from-base-branch", section: "Editing pull requests", description: "Adds an \"Update branch | Rebase\" button to every PR. GitHub has the same feature, but it must be manually configured for each repo.", status: 'todo' },
  { id: "pull-request-hotkeys", section: "Editing pull requests", description: "Adds keyboard shortcuts to cycle through PR tabs: g \u2190 and g \u2192, or g 1, g 2, g 3, and g 4.", status: 'todo' },
  { id: "pr-branch-auto-delete", section: "Editing pull requests", description: "Automatically deletes the branch right after merging a PR, if possible. Common branch names known to be long-lived are excluded (`develop`, `release/*`, etc)", status: 'todo' },
  { id: "one-click-pr-or-gist", section: "Editing pull requests", description: "Lets you create draft PRs and public gists in one click.", status: 'todo' },
  { id: "clear-pr-merge-commit-message", section: "Editing pull requests", description: "Clears the PR merge commit message of clutter, leaving only deduplicated co-authors.", status: 'todo' },
  { id: "quick-review", section: "Editing pull requests", description: "Adds quick-review buttons to the PR sidebar, automatically focuses the review textarea, and adds a keyboard shortcut to open the review popup: v.", status: 'todo' },
  { id: "quick-resolve-conflicts", section: "Editing pull requests", description: "Turns the \"Resolve conflicts\" dropdown into two plain buttons.", status: 'todo' },
];
