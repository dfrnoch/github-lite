# GitHub Lite

A lightweight, fast reimplementation of the github.com web UI on top of the
public GitHub API. Swap `github.com` for this app's host in any URL and you
land on the same page — same data, same look (GitHub's own Primer design
tokens and Octicons), without the AI features and the bloat.

Built with SolidJS 2, Solid Router, UnoCSS and Vite. See
[`IMPLEMENTATION.md`](./IMPLEMENTATION.md) for what is done and what is left.

## Signing in

Two options, both giving the app a token that is stored only in your browser
and sent only to `api.github.com`:

1. **Personal access token** (works everywhere, including a purely static
   deployment). The login page links to GitHub's "new classic token" form
   with every scope the app can use pre-selected (`repo`, `workflow`,
   `delete_repo`, `admin:org`, `admin:repo_hook`, `admin:public_key`,
   `admin:gpg_key`, `user`, `notifications`, `project`, …). Fine-grained
   tokens also work, limited to what you grant them.
2. **Sign in with GitHub (OAuth App)**. GitHub's token endpoint has no CORS
   and needs the client secret, so this needs the small server bundle:
   create an OAuth App with callback URL `<origin>/login/callback`, then set
   `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (see `.env.example`). The
   button only appears when they are configured.

Classic tokens and OAuth tokens can do everything the API allows: create,
edit and delete repositories, manage settings, collaborators, branch
protection, webhooks, releases, Actions, organizations, teams, and so on.
Things the public API cannot do (creating organizations, wikis, billing)
link out to github.com.

## Development

```bash
bun install
bun run dev          # http://localhost:3000
bun run test         # vitest
bun run typecheck    # tsc
bun run lint         # oxlint
bun scripts/gen-octicons.mjs   # regenerate src/icons/octicons.ts after upgrading @primer/octicons
```

## Building & deploying

```bash
bun run build
```

- `dist/client` is a static site (SPA with history fallback) — deploy it to
  any static host if you only use personal access tokens.
- For OAuth, run the bundled Node server, which serves `dist/client` and the
  token-exchange endpoint: `GITHUB_CLIENT_ID=… GITHUB_CLIENT_SECRET=… bun dist/server/node.js`
  (`PORT`/`HOST` configurable).

### Cloudflare Workers

`wrangler.jsonc` configures everything: static files from `dist/client` with SPA
fallback, and the server bundle as the Worker (OAuth token exchange + code
search proxy).

- Build command: `bun run build` — Deploy command: `bunx wrangler deploy`
- Build variable **`BUN_VERSION` = `1.4.3`** (the build image's default Bun is too
  old for `bun.lock`)
- Optional OAuth: add `GITHUB_CLIENT_ID` as a variable and `GITHUB_CLIENT_SECRET`
  as a secret on the Worker (Settings → Variables and secrets), with the OAuth
  App callback URL `https://<your-domain>/login/callback`.

## How it works

- `src/lib/github.ts` — REST + GraphQL client. GETs revalidate the browser's
  HTTP cache with ETags, so unchanged data costs nothing against the rate
  limit (shown in the footer).
- Reads are router `query()`s, mutations router `action()`s; the router
  refetches the page's data after every mutation.
- Markdown (READMEs, issue bodies, comments, previews) is rendered by
  GitHub's API, so it matches github.com exactly; links back to github.com
  are rewritten to stay in the app.
- Syntax highlighting uses Shiki with lazily loaded grammars.
- Routes in `src/routes` mirror github.com's URL layout
  (`/:owner/:repo/blob/:ref/:path`, `/:owner/:repo/pull/:n/files`, …).
