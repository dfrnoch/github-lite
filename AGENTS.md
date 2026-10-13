# Agent Guide

This is a SolidJS 2.x project. Solid is not React: components run once (there is no re-render), reactivity is fine-grained through signals, and effects/memos have Solid-specific semantics. Do not port React patterns.

## Versioned skills (in node_modules — read on demand)

The installed packages ship agent skills that match their exact installed versions:

- `node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md` — repair guide mapping every dev-mode diagnostic code (e.g. `REACTIVE_WRITE_IN_OWNED_SCOPE`, `STRICT_READ_UNTRACKED`) to its prescribed fix. Read it whenever a Solid diagnostic code appears in test output or the browser console.
- `node_modules/@solidjs/diagnostics/skills/agent-loops/SKILL.md` — how to capture reactive evidence (which scopes re-ran and why, wasted recomputes, cost tables) and assert budgets, in tests and against live pages.

## Reactive diagnostics — capture evidence instead of guessing

Use these whenever you are debugging reactivity (something doesn't update, updates too often, or is slow) or verifying a change didn't regress update granularity:

- **In tests:** `captureArtifact()` from `@solidjs/diagnostics` wraps a scenario and returns a serializable artifact of diagnostics + rerun attribution; matchers from `@solidjs/diagnostics/vitest` (`toHaveNoDiagnostics`, `toStayWithinRerunBudget`, `toHaveNoWaste`, …) assert on it. No browser needed.
- **Against the running dev server** (`diagnostics: true` in vite.config.ts; dev-only, no-op in builds). Requires an open page connected to the dev server (e.g. via a browser tool):
  - `GET /__solid/diagnostics` — status and connected client count
  - `POST /__solid/diagnostics` with JSON `{"method":"begin"}` then `{"method":"end"}` — capture a session into an artifact
  - `{"method":"whyDidRun","params":{"name":"<scope name>"}}` — recorded re-runs of one named scope in the open session
  - `{"method":"costs"}` — running cost tables for the open session

Name your signals/memos/effects (the `{ name: "..." }` option) — attribution reports scopes by name.

## Project: GitHub Lite

A lightweight GitHub client. Routes mirror github.com URLs exactly (swap the host, same page). See `IMPLEMENTATION.md` for the feature checklist — tick items off as you finish them.

### Layout

- `src/lib/github.ts` — API client: `gh(path, opts)` (REST), `ghPage` (one page + Link-header pagination), `ghAll`, `gql(query, vars)`. `encodePath()` for file paths.
- `src/lib/{auth,format,markdown,highlight,languages,types,theme}.ts` — helpers. `types.ts` holds REST payload shapes (append new ones at the end).
- `src/features/<area>/api.ts` — router `query()`s (reads) and `action()`s (mutations) for one area; `src/features/<area>/components/` — area components.
- `src/components/ui/` — shared UI kit (import from `src/components/ui`); `src/components/Octicon.tsx` + `src/icons/octicons.ts` (named exports like `repoIcon`, all Primer octicons).
- `src/routes/` — file routes. `[owner]/[repo].tsx` is the repo layout providing `useRepo()` (`src/features/repo/context.ts`).
- `src/styles/primer.css` — Primer class vocabulary: `btn btn-sm btn-primary btn-danger btn-invisible btn-octicon`, `Box Box-header Box-row Box-body Box-footer`, `Label Label--success…`, `Counter`, `State State--open/closed/merged/draft`, `UnderlineNav`, `SegmentedControl`, `NavList NavList-item`, `SelectMenu-item`, `form-control form-select form-group form-label note`, `flash flash-error/warn/success`, `blankslate`, `TimelineItem*`, `timeline-comment*`, `blob-num blob-code diff-table blob-code-addition/deletion/hunk`, `link-plain link-muted`, `container-xl/lg/md`.
- UnoCSS utilities for layout; colors via Primer tokens: `text-fg`, `text-fg-muted`, `text-fg-accent|success|danger|attention|done|severe|open|closed`, `bg-canvas`, `bg-canvas-muted`, `bg-canvas-inset`, `bg-accent-muted`, `bg-success-emphasis`…, `border-line`, `border-line-muted`, `border-line-accent`…. Never hard-code hex colors.

### Patterns (Solid 2 — read before writing code)

- Reads: `const data = createMemo(() => getThing(a, b))` where `getThing = query(async (...) => gh(...), 'thing')`. Render under `<Loading fallback={...}>`. Never call a query directly in JSX.
- Mutations: `export const doThing = action(async (...) => { await gh(..., { method: 'POST', body }) }, 'do-thing')`; in components `const run = useAction(doThing)` and call it from event handlers (`try { await run(...) } catch (e) { toastError(e) }`). The router revalidates the page's queries automatically when an action settles. Busy state: a local `createSignal(false)`.
- **Never name a prop `ref`** — it is reserved by the compiler (use `gitRef` for git refs).
- **Never read props or async values in a component body.** Read them in JSX, memos, or effects. Form fields initialised from data use writable derived signals: `const [title, setTitle] = createSignal(() => props.issue.title)`.
- `aria-*` attributes take strings: `aria-expanded={open() ? 'true' : 'false'}`.
- Effects are two-phase: `createEffect(() => source(), (value) => sideEffect(value))`. Component lifecycle / listeners: `onSettled(() => { …; return cleanup })`.
- Lists: `<For each={items()}>{(item) => …}</For>` (no `.map` in JSX). Conditional classes: `class={['a', { b: cond() }]}`.
- Links are plain `<a href>`; the router intercepts them. Search params: `useSearchParams()`; params: `useParams()`.
- Prefer GraphQL when one request can replace several REST calls; prefer REST for mutations unless GraphQL is the only way.
- Rendered markdown: request `body_html` (`accept: 'application/vnd.github.full+json'` or GraphQL `bodyHTML`) and show it with `<Markdown html=… />`.
- Match github.com's look: compare against real GitHub pages (screenshots) and reuse the Primer classes above.

### Verifying

- `npx tsc --noEmit` and `npx oxlint src` must pass.
- Dev server: `npx vite --port 3000` (check `curl -s localhost:3000 >/dev/null` first; one shared instance is usually already running).
- Screenshot harness: `cd /tmp/shot-tool && GH_TOKEN=$(gh auth token) WAIT=2500 node app.mjs /tmp/appshots /owner/repo/path …` writes PNGs and prints console warnings/errors (Solid diagnostics included). `node eval.mjs <path> '<js expr>'` evaluates in the page.
- **Never perform mutating API calls against real GitHub data while testing** (no creating/editing/deleting anything) — verify mutation UIs up to the submit button, and check request shapes against the REST docs.
