# Docs De-duplication Opportunities

> Do not commit or push changes from this document until they have been reviewed. Leave changes in
> the working tree first.

Remaining opportunities after moving the API docs, guides, and shared docs infrastructure under
`docs/`. The sites deploy independently: `api/` to api.remix.run and `guides/` to guides.remix.run.

## Recommended order

1. Update the guides deployment repository after this restructure lands.
2. Extract small markdown compatibility helpers.
3. Re-evaluate a shared document component after the smaller extractions.

## Update the guides deployment repository

[`remix-run/remix-guides-docs`](https://github.com/remix-run/remix-guides-docs) prerenders the
guides and deploys the static output to GitHub Pages; the Node server does not run in production.
Its workflow still uploads `remix/guides/build/site`, and its README still links to `guides/` in
this repository. Update both paths to `docs/guides/` after this restructure lands. Pagefind is
installed from the catalog in this repository and runs during prerendering.

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
