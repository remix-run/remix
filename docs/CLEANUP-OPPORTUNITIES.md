# Docs De-duplication Opportunities

> Do not commit or push changes from this document until they have been reviewed. Leave changes in
> the working tree first.

Remaining opportunities after moving the API docs, guides, and shared docs infrastructure under
`docs/`. The sites deploy independently: `api/` to api.remix.run and `guides/` to guides.remix.run.

## Recommended order

1. Confirm the guides deployment model, then evaluate a shared server bootstrap.
2. Decide whether the sites should share the remaining product features.
3. Extract small markdown compatibility helpers.
4. Re-evaluate a shared document component after the smaller extractions.

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
removing the structural duplication. When next touching the API pipeline, replace `front-matter`
with `gray-matter` to remove its untyped default-export cast.

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
