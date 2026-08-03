# Remix API Reference

A generated reference site for the Remix 3 packages. TypeDoc data and package overviews become Markdown, which the server renders into searchable, optionally versioned static HTML.

The hand-authored guides live in [`../guides`](../guides). Shared docs UI, styles, search, assets, and prerendering live in [`../shared`](../shared).

## Where things live

- `src/generate/` — TypeDoc loading, API filtering, package overview discovery, and Markdown generation.
- `src/server/markdown.ts` — API Markdown discovery, metadata, versioned links, and symbol-link transforms built on the shared unified/remark/rehype pipeline.
- `src/server/registry.ts` and `routes.ts` — generated document lookup, navigation, and route definitions.
- `src/server/view.tsx` — API-specific document metadata and content rendered with the shared docs shell.
- `src/server/demos.tsx` and `src/generate/build-demos.ts` — API examples discovered from package source and copied into `build/demos/`.
- `src/client/entry.tsx` — browser entrypoint served by the asset server.
- `src/styles/docs.css` — stylesheet entrypoint for shared layers and the API-specific `api.css` layer.
- `src/prerender/` — static-site entrypoint and version-picker data.
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
pnpm --filter remix-api run serve           # serve once
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
