# Shared docs infrastructure

`remix-docs-shared` contains infrastructure used by both `docs/api` and `docs/guides`. It is a private workspace package, not a standalone site.

## Ownership

- `assets/` — static files required by the shared UI.
- `prerender/` — crawling and static-output helpers.
- `search/` — Pagefind elements and browser behavior.
- `server.ts` — local Node server startup, request adaptation, errors, and graceful shutdown.
- `styles/` — shared tokens and docs-shell stylesheets.
- `ui/` — shared server-rendered components and browser behaviors.

Site-specific routes, document shells, content pipelines, styles, and static files stay in the owning site. For example, the API's `favicon.ico` remains in `docs/api/public/`. Repository README artwork lives in `.github/assets/` rather than either site's public directory.

## Asset contract

`Icon`, `DocsHeader`, and `DocsFooter` load the following root-relative URLs:

- `/icons.svg`
- `/remix-logo-light-mode.svg`
- `/remix-wordmark-light-mode.svg`

Both document shells also load `/favicon.svg`. These files live in `assets/`. Each site must:

1. Serve `assets/` as static files at the site root during development and server rendering.
2. Include `assets/` in the prerenderer's `publicDirs` so the files are copied to the static output root.
3. Keep the asset names stable when changing the shared components.

Shared browser modules and styles use a separate source-asset contract. Each site's Remix asset server must allow `docs/shared/**` and map `/docs-shared/*path` to `docs/shared/*path`. This produces browser URLs beneath the site's asset base, such as `/assets/docs-shared/ui/docs-shell.browser.tsx`; it does not replace the root-relative static asset URLs above.

## Commands

Run from the repository root:

```sh
pnpm --filter remix-docs-shared run test
pnpm --filter remix-docs-shared run typecheck
```

Changes consumed by a site should also be validated in that site:

```sh
pnpm --filter remix-api run test
pnpm --filter remix-api run typecheck
pnpm --filter remix-guides run test
pnpm --filter remix-guides run typecheck
```
