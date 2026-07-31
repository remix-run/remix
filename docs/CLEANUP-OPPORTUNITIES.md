# Docs De-duplication: Remaining Opportunities

> **Workflow note:** Do not commit or push changes from this doc until they have been reviewed.
> Leave changes in the working tree for review first.

Status of the `docs/` restructure after moving `api/`, `guides/`, and the new `shared/` workspace
under `docs/`. The shell (`DocsShell`, `DocsHeader`, `DocsFooter`, `Icon`, markdown content mixin),
the prerender crawler, the table-of-contents implementation, and the shared stylesheets already
live in `docs/shared`. This doc lists what is still duplicated or divergent between the two sites,
proposed tasks, and open questions.

**Completed:**

- ✅ Task 1 (De-fork stylesheets) — shared CSS layers moved to `docs/shared/styles/`, served via
  both sites' asset servers (option b). Api CSS moved from static `public/` to the asset server.
- ✅ Task 2 (Share table of contents) — `DocsTableOfContents` + browser behavior + tests moved to
  `docs/shared/ui/`. Api adopted `clientEntry(import.meta.url)`, dropping prop-drilling.
- ✅ Task 3 (Shared prerender runner) — public-file copying, crawling, output writing, Pagefind, and
  guaranteed asset-server cleanup moved to `docs/shared/prerender/run.ts`.
- ✅ Open question 2 — versioned basePath works correctly with `clientEntry(import.meta.url)`;
  the asset server's basePath is applied inside `getHref`.
- ✅ Open question 3 — CSS delivery uses option b (asset server).

Context: `api/` deploys to api.remix.run, `guides/` to guides.remix.run. Both are prerendered to
static HTML via `remix-docs-shared/prerender/run` and indexed with Pagefind.

## Architecture snapshot

| Concern        | `docs/api`                                                          | `docs/guides`                                                            | `docs/shared`                                          |
| -------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| Content        | typedoc-generated markdown + demos, versioned                       | hand-authored chapters + examples                                        | —                                                      |
| Markdown       | `marked` + custom extensions, `front-matter`                        | unified/remark/rehype, `gray-matter`                                     | —                                                      |
| CSS delivery   | `src/styles/docs.css` through asset server, `@import` shared layers | `styles/docs.css` through asset server, fingerprinted + minified in prod | `docs/shared/styles/*.css` served via `/docs-shared/*` |
| Client entries | `clientEntry(import.meta.url)` resolved by `resolveClientEntry`     | `clientEntry(import.meta.url)` resolved by `render()` middleware         | shared behaviors use `clientEntry(import.meta.url)`    |
| Server         | `src/server/index.ts`, no compression/logger                        | `server.ts` + dev-refresh SSE, compression + logger middleware           | —                                                      |
| Search         | Pagefind 1.5.2 (catalog), compact + full button                     | Pagefind 1.5.2 (catalog), full button only                               | `docs/shared/search/*`                                 |

## Tasks

### 1. ✅ De-fork the copied stylesheets (done)

Shared CSS layers (tokens, base, shell, search, article, markdown) moved to
`docs/shared/styles/`, served through both sites' asset servers via the existing
`/docs-shared/*path → docs/shared/*path` fileMap (option b). Each site keeps a small site-only
layer (`docs/api/src/styles/api.css`; `docs/guides/app/styles/{index,chapters-nav}.css`). The
`guides-` prefix is gone from all api CSS.

Api CSS delivery moved from static `public/*.css` to the asset server (`docs/api/src/styles/`),
adding `stylesheetHref`/`stylesheetPreloads` to `DocsContext` → `Document` → `Head`. The preload
links are required so the prerender crawl discovers and writes the `@import`ed shared CSS files.
This also gives api CSS production fingerprinting and minification.

### 2. ✅ Share the table-of-contents implementation (done)

`DocsTableOfContents` (server component + `DocsHeadingLink` type), `TableOfContentsBehavior`
(browser), `table-of-contents-active.browser.ts`, `selection-indicator.browser.ts`, and all tests
moved to `docs/shared/ui/`. The shared component supports h2 + h3 nesting (`docs-toc__item--nested`).

Api adopted `clientEntry(import.meta.url)`, dropping the `behaviorEntryHref`/
`tableOfContentsEntryHref` prop-drilling. The api markdown pipeline now collects h3 headings with
`depth: 2 | 3` for consistency with guides. Verified that versioned basePath prerendering resolves
the module URL correctly (open question 2, resolved).

The guides `chapter-navigation-indicator.browser.ts` imports `selection-indicator.browser` from
the shared package via a new `remix-docs-shared/ui/selection-indicator.browser` export.

### 3. ✅ Share the prerender runner (done)

`prerender(router, options)` now lives in `docs/shared/prerender/run.ts` and owns public-directory
copying, crawling, output writing, and Pagefind. Copying, crawling, and Pagefind run inside a single
`try`/`finally`, so each site's asset server closes even when prerendering fails.

The site scripts still own their CLI parsing and seeding: api keeps version handling,
`ignorePageNofollow`, and its versioned Pagefind directory; guides keeps browser-entry discovery.
The runner's `publicDirs` option provides the seam for moving shared static assets in task 5.

### 4. Shared server bootstrap

`api/src/server/index.ts` and `guides/server.ts` duplicate: `http.createServer` +
`createRequestListener`, error handling, port parsing, and graceful shutdown
(`SIGINT`/`SIGTERM`, `closeAllConnections`, `assetServer.close`). Guides adds dev-refresh SSE.

Task: `docs/shared/server.ts` helper, e.g. `startDocsServer(router, { assetServer, devRefresh })`.
Small, low-risk win. Consider giving api the dev-refresh flow too (it currently relies on
`node --watch` restarts + manual browser reload).

### 5. Single source for static assets

Byte-identical in both `public/` dirs: `icons.svg`, `favicon.svg`, `remix-logo-light-mode.svg`,
`remix-wordmark-light-mode.svg`. These are an implicit contract of the shared `Icon`/`DocsHeader`
components (they reference `/icons.svg`, `/remix-logo-light-mode.svg`, etc. by absolute path).

Task: move them to `docs/shared/assets/` and copy into each site's output at build/prerender time;
document the contract in a `docs/shared/README.md`.

Also: `api/public` ships `remix-wordmark-dark-mode.svg` and both `racing` wordmarks, but nothing
references them (dark mode is a CSS `invert(1)` filter; the only grep hit is a router test).
Confirm and delete.

### 6. Unify the `Document` head (optional — discuss)

Both documents hand-roll the same skeleton: charset/viewport/description metas, favicon links,
Pagefind CSS link ordered first, modulepreloads, title, Pagefind script, body + modal + entry
script. Differences that would need slots: api's `text/markdown` alternate link, robots
noindex/nofollow for versioned pages, `favicon.ico`, per-demo preloads; guides' dev-refresh script
and asset-entry middleware.

A shared `DocsDocument` with `head`/`bodyEnd` slots is doable, but may end up so slot-heavy it
obscures more than it saves. Search is already extracted; recommend doing this _after_ task 2
shrinks the remaining head/body surface, then re-evaluating.

### 7. Feature-parity gaps (product decisions, flag for review)

- **Code-block copy buttons**: guides has `code-block-copy.browser.tsx`; api code blocks have no
  copy affordance. If desired on api, move the component to `docs/shared/ui` and adopt.
- **Sidebar navigation indicator**: guides animates the sidebar highlight across navigations
  (`chapter-navigation-indicator.browser.ts`); api's sidebar has static active styles only.
  Possibly intentional — api's sidebar is grouped `<details>` sections — but decide explicitly.

### 8. Config and dependency drift

- Three near-identical `tsconfig.json`s with copy-paste drift: only guides has
  `DOM.AsyncIterable`; api lacks `"types": ["node"]`; the `remix/ui` jsx-runtime `paths` block is
  duplicated in api + guides. Task: `docs/tsconfig.base.json` + `extends`.
- Version drift across the two `package.json`s: independently pinned `shiki`, `github-slugger`,
  and `@types/hast`. Task: move shared deps to the pnpm catalog.
- Frontmatter parsing uses different packages (`front-matter` vs `gray-matter`); the api one needs
  an untyped-default-export cast. Cheap alignment on `gray-matter` when touching the markdown code.

### 9. Docs about the docs

- `guides/README.md` still points at `app/actions/docs/docs-shell.browser.tsx`, which moved to
  `docs/shared/ui/`. Update the "Where things live" section.
- `docs/shared` has no README. Add one covering: what belongs in shared vs a site, the static-asset
  contract (task 5), the `/docs-shared/*` asset mapping both sites must provide, and how tests run.
- `docs/api` has no README at all; a short one matching the guides README structure would help.

## Deliberately not unified (for now)

**Markdown pipelines.** api (`marked` + custom heading/link/symbol extensions) vs guides
(unified/remark/rehype + directives/frames). Consolidating is a large project with real behavioral
risk (auto-linked API symbols, `::frame` directives, demo embedding) and unclear payoff while the
outputs already share `docsMarkdownContentCss` and CSS class conventions. Recommendation: keep
both, but extract the small convergence points — Shiki theme/config, heading slug + `titleHtml`
conventions — into shared helpers so the rendered HTML stays compatible with the shared styles.
Revisit after the guides pipeline stabilizes.

**Sidebars.** Chapter list vs versioned/grouped API registry are genuinely different products; the
shell already treats them as a slot. No action.

**Version switcher, routes, registries.** api-only concerns; leave in `docs/api`.

## Open questions

1. Where does guides.remix.run deploy from? api's publish flow dispatches to the external
   `remix-run/remix-api-docs` repo — knowing the guides deploy path determines whether server-side
   middleware (compression) matters at all, and where the Pagefind version is actually pinned.
2. ~~Does prerendering api with a versioned `basePath` interact badly with
   `clientEntry(import.meta.url)` resolution?~~ **Resolved:** works correctly — the versioned asset
   server basePath is applied inside `getHref`.
3. ~~CSS strategy decision (a/b/c).~~ **Resolved:** option b (asset server).

## Suggested ordering

1. ~~Task 2 (TOC)~~ — ✅ done.
2. ~~Task 1 (CSS)~~ — ✅ done.
3. ~~Task 3 (prerender runner)~~ — ✅ done.
4. Task 5 (assets), then task 4 (server bootstrap) — mechanical.
5. Tasks 7–9 as follow-ups; task 6 re-evaluated at the end.
