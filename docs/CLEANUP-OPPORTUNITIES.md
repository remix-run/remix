# Docs De-duplication Opportunities

> Do not commit or push changes from this document until they have been reviewed. Leave changes in
> the working tree first.

Remaining opportunities after moving the API docs, guides, and shared docs infrastructure under
`docs/`. The sites deploy independently: `api/` to api.remix.run and `guides/` to guides.remix.run.

## Recommended order

1. Consolidate static assets.
2. Align configuration, dependencies, and maintenance docs.
3. Confirm the guides deployment model, then evaluate a shared server bootstrap.
4. Decide whether the sites should share the remaining product features.
5. Extract small markdown compatibility helpers.
6. Re-evaluate a shared document component after the smaller extractions.

## Consolidate static assets

The following files are byte-identical in both sites' `public/` directories:

- `icons.svg`
- `favicon.svg`
- `remix-logo-light-mode.svg`
- `remix-wordmark-light-mode.svg`

Move them to `docs/shared/assets/` and include that directory in each site's prerender `publicDirs`.
These files are an implicit contract of the shared `Icon`, `DocsHeader`, and `DocsFooter`
components, which reference them by absolute URL.

Keep API-only assets, such as `favicon.ico`, local. Confirm and delete the unreferenced API assets:

- `remix-wordmark-dark-mode.svg`
- `remix-wordmark-racing-darkmode.svg`
- `remix-wordmark-racing-lightmode.svg`

Document the asset contract and required `/docs-shared/*` asset mapping in
`docs/shared/README.md`.

## Align configuration, dependencies, and maintenance docs

- Add `docs/tsconfig.base.json` and extend it from the API, guides, and shared configs. Resolve the
  current drift: only guides includes `DOM.AsyncIterable`, API lacks `"types": ["node"]`, and API
  and guides duplicate the `remix/ui` JSX-runtime paths.
- Move independently pinned shared dependencies such as `shiki`, `github-slugger`, and
  `@types/hast` to the pnpm catalog.
- Align API frontmatter parsing on `gray-matter` when next touching its markdown pipeline; this
  removes the untyped default-export cast required by `front-matter`.
- Update `docs/guides/README.md`; its “Where things live” section still points to the old local
  docs shell.
- Add `docs/shared/README.md` covering ownership boundaries, asset mapping, and test commands.
- Add a short `docs/api/README.md` matching the guides README structure.

## Confirm guides deployment, then evaluate a shared server bootstrap

First determine where guides.remix.run deploys from and whether its Node server runs in
production. This affects whether server middleware differences matter and where Pagefind is pinned.

The local servers still duplicate `http.createServer`, `createRequestListener`, error handling,
port parsing, and graceful shutdown. If sharing remains useful, add a helper such as
`startDocsServer(router, { assetServer, devRefresh })` under `docs/shared/`. Guides needs its
refresh event stream in development; decide whether API should adopt that flow instead of relying
on `node --watch` restarts and manual browser reloads.

## Decide feature parity

- **Code-block copy buttons:** Guides has `code-block-copy.browser.tsx`; API code blocks have no
  copy affordance. If API should have one, move the component to `docs/shared/ui/` and adopt it in
  both sites.
- **Sidebar navigation indicator:** Guides animates the active sidebar item across navigations.
  API uses static active styles within grouped `<details>` sections. Decide whether this difference
  is intentional before sharing the behavior.

## Extract markdown compatibility helpers

Do not unify the markdown pipelines wholesale: API uses `marked` with symbol-linking extensions,
while guides uses unified/remark/rehype with directives and frames. The behavioral risk outweighs
removing the structural duplication.

Explore sharing the smaller compatibility points instead:

- Shiki theme and configuration
- Heading slug generation
- Heading `titleHtml` conventions

These helpers would keep rendered HTML compatible with shared styles without coupling the two
pipelines.

## Re-evaluate a shared document component

Both sites still hand-roll the same document skeleton: common metadata, favicon links, Pagefind
assets, module preloads, title, body, modal, and entry script. Their differences require extension
points:

- API: markdown alternate link, versioned-page robots directives, `favicon.ico`, and demo preloads
- Guides: development refresh script and asset-entry middleware

Consider a shared `DocsDocument` only if the remaining implementation is substantial after the
other extractions. Avoid an abstraction dominated by `head` and `bodyEnd` slots.
