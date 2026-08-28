# Remix API Reference

A generated reference site for the Remix 3 packages. TypeDoc data and package overviews become Markdown, which the server renders into searchable, optionally versioned static HTML.

The hand-authored guides live in [`../guides`](../guides). Shared docs UI, styles, search, assets, and prerendering live in [`../shared`](../shared).

## Where things live

- `app/actions/controller.tsx` — root asset, home, and API lookup actions.
- `app/actions/api/controller.tsx` — generated document and Markdown response actions.
- `app/actions/public/` — root-owned browser entrypoint and stylesheet sources.
- `app/assets.ts` — source asset server configured around colocated `public/` directories.
- `app/data/` — generated-document discovery, Markdown rendering, demos, and navigation registry data.
- `app/middleware/asset-entry.ts` and `render.ts` — request-scoped versioned asset hrefs and HTML rendering.
- `app/ui/document.tsx` — API-specific document metadata and content rendered with the shared docs shell.
- `app/routes.ts` and `app/router.ts` — typed route contract, middleware stack, controller wiring, and versioned route mounts.
- `app/utils/` — focused helpers shared with generation scripts.
- `scripts/generate/` — TypeDoc loading, API filtering, package overview discovery, and Markdown generation.
- `scripts/build-demos.ts` — discovers API examples and copies them into `build/demos/`.
- `scripts/prerender.ts` — static-site entrypoint and version-picker integration.
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

`docs` accepts `--entryPoints` to change the TypeDoc inputs or `--input` to reuse an existing TypeDoc JSON file. Build the discovered demos separately:

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

The development server listens on http://localhost:44100 by default. Set `PORT` to override.

## Static site

Generate Markdown and demos before prerendering a fresh checkout:

```sh
pnpm --filter remix-api run docs
pnpm --filter remix-api run build
pnpm --filter remix-api run prerender
```

Pass `--version` to emit version-prefixed routes and `--dir` to select the output directory. Shared and API-only public assets remain unversioned at the output root so one copy serves every generated version.
