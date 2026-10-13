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
- [x] Light / dark / system theme switch
- [x] App header (context breadcrumbs, search with `/` shortcut, create menu, issues/PRs/notifications, user drawer, nav drawer)
- [x] UI kit: Avatar, Dropdown, Dialog, Toast, Pagination, Markdown (GitHub-rendered HTML), MarkdownEditor (write/preview/toolbar), RelativeTime, IssueLabel, Blankslate, CopyButton, ErrorView
- [x] github.com links inside rendered markdown are rewritten to stay in-app
- [ ] Route `preload`s for the heavy pages (removes the request waterfalls the Solid diagnostics report)
- [ ] Keyboard shortcuts beyond `/` (`t` file finder, `g i`, `g p`, …)
- [ ] Respect forced light/dark theme inside `.markdown-body` (github-markdown-css follows the OS)

## Repository — code (`/:owner/:repo`)

- [x] Repo layout + tab bar with counters (Code, Issues, PRs, Discussions, Actions, Projects, Security, Insights, Settings)
- [x] Repo home: title, Watch (all/participating/ignore), Fork, Star, branch picker, branch/tag counts, latest commit bar, file table with per-file last commit, README, About sidebar (edit description/website/topics), releases, languages, clone/ZIP menu, empty-repo quick setup
- [x] Tree view `/tree/:ref/:path*` (branch names with slashes resolved like github.com)
- [x] Blob view `/blob/:ref/:path*`: syntax highlighting (lazy Shiki), line numbers, `#L10-L20` selection, markdown preview, images, binary detection, raw/copy/download, delete file
- [ ] File tree side panel on tree/blob pages
- [ ] Go to file / file finder (`/find/:ref`)
- [ ] Blame `/blame/:ref/:path*` *(agent: code)*
- [ ] Edit file `/edit/:ref/:path*`, create file `/new/:ref/:path*` (commit to branch or new branch + PR) *(agent: code)*
- [ ] Commits `/commits/:ref/:path*` (grouped by day, author filter, pagination) *(agent: code)*
- [ ] Commit `/commit/:sha` with diff *(agent: code)*
- [ ] Compare `/compare/:base...:head` + "Open a pull request" form *(agent: code)*
- [ ] Branches `/branches` (overview/yours/active/stale, create, rename, delete, protected badge) *(agent: code)*
- [ ] Shared DiffView (unified + split, file tree, viewed state, expand context) *(agent: code)*

## Issues *(agent: issues)*

- [ ] List `/issues` with GitHub's query syntax (is:open, label:, author:, assignee:, milestone:, sort), filter dropdowns, pagination
- [ ] Issue `/issues/:n`: timeline (comments, events, cross references, commits), reactions, edit title/body, close as completed / not planned, reopen, lock, delete comment, edit comment
- [ ] Sidebar editing: assignees, labels, milestone, (type, projects read-only), subscribe/unsubscribe, pin, transfer
- [ ] New issue `/issues/new` (+ issue templates / forms if simple)
- [ ] Labels `/labels` (create, edit, delete, colors)
- [ ] Milestones `/milestones`, `/milestone/:n`, new/edit/close/delete
- [ ] Global `/issues` (created / assigned / mentioned)

## Pull requests *(agents: issues = conversation, code = files/commits)*

- [ ] List `/pulls` with filters (review status, draft, labels…)
- [ ] PR layout `/pull/:n` (title, state, branches, tabs with counts)
- [ ] Conversation tab: timeline (reviews, review comments, commits, force-pushes, status), merge box (merge/squash/rebase, delete branch, mergeability, checks summary), draft → ready, close/reopen, request reviewers, edit base branch
- [ ] Files changed `/pull/:n/files` (diff, review comments, start review / submit approve/request changes/comment, mark viewed)
- [ ] Commits `/pull/:n/commits`
- [ ] Checks `/pull/:n/checks` *(agent: actions)*
- [ ] Global `/pulls` (created / assigned / mentioned / review requested)

## Actions *(agent: actions)*

- [ ] Runs list `/actions` (workflow sidebar, filters: event/status/branch/actor), `/actions/workflows/:file`
- [ ] Run `/actions/runs/:id` (jobs graph/list, annotations, artifacts, re-run all/failed, cancel, delete)
- [ ] Job logs `/actions/runs/:id/job/:job` (steps, collapsible groups, ANSI colors, timestamps)
- [ ] Workflow dispatch (run workflow with inputs), enable/disable workflow
- [ ] Discussions `/discussions`, `/discussions/:n` (GraphQL: list by category, answer, comment, create)

## Repository management *(agent: repo-admin)*

- [ ] New repository `/new` (owner picker incl. orgs, template, README/gitignore/license init)
- [ ] Fork `/fork` (owner, name, default-branch-only)
- [ ] Settings `/settings`: rename, description, visibility, features (issues/wiki/projects/discussions), merge button options, default branch, template, archive/unarchive, transfer, delete
- [ ] Collaborators `/settings/access` (invite, change permission, remove; pending invitations)
- [ ] Branch protection `/settings/branches` + rulesets `/settings/rules`
- [ ] Webhooks `/settings/hooks` (create, edit, deliveries, redeliver, ping)
- [ ] Deploy keys `/settings/keys`
- [ ] Actions secrets & variables `/settings/secrets/actions`, `/settings/variables/actions` (secrets need libsodium sealed boxes)
- [ ] Pages settings `/settings/pages`
- [ ] Releases `/releases`, `/releases/tag/:tag`, new/edit/delete, assets list; Tags `/tags`
- [ ] Stargazers, watchers, forks lists
- [ ] Insights: contributors graph, commit activity, code frequency, traffic (admins), activity
- [ ] Security tab: security policy, advisories, Dependabot alerts (if token allows)

## People & organizations *(agent: people)*

- [~] Dashboard `/` (recent repos list; feed of received events todo)
- [ ] User profile `/:user` (overview with README profile, pinned items, contribution graph, activity; tabs Repositories / Stars / Followers / Following; follow/unfollow; edit profile)
- [ ] Organization profile `/:org` (overview, repositories with filters, people, teams)
- [ ] Org management `/orgs/:org/...`: people (invite, roles, remove), teams (create/edit/delete, members, repos), settings (profile, member privileges)
- [-] Creating organizations (API is GitHub Enterprise Server only — links to github.com)
- [ ] User settings `/settings/...`: profile, emails, SSH keys, GPG keys, organizations (leave), blocked users, social accounts, notifications info
- [ ] Notifications `/notifications` (inbox / done / filters by repo & reason, mark read/done, unsubscribe)
- [ ] Search `/search?q=&type=` (repositories, code, issues, PRs, users, commits, topics) with GitHub's qualifiers
- [ ] Explore `/explore`, topics `/topics/:topic`
- [-] Gists live on gist.github.com (separate host) — out of scope for now
- [-] Wiki (no API), Codespaces/Copilot (excluded on purpose)

## Quality

- [ ] Tests for lib helpers (format, markdown link rewriting, ref resolution) and key components
- [ ] Mobile layout pass
- [ ] Accessibility pass (focus handling in menus/dialogs, labels)
