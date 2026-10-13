import type { FeatureDef } from '../types';

/** Refined GitHub features owned by the people area. See ../types.ts for the fields. */
export const peopleFeatures: FeatureDef[] = [
  { id: "select-notifications", section: "Highlights", description: "Select notifications by type and status", status: 'todo' },
  { id: "user-profile-follower-badge", section: "Profiles", description: "On profiles, it shows whether the user follows you.", status: 'todo' },
  { id: "mark-private-orgs", section: "Profiles", description: "Marks private organizations on your own profile.", status: 'todo' },
  { id: "profile-hotkey", section: "Profiles", description: "Adds a keyboard shortcut to visit your own profile: g m.", status: 'todo' },
  { id: "show-user-top-repositories", section: "Profiles", description: "Adds a link to the user\u2019s most starred repositories.", status: 'todo' },
  { id: "hide-user-forks", section: "Profiles", description: "Filters out forks and archived repos from profiles by default, leaving only the sources. (but they can still be shown.)", status: 'todo' },
  { id: "linkify-user-location", section: "Profiles", description: "Linkifies the user location in their hovercard and profile page.", status: 'todo' },
  { id: "conversation-links-on-repo-lists", section: "Profiles", description: "Adds a link to the issues and pulls on the user profile repository tab and global search.", status: 'todo' },
  { id: "open-all-notifications", section: "Notifications", description: "Adds a button to the notification page to open all your unread notifications at once.", status: 'todo' },
  { id: "unread-anywhere", section: "Notifications", description: "Adds a button to the global header to open your unread notifications from any page.", status: 'todo' },
  { id: "select-all-notifications-shortcut", section: "Notifications", description: "Adds a shortcut to select all visible notifications: a.", status: 'todo' },
  { id: "pr-notification-link", section: "Notifications", description: "Points PR notifications to the Conversation tabs instead of the commits page, which may be a 404.", status: 'todo' },
  { id: "sticky-notifications-actions", section: "Notifications", description: "Make the notifications action bar sticky.", status: 'todo' },
  { id: "clean-notifications", section: "Notifications", description: "Makes the notifications list more compact when grouped by repo.", status: 'todo' },
  { id: "useful-not-found-page", section: "Global", description: "Adds possible related pages and alternatives on 404 pages.", status: 'todo' },
  { id: "selection-in-new-tab", section: "Global", description: "Adds a keyboard shortcut to open selection in new tab when navigating via j and k: shift o.", status: 'todo' },
  { id: "improve-shortcut-help", section: "Global", description: "Shows all of Refined GitHub\u2019s new keyboard shortcuts in the help modal (? hotkey).", status: 'done', hotkeys: ["?"] },
  { id: "mark-private-repos", section: "Fixes for GitHub shortcomings", description: "Highlights private repositories in the repository list with a distinct color.", status: 'todo' },
];
