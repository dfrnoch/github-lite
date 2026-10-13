import type { FeatureDef } from '../types';

/** Refined GitHub features owned by the pulls area. See ../types.ts for the fields. */
export const pullsFeatures: FeatureDef[] = [
  { id: "sync-pr-commit-title", section: "Editing pull requests", description: "Uses the PR’s title as the default squash commit title and updates the PR’s title to match the commit title, if changed.", status: 'done', note: 'When the squash commit title is edited, a note offers to cancel; on merge the PR is renamed first (without the "(#123)" suffix).' },
  {
    id: "pr-branch-auto-delete",
    section: "Editing pull requests",
    description: "Automatically deletes the branch right after merging a PR, if possible. Common branch names known to be long-lived are excluded (`develop`, `release/*`, etc)",
    status: 'done',
    note: 'Only when merging from this app, the repo doesn’t already auto-delete, you can push to the head repo and no open PR uses the branch as its base.',
    options: [
      {
        key: 'exceptions',
        label: 'Never delete these branches',
        type: 'string',
        default: 'dev develop development main master next pre prod stage staging /production/ /^release/ /^v\\d/',
        help: 'Space or comma separated: exact names, globs like release-*, or /regular expressions/.',
      },
    ],
  },
  { id: "clear-pr-merge-commit-message", section: "Editing pull requests", description: "Clears the PR merge commit message of clutter, leaving only deduplicated co-authors.", status: 'done', note: 'Squash merges of PRs with more than one commit; keeps Co-authored-by / Signed-off-by trailers (and closing keywords when the base isn’t the default branch). Undo restores GitHub’s message.' },
  { id: "tab-to-indent", section: "Writing comments", description: "Enables tab and shift tab for indentation in comment fields.", status: 'done', hotkeys: ['Tab', 'shift+Tab'], note: 'Escape leaves the field so the keyboard isn’t trapped.' },
  { id: "unfinished-comments", section: "Writing comments", description: "Notifies the user of unfinished comments in hidden tabs.", status: 'done', note: 'Prefixes the tab title with "✏️ Comment -" while the tab is in the background with unsent text.' },
  { id: "no-self-reference", section: "Writing comments", description: "Warns against self-reference links, helping you avoid mistakes.", status: 'done', note: 'Links to the page you’re on (e.g. "#12" inside #12) get a wavy red underline and stop being links.' },
  { id: "monospace-textareas", section: "Global", description: "Uses a monospace font in commit message, description, release body, and other fields that benefit from it.", status: 'done', note: 'Merge commit title/message and fields that opt in (release body, commit messages).' },
];
