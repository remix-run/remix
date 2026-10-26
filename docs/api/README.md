# Remix API Reference

A generated reference site for the Remix 3 packages. TypeDoc data and package overviews become Markdown, which the server renders into searchable static HTML.

The hand-authored guides live in [`../guides`](../guides). Shared docs UI, styles, search, assets, and prerendering live in [`../shared`](../shared).

## Where things live

- `app/actions/controller.tsx` — root asset, home, and API lookup actions.
- `app/actions/api/controller.tsx` — generated document and Markdown response actions.
- `app/actions/public/` — root-owned browser entrypoint and stylesheet sources.
- `app/assets.ts` — source asset server configured around colocated `public/` directories.
- `app/data/` — generated-document discovery, Markdown rendering, demos, and navigation registry data.
- `app/middleware/asset-entry.ts` and `render.ts` — request-scoped asset hrefs and HTML rendering.
- `app/ui/document.tsx` — API-specific document metadata and content rendered with the shared docs shell.
- `app/routes.ts` and `app/router.ts` — typed route contract, middleware stack, and controller wiring.
- `app/utils/` — focused helpers shared with generation scripts.
- `scripts/generate/` — TypeDoc loading, API filtering, package overview discovery, and Markdown generation.
- `scripts/build-demos.ts` — discovers API examples and copies them into `build/demos/`.
- `scripts/prerender.ts` — static-site entrypoint.
- `server.ts` — local API docs server entrypoint.
- `public/` — API-only static files. Shared docs assets live in `../shared/assets/`.

Generated Markdown and demo files are written beneath `build/` and are not committed.

## Generating the reference

Generate Markdown from the workspace packages:

```sh
pnpm --filter remix-api run docs
```

Pass a release tag when generated source links should target that tag:

```sh
pnpm --filter remix-api run docs --tag remix@3.0.0
```

`docs` accepts `--entryPoints` to change the TypeDoc inputs or `--input` to reuse an existing TypeDoc JSON file.

Unsupported JSDoc `@link` targets emit warnings and render as plain text so reference generation can continue.

Build the discovered demos separately:

```sh
pnpm --filter remix-api run build
```

## Commands

Run from the repository root or from `docs/api/`:

```sh
pnpm --filter remix-api run dev             # build demos, then watch and serve
pnpm --filter remix-api run start           # serve once
pnpm --filter remix-api run prerender       # write build/site and build its Pagefind index
pnpm --filter remix-api run prerender:serve # serve the static output
pnpm --filter remix-api run test
pnpm --filter remix-api run typecheck
```

The development server listens on http://localhost:44100 by default. Set `PORT` to override. Edits to components, styles, browser modules, and `build/md/` show up in open pages without a refresh.

## Static site

Generate Markdown and demos before prerendering a fresh checkout:

```sh
pnpm --filter remix-api run docs
pnpm --filter remix-api run build
pnpm --filter remix-api run prerender
```

Pass `--dir` to select the output directory. The site documents a single release; older docs are available at their Git tags.
