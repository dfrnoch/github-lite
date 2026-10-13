import type { FeatureDef } from '../types';

/** Refined GitHub features owned by the na area. See ../types.ts for the fields. */
export const notApplicableFeatures: FeatureDef[] = [
  { id: "refined-github.css", section: "Code", description: "Reduces tabs\u2019 size to 4 spaces instead of 8 where GitHub doesn't follow the user\u2019s preferences.", status: 'na', note: "Covered by the \"tab-size\" feature." },
  { id: "clean-rich-text-editor", section: "Writing comments", description: "Hides unnecessary comment field tooltips and toolbar items (each one has a keyboard shortcut.)", status: 'na', note: "The comment editor already shows only a minimal toolbar." },
  { id: "clean-conversation-headers", section: "Conversations", description: "Removes duplicate information in the header of PRs (\"User wants to merge X commits from Y into Z\")", status: 'na', note: "The PR header here already omits the duplicate summary." },
  { id: "stop-redirecting-in-notification-bar", section: "Notifications", description: "Stops redirecting to notification inbox from notification bar actions while holding Alt.", status: 'na', note: "There is no notification bar redirect in this app." },
  { id: "notifications-ui", section: "Notifications", description: "Cleans up the Notifications page header, especially on mobile.", status: 'na', note: "The notifications header is already compact." },
  { id: "close-out-of-view-modals", section: "Global", description: "Automatically closes dropdown menus when they\u2019re no longer visible.", status: 'na', note: "Menus close on outside interaction and navigation." },
  { id: "action-used-by-link", section: "Global", description: "Lets you see how others are using the current Action in the Marketplace.", status: 'na', note: "GitHub Marketplace is not part of this app." },
  { id: "clean-footer", section: "Global", description: "Dims the site footer so it's less prominent.", status: 'na', note: "The footer is already a single dimmed line." },
  { id: "night-not-found", section: "Global", description: "Adds dark mode to the global 404 page.", status: 'na', note: "The 404 page already follows the light/dark theme." },
  { id: "github-bugs", section: "Fixes for GitHub shortcomings", description: "Applies various CSS fixes to GitHub's interface.", status: 'na', note: "CSS fixes for github.com bugs that this app does not have." },
  { id: "clean-readme-url", section: "Fixes for GitHub shortcomings", description: "Drops redundant \"readme-ov-file\" parameter from repo URLs.", status: 'na', note: "This app never adds the \"readme-ov-file\" parameter." },
  { id: "click-outside-modal", section: "Fixes for GitHub shortcomings", description: "Closes checks list when clicking outside of modal.", status: 'na', note: "Menus and dialogs here already close on outside click." },
  { id: "no-modals", section: "Fixes for GitHub shortcomings", description: "Disable modals that reduce user-experience instead of enhancing it.", status: 'na', note: "This app has no upsell or interstitial modals." },
  { id: "same-page-links", section: "Fixes for GitHub shortcomings", description: "Keeps links from opening in new tabs when they shouldn't. \"Open in new tab\" must be the user's choice, not the default behavior.", status: 'na', note: "In-app links never force a new tab." },
  { id: "new-tab-links", section: "Fixes for GitHub shortcomings", description: "Lets you open pseudo-links in a new tab with ctrl click or middle click.", status: 'na', note: "Actions that navigate are real links, so ctrl/middle click already works." },
  { id: "extensible-nav", section: "Fixes for GitHub shortcomings", description: "This is a core feature that enables other Refined GitHub features to extend or modify the repository navigation bar.", status: 'na', note: "Core plumbing for injecting tabs into GitHub's DOM; this app owns its tab bar." },
];
