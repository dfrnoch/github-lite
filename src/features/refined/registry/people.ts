import type { FeatureDef } from '../types';

/** Refined GitHub features owned by the people area. See ../types.ts for the fields. */
export const peopleFeatures: FeatureDef[] = [
  {
    id: "hide-user-forks",
    section: "Profiles",
    description: "Filters out forks and archived repos from profiles by default, leaving only the sources. (but they can still be shown.)",
    status: 'done',
    note: 'Links to user and organization Repositories tabs (profile tabs, “Your repositories”, “View all repositories”) open with type=source; pick “All” in the Type menu to see everything.',
  },
  {
    id: "open-all-notifications",
    section: "Notifications",
    description: "Adds a button to the notification page to open all your unread notifications at once.",
    status: 'done',
    note: '“Open all unread” (inbox header), “Open unread” (per repository) and “Open” for the selection (p). Opens oldest first and marks them read (alt-click: done). Browsers block all but the first tab unless pop-ups are allowed for this site.',
    hotkeys: ["p"],
  },
  {
    id: "unread-anywhere",
    section: "Notifications",
    description: "Adds a button to the global header to open your unread notifications from any page.",
    status: 'done',
    note: 'An arrow button joined to the header’s inbox icon (or g u) opens the 5 newest unread notifications in new tabs and marks them read. Allow pop-ups for this site to open more than one.',
    hotkeys: ["g u"],
  },
  {
    id: "clean-notifications",
    section: "Notifications",
    description: "Makes the notifications list more compact when grouped by repo.",
    status: 'done',
    note: 'The inbox is always grouped by repository here (no repeated repo names); this puts the #number before the title and tightens the rows.',
  },
  {
    id: "mark-private-repos",
    section: "Fixes for GitHub shortcomings",
    description: "Highlights private repositories in the repository list with a distinct color.",
    status: 'done',
    note: 'The “Private” label of profile and organization repository lists turns attention-colored.',
  },
];
