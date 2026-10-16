# GitHub Lite — implementation list

A lightweight GitHub client: swap `github.com` for this app's host in any URL and
land on the same page, backed by the GitHub REST + GraphQL APIs with the user's
token. No AI features, no marketing pages.

Legend: `[x]` done · `[~]` partial · `[ ]` todo · `[-]` not possible via the public API

## Foundation

- [x] Packages updated to latest (Solid 2 `next`, Vite 8, Vitest 5, TS 7, UnoCSS 66)
- [x] Primer design tokens (`@primer/primitives` light + dark), hand-written Primer component CSS (`src/styles/primer.css`)
- [x] Tree-shakeable Octicons (`scripts/gen-octicons.mjs` → `src/icons/octicons.ts`)
- [x] API client: REST (`gh`, `ghPage`, `ghAll`), GraphQL (`gql`), ETag revalidation, rate-limit tracking (`src/lib/github.ts`)
- [x] Auth: personal access token (classic, scopes pre-filled) — works on any static host
- [x] Auth: OAuth App via one server function (`src/lib/oauth.ts`, needs `GITHUB_CLIENT_ID/SECRET`)
- [x] Theming like github.com: single theme or sync with system (day/night), all Primer themes (light, dark, dark dimmed, Protanopia & Deuteranopia, Tritanopia) with per-family "increase contrast" (high-contrast variants), plus 21 community themes (Midnight (true black), Dracula, Nord, Catppuccin ×4, Tokyo Night (+ Day), One Dark, Gruvbox ×2, Solarized ×2, Rosé Pine (+ Dawn), Monokai, Everforest, Kanagawa, Ayu Mirage, Synthwave) generated from Primer's tokens; live previews on `/settings/appearance`, applied before first paint
- [x] App header (context breadcrumbs, search with `/` shortcut, create menu, issues/PRs/notifications, user menu box anchored to the avatar, nav drawer)
- [x] UI kit: Avatar, Dropdown, Dialog, Toast, Pagination, Markdown (GitHub-rendered HTML), MarkdownEditor (write/preview/toolbar, @-mention suggester: the issue / PR's people first, then the repo's mentionable users), RelativeTime, IssueLabel, Blankslate, CopyButton, ErrorView
- [x] github.com links inside rendered markdown are rewritten to stay in-app
- [x] User / organization hovercards app-wide (`src/components/hovercard/`): delegated on profile links + `data-hovercard-user`, status, pronouns, bio, location, `GET /users/:login/hovercard` context lines for the current repo / issue / PR, Follow button
- [x] Shared `Popover` primitive (`src/components/ui/Popover.tsx`): anchored, caret, flip + viewport clamp, outside-click / Escape
- [x] Checks popover on every commit status icon (`src/components/checks/ChecksStatus.tsx`): commit lists, commit page, latest-commit bar, branches, PR list rows, PR timeline commits, repo-header CI icon
- [~] Commit signature badge `VerifiedBadge` with details popover (GPG key ID / SSH fingerprint, signer, failure reason) — "Partially verified" and vigilant-mode "Unverified" for unsigned commits aren't exposed by the API
- [ ] Route `preload`s for the heavy pages (removes the request waterfalls the Solid diagnostics report)
- [~] Keyboard shortcuts beyond `/` (`t` file finder done on code pages; `g i`, `g p`, … todo)
- [x] Rendered markdown and syntax highlighting follow the selected theme (generated themeable markdown CSS; github.com's `pl-*` syntax classes)

## Repository — code (`/:owner/:repo`)

- [x] Repo layout + tab bar with counters (Code, Issues, PRs, Discussions, Actions, Projects, Security, Insights, Settings)
- [x] Repo home: title, Watch (all/participating/ignore), Fork, Star, branch picker, branch/tag counts, latest commit bar, file table with per-file last commit, README, About sidebar (edit description/website/topics), releases (latest + newer pre-release, or tag count), contributors (count + top 14 avatars), languages, clone/ZIP menu, empty-repo quick setup
- [x] Tree view `/tree/:ref/:path*` (branch names with slashes resolved like github.com)
- [x] Blob view `/blob/:ref/:path*`: syntax highlighting (lazy Shiki), line numbers, `#L10-L20` selection, markdown preview, images, binary detection, raw/copy/download, delete file
- [x] File tree side panel on tree/blob/blame pages (lazy directories, current path expanded, collapse remembered)
- [x] Go to file / file finder (`/find/:ref`, fuzzy match, keyboard nav, `t` hotkey on code pages)
- [x] Blame `/blame/:ref/:path*` (GraphQL blame hunks, age colors, reblame to parent) *(agent: code)*
- [x] Edit file `/edit/:ref/:path*`, create file `/new/:ref/:path*` (rename via path input, preview / diff preview, commit to branch or new branch + PR) *(agent: code)*
- [x] Commits `/commits/:ref/:path*` (grouped by day, author + date filters, `?after=`/`?before=` cursors like github.com) *(agent: code)*
- [x] Commit `/commit/:sha` with diff (parents, default-branch containment, associated PRs, checks, verified) *(agent: code)*
- [x] Compare `/compare/:base...:head` (+ fork heads `owner:branch`, `?expand=1`, `quick_pull`, `title`/`body`) + "Open a pull request" form (template, draft) *(agent: code)*
- [x] Branches `/branches` (overview/yours/active/stale/all, search, ahead/behind, checks, PR badge, create, rename, delete + restore, protected badge) *(agent: code)*
- [x] Shared DiffView (unified + split, highlighting, word diff, file tree, viewed state, expand context, large-diff collapse, `#diff-<sha256>` anchors, review-comment slots) *(agent: code)*

## Issues *(agent: issues)*

- [x] List `/issues` with GitHub's query syntax (is:open, label:, author:, assignee:, milestone:, sort), filter dropdowns, pagination
- [x] Issue `/issues/:n`: timeline (comments, events, cross references, commits), reactions, edit title/body, close as completed / not planned, reopen, lock, delete comment, edit comment
- [x] Sidebar editing: assignees, labels, milestone, (type, projects read-only), subscribe/unsubscribe, pin, transfer
- [~] New issue `/issues/new` (+ markdown issue templates, `?title=&body=&labels=&assignees=&milestone=`; YAML issue forms are not exposed by the API)
- [x] Labels `/labels` (create, edit, delete, colors)
- [x] Milestones `/milestones`, `/milestone/:n`, new/edit/close/delete
- [x] Global `/issues` (created / assigned / mentioned)

## Pull requests *(agents: issues = conversation, code = files/commits)*

- [x] List `/pulls` with filters (review status, draft, labels…)
- [x] PR layout `/pull/:n` (title, state, branches, tabs with counts) — `usePull()` in src/features/pulls/context.ts
- [x] Conversation tab: timeline (reviews, review comments, commits, force-pushes, status), merge box (merge/squash/rebase, delete branch, mergeability, checks summary), draft → ready, close/reopen, request reviewers, edit base branch
- [x] Files changed `/pull/:n/files` (diff, review threads under their side in split view with reply/resolve, multi-line comments by dragging "+" or line numbers, single comment / start review on pending review, submit comment/approve/request changes, mark viewed)
- [x] Commits `/pull/:n/commits`
- [x] Checks `/pull/:n/checks` *(agent: actions)* — grouped by workflow/app, `?check_run_id=` details (summary, annotations), commit statuses
- [x] Global `/pulls` (created / assigned / mentioned / review requested)

## Actions *(agent: actions)*

- [x] Runs list `/actions` (workflow sidebar, filters: event/status/branch/actor), `/actions/workflows/:file` — github.com's `?query=` syntax, pagination, delete run
- [x] Run `/actions/runs/:id` (jobs graph/list, annotations, artifacts, re-run all/failed, cancel, delete) + `/attempts/:n`, polling while running
- [x] Job logs `/actions/runs/:id/job/:job` (steps, collapsible groups, ANSI colors, timestamps) + search, `#step:N:L` links, raw/download (logs of running jobs: not in the REST API → link to github.com)
- [x] Workflow dispatch (run workflow with inputs), enable/disable workflow
- [x] Caches `/actions/caches` (filter, sort, delete), self-hosted runners `/actions/runners`
- [x] Discussions `/discussions`, `/discussions/categories/:slug`, `/discussions/:n`, `/discussions/new` (GraphQL: list by category, answer, comment, create, replies, upvotes, reactions, lock, close, polls)

## Repository management *(agent: repo-admin)*

- [x] New repository `/new` (owner picker incl. orgs, debounced name availability, template + include all branches, README/gitignore/license init, `?owner=&name=&template_owner=&template_name=`)
- [x] Fork `/fork` (owner, name availability, description, default-branch-only; waits for the async fork before navigating)
- [x] Settings `/settings`: rename, template, signoff, default branch switch, features (issues/wiki/projects/discussions), merge button options + default commit messages, update branch / auto-merge / delete head branches, forking (private org repos), visibility, archive/unarchive, transfer, delete
- [x] Collaborators `/settings/access` (invite via user search, change role, remove; pending invitations: change role / cancel; org repos: teams add/change/remove)
- [x] Branch protection `/settings/branches` + `/settings/branch_protection_rules/new|:id` (GraphQL create/update/delete)
- [~] Rulesets `/settings/rules`, `/settings/rules/new|:id` (basic editor: name, enforcement, include/exclude targets, common rules; bypass actors + unknown rules preserved, not editable)
- [x] Actions permissions `/settings/actions` (allowed actions policy, GITHUB_TOKEN default permissions)
- [x] Webhooks `/settings/hooks` (create, edit, delete, ping, recent deliveries with request/response, redeliver)
- [x] Deploy keys `/settings/keys` (+ `/new`, fingerprints, delete)
- [x] Actions secrets & variables `/settings/secrets/actions`, `/settings/variables/actions` (+ `/new`, `/:name`; secrets sealed in-browser with tweetnacl + blakejs `crypto_box_seal`, lazy-loaded)
- [x] Pages settings `/settings/pages` (enable, branch/folder or Actions source, custom domain, enforce HTTPS, unpublish)
- [x] Releases `/releases` (sticky "Release list" column with scroll spy + anchors, stacked cards, long notes clamped), `/releases/tag/:tag` (release list column paged around the release, Compare ▾ tag menu, commit SHA + signature, Immutable, commits since release), `/releases/new` (`?tag=`), `/releases/edit/:tag` (tag picker/create on target, generate notes, binaries upload/delete, pre-release/latest, draft), delete; Tags `/tags` (verified, zip/tar, notes, delete tag)
- [x] Release search ("Find a release", `?q=`) — not in the API: matches name/tag over up to 1000 release names (GraphQL), first 10 matches
- [x] Stargazers, watchers (user cards, cursor pagination; GitHub hides stargazer lists of repos you don't admin), forks (sort, pagination)
- [x] Insights: contributors (period/metric, area chart + per-contributor charts, 202 retry), commit activity, code frequency, traffic (push access), pulse (`/pulse/:period`), activity (`/activity` with filters); hand-rolled SVG charts with hover tooltips
- [x] Security tab: overview, security policy (repo or owner `.github` SECURITY.md), advisories list + detail, Dependabot alerts (graceful when the token lacks access)
- [x] Projects tab `/projects`: linked Projects v2 (links out to github.com; explains a missing `read:project` scope)

## People & organizations *(agent: people)*

- [x] Dashboard `/` (pinned repositories (local, drag/↑↓ reorder; also Pin button on repo title + nav drawer), top repositories with filter + hover pin, recent activity; github.com-style "Feed": event cards with badged avatars, PR/issue titles + state pills + rendered body excerpts + reactions + comment counts, release notes + contributors, repo cards with Star group, trending repositories card, Filter menu + per-repo hide (local), one batched GraphQL query per page, "More" paging)
- [x] User profile `/:user` (overview with README profile, pinned/popular, contribution graph + year picker (click a day for its activity: commits per repo, PRs, issues, reviews), activity summary; tabs Repositories (search/type/language/sort) / Projects + Packages (link-out lists) / Stars / Followers / Following; follow/unfollow; inline edit profile)
- [x] Organization profile `/:org` (overview: README, pinned/popular, recent repos, people, top languages, topics; `/orgs/:org/repositories` with filters; projects/packages link-out lists; `/:org?tab=x` redirects)
- [x] Org management `/orgs/:org/...`: people (invite, roles, remove, convert, publicize, bulk), pending/failed invitations, outside collaborators, teams (create/edit/delete, members, repos), settings (profile, member privileges, delete); `/organizations/:org/settings/*` redirects
- [-] Creating organizations (API is GitHub Enterprise Server only — links to github.com)
- [x] User settings `/settings/...`: profile, account, appearance, emails, SSH / signing / GPG keys, organizations (leave, publicize, accept invites), blocked users, social accounts, notifications info, token scopes
- [x] Notifications `/notifications` (inbox / done / filters by repo & reason, mark read/done, unsubscribe, bulk actions)
- [x] Search `/search?q=&type=` (repositories, code, issues, PRs, discussions, users, commits, topics) with GitHub's qualifiers (code search goes through a tiny server-function proxy: `/search/code` has no CORS)
- [x] Explore `/explore`, topics `/topics`, `/topics/:topic`
- [-] Gists live on gist.github.com (separate host) — out of scope for now
- [-] Wiki (no API), Codespaces/Copilot (excluded on purpose)

## Refined GitHub features

- [x] Optional-feature registry with toggles and options (`/settings/refined`, stored per browser, all on by default) for the 41 opinionated features
- [x] `?` keyboard-shortcut dialog listing every active shortcut; GitHub's `g …` navigation shortcuts
- [x] Refined GitHub features: 129 quality-of-life features are permanent behaviour (no toggle); 41 opinionated ones stay optional; the rest were already built in or don't apply and were dropped
- [x] Navigation progress bar (GitHub's top loading bar)

## Quality

- [~] Tests for lib helpers (format, markdown link rewriting, README URL resolution, Actions helpers); components untested
- [ ] Mobile layout pass
- [ ] Accessibility pass (focus handling in menus/dialogs, labels)
