import type { FeatureDef } from '../types';

/** Refined GitHub features owned by the repo area. See ../types.ts for the fields. */
export const repoFeatures: FeatureDef[] = [
  {
    id: 'new-repo-disable-projects-and-wikis',
    section: 'Repositories',
    description: 'Automatically disables projects and wikis when creating a repository.',
    status: 'done',
    note: 'Adds a (checked) “Disable Projects and Wikis” box to /new and the fork page. New repos are created without them; template-generated repos and forks are updated right after creation.',
  },
  {
    id: 'sticky-sidebar',
    section: 'Repositories',
    description: 'Makes sidebars sticky in repositories, issues, and PRs, if they fit the viewport.',
    status: 'done',
    note: 'Repo home, issue, pull request and discussion sidebars.',
  },
  {
    id: 'quick-repo-deletion',
    section: 'Repositories',
    description:
      'Simplifies the deletion of repositories. Adds "Delete fork" button on 0-star repos. Enables shift alt clicks to delete repos in 2 clicks.',
    status: 'done',
    note: '“Delete fork” on un-starred forks you administer opens the delete dialog with the name already typed. Alt+click it (or “Delete this repository” in settings) to delete after a single confirmation.',
  },
  {
    id: 'extend-repo-tabs',
    section: 'Repositories',
    description:
      'Collapses repository tabs if rarely used (Insights, Security) or when empty (Projects, Wiki, Actions). It also adds counters to Projects and Wiki.',
    status: 'done',
    note: 'Collapsed tabs move to a ⋯ menu at the end of the tab bar (and come back while you are on them). Actions collapses when the default branch has no check suites; the Projects counter needs a token with read:project. This app has no Wiki tab. Also shortens “Pull requests” to “PRs”.',
  },
  {
    id: 'releases-tab',
    section: 'Tags and releases',
    description: 'Adds a `Releases` tab and a keyboard shortcut: g r.',
    status: 'done',
    note: 'A “Tags” tab instead when the repo has tags but no releases.',
    hotkeys: ['g r'],
  },
  {
    id: 'bugs-tab',
    section: 'Conversations',
    description: 'Adds a "Bugs" tab to repos, if there are any open issues with the "bug" label.',
    status: 'done',
    note: 'Counts open issues with the repo’s bug label (bug, Type: Bug, kind/bug…) or the Bug issue type; the tab opens that issue search and is selected while it is shown.',
  },
];
